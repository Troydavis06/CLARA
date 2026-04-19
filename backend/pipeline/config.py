import os
from dataclasses import dataclass, field
from pathlib import Path

# Resolve paths relative to repo root (two levels up from this file)
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Load .env from backend/ directory — works whether running via uvicorn or directly
_env_file = Path(__file__).parent.parent / ".env"
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())


def _data(path: str) -> str:
    return os.path.join(_REPO_ROOT, "data", path)


@dataclass
class Finding:
    id: str
    source_tool: str            # bandit | zap | npm-audit | osv-scanner
    source_target: str          # juice-shop | pygoat | impacket
    title: str
    description: str
    severity: str               # critical | high | medium | low | informational
    location: str               # filename:line, package@version, or alert name
    cwe: list[str] = field(default_factory=list)
    cve: str | None = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "source_tool": self.source_tool,
            "source_target": self.source_target,
            "title": self.title,
            "description": self.description,
            "severity": self.severity,
            "location": self.location,
            "cwe": self.cwe,
            "cve": self.cve,
        }


TARGETS: dict[str, dict] = {
    "pygoat": {
        "sast": _data("demo/sast_bandit.json"),
        "dast": _data("demo/dast_zap_pygoat.json"),
        "oss":  _data("demo/oss_vulns.json"),
        "sast_source": "pygoat",
        "dast_source": "pygoat",
        "oss_source":  "pygoat",
        "context": "Python/Django intentionally vulnerable web application (OWASP pygoat)",
        "stack": "Python 3.10 + Django 4.2 + SQLite",
        "threat_model": (
            "Externally-facing learning platform. No WAF. Django debug mode exposed. "
            "SQL injection present in login form. CSRF tokens missing on several forms."
        ),
    },
    "juice-shop": {
        "sast": None,
        "dast": _data("demo/dast_zap_juiceshop.json"),
        "oss":  _data("demo/oss_vulns.json"),
        "sast_source": None,
        "dast_source": "juice-shop",
        "oss_source":  "juice-shop",
        "context": "Node.js/Angular intentionally vulnerable e-commerce application (OWASP Juice Shop)",
        "stack": "Node.js 18 + Express + Angular + SQLite",
        "threat_model": (
            "Externally-facing e-commerce shop. No WAF. "
            "JWT verification bypass allows authentication without valid credentials. "
            "Prototype pollution in lodash. CORS misconfiguration allows cross-origin requests."
        ),
    },
    "impacket": {
        "sast": _data("demo/sast_bandit.json"),
        "dast": None,
        "oss":  _data("demo/oss_vulns.json"),
        "sast_source": "impacket",
        "dast_source": None,
        "oss_source":  "impacket",
        "context": "Python library for network protocols (SMB, Kerberos, NTLM) — Impacket",
        "stack": "Python 3.x + ctypes + OpenSSL bindings",
        "threat_model": (
            "Security tool / library used in penetration testing. "
            "Subprocess calls with shell=True. Weak crypto (MD5/DES) in legacy protocol implementations. "
            "Hardcoded credentials in example scripts."
        ),
    },
}

VALID_SURFACES = {
    "authentication",
    "data_access",
    "dependency_chain",
    "network_transport",
    "file_system",
    "session_management",
    "admin_interface",
}

SEVERITY_ORDER = ["critical", "high", "medium", "low", "informational"]

GOLDEN_DIR = _data("demo/golden")
OUTPUT_DIR = _data("output")
