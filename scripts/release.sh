#!/bin/bash

# Get the current version from package.json
currentVersion=$(node -p "require('./package.json').version")

# Run semantic-release
npx semantic-release

# Get the new version from package.json
newVersion=$(node -p "require('./package.json').version")

# Revert package.json to its state in the Git repository
git checkout HEAD -- package.json

# If the version has changed, update the version in package.json
if [[ "$currentVersion" != "$newVersion" ]]; then
    git config --local user.email "action@github.com"
    git config --local user.name "GitHub Action"
    npm version --no-git-tag-version $newVersion
    git add package.json
    git commit -m "chore: release $newVersion [skip ci]"
    git push
fi
