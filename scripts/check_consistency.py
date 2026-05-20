#!/usr/bin/env python3
"""Consistency checker for Kino-App — runs as CI gate in automerge.yml."""

import sys
from pathlib import Path

errors = []


def fail(msg):
    errors.append(msg)


automerge = Path(".github/workflows/automerge.yml").read_text()

# 1. automerge.yml: uses explicit branches allowlist, not branches-ignore
if "branches-ignore" in automerge:
    fail("automerge.yml: uses 'branches-ignore' — should use explicit branches: [claude/**, cursor/**]")
if "claude/**" not in automerge:
    fail("automerge.yml: missing 'claude/**' in branches filter")
if "cursor/**" not in automerge:
    fail("automerge.yml: missing 'cursor/**' in branches filter")

# 2. No -X theirs in automerge.yml (unsafe merge strategy)
if "-X theirs" in automerge:
    fail("automerge.yml: contains '-X theirs' — unsafe merge strategy, remove it")

# 3. automerge.yml: merges into main (direct workflow, no dev stage)
if "checkout main" not in automerge and "origin main" not in automerge:
    fail("automerge.yml: must merge into 'main' (workflow: claude/... → main directly)")

# 4. promote.yml must exist
if not Path(".github/workflows/promote.yml").exists():
    fail(".github/workflows/promote.yml: missing — required for post-merge test runs")

if errors:
    print("CONSISTENCY ERRORS:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)

print("Consistency check passed.")
