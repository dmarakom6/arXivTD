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