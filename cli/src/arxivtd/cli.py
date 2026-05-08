"""CLI interface for ArXivTD."""

import os
import sys
import json
import time
import threading
from pathlib import Path

import questionary
from questionary import Choice, Separator
import requests
import sys


def is_interactive() -> bool:
    return sys.stdin.isatty()


CONFIG_DIR = Path.home() / ".arxivtd"
CONFIG_FILE = CONFIG_DIR / "config.json"

API_BASE_URL = os.environ.get("ARXIVTD_API_URL", "https://arxivtd.com/api/v1")
RATE_LIMIT = 5
RATE_WINDOW = 1800

API_KEY_PROMPT = "Enter your API Key (from dashboard)"
GROBID_URL_PROMPT = "Enter Grobid URL"


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

_spinner_active = False
_spinner_thread = None


def _spinner_worker(message: str):
    symbols = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
    i = 0
    while _spinner_active:
        sys.stdout.write(f"\r{message} {symbols[i % len(symbols)]}")
        sys.stdout.flush()
        time.sleep(0.1)
        i += 1
    sys.stdout.write("\r" + " " * (len(message) + 3) + "\r")
    sys.stdout.flush()


class spinner:
    def __init__(self, message: str):
        self.message = message

    def __enter__(self):
        global _spinner_active, _spinner_thread
        _spinner_active = True
        _spinner_thread = threading.Thread(target=_spinner_worker, args=(self.message,))
        _spinner_thread.start()
        return self

    def __exit__(self, *args):
        global _spinner_active, _spinner_thread
        _spinner_active = False
        if _spinner_thread:
            _spinner_thread.join()


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

    print("\n+-------------------------------------------------+")
    print("|         ArXivTD CLI Setup                      |")
    print("+-------------------------------------------------+\n")

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
        return response.status_code == 200
    except:
        return False


def scan_arxiv(arxiv_id: str, mode: str = "basic"):
    api_key = require_config()
    url = f"{API_BASE_URL}/trust/{arxiv_id}?mode={mode}"

    credits = 3 if mode == "deep" else 1
    print(f"\n📄 Mode: {mode} ({credits} {'credits' if credits > 1 else 'credit'})")

    with spinner("Analyzing paper..."):
        try:
            headers = {"X-API-Key": api_key}
            response = requests.get(url, headers=headers)

            if response.status_code == 200:
                rate_limiter.record_request()
                result = response.json()

                output_file = Path.cwd() / f"{arxiv_id}.json"
                with open(output_file, "w") as f:
                    json.dump(result, f, indent=2)

                print(f"\n✅ Scan complete! Remaining: {rate_limiter.remaining()}/5\n")
                print(f"   Trust Score: {result.get('trust_score', 'N/A')}")
                print(f"   Paper:       {result.get('title', 'N/A')[:50]}...")
                print(f"   Saved to:    {output_file}")
                return result
            elif response.status_code == 402:
                print("\n❌ Insufficient credits.")
            elif response.status_code == 404:
                print(f"\n❌ Paper not found: {arxiv_id}")
            else:
                print(f"\n❌ Scan failed: {response.status_code}")
                try:
                    print(f"   {response.json().get('detail', 'Unknown error')}")
                except:
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

    with spinner("Analyzing PDF..."):
        try:
            with open(pdf_path, "rb") as f:
                files = {"file": (os.path.basename(pdf_path), f, "application/pdf")}
                headers = {"X-API-Key": api_key}
                response = requests.post(url, files=files, headers=headers)

            if response.status_code == 200:
                rate_limiter.record_request()
                result = response.json()

                scan_id = result.get("scan_id") or result.get("id") or "unknown"
                arxiv_id = result.get("arxiv_id", scan_id[:8])
                output_file = Path.cwd() / f"{arxiv_id}.json"
                with open(output_file, "w") as f:
                    json.dump(result, f, indent=2)

                print(f"\n✅ Scan complete! Remaining: {rate_limiter.remaining()}/5\n")
                print(f"   Trust Score: {result.get('trust_score', 'N/A')}")
                print(f"   Scan ID:     {scan_id}")
                print(f"   Saved to:    {output_file}")
                return result
            elif response.status_code == 402:
                print("\n❌ Insufficient credits.")
            else:
                print(f"\n❌ Scan failed: {response.status_code}")
                try:
                    print(f"   {response.json().get('detail', 'Unknown error')}")
                except:
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

    pdf_files = list(dir_path.glob("*.pdf"))
    if len(pdf_files) > 20:
        print(f"\n❌ Batch scanning limited to 20 PDFs at a time.")
        print(f"   Found {len(pdf_files)} PDFs. Split into smaller batches.")
        sys.exit(1)

    if len(pdf_files) <= 5:
        print(f"\n❌ Batch scanning only works with >5 PDFs.")
        print(f"   Found {len(pdf_files)} PDFs. Use 'arxivtd scan' instead.")
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
                response = requests.post(url, files=files, headers=headers, timeout=120)

            if response.status_code == 200:
                result = response.json()
                results.append(
                    {"file": pdf_file.name, "success": True, "result": result}
                )
                print(f"   ✅ Score: {result.get('trust_score', 'N/A')}")
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

    print(f"\n{'=' * 50}")
    print(
        f"  Batch Complete: {len([r for r in results if r['success']])}/{len(results)} successful"
    )
    print(f"{'=' * 50}")


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

    with spinner("Fetching citation graph..."):
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

    with spinner("Loading history..."):
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
        print(f"   {'ID':<30} {'Paper':<25} {'Score':<8} {'Date'}")
        print(f"   {'-' * 30} {'-' * 25} {'-' * 8} {'-' * 12}")

        for scan in scans[:10]:
            scan_id = scan.get("id", "")[:28]
            url = scan.get("url", "")
            paper = url.split("/")[-1] if url else "N/A"
            paper = paper[:23] + ".." if len(paper) > 25 else paper
            score = scan.get("result_json", {}).get("trust_score", "N/A")
            date = scan.get("created_at", "")[:10]

            print(f"   {scan_id:<30} {paper:<25} {score:<8} {date}")


def main():
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
  arxivtd batch <dir>      Scan multiple PDFs (>5 files)
  arxivtd graph <id>       Show citation graph
  arxivtd status           Show status and credits
  arxivtd history          Show scan history
  arxivtd keys             Manage API keys
  arxivtd --version        Show version
""")
        sys.exit(0)

    command = sys.argv[1]

    if command == "--version":
        print("ArXivTD CLI v0.1.0")
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
