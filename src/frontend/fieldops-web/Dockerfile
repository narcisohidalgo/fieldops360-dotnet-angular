# Build Angular
FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build -- --configuration production

# Serve Angular with unprivileged Nginx
FROM nginx/nginx-unprivileged:stable-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/fieldops-web/browser/ /usr/share/nginx/html/

EXPOSE 8443
