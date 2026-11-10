#!/usr/bin/env bash
# Install Klaq without the plugin system: use this clone as the workspace and link the skill.
#   ./install.sh [--skip-docs]
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$HOME/.claude/skills/klaq"
mkdir -p "$HOME/.claude/skills"
if [ -e "$TARGET" ] && [ ! -L "$TARGET" ]; then echo "$TARGET exists and is not a link; move it away first."; exit 1; fi
ln -sfn "$DIR/plugin/skills/klaq" "$TARGET"
echo "Linked skill: $TARGET → $DIR/plugin/skills/klaq"
KLAQ_HOME="$DIR" "$DIR/plugin/bin/klaq-setup" "$@"
