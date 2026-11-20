# Webtop image for Zoom capture agent
# Base: LinuxServer Webtop with KDE, pinned to tested version
# Must include: Zoom client, FFmpeg, xdotool, Tesseract, Node.js

ARG BASE_IMAGE=linuxserver/webtop:ubuntu-kde
FROM ${BASE_IMAGE}

# Install additional packages needed for Zoom capture
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    xdotool \
    tesseract-ocr \
    tesseract-ocr-eng \
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
    libasound2t64 \
    pulseaudio \
    pulseaudio-utils \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Zoom client (Linux .deb)
ARG ZOOM_DEB_URL=https://zoom.us/client/latest/zoom_amd64.deb
RUN wget -q "${ZOOM_DEB_URL}" -O /tmp/zoom.deb \
    && apt-get update && apt-get install -y /tmp/zoom.deb \
    && rm -rf /tmp/zoom.deb /var/lib/apt/lists/* \
    && echo "/opt/zoom" > /etc/ld.so.conf.d/zoom.conf \
    && echo "/opt/zoom/Qt/lib" >> /etc/ld.so.conf.d/zoom.conf \
    && echo "/opt/zoom/Qt/plugins" >> /etc/ld.so.conf.d/zoom.conf \
    && ldconfig

# Install Node.js 24 (matching planner version)
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create agent user (abc user already exists in base image with uid 1000)
# The base image runs as abc user, we'll use that

# Copy agent code
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY agent.ts ./
COPY capture.ts ./
COPY zoom-ui.ts ./
COPY tsconfig.json ./

# Build TypeScript
RUN npx tsc

# Copy service runner, entrypoint, and custom init
COPY root/ /
COPY entrypoint.sh /entrypoint.sh
COPY custom-cont-init.d/ /etc/cont-init.d/

# Ensure scripts are executable
RUN chmod +x /entrypoint.sh /etc/cont-init.d/01-zoom-agent-init

# Default command runs s6 overlay (base image entrypoint)