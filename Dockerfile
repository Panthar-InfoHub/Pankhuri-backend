# Use a slim version to keep it light, but we need the build-essential tools
FROM node:20-slim

# Install the necessary system dependencies for Puppeteer/Chromium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    apt-transport-https \
    # The missing library from your error
    libnspr4 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    librandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install Chromium directly from the debian repo - it's more stable for Cloud Run
RUN apt-get update && apt-get install -y chromium --no-install-recommends

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Generate Prisma and Build
RUN DATABASE_URL="postgresql://dummy@localhost/dummy" npx prisma generate
RUN npm run build

# Crucial: Set the path to the system-installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

CMD ["npm", "start"]