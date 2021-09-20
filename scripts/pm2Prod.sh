#!/usr/bin/env bash
cat .env-prod-matic > .env
pm2 start main.js --name 'polygon'
sleep 2
cat .env-prod-xdai > .env
pm2 start main.js --name 'xdai'
pm2 monit
