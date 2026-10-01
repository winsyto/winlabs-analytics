FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json ./
RUN npm install --omit=dev

# Build TypeScript
FROM base AS builder
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

# Production image
FROM base AS runner
ENV NODE_ENV=production

COPY --from=deps    /app/node_modules ./node_modules
COPY --from=builder /app/dist         ./dist

CMD ["node", "dist/index.js"]
