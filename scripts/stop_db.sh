#!/bin/bash
echo "Stopping and removing PostgreSQL container..."
docker stop smart-commerce-postgres
docker rm smart-commerce-postgres
echo "Database stopped."
