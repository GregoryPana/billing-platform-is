#!/usr/bin/env python3
"""Fail on machine-detectable design-system anti-patterns."""
from __future__ import annotations

import argparse
import fnmatch
import json
import re
from dataclasses import dataclass
from pathlib import Path

EXTENSIONS = {".css", ".scss", ".sass", ".less", ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".html", ".json"}
IGNORED_PARTS = {".git", "node_modules", "dist", "build", ".next", ".nuxt", "coverage", "vendor"}
ACTIVE = r"(?:active|selected|current|aria-selected|aria-current|data-\[state(?:=|:)active\]|data-state\s*=\s*[\"']active)"
SIDE_BORDER = r"(?:border-(?:l|r|s|e)(?:-|\b)|border(?:Left|Right|InlineStart|InlineEnd)|border-(?:left|right|inline-start|inline-end))"

RULES = {
    "DS001": re.compile(r"(?i)(?<![\w-])(?:Inter|Geist|DM\s*Sans|Plus\s*Jakarta\s*Sans|Poppins|Manrope)(?![\w-])"),
    "DS002": re.compile(r"(?i)(?:lucide(?:-react|-vue(?:-next)?|-svelte|-preact)?|from\s*[\"']lucide[^\"']*[\"'])"),
    "DS003": re.compile(r"\b(?:IconSparkles2?(?:Filled|Off)?|IconStars(?:Filled|Off)?|Sparkles|Stars|WandSparkles|StarBurst|Starburst)\b"),
    "DS004": re.compile(rf"(?i)(?=.*{ACTIVE})(?=.*{SIDE_BORDER}).*"),
}

MESSAGES = {
    "DS001": "prohibited default typeface; use IBM Plex Sans, Public Sans, Work Sans, Archivo, or an approved project font",
    "DS002": "Lucide reference; product UI uses Tabler Icons",
    "DS003": "sparkles/stars/star-burst icon requires removal or a narrow approved non-AI exception",
    "DS004": "active/selected/current state uses a lateral border accent",
    "DS005": "active/selected/current CSS block uses a lateral border accent",
}

@dataclass(frozen=True)
class Finding:
    rule: str
    path: str
    line: int
    excerpt: str


def load_config(root: Path) -> dict:
    path = root / ".design-conformance.json"
    if not path.exists():
        return {"exclude": [], "allow": {}}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {"exclude": data.get("exclude", []), "allow": data.get("allow", {})}


def is_excluded(rel: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatch(rel, pattern) for pattern in patterns)


def iter_files(root: Path, requested: list[str], excludes: list[str]):
    seen: set[Path] = set()
    candidates = [Path(p) if Path(p).is_absolute() else root / p for p in requested] if requested else [root]
    for candidate in candidates:
        pool = [candidate] if candidate.is_file() else candidate.rglob("*") if candidate.exists() else []
        for path in pool:
            if not path.is_file() or path.suffix.lower() not in EXTENSIONS:
                continue
            try:
                rel = path.resolve().relative_to(root.resolve()).as_posix()
            except ValueError:
                rel = path.resolve().as_posix()
            if any(part in IGNORED_PARTS for part in path.parts) or is_excluded(rel, excludes) or path in seen:
                continue
            seen.add(path)
            yield path, rel


def allowed(finding: Finding, allow: dict) -> bool:
    target = f"{finding.path}:{finding.line}:{finding.excerpt}"
    return any(re.search(pattern, target) for pattern in allow.get(finding.rule, []))


def scan_file(path: Path, rel: str) -> list[Finding]:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return []
    findings: list[Finding] = []
    lines = text.splitlines()
    for number, line in enumerate(lines, 1):
        for rule, pattern in RULES.items():
            if pattern.search(line):
                findings.append(Finding(rule, rel, number, line.strip()[:240]))
    if path.suffix.lower() in {".css", ".scss", ".sass", ".less"}:
        block = re.compile(rf"(?is)([^{{}}]*{ACTIVE}[^{{}}]*)\{{([^{{}}]*)\}}")
        declaration = re.compile(r"(?i)border-(?:left|right|inline-start|inline-end)\s*:")
        for match in block.finditer(text):
            hit = declaration.search(match.group(2))
            if hit:
                absolute = match.start(2) + hit.start()
                number = text.count("\n", 0, absolute) + 1
                excerpt = lines[number - 1].strip()[:240] if number <= len(lines) else ""
                findings.append(Finding("DS005", rel, number, excerpt))
    return findings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="*", help="Files/directories relative to --root; default is root")
    parser.add_argument("--root", default=".", help="Project root containing optional .design-conformance.json")
    args = parser.parse_args(argv)
    root = Path(args.root).resolve()
    config = load_config(root)
    findings: list[Finding] = []
    for path, rel in iter_files(root, args.paths, config["exclude"]):
        findings.extend(scan_file(path, rel))
    findings = sorted(set(findings), key=lambda f: (f.path, f.line, f.rule))
    findings = [finding for finding in findings if not allowed(finding, config["allow"])]
    if findings:
        for finding in findings:
            print(f"{finding.path}:{finding.line}: {finding.rule} {MESSAGES[finding.rule]}\n  {finding.excerpt}")
        print(f"FAIL: {len(findings)} design-conformance violation(s)")
        return 1
    print("PASS: no machine-detectable design-conformance violations")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
