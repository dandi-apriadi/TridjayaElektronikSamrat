FROM node:22-bookworm AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Accept build-time env vars for Vite
ARG VITE_API_BASE_URL=http://localhost:8081
ARG VITE_FRONTEND_URL=http://localhost:5173
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_FRONTEND_URL=$VITE_FRONTEND_URL

RUN npm run build

FROM nginx:1.27-alpine
# Use custom Nginx config with SPA fallback (try_files -> index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
