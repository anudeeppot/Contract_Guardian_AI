#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/../.."

echo "Building and starting Contract Guardian AI..."
docker compose up --build -d
echo "Application: http://localhost:8080"
echo "Backend health: http://localhost:8080/api/v1/health"
