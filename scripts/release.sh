#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

# Get the current version from package.json
currentVersion=$(node -p "require('./package.json').version")

# Run semantic-release
npx semantic-release --ci

# Get the new version from package.json
newVersion=$(node -p "require('./package.json').version")

# Revert package.json and package-lock.json to their state in the Git repository
git checkout HEAD -- package.json package-lock.json

# If the version has changed, update the version in package.json
if [[ "$currentVersion" != "$newVersion" ]]; then
    git config --local user.email "action@github.com"
    git config --local user.name "GitHub Action"
    npm version --no-git-tag-version $newVersion
    git add package.json package-lock.json
    git commit -m "chore: release $newVersion [skip ci]"
    git push
fi
