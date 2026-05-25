#!/bin/bash
HOOKS="$(npm root -g)/context-mode/hooks"
[ -f "$HOOKS/pretooluse.mjs" ] && exec node "$HOOKS/pretooluse.mjs" || exit 0
