FROM rust:1.88-bookworm AS builder
WORKDIR /app

COPY Cargo.toml Cargo.lock* ./
COPY src ./src
COPY migrations ./migrations

RUN cargo build --release --bin tridjaya-backend

FROM debian:bookworm-slim
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/tridjaya-backend /usr/local/bin/tridjaya-backend
COPY migrations ./migrations
COPY baileys-bridge/package*.json ./baileys-bridge/
RUN npm ci --omit=dev --prefix ./baileys-bridge
COPY baileys-bridge ./baileys-bridge

RUN mkdir -p data uploads uploads/private uploads/temp sessions

EXPOSE 8081
CMD ["tridjaya-backend"]
