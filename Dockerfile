FROM node:24 AS builder

WORKDIR /app

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

ARG DIRECT_URL
ENV DIRECT_URL=$DIRECT_URL


RUN printenv DATABASE_URL
RUN printenv DIRECT_URL

# Copy dependency files
COPY package.json package-lock.json* ./
COPY tsconfig.json ./
COPY prisma.config.ts ./

# Copy Prisma schema
COPY src/prisma ./src/prisma

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate --schema=./src/prisma/index.prisma

# Copy source code
COPY src ./src
COPY scripts ./scripts

# Build TypeScript
RUN npm run build

#Stage 2: Production Stage (Alpine)
FROM node:24-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy Prisma schema for runtime
COPY --from=builder /app/src/prisma ./src/prisma
COPY --from=builder /app/prisma.config.ts ./

# Generate Prisma client in production
RUN npx prisma generate --schema=./src/prisma/index.prisma

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user and switch to it
RUN addgroup -S appgroup && adduser -S appuser -G appgroup 
USER appuser

# Expose the port
EXPOSE 8080

# Health check
# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#   CMD node -e "require('http').get('http://localhost:8080/ping', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the app
CMD ["node", "dist/server.js"]