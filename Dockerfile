# Planner Dockerfile
FROM node:24-slim

WORKDIR /app

# Install dependencies for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/
COPY web/ ./web/

# Build TypeScript
RUN npm run build

# Copy .env file for node --env-file-if-exists
COPY .env .env

# Create storage directories
RUN mkdir -p /data/recordings /data/whatsapp-auth

# Expose port
EXPOSE 3000

# Start planner
CMD ["npm", "start"]