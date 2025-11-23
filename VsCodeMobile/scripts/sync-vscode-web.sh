#!/bin/bash

set -e

VSCODE_DIR="../"
MOBILE_DIR="$(pwd)"
ASSETS_DIR="$MOBILE_DIR/assets/vscode-web"

if [ ! -d "$VSCODE_DIR/out" ]; then
    echo "Error: VS Code out directory not found."
    echo "Please run 'npm run compile-web' in the VS Code directory first."
    exit 1
fi

mkdir -p "$ASSETS_DIR"

rsync -av --delete \
    --exclude='*.map' \
    --exclude='test/**' \
    "$VSCODE_DIR/out/" "$ASSETS_DIR/out/"

rsync -av --delete \
    --exclude='node_modules/**' \
    --exclude='**/node_modules/**' \
    --exclude='*.map' \
    "$VSCODE_DIR/extensions/" "$ASSETS_DIR/extensions/"

echo "Sync complete."
