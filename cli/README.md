# ArXivTD CLI

Free, open-source command-line tool for academic paper trust analysis.

## Installation

Install from source:

```bash
git clone https://github.com/dmarakom6/arXivTD
cd arXivTD/cli
pip install -e .
```

## Requirements

- Python 3.10+
- ArXivTD API key (free from [arxivtd.com](https://arxivtd.com))

## Setup

```bash
arxivtd init

# Prompts:
# - Enter your API Key (from dashboard)
# - Enter Grobid URL (e.g., http://localhost:8070)
# - Enter API URL (defaults to https://arxivtd.com/api/v1)
```

## API URL Resolution

The CLI resolves the backend URL in this order:

1. **Environment variable**: `ARXIVTD_API_URL` (e.g. `http://localhost:8005/api/v1`)
2. **Config file**: `~/.arxivtd/config.json` → `api_url` field (set via `arxivtd init`)
3. **Remote default**: `https://arxivtd.com/api/v1`

If the configured host is unreachable (no DNS, server down) and isn't a loopback
address, the CLI probes common local dev ports (`localhost:8005`, `8000`, `8001`)
and saves the first hit to `~/.arxivtd/config.json` for future runs.

Override for a single run without changing config:

```bash
ARXIVTD_API_URL=http://localhost:8005/api/v1 arxivtd scan --id 2608.18534
```

## Usage

```bash
# Initialize configuration
arxivtd init

# Scan by arXiv ID (no Grobid needed)
arxivtd scan --id 2205.14135
arxivtd scan --id 2205.14135 --deep   # 3 credits, full analysis

# Scan a PDF (requires Grobid running)
arxivtd scan --pdf paper.pdf
arxivtd scan --pdf paper.pdf --deep

# Scan multiple PDFs (6-20 files)
arxivtd batch ./papers/

# View citation graph (arXiv ID or S2 paper ID)
arxivtd graph 2205.14135
arxivtd graph 9a05df54-af6b-41ba-8a8e-ce74ff862902

# Show status and credits
arxivtd status

# View scan history (all keys)
arxivtd history

# Manage API keys
arxivtd keys

# Show version
arxivtd --version
```

## Rate Limits

- **5 scans per 30 minutes** (single scan mode)
- **Unlimited** (batch mode, 6-20 PDFs)

## Environment Variables

```bash
ARXIVTD_API_KEY=arxivid_xxx
ARXIVTD_GROBID_URL=http://localhost:8070
ARXIVTD_API_URL=http://localhost:8000/api/v1
```

## Uninstall

```bash
pip uninstall arxivtd
rm -rf ~/.arxivtd  # Remove config
```

## License

GPL License - See LICENSE file for details.