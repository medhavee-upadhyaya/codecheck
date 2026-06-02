#!/usr/bin/env bash
# publish.sh — Publish all CodeCheck packages to npm
#
# Prerequisites:
#   npm login  (or set NPM_TOKEN env var)
#
# Usage:
#   ./scripts/publish.sh            # publish all packages
#   ./scripts/publish.sh --dry-run  # preview what would be published
#
# Build order matters — core must be built before packages that depend on it.

set -euo pipefail

DRY_RUN="${1:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"

echo ""
echo "  ◆ CodeCheck publish script"
echo ""

# Build everything first
echo "  [1/3] Building all packages..."
npm run build --workspaces --if-present
echo "  ✓ Build complete"
echo ""

# Run all tests
echo "  [2/3] Running all tests..."
npm test --workspaces --if-present
echo "  ✓ All tests pass"
echo ""

# Publish in dependency order
PACKAGES=(
  "packages/core"
  "packages/scope-unit"
  "packages/scope-smoke"
  "packages/scope-functional"
  "packages/scope-sanity"
  "packages/scope-integration"
  "packages/scope-api"
  "packages/scope-e2e"
  "packages/scope-snapshot"
  "packages/scope-regression"
  "packages/scope-everything"
  "packages/output-terminal"
  "packages/output-github"
  "packages/output-dashboard"
  "packages/output-report"
  "packages/output-slack"
  "packages/output-inline"
  "packages/trigger-oncommit"
  "packages/trigger-onsave"
  "packages/trigger-onpush"
  "packages/trigger-ci"
  "packages/codecheck-init"
)

if [ -n "${NPM_TOKEN:-}" ]; then
  npm set //registry.npmjs.org/:_authToken="${NPM_TOKEN}"
fi

echo "  [3/3] Publishing packages..."
for pkg in "${PACKAGES[@]}"; do
  name=$(node -p "require('./$pkg/package.json').name")
  version=$(node -p "require('./$pkg/package.json').version")
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] Would publish $name@$version"
    npm publish "./$pkg" --access public --dry-run 2>&1 | grep -E "npm notice|tarball" | head -5
  else
    echo "  Publishing $name@$version..."
    npm publish "./$pkg" --access public
    echo "  ✓ $name@$version published"
  fi
done

echo ""
echo "  ◆ Done! All packages published."
echo ""
