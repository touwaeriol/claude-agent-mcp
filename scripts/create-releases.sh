#!/bin/bash

# Script to create GitHub Releases for all versions
# Usage: ./scripts/create-releases.sh
# Note: Requires GitHub CLI (gh) to be installed and authenticated

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  Claude Agent MCP - GitHub Release Creator"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "   Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub."
    echo "   Run: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI is ready"
echo ""

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q)
echo "📦 Repository: $REPO"
echo ""

# Function to create a release
create_release() {
    local TAG=$1
    local TITLE=$2
    local NOTES_FILE=$3
    local IS_LATEST=$4

    echo "Creating release for $TAG..."

    if [ "$IS_LATEST" = "true" ]; then
        gh release create "$TAG" \
            --title "$TITLE" \
            --notes-file "$NOTES_FILE" \
            --latest
        echo "✅ Release $TAG created (marked as latest)"
    else
        gh release create "$TAG" \
            --title "$TITLE" \
            --notes-file "$NOTES_FILE"
        echo "✅ Release $TAG created"
    fi
    echo ""
}

# Create releases in order
echo "Creating releases..."
echo ""

# v1.0.0 - Initial release
create_release "v1.0.0" \
    "v1.0.0 - Initial MCP Server Release" \
    "docs/RELEASE_v1.0.0.md" \
    "false"

# v1.0.1 - Test suite release
create_release "v1.0.1" \
    "v1.0.1 - Test Suite and Documentation Release" \
    "docs/RELEASE_v1.0.1.md" \
    "false"

# v1.1.0 - Production release (marked as latest)
create_release "v1.1.0" \
    "v1.1.0 - Production Release with Comprehensive Testing" \
    "docs/RELEASE_v1.1.0.md" \
    "true"

echo "═══════════════════════════════════════════════════════════════"
echo "✨ All releases created successfully!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "View releases at:"
echo "  https://github.com/$REPO/releases"
echo ""
