FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ openssl openssl-dev

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app

# OpenSSL required by Prisma engine
RUN apk add --no-cache openssl openssl-dev

# Copy EVERYTHING from builder — keeps all runtime deps including dotenv
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
# `npx prisma db seed` in here reads the seed command from package.json and
# runs it with ts-node, which needs tsconfig.json (for esModuleInterop).
COPY package.json tsconfig.json ./

# Runs as root by default otherwise. node:20-alpine already ships an
# unprivileged "node" user (uid 1000) — reuse it rather than defining a new
# one, and make sure it actually owns the dirs it needs to write to
# (uploads for lab report PDFs, logs).
RUN mkdir -p logs uploads/lab-reports && chown -R node:node /app
USER node

EXPOSE 5000

# Render's free tier has no pre-deploy hook and no shell, so the container
# applies pending migrations itself when RUN_MIGRATIONS=true (render.yaml
# sets it). Off by default so local compose leaves its database alone.
CMD ["sh", "-c", "if [ \"$RUN_MIGRATIONS\" = \"true\" ]; then npx prisma migrate deploy || exit 1; fi; exec node dist/app.js"]
