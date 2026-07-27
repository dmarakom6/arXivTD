"""CLI interface for ArXivTD."""

import os
import sys
import json
import time
import random
import threading
import xml.etree.ElementTree as ET
from pathlib import Path

import questionary
from questionary import Choice, Separator
import requests


def is_interactive() -> bool:
    return sys.stdin.isatty()


CONFIG_DIR = Path.home() / ".arxivtd"
CONFIG_FILE = CONFIG_DIR / "config.json"

API_BASE_URL = os.environ.get("ARXIVTD_API_URL", "https://arxivtd.com/api/v1")
APP_URL = os.environ.get("ARXIVTD_APP_URL", "https://arxivtd.com")
RATE_LIMIT = 5
RATE_WINDOW = 1800

API_KEY_PROMPT = "Enter your API Key (from dashboard)"
GROBID_URL_PROMPT = "Enter Grobid URL"

# Average scan times for ETA estimation (seconds)
AVG_SCAN_TIMES = {
    "basic": 15,
    "deep": 45,
}


class RateLimiter:
    def __init__(
        self, max_requests: int = RATE_LIMIT, window_seconds: int = RATE_WINDOW
    ):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = []

    def can_proceed(self) -> bool:
        now = time.time()
        self.requests = [t for t in self.requests if now - t < self.window_seconds]
        return len(self.requests) < self.max_requests

    def record_request(self):
        self.requests.append(time.time())

    def remaining(self) -> int:
        now = time.time()
        self.requests = [t for t in self.requests if now - t < self.window_seconds]
        return max(0, self.max_requests - len(self.requests))

    def reset(self):
        self.requests = []


rate_limiter = RateLimiter()


_LOCAL_QUOTES = [
    '"The only way to do great work is to love what you do." — Steve Jobs',
    '"In the middle of difficulty lies opportunity." — Albert Einstein',
    '"Talk is cheap. Show me the code." — Linus Torvalds',
    '"First, solve the problem. Then, write the code." — John Johnson',
    '"Any sufficiently advanced technology is indistinguishable from magic." — Arthur C. Clarke',
    '"Simplicity is the soul of efficiency." — Austin Freeman',
    '"Make it work, make it right, make it fast." — Kent Beck',
    '"Programs must be written for people to read." — Harold Abelson',
    '"The best error message is the one that never shows up." — Thomas Fuchs',
    '"Code is like humor. When you have to explain it, it\'s bad." — Cory House',
    '"Fix the cause, not the symptom." — Steve Maguire',
    '"Optimism is an occupational hazard of programming." — Kent Beck',
    '"Deleted code is debugged code." — Jeff Sickel',
    '"The most dangerous phrase is: We\'ve always done it this way." — Grace Hopper',
    '"Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away." — Antoine de Saint-Exupéry',
]


def _fetch_quote() -> str:
    """Fetch a random quote from a free API, falling back to local quotes."""
    apis = [
        ("https://dummyjson.com/quotes/random", lambda d: f'"{d["quote"]}" — {d["author"]}'),
        ("https://zenquotes.io/api/random", lambda d: f'"{d[0]["q"]}" — {d[0]["a"]}'),
        ("https://api.quotable.io/quotes/random", lambda d: f'"{d[0]["content"]}" — {d[0]["author"]}'),
    ]
    for url, parser in apis:
        try:
            resp = requests.get(url, timeout=3)
            if resp.status_code == 200:
                return parser(resp.json())
        except Exception:
            continue
    return random.choice(_LOCAL_QUOTES)


