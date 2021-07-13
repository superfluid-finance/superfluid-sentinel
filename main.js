#!/usr/bin/env node
const App = require("./src/app");

async function main() {
    const app = new App();
    await app.start();
}

main();
//TODO: check if - else when there are not needed. Reduce to one if that returns
//TODO: Apply backoff algo to WS reconnection