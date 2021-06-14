#!/usr/bin/env bash
cat .env-prod-goerli > .env 
pm2 start main.js --name 'Goerli'
sleep 2
cat .env-prod-ropsten > .env
pm2 start main.js --name 'Ropsten'
sleep 2
cat .env-prod-rinkeby > .env
pm2 start main.js --name 'Rinkeby'
sleep 2
cat .env-prod-kovan > .env
pm2 start main.js --name 'Kovan'
sleep 2
cat .env-prod-mumbai > .env
pm2 start main.js --name 'Mumbai (Polygon)'
pm2 monit
