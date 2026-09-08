FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Runs as root by default otherwise. nginx:alpine ships an unprivileged
# "nginx" user, but the base image's cache/run dirs are root-owned and the
# default config listens on port 80 (privileged, unavailable to a non-root
# process) — switched to 8080 in nginx.conf so this actually works instead
# of crash-looping on startup.
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/run \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid
USER nginx

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
