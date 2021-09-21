#!/usr/bin/env bash
cat .env-prod-goerli > .env
pm2 start main.js --name 'goerli'
sleep 2
cat .env-prod-ropsten > .env
pm2 start main.js --name 'ropsten'
sleep 2
cat .env-prod-rinkeby > .env
pm2 start main.js --name 'rinkeby'
sleep 2
cat .env-prod-kovan > .env
pm2 start main.js --name 'kovan'
sleep 2
cat .env-prod-mumbai > .env
pm2 start main.js --name 'mumbai'
pm2 monit