def _fetch_similar_papers(arxiv_id: str) -> list[dict]:
    """Fetch similar papers from arXiv API."""
    try:
        clean_id = arxiv_id.strip()
        if "/" in clean_id:
            clean_id = clean_id.split("/")[-1]

        resp = requests.get(
            f"https://export.arxiv.org/api/query",
            params={
                "id_list": clean_id,
            },
            headers={
                "User-Agent": "ArXivTD/1.0 (mailto:support@arxivtd.com)",
                "Accept": "application/atom+xml",
            },
            timeout=10,
        )

        if resp.status_code != 200 or not resp.text.strip():
            return []

        root = ET.fromstring(resp.text)
        ns = {"atom": "http://www.w3.org/2005/Atom"}

        # Extract categories from the paper
        entry = root.find("atom:entry", ns) or root.find("entry")
        if entry is None:
            return []

        categories = []
        for cat in entry.findall("atom:category", ns) or entry.findall("category"):
            term = cat.get("term")
            if term:
                categories.append(term)

        if not categories:
            return []

        # Search for related papers using the primary category
        search_query = f"cat:{categories[0]}"
        search_resp = requests.get(
            "https://export.arxiv.org/api/query",
            params={
                "search_query": search_query,
                "start": 0,
                "max_results": 5,
                "sortBy": "submittedDate",
                "sortOrder": "descending",
            },
            headers={
                "User-Agent": "ArXivTD/1.0 (mailto:support@arxivtd.com)",
                "Accept": "application/atom+xml",
            },
            timeout=10,
        )

        if search_resp.status_code != 200:
            return []

        search_root = ET.fromstring(search_resp.text)
        papers = []
        for e in search_root.findall("atom:entry", ns) or search_root.findall("entry"):
            title_elem = e.find("atom:title", ns) or e.find("title")
            id_elem = e.find("atom:id", ns) or e.find("id")
            if title_elem is not None and id_elem is not None:
                title = title_elem.text.strip() if title_elem.text else ""
                paper_id = id_elem.text.strip() if id_elem.text else ""
                # Extract arXiv ID from URL
                if "/abs/" in paper_id:
                    paper_id = paper_id.split("/abs/")[-1]
                # Skip the paper itself
                if paper_id == clean_id:
                    continue
                papers.append({
                    "title": title[:80],
                    "id": paper_id,
                })
                if len(papers) >= 3:
                    break

        return papers

    except Exception:
        return []


class SpinnerWithETA:
    """Spinner that shows elapsed time, ETA, and periodic quotes."""

    def __init__(self, message: str, mode: str = "basic", arxiv_id: str = ""):
        self.message = message
        self.mode = mode
        self.arxiv_id = arxiv_id
        self._active = False
        self._thread = None
        self._start_time = 0
        self._last_quote_time = 0
        self._quote_lines = 0
        self._similar_shown = False

    def _show_quote(self, quote: str):
        """Display a quote below the spinner, replacing any previous quote."""
        max_width = 70
        words = quote.split()
        wrapped = []
        current_line = "   💬 "
        for word in words:
            if len(current_line) + len(word) + 1 > max_width:
                wrapped.append(current_line)
                current_line = "      " + word
            else:
                current_line += " " + word if current_line.strip() else word
        wrapped.append(current_line)

        num_lines = len(wrapped)
        # Clear old quote area (move down with \n, clear each line)
        clear_lines = max(num_lines, self._quote_lines)
        if clear_lines == 0:
            clear_lines = 1  # At least one line for the quote
        for _ in range(clear_lines):
            sys.stdout.write("\n\033[2K")

        # Move back up to spinner line
        sys.stdout.write(f"\033[{clear_lines}A")

        # Print new quote: for each line, \n down then write text
        for ql in wrapped:
            sys.stdout.write(f"\n\033[2K\033[2m{ql}\033[0m")

        # Move back up to spinner line
        sys.stdout.write(f"\033[{num_lines}A")

        self._quote_lines = num_lines
        sys.stdout.flush()

    def _worker(self):
        symbols = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
        i = 0
        avg_time = AVG_SCAN_TIMES.get(self.mode, 20)

        while self._active:
            elapsed = time.time() - self._start_time
            elapsed_str = f"{int(elapsed)}s"

            # ETA calculation
            if elapsed < avg_time:
                eta = avg_time - elapsed
                eta_str = f"~{int(eta)}s"
            else:
                eta_str = "any moment"

            line = f"\r{self.message} {symbols[i % len(symbols)]}  elapsed: {elapsed_str}  ETA: {eta_str}"
            sys.stdout.write(line)
            sys.stdout.flush()
            time.sleep(0.1)
            i += 1

            # Show quote every 10 seconds (first quote after 3s)
            now = time.time()
            first_quote_shown = self._last_quote_time > 0
            if (not first_quote_shown and elapsed >= 3) or (first_quote_shown and now - self._last_quote_time >= 10):
                self._last_quote_time = now
                quote = _fetch_quote()
                if quote:
                    self._show_quote(quote)

            # Show similar papers at 15 seconds
            if not self._similar_shown and elapsed >= 15 and self.arxiv_id:
                self._similar_shown = True
                similar = _fetch_similar_papers(self.arxiv_id)
                if similar:
                    sys.stdout.write("\r" + " " * 80 + "\r")
                    print("   📚 While you wait, check out these related papers:")
                    for p in similar:
                        print(f"      • {p['title'][:65]}...")
                        print(f"        {APP_URL}/scans/new?id={p['id']}")
                    sys.stdout.flush()

    def __enter__(self):
        self._active = True
        self._start_time = time.time()
        self._thread = threading.Thread(target=self._worker, daemon=True)
        self._thread.start()
        return self

    def __exit__(self, *args):
        self._active = False
        # Cursor is on spinner line; clear spinner + quote lines below
        if self._quote_lines > 0:
            for _ in range(self._quote_lines):
                sys.stdout.write("\n\033[2K")
            sys.stdout.write(f"\033[{self._quote_lines}A")
        sys.stdout.write("\033[2K")
        sys.stdout.flush()
        if self._thread:
            self._thread.join()
        elapsed = time.time() - self._start_time
        sys.stdout.write("\r" + " " * 100 + "\r")
        sys.stdout.flush()


