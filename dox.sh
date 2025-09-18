#!/usr/bin/env bash
set -euo pipefail

# Root directory
ROOT="docs"

# Define directories and files
declare -A structure=(
  ["$ROOT/README.md"]=""
  ["$ROOT/getting-started/installation.md"]=""
  ["$ROOT/getting-started/quick-start.md"]=""
  ["$ROOT/getting-started/configuration.md"]=""
  ["$ROOT/architecture/overview.md"]=""
  ["$ROOT/architecture/client-storage.md"]=""
  ["$ROOT/architecture/server-storage.md"]=""
  ["$ROOT/architecture/sync-protocol.md"]=""
  ["$ROOT/architecture/data-models.md"]=""
  ["$ROOT/api/sync-api.md"]=""
  ["$ROOT/api/client-api.md"]=""
  ["$ROOT/api/storage-api.md"]=""
  ["$ROOT/deployment/client-deployment.md"]=""
  ["$ROOT/deployment/server-deployment.md"]=""
  ["$ROOT/deployment/docker.md"]=""
  ["$ROOT/development/contributing.md"]=""
  ["$ROOT/development/coding-standards.md"]=""
  ["$ROOT/development/testing.md"]=""
  ["$ROOT/development/debugging.md"]=""
  ["$ROOT/user-guide/features.md"]=""
  ["$ROOT/user-guide/chat-management.md"]=""
  ["$ROOT/user-guide/sync-usage.md"]=""
  ["$ROOT/reference/changelog.md"]=""
  ["$ROOT/reference/roadmap.md"]=""
  ["$ROOT/reference/faq.md"]=""
)

# Create directories and files
for path in "${!structure[@]}"; do
  dir=$(dirname "$path")
  mkdir -p "$dir"
  if [[ ! -f "$path" ]]; then
    echo "# $(basename "$path" .md | sed -E 's/-/ /g' | sed 's/\b\(.\)/\u\1/g')" > "$path"
  fi
done

echo "✅ Documentation structure created under $ROOT/"

