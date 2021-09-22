const App = require("./src/app");
const app = new App({
    ws_rpc_node: "ws://127.0.0.1:8545",
    http_rpc_node: "http://127.0.0.1:8545",
    mnemonic: "clutch mutual favorite scrap flag rifle tone brown forget verify galaxy return",
    epoch_block: 0,
    DB: "TestDatabase.sqlite",
    protocol_release_version: "test",
    tx_timeout: 300000,
    max_query_block_range: 500000,
    max_gas_price:5000000000,
    concurrency: 1,
    cold_boot: 1,
    listen_mode: 1,
    number_retries: 3,
    testResolver: process.env.TEST_RESOLVER_ADDRESS
});
module.exports = app.start();