def load_config() -> dict:
    if not CONFIG_FILE.exists():
        return {}
    try:
        with open(CONFIG_FILE, "r") as f:
            config = json.load(f)
            if "api_key" in config and "keys" not in config:
                config["keys"] = {
                    "default": {
                        "api_key": config.pop("api_key"),
                        "grobid_url": config.get("grobid_url", "http://localhost:8070"),
                    }
                }
                config["active_key"] = "default"
                save_config(config)
            return config
    except (json.JSONDecodeError, IOError):
        return {}


def save_config(config: dict):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


def get_active_key() -> str | None:
    config = load_config()
    active_name = config.get("active_key")
    keys = config.get("keys", {})
    if active_name and active_name in keys:
        return keys[active_name].get("api_key")
    return os.environ.get("ARXIVTD_API_KEY")


def get_grobid_url() -> str:
    config = load_config()
    return config.get("grobid_url") or os.environ.get(
        "ARXIVTD_GROBID_URL", "http://localhost:8070"
    )


def require_config():
    api_key = get_active_key()
    if not api_key:
        print(
            "\n❌ No active API key. Run 'arxivtd init' or 'arxivtd keys' to add one."
        )
        sys.exit(1)
    return api_key


def api_request(method: str, endpoint: str, **kwargs) -> requests.Response:
    api_key = require_config()
    url = f"{API_BASE_URL}{endpoint}"
    headers = {"X-API-Key": api_key}
    if "headers" not in kwargs:
        kwargs["headers"] = {}
    kwargs["headers"].update(headers)

    try:
        response = requests.request(method, url, **kwargs)
        return response
    except requests.RequestException as e:
        print(f"\n❌ API request failed: {e}")
        sys.exit(1)


