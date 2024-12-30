#!/bin/bash

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

# Function to generate secure random string
generate_secret() {
    local length=$1
    head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9!@#$%^&*()' | head -c "$length"
}

# Function to prompt for required value
prompt_required() {
    local var_name=$1
    local prompt_text=$2
    local default_value=$3
    local is_secret=$4
    
    if [ -z "${!var_name}" ]; then
        if [ "$is_secret" = "true" ]; then
            # Handle secret input
            while [ -z "${!var_name}" ]; do
                read -s -p "$prompt_text: " value
                echo
                read -s -p "Confirm $prompt_text: " value2
                echo
                if [ "$value" = "$value2" ]; then
                    printf -v "$var_name" "%s" "$value"
                else
                    echo "Values do not match, please try again"
                fi
            done
        else
            # Handle normal input
            if [ -n "$default_value" ]; then
                read -p "$prompt_text (default: $default_value): " value
                printf -v "$var_name" "%s" "${value:-$default_value}"
            else
                while [ -z "${!var_name}" ]; do
                    read -p "$prompt_text: " value
                    printf -v "$var_name" "%s" "$value"
                done
            fi
        fi
    fi
}

# Function to check if instance exists
check_instance() {
    local company_dir=$1
    if [ -d "instances/${company_dir}" ]; then
        return 0
    else
        return 1
    fi
}

# Function to save secrets
save_secrets() {
    local instance_dir=$1
    local secrets_file="${instance_dir}/secrets.env"
    local credentials_file="${instance_dir}/admin_credentials.txt"
    
    # Format admin username (use email format for consistency)
    local admin_username="admin.${COMPANY_DIR}"

    # Generate additional secrets if needed
    local session_secret=$(generate_secret 32)
    local encryption_key=$(generate_secret 32)
    
    # Create secrets file with restricted permissions
    umask 077
    if ! cat > "$secrets_file" << EOL
# Admin Credentials
ADMIN_USERNAME=${admin_username}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_EMAIL=${COMPANY_EMAIL}
ADMIN_FIRST_NAME=Admin
ADMIN_LAST_NAME=${COMPANY_NAME}

# Company Details
COMPANY_NAME=${COMPANY_NAME}
COMPANY_ADDRESS=${COMPANY_ADDRESS}
COMPANY_PHONE=${COMPANY_PHONE}
COMPANY_EMAIL=${COMPANY_EMAIL}

# Security Keys
SESSION_SECRET=${session_secret}

# Security Settings
NODE_ENV=production
BCRYPT_SALT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=4
LOCK_TIME=15

# Instance Information
INSTANCE_ID=${COMPANY_DIR}
DOMAIN=${DOMAIN}
EOL
    then
        error "Failed to create secrets file"
    fi

    # Ensure proper ownership and permissions for secrets file
    if ! chown $(id -u):$(id -g) "$secrets_file" || ! chmod 600 "$secrets_file"; then
        error "Failed to set secrets file permissions"
    fi
    
    success "Secrets saved to $secrets_file"
    
    # Save a backup of credentials
    if ! cat > "$credentials_file" << EOL
Admin Portal Credentials
=======================
URL: https://${DOMAIN}/admin
Username: ${admin_username}
Password: ${ADMIN_PASSWORD}

Company Details:
Name: ${COMPANY_NAME}
Email: ${COMPANY_EMAIL}
Phone: ${COMPANY_PHONE}

IMPORTANT: Store this file securely and then delete it.
This file will be automatically deleted in 24 hours for security.
EOL
    then
        error "Failed to create credentials file"
    fi
    
    # Set file permissions for credentials file
    if ! chown $(id -u):$(id -g) "$credentials_file" || ! chmod 600 "$credentials_file"; then
        error "Failed to set credentials file permissions"
    fi
    
    # Schedule credentials file deletion
    if ! echo "rm -f \"$credentials_file\"" | at now + 24 hours 2>/dev/null; then
        info "Note: Could not schedule automatic deletion of credentials file"
    fi
    
    success "Admin credentials saved to $credentials_file (will be deleted in 24 hours)"
}

# Load default configuration
if [ -f "config.env" ]; then
    source config.env
else
    error "config.env not found"
fi

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --company-name=*)
            COMPANY_NAME="${1#*=}"
            shift
            ;;
        --company-address=*)
            COMPANY_ADDRESS="${1#*=}"
            shift
            ;;
        --company-phone=*)
            COMPANY_PHONE="${1#*=}"
            shift
            ;;
        --company-email=*)
            COMPANY_EMAIL="${1#*=}"
            shift
            ;;
        --port=*)
            PORT="${1#*=}"
            shift
            ;;
        --domain=*)
            DOMAIN="${1#*=}"
            shift
            ;;
        --admin-password=*)
            ADMIN_PASSWORD="${1#*=}"
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --company-name=NAME     Company name"
            echo "  --company-address=ADDR  Company address"
            echo "  --company-phone=PHONE   Company phone"
            echo "  --company-email=EMAIL   Company email"
            echo "  --port=PORT            Port number (default: 3000)"
            echo "  --domain=DOMAIN        Domain name"
            echo "  --admin-password=PASS  Admin password (will prompt if not provided)"
            echo "  --force                Force redeployment"
            exit 0
            ;;
        *)
            error "Unknown parameter: $1"
            ;;
    esac
