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

# 2. automerge.yml: merges into dev, not main (two-stage workflow is intentional)
if "checkout dev" not in automerge and "origin dev" not in automerge:
    fail("automerge.yml: must merge into 'dev', not 'main' (two-stage: claude/** → dev → main via promote.yml)")

# 3. No -X theirs in automerge.yml
if "-X theirs" in automerge:
    fail("automerge.yml: contains '-X theirs' — unsafe merge strategy, remove it")

# 4. promote.yml must exist (mandatory for two-stage workflow)
if not Path(".github/workflows/promote.yml").exists():
    fail(".github/workflows/promote.yml: missing — required for two-stage workflow (dev → main with tests)")

if errors:
    print("CONSISTENCY ERRORS:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)

print("Consistency check passed.")
