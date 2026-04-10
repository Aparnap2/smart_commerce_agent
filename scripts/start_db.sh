#!/bin/bash
echo "Starting PostgreSQL container..."
docker run -d \
  --name smart-commerce-postgres \
  -e POSTGRES_DB=smart_commerce \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:alpine

# Wait for postgres to be ready
echo "Waiting for PostgreSQL to be ready..."
until docker exec smart-commerce-postgres pg_isready -U postgres -d smart_commerce; do
  sleep 1
done
echo "PostgreSQL is ready!"