done

# Prompt for required values if not provided
prompt_required COMPANY_NAME "Enter company name"
prompt_required COMPANY_ADDRESS "Enter company address"
prompt_required COMPANY_PHONE "Enter company phone"
prompt_required COMPANY_EMAIL "Enter company email"
prompt_required ADMIN_PASSWORD "Enter admin password" "" true

# Format company name for directory
export COMPANY_DIR=$(echo "${COMPANY_NAME}" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | xargs)
[[ -z "$COMPANY_DIR" ]] && error "Failed to format company directory name"

# Generate default domain name
export GENERATED_DOMAIN="${COMPANY_DIR}.amadiy.com"
prompt_required DOMAIN "Enter domain name (default: ${GENERATED_DOMAIN})" "${GENERATED_DOMAIN}"

# if domain is not provided, use generated domain
if [ -z "$DOMAIN" ]; then
    info "Using generated domain name: ${GENERATED_DOMAIN}"
    DOMAIN="${GENERATED_DOMAIN}"
fi

# if domain doesnt end with .amadiy.com, add it
if [[ "$DOMAIN" != *.amadiy.com ]]; then
    DOMAIN="${DOMAIN}.amadiy.com"
    info "Added amadiy.com to domain name : ${DOMAIN}"
fi

# Generate secure secrets if not existing
SESSION_SECRET=${SESSION_SECRET:-$(generate_secret 32)}

# Set default values for optional parameters
PORT=${PORT:-3000}
NODE_ENV=${NODE_ENV:-production}
LOG_LEVEL=${LOG_LEVEL:-info}
MAX_LOGIN_ATTEMPTS=${MAX_LOGIN_ATTEMPTS:-4}
LOCK_TIME=${LOCK_TIME:-15}
BCRYPT_SALT_ROUNDS=${BCRYPT_SALT_ROUNDS:-12}

# Check if instance exists
if check_instance "$COMPANY_DIR"; then
    if [ "$FORCE" != "true" ]; then
        info "Instance ${COMPANY_DIR} already exists"
        read -p "Do you want to update it? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi
fi

# Create instance directories
INSTANCE_DIR="instances/${COMPANY_DIR}"
if ! mkdir -p ${INSTANCE_DIR}/{db,logs}; then
    error "Failed to create instance directories"
fi

# Set proper permissions for instance directory
if ! chmod 755 ${INSTANCE_DIR} ${INSTANCE_DIR}/{db,logs}; then
    error "Failed to set directory permissions"
fi

# Ensure current user owns the directories
if ! chown -R $(id -u):$(id -g) ${INSTANCE_DIR}; then
    error "Failed to set directory ownership"
fi

# Display instance directory with a 
success "Created/Updated instance directories ${INSTANCE_DIR}"

# Save secrets to protected file
save_secrets "$INSTANCE_DIR"

# Generate docker-compose file
if ! cat > ${INSTANCE_DIR}/docker-compose.yml << EOL
version: '3.8'

services:
  carinspection:
    image: rehanalimahomed/autopresto-plateform:latest
    container_name: ${COMPANY_DIR}-plateform
    ports:
      - "${PORT}:3000"
    volumes:
      - ./db:/app/src/db
      - ./logs:/app/src/logs
      - ./secrets.env:/app/secrets.env:ro
    environment:
      # Runtime Settings
      - PORT=3000
      - SECRETS_PATH=/app/secrets.env
      
      # Instance Information
      - INSTANCE_ID=${COMPANY_DIR}
      - DOMAIN=${DOMAIN}
      
    env_file:
      - secrets.env
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
EOL
then
    error "Failed to create docker-compose.yml"
fi

# Set proper permissions for docker-compose.yml
if ! chmod 644 ${INSTANCE_DIR}/docker-compose.yml; then
    error "Failed to set docker-compose.yml permissions"
fi

# Deploy container
info "Deploying instance..."
cd ${INSTANCE_DIR}
if docker-compose up -d; then
    success "Container deployment successful!"
    
    # Update HAProxy configuration
    info "Updating proxy configuration..."
    if ssh ${PROXY_USER}@${PROXY_HOST} "${PROXY_MANAGER_DIR}/update-proxy.sh add \"$COMPANY_DIR\" \"$PORT\" \"$DOMAIN\" \"$APP_SERVER_IP\""; then
        success "Proxy configuration updated"
        success "Instance is accessible at https://$DOMAIN"
        success "Container name: ${COMPANY_DIR}-plateform"
        
        # Display admin credentials securely
        echo -e "\n${GREEN}Admin Credentials${NC}"
        echo "Username: admin.${COMPANY_DIR}"
        echo "Password: (saved in ${INSTANCE_DIR}/secrets.env)"
    else
        error "Failed to update proxy configuration"
    fi
else
    error "Deployment failed"
fi 