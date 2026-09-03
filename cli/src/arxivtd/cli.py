"""CLI interface for ArXivTD."""

import os
import re
import sys
import json
import time
import threading
import xml.etree.ElementTree as ET
from pathlib import Path

import questionary
import requests
from questionary import Choice, Separator

_ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}


def _xml_first(elem: ET.Element, *tags: str) -> ET.Element | None:
    """Return the first child matching any tag using explicit None checks.

    XML elements that only contain text (no child elements) are falsy in
    Python (bool(Element) is False), so `a or b` chains on them silently
    yield None. This helper avoids that pitfall.
    """
    for tag in tags:
        found = elem.find(tag, _ATOM_NS)
        if found is not None:
            return found
    return None


def _xml_findall(elem: ET.Element, *tags: str) -> list[ET.Element]:
    """Return children matching any tag, preferring the first non-empty match."""
    for tag in tags:
        found = elem.findall(tag, _ATOM_NS)
        if found:
            return found
    return []


def is_interactive() -> bool:
    return sys.stdin.isatty()


CONFIG_DIR = Path.home() / ".arxivtd"
CONFIG_FILE = CONFIG_DIR / "config.json"
REPORTS_DIR = Path.home() / "arxivtd-reports"

DEFAULT_API_BASE_URL = "https://arxivtd.com/api/v1"
APP_URL = os.environ.get("ARXIVTD_APP_URL", "https://arxivtd.com")
RATE_LIMIT = 5
RATE_WINDOW = 1800

# Local dev backends probed when the default API host is unreachable
LOCAL_API_CANDIDATES = [
    "http://localhost:8005/api/v1",
    "http://127.0.0.1:8005/api/v1",
    "http://localhost:8000/api/v1",
    "http://localhost:8001/api/v1",
]

API_KEY_PROMPT = "Enter your API Key (from dashboard)"
GROBID_URL_PROMPT = "Enter Grobid URL"


def get_api_base_url() -> str:
    """Resolve the API base URL: env var > config file > remote default."""
    config = load_config()
    return (
        os.environ.get("ARXIVTD_API_URL")
        or config.get("api_url")
        or DEFAULT_API_BASE_URL
    )


def _is_host_local(url: str) -> bool:
    """Return True if the URL points at a loopback host."""
    host = url.split("//")[-1].split("/")[0].split(":")[0].lower()
    return host in ("localhost", "127.0.0.1", "0.0.0.0", "::1")


def _probe_url(url: str, timeout: float = 3.0) -> bool:
    """Return True if the host answers HTTP with any status code."""
    try:
        requests.get(url.rstrip("/") + "/keys", timeout=timeout)
        return True
    except requests.RequestException:
        return False


def ensure_api_reachable() -> None:
    """Make sure the configured API host is reachable; auto-detect local backend.

    Resolves the base URL (env var > config > remote default). If the resolved
    host is unreachable (e.g. no DNS for the pre-MVP remote default) and isn't a
    loopback address, probes common local dev ports and persists the first hit so
    future runs work without setting any env vars.
    """
    base_url = get_api_base_url()
    if _is_host_local(base_url) or _probe_url(base_url):
        return

    print(f"⚠️  Cannot reach API at {base_url}")
    for candidate in LOCAL_API_CANDIDATES:
        if _probe_url(candidate):
            config = load_config()
            config["api_url"] = candidate
            save_config(config)
            print(f"   Detected local backend at {candidate}")
            print("   (saved to ~/.arxivtd/config.json)")
            return

    print(
        "\n❌ No API backend reachable.\n"
        "   Start the backend, e.g.:\n"
        "       cd backend && uv run uvicorn app.main:app --port 8005\n"
        "   or point the CLI at a specific URL:\n"
        "       export ARXIVTD_API_URL=http://localhost:8005/api/v1"
    )
    sys.exit(1)

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

_ARXIV_ID_RE = re.compile(
    r"^(\d{4}\.\d{4,5}|[a-z\-]+/\d{7})(v\d+)?$"
)


