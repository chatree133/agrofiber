FROM node:20-alpine

WORKDIR /app

# Copy package config first to leverage caching
COPY package.json ./

# Install packages
RUN npm install --omit=dev

# Copy source code
COPY . .

# Ensure upload/public directories exist
RUN mkdir -p uploads src/public

EXPOSE 4000

ENV PORT=4000
ENV NODE_ENV=production

CMD ["node", "src/server.js"]
