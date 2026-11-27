#!/usr/bin/env bash
#
# Build and publish @novant/sdk to npm.
#
# Uses your `npm login` session; npm prompts for 2FA in the browser.
# Version is read from package.json (the single source of truth).
#

set -euo pipefail

cd "$(dirname "$0")"

version=$(node -p "require('./package.json').version")

if [[ -n "$(git status --porcelain)" ]]; then
  echo "error: working tree not clean" >&2
  exit 1
fi

if git rev-parse -q --verify "refs/tags/v$version" >/dev/null; then
  echo "error: tag v$version already exists; roll the version in package.json" >&2
  exit 1
fi

if ! user=$(npm whoami 2>/dev/null); then
  echo "error: not logged in to npm; run 'npm login' first" >&2
  exit 1
fi

echo "Publishing @novant/sdk $version to npm as $user"
read -r -p "Continue? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "aborted"
  exit 1
fi

npm ci
npm run typecheck
npm run test:unit
npm run build

npm publish

git tag "v$version"
git push --tags

echo "published @novant/sdk $version"
