#!/usr/bin/env bash
#
# Build and publish @novant/sdk to npm.
#
# Reads npm token from secret/npm.key (gitignored).
# Version is read from package.json (the single source of truth).
#

set -euo pipefail

cd "$(dirname "$0")"

token_file="secret/npm.key"
if [[ ! -f "$token_file" ]]; then
  echo "error: npm token not found at $token_file" >&2
  exit 1
fi

version=$(node -p "require('./package.json').version")

if [[ -n "$(git status --porcelain)" ]]; then
  echo "error: working tree not clean" >&2
  exit 1
fi

echo "Publishing @novant/sdk $version to npm"
read -r -p "Continue? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "aborted"
  exit 1
fi

npm ci
npm run typecheck
npm run test:unit
npm run build

# write a temporary npmrc so the token never lands in ~/.npmrc
npmrc=$(mktemp)
trap 'rm -f "$npmrc"' EXIT
echo "//registry.npmjs.org/:_authToken=$(cat "$token_file")" > "$npmrc"
npm publish --userconfig "$npmrc" --access public

git tag "v$version"
git push --tags

echo "published @novant/sdk $version"
