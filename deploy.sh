#!/bin/bash

# Load configuration
source config.env

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Company Information - MODIFY THESE VALUES
export COMPANY_NAME="Auto Presto"
export COMPANY_ADDRESS="3 Rue de la Guadeloupe, Sainte-Clotilde 97490"
export COMPANY_PHONE="+262 693 01 25 39"
export COMPANY_EMAIL="habibe97490@gmail.com"
export PORT=3000
export MAIN_DOMAIN="amadiy.com"

# Check required environment variables
[[ -z "$COMPANY_NAME" ]] && error "COMPANY_NAME is required"
[[ -z "$COMPANY_ADDRESS" ]] && error "COMPANY_ADDRESS is required"
[[ -z "$COMPANY_PHONE" ]] && error "COMPANY_PHONE is required"
[[ -z "$COMPANY_EMAIL" ]] && error "COMPANY_EMAIL is required"
[[ -z "$DOMAIN" ]] && error "DOMAIN is required"

# Format company name for directory (lowercase, replace spaces with hyphens, trim)
export COMPANY_DIR=$(echo "${COMPANY_NAME}" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | xargs)
[[ -z "$COMPANY_DIR" ]] && error "Failed to format company directory name"

export DOMAIN="${COMPANY_DIR }.${MAIN_DOMAIN}"

# Print deployment information
info "Deploying AutoPresto instance:"
info "Company: $COMPANY_NAME"
info "Directory: $COMPANY_DIR"
info "Port: $PORT"
info "Domain: $DOMAIN"

# Create instance directories
INSTANCE_DIR="${INSTANCES_BASE_DIR}/${COMPANY_DIR}"
mkdir -p ${INSTANCE_DIR}/{db,logs} || error "Failed to create instance directories"
success "Created instance directories"

# Move to instance directory
cd ${INSTANCE_DIR} || error "Failed to change to instance directory"

# Deploy with docker-compose
info "Starting deployment..."
if docker-compose up -d; then
    success "Deployment successful!"
    
    # Update HAProxy configuration via SSH
    info "Updating proxy configuration..."
    if ssh ${PROXY_USER}@${PROXY_HOST} "${PROXY_MANAGER_DIR}/update-proxy.sh add \"$COMPANY_DIR\" \"$PORT\" \"$DOMAIN\" \"$APP_SERVER_IP\""; then
        success "Proxy configuration updated"
        success "Instance is accessible at https://$DOMAIN"
        success "Container name: autopresto-$COMPANY_DIR"
    else
        error "Failed to update proxy configuration"
    fi
else
    error "Deployment failed"
fi 