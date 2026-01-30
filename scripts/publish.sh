#!/bin/bash
#
# Publish all @awcp packages to npm
#
# Usage:
#   ./scripts/publish.sh                    # Publish current version
#   ./scripts/publish.sh --bump patch       # Bump patch version and publish
#   ./scripts/publish.sh --bump minor       # Bump minor version and publish
#   ./scripts/publish.sh --bump major       # Bump major version and publish
#   ./scripts/publish.sh --dry-run          # Preview without publishing
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse args
DRY_RUN=""
BUMP_TYPE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN="--dry-run"
            shift
            ;;
        --bump)
            BUMP_TYPE="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

if [[ -n "$DRY_RUN" ]]; then
    echo -e "${YELLOW}DRY RUN MODE - no packages will be published${NC}"
    echo ""
fi

# Packages in dependency order
PACKAGES=(
    "core"
    "transport-sshfs"
    "sdk"
    "mcp"
)

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         AWCP Package Publisher                             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$ROOT_DIR"

# Check if running in CI
if [[ -n "$CI" ]]; then
    echo -e "${BLUE}Running in CI environment${NC}"
else
    # Check npm login
    echo -e "${YELLOW}Checking npm login...${NC}"
    NPM_USER=$(npm whoami 2>/dev/null) || {
        echo -e "${RED}Error: Not logged in to npm. Run 'npm login' first.${NC}"
        exit 1
    }
    echo -e "${GREEN}✓ Logged in as: $NPM_USER${NC}"

    # Check org membership
    echo -e "${YELLOW}Checking @awcp org membership...${NC}"
    npm org ls awcp 2>/dev/null | grep -q "$NPM_USER" || {
        echo -e "${RED}Error: $NPM_USER is not a member of @awcp org.${NC}"
        exit 1
    }
    echo -e "${GREEN}✓ Member of @awcp org${NC}"
    echo ""

    # Check for uncommitted changes
    echo -e "${YELLOW}Checking git status...${NC}"
    if [[ -n $(git status --porcelain) ]]; then
        echo -e "${YELLOW}Warning: You have uncommitted changes${NC}"
        git status --short
        echo ""
        if [[ -z "$DRY_RUN" ]]; then
            read -p "Continue anyway? (y/N) " -n 1 -r
            echo ""
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    else
        echo -e "${GREEN}✓ Working directory clean${NC}"
    fi
    echo ""
fi

# Bump version if requested
if [[ -n "$BUMP_TYPE" ]]; then
    echo -e "${YELLOW}Bumping version ($BUMP_TYPE)...${NC}"
    npx tsx scripts/version.ts "$BUMP_TYPE"
    echo ""
fi

# Build all packages
echo -e "${YELLOW}Building all packages...${NC}"
npm run build
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Run tests (skip in CI if already run)
if [[ -z "$SKIP_TESTS" ]]; then
    echo -e "${YELLOW}Running tests...${NC}"
    npm test
    echo -e "${GREEN}✓ Tests passed${NC}"
    echo ""
fi

# Publish each package
echo -e "${BLUE}Publishing packages...${NC}"
echo ""

for pkg in "${PACKAGES[@]}"; do
    PKG_DIR="$ROOT_DIR/packages/$pkg"
    PKG_NAME=$(node -p "require('$PKG_DIR/package.json').name")
    PKG_VERSION=$(node -p "require('$PKG_DIR/package.json').version")
    
    echo -e "${YELLOW}Publishing $PKG_NAME@$PKG_VERSION...${NC}"
    
    cd "$PKG_DIR"
    
    # Check if version already exists
    if npm view "$PKG_NAME@$PKG_VERSION" version 2>/dev/null; then
        echo -e "${YELLOW}  ⚠ Version $PKG_VERSION already published, skipping${NC}"
    else
        npm publish --access public $DRY_RUN
        if [[ -z "$DRY_RUN" ]]; then
            echo -e "${GREEN}  ✓ Published $PKG_NAME@$PKG_VERSION${NC}"
        else
            echo -e "${BLUE}  ✓ Would publish $PKG_NAME@$PKG_VERSION${NC}"
        fi
    fi
    echo ""
done

cd "$ROOT_DIR"

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         All packages published successfully!               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [[ -z "$DRY_RUN" ]]; then
    PKG_VERSION=$(node -p "require('./packages/core/package.json').version")
    echo "Published version: v$PKG_VERSION"
    echo ""
    echo "Install with:"
    echo "  npm install @awcp/sdk @awcp/mcp"
fi