def init_cli():
    config = load_config()
    keys = config.get("keys", {})

    print("\n+---------------------------------------------------+")
    print("|            ArXivTD CLI Setup                      |")
    print("+---------------------------------------------------+\n")

    if keys:
        print("📌 You already have keys configured:")
        for name, data in keys.items():
            marker = " ●" if name == config.get("active_key") else " ○"
            print(f"   {marker} {name}: ...{data.get('api_key', '')[-8:]}")
        print()

        if not is_interactive():
            print("Run 'arxivtd keys' to manage keys interactively.")
            return

        action = questionary.select(
            "What would you like to do?",
            choices=[
                Choice("Add a new API key", "add"),
                Choice("Switch to a different key", "switch"),
                Choice("Manage keys (add/remove/switch)", "manage"),
                Choice("Exit", "exit"),
            ],
        ).ask()

        if action in ("add", "manage"):
            manage_keys()
        elif action == "switch":
            switch_key()
        return

    add_key_flow()


def add_key_flow():
    print("Get your API key from: https://arxivtd.com/dashboard\n")

    if is_interactive():
        api_key = questionary.text(
            "Enter your API Key",
            validate=lambda x: len(x) > 10 or "Invalid key format",
        ).ask()

        if not api_key:
            print("❌ API key is required.")
            sys.exit(1)

        name = questionary.text(
            "Name this key (e.g., 'work', 'personal', 'prod')",
            default="default",
        ).ask()

        grobid_url = questionary.text(
            "Grobid URL",
            default="http://localhost:8070",
        ).ask()
    else:
        api_key = input("Enter your API Key: ").strip()
        if not api_key:
            print("❌ API key is required.")
            sys.exit(1)
        name = input("Name this key (default: default): ").strip() or "default"
        grobid_url = (
            input("Grobid URL (default: http://localhost:8070): ").strip()
            or "http://localhost:8070"
        )

    config = load_config()
    config.setdefault("keys", {})[name] = {
        "api_key": api_key,
        "grobid_url": grobid_url,
    }
    config["active_key"] = name
    config["grobid_url"] = grobid_url
    save_config(config)

    print(f"\n✅ Key '{name}' saved and activated!")
    print(f"   API Key: ...{api_key[-8:]}")
    print(f"   Grobid:   {grobid_url}")


def manage_keys():
    config = load_config()
    keys = config.get("keys", {})

    if not keys:
        print("\n❌ No keys found. Adding one now...")
        add_key_flow()
        return

    if not is_interactive():
        print("\n📌 Configured keys:")
        for name, data in keys.items():
            marker = "●" if name == config.get("active_key") else "○"
            print(f"   {marker} {name}: ...{data.get('api_key', '')[-8:]}")
        print("\nRun in interactive mode to add/remove/switch keys.")
        return

    choices = []
    for name, data in keys.items():
        marker = " ●" if name == config.get("active_key") else " ○"
        choices.append(
            Choice(f"{marker} {name} (...{data.get('api_key', '')[-6:]})", name)
        )
    choices.append(Separator())
    choices.append(Choice("＋ Add new key", "add"))
    choices.append(Choice("✕ Remove a key", "remove"))

    action = questionary.select(
        "Manage your API keys",
        choices=choices,
    ).ask()

    if action == "add":
        add_key_flow()
    elif action == "remove":
        remove_key()
    elif action:
        switch_key(action)


def remove_key():
    config = load_config()
    keys = config.get("keys", {})

    if len(keys) <= 1:
        print("❌ Cannot remove the last key. Add another one first.")
        return

    choices = [
        Choice(name, name) for name in keys.keys() if name != config.get("active_key")
    ]
    if not choices:
        print("❌ No other keys to remove.")
        return

    to_remove = questionary.select(
        "Select key to remove",
        choices=choices,
    ).ask()

    if questionary.confirm(f"Remove key '{to_remove}'?").ask():
        del keys[to_remove]
        config["keys"] = keys
        if config.get("active_key") == to_remove:
            config["active_key"] = list(keys.keys())[0]
            config["grobid_url"] = keys[config["active_key"]].get(
                "grobid_url", "http://localhost:8070"
            )
        save_config(config)
        print(f"✅ Key '{to_remove}' removed.")


