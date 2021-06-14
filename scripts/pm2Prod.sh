#!/usr/bin/env bash
cat .env-prod-matic > .env 
pm2 start main.js --name 'Polygon'
sleep 2
cat .env-prod-xdai > .env
pm2 start main.js --name 'xDAI'
pm2 monit
