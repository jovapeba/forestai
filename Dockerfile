# VERDANT AI — multi-stage production image
#
#   docker build -t verdant .
#   docker run -p 8080:8080 verdant
#
# Build args bake the optional free keys into the bundle (Vite env vars are
# build-time, not runtime). All are optional — the app degrades honestly
# without them. Note: values passed as build args end up in the image, so
# build the image yourself rather than pulling untrusted copies.

# ------------------------------ build stage --------------------------------
FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_CARTO_API_KEY=""
ARG VITE_FIRMS_MAP_KEY=""
ARG VITE_NVE_API_KEY=""
ENV VITE_CARTO_API_KEY="$VITE_CARTO_API_KEY" \
    VITE_FIRMS_MAP_KEY="$VITE_FIRMS_MAP_KEY" \
    VITE_NVE_API_KEY="$VITE_NVE_API_KEY"

# Dependencies first — cached unless the lockfile changes
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# Runs `tsc --noEmit && vite build` — type errors fail the image build
RUN npm run build

# ------------------------------ runtime stage ------------------------------
FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