def switch_key(key_name: str = None):
    config = load_config()
    keys = config.get("keys", {})

    if not keys:
        print("❌ No keys configured.")
        return

    if key_name is None:
        choices = [
            Choice(f"{'●' if name == config.get('active_key') else '○'} {name}", name)
            for name in keys.keys()
        ]
        key_name = questionary.select(
            "Select active key",
            choices=choices,
        ).ask()

    if key_name and key_name in keys:
        config["active_key"] = key_name
        config["grobid_url"] = keys[key_name].get("grobid_url", "http://localhost:8070")
        save_config(config)
        print(f"✅ Switched to key '{key_name}'")


def check_grobid() -> bool:
    """Check if Grobid is available."""
    grobid_url = get_grobid_url()
    try:
        response = requests.get(f"{grobid_url}/api/health", timeout=5)
        if response.status_code == 200:
            return True
    except Exception:
        pass
    try:
        response = requests.get(f"{grobid_url}/api/status", timeout=5)
        return response.status_code == 200
    except Exception:
        return False


def _print_scan_result(result: dict, output_file: Path | None = None):
    """Print scan results in a nice format."""
    trust_score = result.get("trust_score", "N/A")
    title = (result.get("title") or "N/A")[:60]
    scan_id = result.get("scan_id", "")
    mode = result.get("scan_mode", "basic")
    citations = result.get("citations_validated", {})
    flags = result.get("flags", [])

    # Color code the score
    if isinstance(trust_score, (int, float)):
        if trust_score >= 80:
            score_str = f"\033[92m{trust_score}\033[0m"  # green
        elif trust_score >= 60:
            score_str = f"\033[93m{trust_score}\033[0m"  # yellow
        else:
            score_str = f"\033[91m{trust_score}\033[0m"  # red
    else:
        score_str = str(trust_score)

    print(f"\n{'=' * 60}")
    print(f"  ✅ Scan Complete")
    print(f"{'=' * 60}")
    print(f"  Title:          {title}")
    print(f"  Trust Score:    {score_str}")
    print(f"  Mode:           {mode}")

    if citations:
        total = citations.get("total", 0)
        found = citations.get("found", 0)
        missing = citations.get("missing", 0)
        rate = citations.get("hallucination_rate", 0)
        print(f"  Citations:      {found}/{total} verified ({missing} missing, {rate:.1%} anomaly)")

    if flags:
        print(f"  Flags:          {len(flags)} alerts")
        for f in flags[:3]:
            sev = f.get("severity", "medium")
            msg = f.get("message", "")[:55]
            icon = "🔴" if sev == "high" else "🟡"
            print(f"    {icon} {msg}")

    if scan_id:
        print(f"  View:           {APP_URL}/scans/{scan_id}")

    if output_file:
        print(f"  Saved to:       {output_file}")

    print(f"{'=' * 60}")


def scan_arxiv(arxiv_id: str, mode: str = "basic"):
    if mode == "deep" and not rate_limiter.can_proceed():
        print(f"\n❌ Rate limit exceeded. Maximum 5 scans per 30 minutes.")
        sys.exit(1)

    api_key = require_config()
    url = f"{API_BASE_URL}/trust/{arxiv_id}?mode={mode}"

    credits = 3 if mode == "deep" else 1
    print(f"\n📄 Mode: {mode} ({credits} {'credits' if credits > 1 else 'credit'})")

    with SpinnerWithETA("Analyzing paper...", mode=mode, arxiv_id=arxiv_id):
        try:
            headers = {"X-API-Key": api_key}
            response = requests.get(url, headers=headers, timeout=120)

            if response.status_code == 200:
                rate_limiter.record_request()
                result = response.json()

                output_file = Path.cwd() / f"{arxiv_id}.json"
                with open(output_file, "w") as f:
                    json.dump(result, f, indent=2)

                _print_scan_result(result, output_file)
                return result
            elif response.status_code == 402:
                print("\n❌ Insufficient credits.")
            elif response.status_code == 404:
                print(f"\n❌ Paper not found: {arxiv_id}")
            else:
                print(f"\n❌ Scan failed: {response.status_code}")
                try:
                    print(f"   {response.json().get('detail', 'Unknown error')}")
                except Exception:
                    pass
                sys.exit(1)

        except requests.RequestException as e:
            print(f"\n❌ Request failed: {e}")
            sys.exit(1)


