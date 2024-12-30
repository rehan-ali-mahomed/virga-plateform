# Build stage
FROM node:18-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Production stage
FROM node:18-slim

# Install required system dependencies for PDF generation
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

# Create necessary directories with proper permissions
RUN mkdir -p src/db src/logs generated_reports && \
    chown -R node:node /app

# Switch to non-root user
USER node

# Set environment variables with defaults
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info \
    BCRYPT_SALT_ROUNDS=12 \
    SESSION_SECRET=default-secret-change-in-production \
    MAX_LOGIN_ATTEMPTS=4 \
    LOCK_TIME=15

# Create a script to handle environment variable substitution
COPY docker-entrypoint.sh /usr/local/bin/
USER root
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
USER node

# Expose port
EXPOSE 3000

# Use the entrypoint script
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "start"] 