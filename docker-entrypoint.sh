#!/bin/sh
set -e

# Create .env file from environment variables
cat > .env << EOL
# Server Configuration
PORT=${PORT:-3000}
NODE_ENV=${NODE_ENV:-production}
LOG_LEVEL=${LOG_LEVEL:-info}

# Security
BCRYPT_SALT_ROUNDS=${BCRYPT_SALT_ROUNDS:-12}
SESSION_SECRET=${SESSION_SECRET:-default-secret-change-in-production}
MAX_LOGIN_ATTEMPTS=${MAX_LOGIN_ATTEMPTS:-4}
LOCK_TIME=${LOCK_TIME:-15}

# Company Details
COMPANY_NAME=${COMPANY_NAME:-}
COMPANY_ADDRESS=${COMPANY_ADDRESS:-}
COMPANY_PHONE=${COMPANY_PHONE:-}
COMPANY_EMAIL=${COMPANY_EMAIL:-}
EOL

# Execute the main command
exec "$@" 