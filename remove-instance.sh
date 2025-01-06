#!/bin/bash

# Colors (matching deploy-instance.sh)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Error handling functions (matching deploy-instance.sh)
error() { echo -e "${RED}Error: $1${NC}" >&2; exit 1; }
success() { echo -e "${GREEN}$1${NC}"; }
info() { echo -e "${YELLOW}$1${NC}"; }

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --company-name=*)
            COMPANY_NAME="${1#*=}"
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help)
            echo "Usage: $0 --company-name=NAME [--force]"
            exit 0
            ;;
        *)
            error "Unknown parameter: $1"
            ;;
    esac
done

# Validate input
[ -z "$COMPANY_NAME" ] && error "Company name is required (--company-name=NAME)"

# Format company directory (matching deploy-instance.sh)
COMPANY_DIR=$(echo "${COMPANY_NAME}" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | xargs)
[ -z "$COMPANY_DIR" ] && error "Failed to format company directory name"

# Set directories (matching deploy-instance.sh)
BASE_DIR="/var/lib/virga-plateform"
INSTANCE_DIR="${BASE_DIR}/instances/${COMPANY_DIR}"

# Check instance exists
[ ! -d "$INSTANCE_DIR" ] && error "Instance ${COMPANY_DIR} does not exist"

# Confirm unless forced
if [ "$FORCE" != "true" ]; then
    read -p "Remove instance ${COMPANY_DIR} and its DNS records? [y/N] " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && exit 0
fi

# Get domain from secrets file
if [ -f "${INSTANCE_DIR}/secrets.env" ]; then
    source "${INSTANCE_DIR}/secrets.env"
    DOMAIN=${DOMAIN}
else
    error "Cannot find secrets.env file"
fi

# 1. Stop and remove container
cd "${INSTANCE_DIR}" || error "Failed to access instance directory"
if [ -f "docker-compose.yml" ]; then
    info "Stopping services..."
    docker compose down || error "Failed to stop services"
fi

# 2. Remove proxy configuration
info "Removing proxy configuration..."
if ! ssh ${PROXY_USER}@${PROXY_HOST} "${PROXY_MANAGER_DIR}/update-proxy.sh remove \"$COMPANY_DIR\""; then
    error "Failed to remove proxy configuration"
fi

# 3. Remove instance directory
info "Removing instance directory..."
rm -rf "${INSTANCE_DIR}" || error "Failed to remove instance directory"

success "Instance ${COMPANY_DIR} and its DNS records removed successfully"