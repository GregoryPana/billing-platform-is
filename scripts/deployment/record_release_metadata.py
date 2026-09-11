"""Write the per-release ledger file read back by the rollback workflow.

Kept as a small standalone, testable script (rather than an inline
workflow heredoc) because rollback's schema-compatibility check depends on
parsing this file's `migration_revision` field correctly.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release-dir", required=True, type=Path)
    parser.add_argument("--sha", required=True)
    parser.add_argument("--migration-revision", required=True)
    parser.add_argument("--deployed-at", required=True)
    parser.add_argument("--actor", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--run-url", required=True)
    args = parser.parse_args()

    if not args.release_dir.is_dir():
        print(f"Release directory does not exist: {args.release_dir}", file=sys.stderr)
        return 1

    payload = {
        "sha": args.sha,
        "migration_revision": args.migration_revision,
        "deployed_at": args.deployed_at,
        "actor": args.actor,
        "run_id": args.run_id,
        "run_url": args.run_url,
    }
    metadata_path = args.release_dir / ".deploy-metadata.json"
    metadata_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Recorded release metadata: {metadata_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
