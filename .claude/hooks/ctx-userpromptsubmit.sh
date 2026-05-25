#!/bin/bash
HOOKS="$(npm root -g)/context-mode/hooks"
[ -f "$HOOKS/userpromptsubmit.mjs" ] && exec node "$HOOKS/userpromptsubmit.mjs" || exit 0
