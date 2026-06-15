#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Building Cloud Functions..."
npm --prefix functions run build

echo "Deploying Cloud Functions only (rules, indexes, and hosting are not updated)..."
firebase deploy --only functions

echo "Done."
