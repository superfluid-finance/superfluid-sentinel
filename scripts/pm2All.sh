#!/usr/bin/env bash
cat .env-prod-matic > .env && pm2 start main.js --name 'polygon'
sleep 3
cat .env-prod-xdai > .env && pm2 start main.js --name 'xdai'
sleep 3
cat .env-prod-goerli > .env && pm2 start main.js --name 'goerli'
sleep 3
cat .env-prod-ropsten > .env && pm2 start main.js --name 'ropsten'
sleep 3
cat .env-prod-rinkeby > .env && pm2 start main.js --name 'rinkeby'
sleep 3
cat .env-prod-kovan > .env && pm2 start main.js --name 'kovan'
sleep 3
cat .env-prod-mumbai > .env && pm2 start main.js --name 'mumbai'
pm2 monit
