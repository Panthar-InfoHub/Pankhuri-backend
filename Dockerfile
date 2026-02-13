FROM node:20-slim

# Install the dependencies correctly
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
    libxrandr2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN DATABASE_URL="postgresql://dummy@localhost/dummy" npx prisma generate
RUN npm run build

CMD ["npm", "start"]