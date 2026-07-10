# --- Stage 1: build the Vite/React app ---
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Stage 2: serve the built static files with nginx ---
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Railway assigns $PORT dynamically at runtime, but nginx.conf can't read
# env vars directly -- we use a template + envsubst to inject it at
# container start, and fall back to a SPA-friendly config so React
# Router's client-side routes (e.g. /dashboard, /login) don't 404 on
# refresh.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV PORT=8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
