FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ openssl openssl-dev

COPY package.json ./
RUN npm install

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

RUN mkdir -p logs

EXPOSE 5000
CMD ["node", "dist/app.js"]
