#!/usr/bin/env python3
"""Consistency checker for TEMPLATE repo — runs as CI gate in automerge.yml."""

import sys
from pathlib import Path

errors = []


def fail(msg):
    errors.append(msg)


# 1. QUICKSTART.md: no 'dev' stage in git flow
quickstart = Path("QUICKSTART.md").read_text()
if "→ dev →" in quickstart or "→ `dev` →" in quickstart:
    fail("QUICKSTART.md: git flow references 'dev' stage — should be 'claude/... → main'")

# 2. automerge.yml: uses explicit branches allowlist, not branches-ignore
automerge = Path(".github/workflows/automerge.yml").read_text()
if "branches-ignore" in automerge:
    fail("automerge.yml: uses 'branches-ignore' — should use explicit branches: [claude/**, cursor/**]")
if "claude/**" not in automerge:
    fail("automerge.yml: missing 'claude/**' in branches filter")
if "cursor/**" not in automerge:
    fail("automerge.yml: missing 'cursor/**' in branches filter")

# 3. Adapter files exist
for adapter in ["adapters/CLAUDE.md", "adapters/CURSOR.md", "adapters/OPENAI.md"]:
    if not Path(adapter).exists():
        fail(f"Missing adapter file: {adapter}")

# 4. No adapter or SYSTEM.md mentions 'dev' branch in git workflow
for md_path in [*Path("adapters").glob("*.md"), Path("SYSTEM.md")]:
    content = md_path.read_text()
    if any(pat in content for pat in ["→ dev", "targets `dev`", "targets dev", "into dev"]):
        fail(f"{md_path}: references 'dev' branch in git workflow rules")

if errors:
    print("CONSISTENCY ERRORS:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)

print("Consistency check passed.")
