# Use the official Node.js image
FROM node:20-slim

# Install the exact libraries Chromium needs
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libgbm1 \
    libasound2 \
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
    pango1.0-common \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your code
COPY . .

# Generate Prisma client and build TypeScript
RUN DATABASE_URL="postgresql://dummy@localhost/dummy" npx prisma generate
RUN npm run build

# Start the server
CMD ["npm", "start"]