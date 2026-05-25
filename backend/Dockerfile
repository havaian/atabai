FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
RUN npm ci

COPY src ./src
COPY templates ./templates
COPY public ./public

RUN npm run build && npm prune --production

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "dist/main.js"]
