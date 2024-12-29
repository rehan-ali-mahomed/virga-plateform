#!/bin/bash

# Load configuration
source config.env

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to print error and exit
error() {
    echo -e "${RED}Error: $1${NC}" >&2
    exit 1
}

# Function to print success
success() {
    echo -e "${GREEN}$1${NC}"
}

# Function to print info
info() {
    echo -e "${YELLOW}$1${NC}"
}

# Function to cleanup temporary files
cleanup() {
    info "Cleaning up temporary files..."
    rm -rf "${TMP_DIR}"
    ssh -q ${PROXY_USER}@${PROXY_HOST} "rm -rf ${PROXY_TMP_DIR}"
}

# Set trap for cleanup
trap cleanup EXIT

[[ ! -f "haproxy.cfg.template" ]] && error "haproxy.cfg.template not found"
[[ ! -f "update-proxy.sh" ]] && error "update-proxy.sh not found"

# Create temporary directories
info "Creating temporary directories..."
mkdir -p "${TMP_DIR}"
ssh -q ${PROXY_USER}@${PROXY_HOST} "mkdir -p ${PROXY_TMP_DIR}"

# Test SSH connection
info "Testing SSH connection to proxy server..."
if ! ssh -q ${PROXY_USER}@${PROXY_HOST} exit; then
    error "Cannot connect to proxy server. Please check SSH configuration."
fi

# Create proxy manager directory structure on proxy server
info "Setting up proxy manager on proxy server..."
ssh -q ${PROXY_USER}@${PROXY_HOST} "sudo mkdir -p ${PROXY_MANAGER_DIR} ${HAPROXY_BACKENDS_DIR}"

# Copy scripts to temporary location first
info "Copying configuration files to proxy server..."
scp -q haproxy.cfg.template ${PROXY_USER}@${PROXY_HOST}:${PROXY_TMP_DIR}/ || error "Failed to copy haproxy.cfg.template"
scp -q update-proxy.sh ${PROXY_USER}@${PROXY_HOST}:${PROXY_TMP_DIR}/ || error "Failed to copy update-proxy.sh"

# Move files to final location with sudo
ssh -q ${PROXY_USER}@${PROXY_HOST} "sudo mv ${PROXY_TMP_DIR}/* ${PROXY_MANAGER_DIR}/ && sudo chown -R root:root ${PROXY_MANAGER_DIR}/" || error "Failed to move files to final location"

# Set permissions on proxy server
info "Setting up permissions on proxy server..."
ssh -q ${PROXY_USER}@${PROXY_HOST} "sudo chmod +x ${PROXY_MANAGER_DIR}/update-proxy.sh" || error "Failed to set permissions"

# Create local instance directory
info "Setting up local instance directory..."
mkdir -p ${INSTANCES_BASE_DIR}

success "Setup completed successfully!"
info "You can now use deploy.sh to deploy new instances" 
