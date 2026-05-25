#!/bin/bash
HOOKS="$(npm root -g)/context-mode/hooks"
[ -f "$HOOKS/precompact.mjs" ] && exec node "$HOOKS/precompact.mjs" || exit 0
