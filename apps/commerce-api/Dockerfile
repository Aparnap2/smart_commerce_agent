FROM oven/bun:1.2-alpine
WORKDIR /app

# Copy workspace configuration
COPY package.json ./
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./

# Copy prisma schema first (needed for generate)
COPY prisma/schema.prisma ./prisma/schema.prisma

# Copy shared packages
COPY packages/errors ./packages/errors
COPY packages/types ./packages/types

# Copy commerce-api package files
COPY apps/commerce-api/package.json ./apps/commerce-api/

# Install dependencies (workspace-aware)
RUN bun install

# Copy commerce-api source
COPY apps/commerce-api/src ./apps/commerce-api/src

# Generate Prisma client
RUN bunx prisma generate --schema ./prisma/schema.prisma

WORKDIR /app/apps/commerce-api
EXPOSE 3001
CMD ["bun", "run", "src/index.ts"]
