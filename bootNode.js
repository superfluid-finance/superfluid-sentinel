const App = require("./src/app");
const app = new App({
    wsNode: "ws://127.0.0.1:8545",
    httpNode: "http://127.0.0.1:8545",
    mnemonic: "clutch mutual favorite scrap flag rifle tone brown forget verify galaxy return",
    epochBlock: 0,
    DB: "TestDatabase.sqlite",
    prv: "test",
    timeoutFn: 300000,
    pullStep: 500000,
    gasPrice:5000000000,
    concurrency: 1,
    coldBoot: 1,
    listenMode: 1,
    numberRetries: 3,
    testResolver: process.env.TEST_RESOLVER_ADDRESS
});
module.exports = app.start();