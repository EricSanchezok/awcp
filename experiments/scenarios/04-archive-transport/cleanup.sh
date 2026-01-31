#!/bin/bash
# Cleanup script for 04-archive-transport
rm -rf workdir/* exports/* temp/* logs/* 2>/dev/null || true
echo "Cleanup complete"
