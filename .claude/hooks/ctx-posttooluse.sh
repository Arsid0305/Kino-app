#!/bin/bash
HOOKS="$(npm root -g)/context-mode/hooks"
[ -f "$HOOKS/posttooluse.mjs" ] && exec node "$HOOKS/posttooluse.mjs" || exit 0