def validate_arxiv_id(raw: str) -> str:
    """Validate and clean an arXiv ID. Exits on invalid input."""
    s = raw.strip()
    # Strip URL prefix (with or without protocol)
    s = re.sub(r"^(https?://)?arxiv\.org/abs/", "", s)
    s = re.sub(r"^(https?://)?arxiv\.org/pdf/", "", s)
    # Strip trailing .pdf
    s = re.sub(r"\.pdf$", "", s)
    # Strip trailing version if present for matching, then re-add
    m = _ARXIV_ID_RE.match(s)
    if m:
        return s
    # Also accept with version stripped for the regex
    base = re.sub(r"v\d+$", "", s)
    if _ARXIV_ID_RE.match(base):
        return s
    print(f"\n❌ Invalid arXiv ID: '{raw}'")
    print("   Expected format: YYMM.NNNNN (e.g. 2205.14135) or category/YYMMNNN (e.g. hep-th/9901001)")
    sys.exit(1)


def validate_pdf_path(raw: str) -> Path:
    """Validate a PDF file path. Exits on invalid input."""
    p = Path(raw).expanduser().resolve()
    if not p.exists():
        print(f"\n❌ File not found: {p}")
        sys.exit(1)
    if not p.suffix.lower() == ".pdf":
        print(f"\n❌ Not a PDF file: {p.name}")
        sys.exit(1)
    return p


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

        # Extract categories from the paper
        entry = _xml_first(root, "atom:entry", "entry")
        if entry is None:
            return []

        categories = []
        for cat in _xml_findall(entry, "atom:category", "category"):
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
        for e in _xml_findall(search_root, "atom:entry", "entry"):
            title_elem = _xml_first(e, "atom:title", "title")
            id_elem = _xml_first(e, "atom:id", "id")
            if title_elem is None or id_elem is None:
                continue
            title = title_elem.text.strip() if title_elem.text else ""
            paper_id = id_elem.text.strip() if id_elem.text else ""
            # Extract arXiv ID from URL
            if "/abs/" in paper_id:
                paper_id = paper_id.split("/abs/")[-1]
            # Strip version suffix (e.g. 2609.02005v1 → 2609.02005)
            def _strip_ver(arxid: str) -> str:
                return re.sub(r"v\d+$", "", arxid)
            if _strip_ver(paper_id) == _strip_ver(clean_id):
                continue
            authors = []
            for a in _xml_findall(e, "atom:author", "author"):
                name = _xml_first(a, "atom:name", "name")
                if name is not None and name.text:
                    authors.append(name.text.strip())
            papers.append({
                "title": title,
                "id": paper_id,
                "authors": authors[:3],
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
        self._similar_shown = False

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

            if not self._similar_shown:
                line = f"\r{self.message} {symbols[i % len(symbols)]}  elapsed: {elapsed_str}  ETA: {eta_str}"
                sys.stdout.write(line)
                sys.stdout.flush()
            time.sleep(0.1)
            i += 1

            # Show similar papers at 7 seconds (no quotes, no cursor tricks)
            if not self._similar_shown and elapsed >= 7 and self.arxiv_id:
                self._similar_shown = True
                similar = _fetch_similar_papers(self.arxiv_id)
                if similar:
                    # Clear spinner line
                    sys.stdout.write("\r\033[2K")
                    sys.stdout.flush()

                    # Print related papers as a clean block
                    print("   📚 While you wait, check out these related papers:")
                    for p in similar:
                        authors = ", ".join(p.get("authors") or [])
                        print(f"      • {p['title'][:70]}")
                        if authors:
                            print(f"        {authors[:70]}")
                        print(f"        https://arxiv.org/abs/{p['id']}")
                    sys.stdout.flush()

    def __enter__(self):
        self._active = True
        self._start_time = time.time()
        self._thread = threading.Thread(target=self._worker, daemon=True)
        self._thread.start()
        return self

    def __exit__(self, *args):
        self._active = False
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
    url = f"{get_api_base_url()}{endpoint}"
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

        api_url = questionary.text(
            "API URL",
            default=get_api_base_url(),
        ).ask() or get_api_base_url()

        s2_key = questionary.text(
            "Semantic Scholar API key (optional, for 0-credit basic scans)",
            default="",
        ).ask() or ""
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
        api_url = (
            input(f"API URL (default: {get_api_base_url()}): ").strip()
            or get_api_base_url()
        )
        s2_key = (
            input("Semantic Scholar API key (optional, for 0-credit basic scans): ").strip()
            or ""
        )

    config = load_config()
    config.setdefault("keys", {})[name] = {
        "api_key": api_key,
        "grobid_url": grobid_url,
        "s2_key": s2_key if s2_key else None,
    }
    config["active_key"] = name
    config["grobid_url"] = grobid_url
    config["api_url"] = api_url
    save_config(config)

    print(f"\n✅ Key '{name}' saved and activated!")
    print(f"   API Key: ...{api_key[-8:]}")
    print(f"   Grobid:   {grobid_url}")
    print(f"   API URL:  {api_url}")
    if s2_key:
        print(f"   S2 Key:   ...{s2_key[-4:]} (BYOK enabled)")
        # Set S2 key on backend
        try:
            resp = requests.post(
                f"{api_url}/user/s2-key",
                headers={"X-API-Key": api_key, "Content-Type": "application/json"},
                json={"s2_key": s2_key},
                timeout=10,
            )
            if resp.status_code == 200:
                print(f"   ✅ S2 key verified and saved on server")
            else:
                detail = resp.json().get("detail", "unknown error")
                print(f"   ⚠️  S2 key validation failed: {detail}")
                print(f"   You can set it later via the web dashboard")
        except Exception as e:
            print(f"   ⚠️  Could not reach server to set S2 key: {e}")
    else:
        print(f"   S2 Key:   not configured")


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


def get_byok_status() -> bool:
    """Query the server for BYOK (user S2 key) status.

    Returns True when the user has a Semantic Scholar API key stored
    server-side (basic scans are free; deep scans cost 2 credits). Fails
    safe to False if the server is unreachable or errors.
    """
    return get_s2_key_info()[0]


def get_s2_key_info() -> tuple[bool, str | None]:
    """Query the server for BYOK status and the S2 key preview.

    Returns (has_s2_key, preview). Fails safe to (False, None) if the
    server is unreachable or errors.
    """
    api_key = require_config()
    try:
        resp = requests.get(
            f"{get_api_base_url()}/user/s2-key",
            headers={"X-API-Key": api_key},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            return bool(data.get("has_s2_key", False)), data.get("s2_key_preview")
    except (requests.RequestException, ValueError):
        pass
    return False, None


def get_byok_status_display() -> str:
    """Human-readable S2 key status line for `arxivtd status`."""
    has_s2_key, preview = get_s2_key_info()
    if has_s2_key and preview:
        return f"...{preview[-4:]} (BYOK enabled)"
    if has_s2_key:
        return "(BYOK enabled)"
    return "not configured"


def scan_arxiv(arxiv_id: str, mode: str = "basic"):
    if mode == "deep" and not rate_limiter.can_proceed():
        print(f"\n❌ Rate limit exceeded. Maximum 5 scans per 30 minutes.")
        sys.exit(1)

    api_key = require_config()

    clean_id = validate_arxiv_id(arxiv_id)

    has_byok = get_byok_status()
    credits = 0 if (mode == "basic" and has_byok) else (2 if has_byok else (3 if mode == "deep" else 1))
    if credits == 0:
        print(f"\n📄 Mode: {mode} (0 credits (BYOK))")
    else:
        print(f"\n📄 Mode: {mode} ({credits} {'credits' if credits > 1 else 'credit'})")

    with SpinnerWithETA("Analyzing paper...", mode=mode, arxiv_id=clean_id):
        try:
            headers = {"X-API-Key": api_key}

            # 1. Start the async scan (returns immediately with a scan_id)
            start_url = f"{get_api_base_url()}/trust/{clean_id}/async?mode={mode}"
            response = requests.get(start_url, headers=headers, timeout=30)

            if response.status_code == 402:
                print("\n❌ Insufficient credits.")
                sys.exit(1)
            if response.status_code == 429:
                print("\n❌ Rate limited. Please wait and try again.")
                sys.exit(1)
            if response.status_code != 200:
                print(f"\n❌ Failed to start scan: {response.status_code}")
                try:
                    print(f"   {response.json().get('detail', 'Unknown error')}")
                except Exception:
                    pass
                sys.exit(1)

            scan_id = response.json().get("scan_id")
            if not scan_id:
                print("\n❌ No scan ID returned from server.")
                sys.exit(1)

            # 2. Poll until the scan completes (scans can take several minutes)
            status_url = f"{get_api_base_url()}/scans/{scan_id}/status"
            deadline = time.time() + 20 * 60  # 20 minute cap
            while time.time() < deadline:
                time.sleep(3)
                try:
                    status_resp = requests.get(status_url, headers=headers, timeout=30)
                except requests.RequestException:
                    continue
                if status_resp.status_code != 200:
                    continue
                status = status_resp.json()
                if status.get("status") == "completed":
                    break
                if status.get("status") == "failed":
                    print(f"\n❌ Scan failed: {status.get('error', 'Unknown error')}")
                    sys.exit(1)
            else:
                print("\n❌ Scan timed out after 20 minutes.")
                sys.exit(1)

            # 3. Fetch the full result
            result_url = f"{get_api_base_url()}/scans/{scan_id}"
            result_resp = requests.get(result_url, headers=headers, timeout=30)
            if result_resp.status_code != 200:
                print(f"\n❌ Failed to fetch scan result: {result_resp.status_code}")
                sys.exit(1)

            scan_data = result_resp.json()
            rate_limiter.record_request()

            result = dict(scan_data.get("result_json") or {})
            result["scan_id"] = scan_data.get("id", scan_id)
            result["trust_score"] = scan_data.get(
                "trust_score", result.get("trust_score")
            )
            result["credits_spent"] = scan_data.get("credits_spent")

            REPORTS_DIR.mkdir(parents=True, exist_ok=True)
            output_file = REPORTS_DIR / f"{clean_id}.json"
            with open(output_file, "w") as f:
                json.dump(result, f, indent=2)

            _print_scan_result(result, output_file)
            return result

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
    pdf_file = validate_pdf_path(pdf_path)
    url = f"{get_api_base_url()}/analyze/pdf?mode={mode}"

    has_byok = get_byok_status()
    credits = 0 if (mode == "basic" and has_byok) else (2 if has_byok else (3 if mode == "deep" else 1))
    if credits == 0:
        print(f"\n📄 Mode: {mode} (0 credits (BYOK))")
    else:
        print(f"\n📄 Mode: {mode} ({credits} {'credits' if credits > 1 else 'credit'})")

    with SpinnerWithETA("Analyzing PDF...", mode=mode):
        try:
            with open(pdf_file, "rb") as f:
                files = {"file": (pdf_file.name, f, "application/pdf")}
                headers = {"X-API-Key": api_key}
                response = requests.post(url, files=files, headers=headers, timeout=120)

            if response.status_code == 200:
                rate_limiter.record_request()
                result = response.json()

                scan_id = result.get("scan_id") or result.get("id") or "unknown"
                arxiv_id = result.get("arxiv_id", scan_id[:8])
                REPORTS_DIR.mkdir(parents=True, exist_ok=True)
                output_file = REPORTS_DIR / f"{arxiv_id}.json"
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

        url = f"{get_api_base_url()}/analyze/pdf?mode={mode}&is_batch=true"
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

    if not is_uuid:
        paper_id = validate_arxiv_id(paper_id)

    endpoint = (
        f"{get_api_base_url()}/graph/id/{paper_id}"
        if is_uuid
        else f"{get_api_base_url()}/graph/{paper_id}"
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
    print(f"   API URL:  {get_api_base_url()}")
    print(f"   Grobid:   {config.get('grobid_url', 'Not set')}")
    print(f"   S2 Key:   {get_byok_status_display()}")
    print(f"\n   Rate Limit: {RATE_LIMIT} scans per 30 minutes")
    print(f"   Remaining:  {rate_limiter.remaining()}/5")

    # Fetch credit balance from API
    try:
        headers = {"X-API-Key": active_key_data.get("api_key", "")}
        resp = requests.get(f"{get_api_base_url()}/credits/balance", headers=headers, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            print(f"\n   Credits:    {data['credits_balance']}")
            print(f"   Model:      {data['model_tier']}")
        else:
            print(f"\n   Credits:    (unavailable)")
    except Exception:
        print(f"\n   Credits:    (offline)")


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

    # Network commands need a reachable backend. Auto-detects a local dev
    # backend when the configured/default host is unreachable.
    if command in ("scan", "batch", "graph", "history"):
        ensure_api_reachable()

    if command == "init":
        init_cli()
    elif command == "keys":
        manage_keys()
    elif command == "scan":
        if len(sys.argv) < 3:
            print("Usage: arxivtd scan --pdf <file> OR --id <arxiv_id> [--deep]")
            sys.exit(1)

        mode = "deep" if ("--deep" in sys.argv or "-d" in sys.argv) else "basic"

        if "--pdf" in sys.argv or "-pdf" in sys.argv:
            flag = "--pdf" if "--pdf" in sys.argv else "-pdf"
            idx = sys.argv.index(flag)
            if idx + 1 >= len(sys.argv):
                print("Usage: arxivtd scan --pdf <file>")
                sys.exit(1)
            scan_pdf(sys.argv[idx + 1], mode)
        elif "--id" in sys.argv or "-id" in sys.argv:
            flag = "--id" if "--id" in sys.argv else "-id"
            idx = sys.argv.index(flag)
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
