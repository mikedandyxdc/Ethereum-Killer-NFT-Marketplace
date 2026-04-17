#!/bin/bash
# Local test run for Docker image with asset mounts
docker run --rm -p 3000:3000 \
  -v "$(cd .. && pwd)/nfts/nfts_thumbnail:/app/public/nfts_thumbnail:ro" \
  -v "$(cd .. && pwd)/nfts/nfts_full:/app/public/nfts_full:ro" \
  xrc721-nextjs:latest
