#!/bin/bash
cd /root/proyect/kiri
docker compose up -d --build backend
echo "Backend rebuild completed at $(date)" >> /tmp/rebuild.log
docker ps --format "table {{.Names}}\t{{.Status}}" | grep kiri >> /tmp/rebuild.log
