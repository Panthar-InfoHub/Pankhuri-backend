FROM node:24-alpine
RUN apk update && apk add ffmpeg
WORKDIR /app
COPY package*.json .
RUN npm install
COPY . .

# Create non-root user
RUN addgroup -S transcodeGroup && adduser -S appuser -G transcodeGroup
USER appuser

EXPOSE 8080
CMD ["node", "index.js"]