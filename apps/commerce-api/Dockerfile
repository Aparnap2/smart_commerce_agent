FROM oven/bun:1.2-alpine
WORKDIR /app

# Copy prisma schema first (needed for generate)
COPY prisma/schema.prisma ./prisma/schema.prisma

# Copy commerce-api package files
COPY apps/commerce-api/package.json ./
COPY apps/commerce-api/bun.lock* ./

RUN bun install --frozen-lockfile

# Copy source
COPY apps/commerce-api/src ./src

# Generate Prisma client
RUN bunx prisma generate --schema ./prisma/schema.prisma

EXPOSE 3001
CMD ["bun", "run", "src/index.ts"]