def scan_pdf(pdf_path: str, mode: str = "basic"):
    if not check_grobid():
        print(f"\n❌ Grobid is not running at {get_grobid_url()}")
        print("   Start Grobid or use 'arxivtd scan --id <arxiv_id>' instead.")
        sys.exit(1)

    if mode == "deep" and not rate_limiter.can_proceed():
        print(f"\n❌ Rate limit exceeded. Maximum 5 scans per 30 minutes.")
        sys.exit(1)

    api_key = require_config()
    url = f"{API_BASE_URL}/analyze/pdf?mode={mode}"

    credits = 3 if mode == "deep" else 1
    print(f"\n📄 Mode: {mode} ({credits} {'credits' if credits > 1 else 'credit'})")

    if not os.path.exists(pdf_path):
        print(f"\n❌ PDF not found: {pdf_path}")
        sys.exit(1)

    with SpinnerWithETA("Analyzing PDF...", mode=mode):
        try:
            with open(pdf_path, "rb") as f:
                files = {"file": (os.path.basename(pdf_path), f, "application/pdf")}
                headers = {"X-API-Key": api_key}
                response = requests.post(url, files=files, headers=headers, timeout=120)

            if response.status_code == 200:
                rate_limiter.record_request()
                result = response.json()

                scan_id = result.get("scan_id") or result.get("id") or "unknown"
                arxiv_id = result.get("arxiv_id", scan_id[:8])
                output_file = Path.cwd() / f"{arxiv_id}.json"
                with open(output_file, "w") as f:
                    json.dump(result, f, indent=2)

                _print_scan_result(result, output_file)
                return result
            elif response.status_code == 402:
                print("\n❌ Insufficient credits.")
            else:
                print(f"\n❌ Scan failed: {response.status_code}")
                try:
                    print(f"   {response.json().get('detail', 'Unknown error')}")
                except Exception:
                    pass
                sys.exit(1)

        except requests.RequestException as e:
            print(f"\n❌ Request failed: {e}")
            sys.exit(1)


def batch_scan(directory: str, mode: str = "basic"):
    dir_path = Path(directory)
    if not dir_path.is_dir():
        print(f"\n❌ Not a directory: {directory}")
        sys.exit(1)

    pdf_files = sorted(dir_path.glob("*.pdf"))
    if len(pdf_files) > 20:
        print(f"\n❌ Batch scanning limited to 20 PDFs at a time.")
        print(f"   Found {len(pdf_files)} PDFs. Split into smaller batches.")
        sys.exit(1)

    if len(pdf_files) < 5:
        print(f"\n❌ Batch scanning requires at least 5 PDFs.")
        print(f"   Found {len(pdf_files)} PDFs in {directory}")
        sys.exit(1)

    if len(pdf_files) == 0:
        print(f"\n❌ No PDF files found in {directory}")
        sys.exit(1)

    api_key = require_config()
    grobid_url = get_grobid_url()

    print(f"\n📁 Found {len(pdf_files)} PDFs")
    print(f"   Mode: {mode}")
    print(f"   Grobid: {grobid_url}")
    print(f"   Rate limits: Bypassed (batch mode)\n")

    results = []
    for i, pdf_file in enumerate(pdf_files, 1):
        print(f"[{i}/{len(pdf_files)}] Scanning: {pdf_file.name}")

        url = f"{API_BASE_URL}/analyze/pdf?mode={mode}&is_batch=true"
        try:
            with open(pdf_file, "rb") as f:
                files = {"file": (pdf_file.name, f, "application/pdf")}
                headers = {"X-API-Key": api_key}
                response = requests.post(url, files=files, headers=headers, timeout=180)

            if response.status_code == 200:
                result = response.json()
                results.append(
                    {"file": pdf_file.name, "success": True, "result": result}
                )
                score = result.get("trust_score", "N/A")
                title = (result.get("title") or "")[:40]
                print(f"   ✅ Score: {score}  {title}")
            elif response.status_code == 402:
                results.append(
                    {"file": pdf_file.name, "success": False, "error": "Insufficient credits"}
                )
                print(f"   ❌ Insufficient credits")
            else:
                results.append(
                    {
                        "file": pdf_file.name,
                        "success": False,
                        "error": f"HTTP {response.status_code}",
                    }
                )
                print(f"   ❌ Failed: {response.status_code}")

        except Exception as e:
            results.append({"file": pdf_file.name, "success": False, "error": str(e)})
            print(f"   ❌ Error: {e}")

    print(f"\n{'=' * 60}")
    success = [r for r in results if r["success"]]
    print(f"  Batch Complete: {len(success)}/{len(results)} successful")
    if success:
        scores = [r["result"]["trust_score"] for r in success if r["result"].get("trust_score")]
        if scores:
            avg = sum(scores) / len(scores)
            print(f"  Average Trust Score: {avg:.1f}")
    print(f"{'=' * 60}")

    output_file = dir_path / "batch_results.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"  Results saved to: {output_file}")


