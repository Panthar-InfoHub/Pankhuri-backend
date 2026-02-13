# Use the full Node 20 image
FROM node:20

# Step 1: Install tools needed to add the Google Repo
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    --no-install-recommends

# Step 2: Add the Google Chrome repository
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list

# Step 3: Now update and install Chrome (the system can now find it)
RUN apt-get update && apt-get install -y \
    google-chrome-stable \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN DATABASE_URL="postgresql://dummy@localhost/dummy" npx prisma generate
RUN npm run build

# Tell Puppeteer where Chrome is located
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

CMD ["npm", "start"]