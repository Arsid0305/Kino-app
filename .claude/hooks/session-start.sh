#!/bin/bash
set -euo pipefail
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi
if [ -f "$CLAUDE_PROJECT_DIR/requirements.txt" ]; then
  pip install -r "$CLAUDE_PROJECT_DIR/requirements.txt" --quiet
fi
if ! command -v context-mode &> /dev/null; then
  npm install -g context-mode --silent
fi
claude mcp add context-mode -- npx -y context-mode 2>/dev/null || true
echo "Session ready"
