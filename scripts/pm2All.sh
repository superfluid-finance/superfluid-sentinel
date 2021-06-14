#!/usr/bin/env bash
cat .env-prod-matic > .env && pm2 start main.js --name 'Polygon'
sleep 3
cat .env-prod-xdai > .env && pm2 start main.js --name 'xDAI'
sleep 3
cat .env-prod-goerli > .env && pm2 start main.js --name 'Goerli'
sleep 3
cat .env-prod-ropsten > .env && pm2 start main.js --name 'Ropsten'
sleep 3
cat .env-prod-rinkeby > .env && pm2 start main.js --name 'Rinkeby'
sleep 3
cat .env-prod-kovan > .env && pm2 start main.js --name 'Kovan'
sleep 3
cat .env-prod-mumbai > .env && pm2 start main.js --name 'Mumbai'
pm2 monit
