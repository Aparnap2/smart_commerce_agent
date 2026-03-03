FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN bun install

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client
RUN bunx prisma generate

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Start the server
CMD ["bun", "run", "src/index.ts"]
