#!/bin/bash
# ----------------------------------------------------------------------------------------------------------------------
# This script is intended to automate release process.
# Explanation: This script will pull all latest changes from master and develop and checkout release branch from develop
#   with specified version and then bump up package version and add CHANGELOGS (input required) and commit them. After
#   that merge release branch into master and develop with appropriate tags.
#
# Example: "npm run release 1.2.3" 
# ----------------------------------------------------------------------------------------------------------------------

# Stop on first error
set -e;

# Ensure that the provided version is in valid semver format
if [[ ! $1 =~ ^v?[0-9]+(\.[0-9]+){2}(-[a-z]+\.\d+)?$ ]]; then
  echo "A valid version must be provided as the first argument.";
  exit 1;
fi

ver=${1/v/}; # Strip the leading v from the version (if it exists)
msg=$2;

[[ -z $msg ]] && msg="Released v${ver}";

# Update the master branch to the latest
git checkout master;
git pull origin master;

# Update develop to the latest, and create a release brach off of it.
git checkout develop;
git pull origin develop;
git checkout -b release/$ver;

# Bump version in package.json, but do not create a git tag
npm version $ver --no-git-tag-version;

# Inject the current release version and date into the CHANGELOG file
sed -i "" "3i\\
#### v${ver} (`date '+%B %d, %Y'`)\\
\\
" CHANGELOG.md;

# Find all commits between the HEAD on develop and the latest tag on master, and pipe their messages into the clipboard
git log $(git describe --tags master --abbrev=0)..HEAD --merges --pretty=format:'* %s' | pbcopy;

# Provision manual intervention for CHANGELOG.md
vi CHANGELOG.md

# Create the release
git add CHANGELOG.md package.json;
[[ -f package-lock.json ]] && git add package-lock.json;
git commit -am "$msg";

# Merge the release branch into develop and push
git checkout develop;
git merge --no-ff release/$ver;
git push origin develop;

# Merge the release branch into master, create a tag and push
git checkout master;
git merge --no-ff release/$ver;
git tag -a "$ver" -m "$msg";
git push origin master --follow-tags;

# Move back to develop
git checkout develop;
git branch -d release/$ver;

unset msg ver;