def show_graph(paper_id: str):
    api_key = require_config()

    # Auto-detect: if it looks like a UUID/S2 ID, use /graph/id endpoint
    is_uuid = len(paper_id) == 36 and paper_id.count("-") == 5

    endpoint = (
        f"{API_BASE_URL}/graph/id/{paper_id}"
        if is_uuid
        else f"{API_BASE_URL}/graph/{paper_id}"
    )
    label = f"S2:{paper_id[:8]}..." if is_uuid else f"arXiv:{paper_id}"

    with SpinnerWithETA("Fetching citation graph..."):
        try:
            headers = {"X-API-Key": api_key}
            response = requests.get(endpoint, headers=headers, timeout=30)

            if response.status_code == 200:
                data = response.json()
                nodes = data.get("nodes", [])
                edges = data.get("edges", [])

                print(f"\n📊 Citation Graph for {label}")
                print(f"   Source: {data.get('source', {}).get('title', 'N/A')}")
                print(f"   Nodes:  {len(nodes)}")
                print(f"   Edges:  {len(edges)}\n")

                print("  Connected Papers:")
                for node in nodes[1:6]:
                    year = node.get("year", "N/A")
                    citations = node.get("citation_count", 0)
                    title = node.get("title", "Unknown")[:50]
                    print(f"   • {title}... ({year}) - {citations} citations")

            elif response.status_code == 404:
                print(f"\n❌ Paper not found in Semantic Scholar: {paper_id}")
            else:
                print(f"\n❌ Failed to fetch graph: {response.status_code}")

        except requests.RequestException as e:
            print(f"\n❌ Request failed: {e}")


def show_status():
    config = load_config()
    keys = config.get("keys", {})
    active = config.get("active_key")

    print("\n╔══════════════════════════════════════════════════╗")
    print("║                  ArXivTD Status                  ║")
    print("╚══════════════════════════════════════════════════╝")

    if not keys:
        print("\n❌ Not configured. Run 'arxivtd init'")
        return

    active_key_data = keys.get(active, {})
    print(f"\n   Active Key: {active}")
    print(f"   API Key: ...{active_key_data.get('api_key', '')[-8:]}")
    print(f"   Grobid:  {config.get('grobid_url', 'Not set')}")
    print(f"\n   Rate Limit: {RATE_LIMIT} scans per 30 minutes")
    print(f"   Remaining:  {rate_limiter.remaining()}/5")
    print(f"\n   Note: Credit balance requires web dashboard")


