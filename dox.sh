#!/usr/bin/env bash
set -euo pipefail

ROOT="docs"

# Relative paths (no $ROOT here)
paths=(
  "README.md"
  "getting-started/installation.md"
  "getting-started/quick-start.md"
  "getting-started/configuration.md"
  "architecture/overview.md"
  "architecture/client-storage.md"
  "architecture/server-storage.md"
  "architecture/sync-protocol.md"
  "architecture/data-models.md"
  "api/sync-api.md"
  "api/client-api.md"
  "api/storage-api.md"
  "deployment/client-deployment.md"
  "deployment/server-deployment.md"
  "deployment/docker.md"
  "development/contributing.md"
  "development/coding-standards.md"
  "development/testing.md"
  "development/debugging.md"
  "user-guide/features.md"
  "user-guide/chat-management.md"
  "user-guide/sync-usage.md"
  "reference/changelog.md"
  "reference/roadmap.md"
  "reference/faq.md"
)

# Create directories and files
for relpath in "${paths[@]}"; do
  path="$ROOT/$relpath"
  dir=$(dirname "$path")
  mkdir -p "$dir"
  if [[ ! -f "$path" ]]; then
    title=$(basename "$path" .md | sed -E 's/-/ /g' | sed 's/\b\(.\)/\u\1/g')
    echo "# $title" > "$path"
  fi
done

echo "✅ Documentation structure created under $ROOT/"

