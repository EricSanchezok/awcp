#!/bin/bash
# Cleanup script for 05-synergy-executor scenario

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Clean up workdir
rm -rf workdir/*

# Clean up temp files
rm -rf temp/*

# Clean up logs (optional - keep for debugging)
# rm -rf logs/*

echo "Cleanup complete"
