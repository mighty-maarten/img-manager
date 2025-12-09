#!/bin/bash
# Diagnostic script to check application status

echo "=== PM2 Status ==="
pm2 list

echo ""
echo "=== PM2 Logs (last 50 lines) ==="
pm2 logs --lines 50 --nostream

echo ""
echo "=== Check if port 3000 is listening ==="
sudo netstat -tlnp | grep 3000

echo ""
echo "=== Check node processes ==="
ps aux | grep node | grep -v grep

echo ""
echo "=== Check node_modules ==="
ls -la /opt/img-manager/current/node_modules/@nestjs/ | head -20

echo ""
echo "=== Check application files ==="
ls -la /opt/img-manager/current/packages/api/dist/src/

echo ""
echo "=== Check environment file ==="
ls -la /opt/img-manager/shared/.env

echo ""
echo "=== Test local health endpoint ==="
curl -v http://localhost:3000/health

echo ""
echo "=== Check application error logs ==="
tail -50 /var/log/img-manager/api-error.log

echo ""
echo "=== Check CodeDeploy logs ==="
tail -50 /var/log/aws/codedeploy-agent/codedeploy-agent.log
