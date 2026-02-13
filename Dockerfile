FROM node:20-slim

# Step 1: Install the actual system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    apt-transport-https \
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
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxss1 \
    libxtst6 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Step 2: Install Chromium
RUN apt-get update && apt-get install -y chromium --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Step 3: Env vars for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Standard build steps
RUN DATABASE_URL="postgresql://dummy@localhost/dummy" npx prisma generate
RUN npm run build

CMD ["npm", "start"]