def show_history():
    require_config()

    with SpinnerWithETA("Loading history..."):
        response = api_request("GET", "/scans")

        if response.status_code != 200:
            print(f"\n❌ Failed to load history: {response.status_code}")
            return

        data = response.json()
        scans = data.get("scans") or data.get("items", [])

        if not scans:
            print("\n📭 No scan history found.")
            return

        print(f"\n📜 Scan History ({len(scans)} scans)\n")

        for i, scan in enumerate(scans[:15], 1):
            scan_id = scan.get("id", "")[:8]
            url = scan.get("url", "")
            paper_id = url.split("/")[-1] if url else "N/A"

            result_json = scan.get("result_json") or {}
            title = result_json.get("title", "")[:50] or paper_id
            score = result_json.get("trust_score", "N/A")
            mode = result_json.get("scan_mode", "?")
            date = scan.get("created_at", "")[:10]
            credits = scan.get("credits_spent", "?")

            # Color code score
            if isinstance(score, (int, float)):
                if score >= 80:
                    score_str = f"\033[92m{score}\033[0m"
                elif score >= 60:
                    score_str = f"\033[93m{score}\033[0m"
                else:
                    score_str = f"\033[91m{score}\033[0m"
            else:
                score_str = str(score)

            print(f"  {i:>2}. [{date}] {mode:>5} | Score: {score_str:>20} | {credits} cr")
            print(f"      {title}")
            print(f"      {APP_URL}/scans/{scan.get('id', '')}")
            if i < len(scans[:15]):
                print()


def main():
    try:
        _main()
    except KeyboardInterrupt:
        print("\n")
        sys.exit(130)


def _main():
    if len(sys.argv) < 2:
        print("""
+---------------------------------------------------+
|         ArXivTD CLI - Academic Paper Trust        |
|                    Analysis Tool                  |
+---------------------------------------------------+

Commands:
  arxivtd init              Configure CLI (first time)
  arxivtd scan --pdf <path> Scan PDF (requires Grobid)
  arxivtd scan --id <arXiv> Scan by arXiv ID (no Grobid needed)
  arxivtd scan --deep       Use deep mode (3 credits)
  arxivtd batch <dir>       Scan multiple PDFs
  arxivtd graph <id>        Show citation graph
  arxivtd history           Show scan history
  arxivtd status            Show status and credits
  arxivtd keys              Manage API keys
  arxivtd --version         Show version
""")
        sys.exit(0)

    command = sys.argv[1]

    if command == "--version":
        print("ArXivTD CLI v0.2.0")
        sys.exit(0)

    if command == "init":
        init_cli()
    elif command == "keys":
        manage_keys()
    elif command == "scan":
        if len(sys.argv) < 3:
            print("Usage: arxivtd scan --pdf <file> OR --id <arxiv_id> [--deep]")
            sys.exit(1)

        mode = "deep" if "--deep" in sys.argv else "basic"

        if "--pdf" in sys.argv:
            idx = sys.argv.index("--pdf")
            if idx + 1 >= len(sys.argv):
                print("Usage: arxivtd scan --pdf <file>")
                sys.exit(1)
            scan_pdf(sys.argv[idx + 1], mode)
        elif "--id" in sys.argv:
            idx = sys.argv.index("--id")
            if idx + 1 >= len(sys.argv):
                print("Usage: arxivtd scan --id <arxiv_id>")
                sys.exit(1)
            scan_arxiv(sys.argv[idx + 1], mode)
        else:
            print("Usage: arxivtd scan --pdf <file> OR --id <arxiv_id>")
            sys.exit(1)
    elif command == "batch":
        if len(sys.argv) < 3:
            print("Usage: arxivtd batch <directory>")
            sys.exit(1)
        batch_scan(sys.argv[2])
    elif command == "graph":
        if len(sys.argv) < 3:
            print("Usage: arxivtd graph <arxiv_id>")
            sys.exit(1)
        show_graph(sys.argv[2])
    elif command == "status":
        show_status()
    elif command == "history":
        show_history()
    else:
        print(f"Unknown command: {command}")
        print("Run 'arxivtd' for usage information")
        sys.exit(1)


if __name__ == "__main__":
    main()
