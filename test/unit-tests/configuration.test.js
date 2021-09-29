const configModule = require("../../src/config/configuration");

const expect = require('chai').expect
let app;
const delay = ms => new Promise(res => setTimeout(res, ms));

const exitWithError = (error) => {
    console.error(error);
    removeEnvVariables();
    process.exit(1);
}

const populateEnvVariables= () => {
    process.env.HTTP_RPC_NODE="http://127.0.0.1:8545";
    process.env.WS_RPC_NODE="ws://127.0.0.1:8545";
    process.env.MNEMONIC="clutch mutual favorite scrap flag rifle tone brown forget verify galaxy return";
    process.env.MNEMONIC_INDEX=0
    process.env.PRIVATE_KEY="0x4b2058f23c4a47002e35c06e9c0beb6af7ff8f1638dee7e38dec852a3b4aef84"
    process.env.MAX_QUERY_BLOCK_RANGE=100
    process.env.TOKENS="0x79DA1bBa37Ce32c094c7373B4c2F87e27DaA7C19,0x92b83E6c3d7279c9dE09d99604a479468aF02De9,0xc752367ea7C1B19ea0b531bBa5eb4502E967ccFa";
    process.env.DB_PATH="test/db.sqlite";
    process.env.ADDITIONAL_LIQUIDATION_DELAY= 10
    process.env.TX_TIMEOUT= 100;
    process.env.PROTOCOL_RELEASE_VERSION= "v1";
    process.env.MAX_GAS_PRICE= 500;
    process.env.RETRY_GAS_MULTIPLIER= 1.1;
    process.env.CLO_ADDR="0xAB4075f621100563f4551C0Ca50944809b03E948";
    process.env.CONCURRENCY=2;
    process.env.LISTEN_MODE=0;
    process.env.NUM_RETRIES=5;
    process.env.COLD_BOOT=0;
    process.env.SHUTDOWN_ON_ERROR=true;
    process.env.METRICS=true;
    process.env.METRICS_PORT=3555;
    process.env.LIQUIDATION_RUN_EVERY=55;
    process.env.MAX_BATCH_TX=5;
    process.env.LOG_LEVEL="debug";
    return {
        HTTP_RPC_NODE:process.env.HTTP_RPC_NODE,
        WS_RPC_NODE:process.env.WS_RPC_NODE,
        MNEMONIC:process.env.MNEMONIC,
        MNEMONIC_INDEX:process.env.MNEMONIC_INDEX,
        PRIVATE_KEY:process.env.PRIVATE_KEY,
        MAX_QUERY_BLOCK_RANGE:process.env.MAX_QUERY_BLOCK_RANGE,
        TOKENS:process.env.TOKENS,
        DB_PATH:process.env.DB_PATH,
        ADDITIONAL_LIQUIDATION_DELAY:process.env.ADDITIONAL_LIQUIDATION_DELAY,
        TX_TIMEOUT:process.env.TX_TIMEOUT,
        PROTOCOL_RELEASE_VERSION:process.env.PROTOCOL_RELEASE_VERSION,
        MAX_GAS_PRICE:process.env.MAX_GAS_PRICE,
        RETRY_GAS_MULTIPLIER:process.env.RETRY_GAS_MULTIPLIER,
        CLO_ADDR:process.env.CLO_ADDR,
        CONCURRENCY:process.env.CONCURRENCY,
        LISTEN_MODE:process.env.LISTEN_MODE,
        NUM_RETRIES:process.env.NUM_RETRIES,
        COLD_BOOT:process.env.COLD_BOOT,
        SHUTDOWN_ON_ERROR:process.env.SHUTDOWN_ON_ERROR,
        METRICS:process.env.METRICS,
        METRICS_PORT:process.env.METRICS_PORT,
        LIQUIDATION_RUN_EVERY:process.env.LIQUIDATION_RUN_EVERY,
        MAX_BATCH_TX:process.env.MAX_BATCH_TX,
        LOG_LEVEL:process.env.LOG_LEVEL
    }
}

const removeEnvVariables = () => {
    delete process.env.HTTP_RPC_NODE;
    delete process.env.WS_RPC_NODE;
    delete process.env.MNEMONIC;
    delete process.env.MNEMONIC_INDEX;
    delete process.env.PRIVATE_KEY;
    delete process.env.MAX_QUERY_BLOCK_RANGE;
    delete process.env.TOKENS;
    delete process.env.DB_PATH;
    delete process.env.ADDITIONAL_LIQUIDATION_DELAY;
    delete process.env.TX_TIMEOUT;
    delete process.env.PROTOCOL_RELEASE_VERSION;
    delete process.env.MAX_GAS_PRICE;
    delete process.env.RETRY_GAS_MULTIPLIER;
    delete process.env.CLO_ADDR;
    delete process.env.CONCURRENCY;
    delete process.env.LISTEN_MODE;
    delete process.env.NUM_RETRIES;
    delete process.env.COLD_BOOT;
    delete process.env.SHUTDOWN_ON_ERROR;
    delete process.env.METRICS;
    delete process.env.METRICS_PORT;
    delete process.env.LIQUIDATION_RUN_EVERY;
    delete process.env.MAX_BATCH_TX;
    delete process.env.LOG_LEVEL;
}

describe("Test Agent user configurations", () => {

    it("Boot agent with env variables", async () => {
        try {
            const envObj = populateEnvVariables();
            const config = new configModule();
            expect(envObj.HTTP_RPC_NODE).to.equal(config.HTTP_RPC_NODE);
            expect(envObj.WS_RPC_NODE).to.equal(config.WS_RPC_NODE);
            expect(envObj.MNEMONIC).to.equal(config.MNEMONIC);
            expect(envObj.MNEMONIC_INDEX).to.equal(config.MNEMONIC_INDEX);
            expect(envObj.PRIVATE_KEY).to.equal(config.PRIVATE_KEY);
            expect(envObj.MAX_QUERY_BLOCK_RANGE).to.equal(config.MAX_QUERY_BLOCK_RANGE);
            expect(envObj.TOKENS.split(",")).to.eql(config.TOKENS);
            expect(envObj.DB_PATH).to.equal(config.DB);
            expect(envObj.ADDITIONAL_LIQUIDATION_DELAY).to.equal(config.ADDITIONAL_LIQUIDATION_DELAY);
            expect(envObj.TX_TIMEOUT * 1000).to.equal(config.TX_TIMEOUT);
            expect(envObj.PROTOCOL_RELEASE_VERSION).to.equal(config.PROTOCOL_RELEASE_VERSION);
            expect(envObj.MAX_GAS_PRICE).to.equal(config.MAX_GAS_PRICE);
            expect(envObj.RETRY_GAS_MULTIPLIER).to.equal(config.RETRY_GAS_MULTIPLIER);
            expect(envObj.CLO_ADDR).to.equal(config.CLO_ADDR);
            expect(envObj.CONCURRENCY).to.equal(config.CONCURRENCY);
            expect(envObj.LISTEN_MODE).to.equal(config.LISTEN_MODE);
            expect(envObj.NUM_RETRIES).to.equal(config.NUM_RETRIES);
            expect(envObj.COLD_BOOT).to.equal(config.COLD_BOOT);
            expect(envObj.SHUTDOWN_ON_ERROR).to.equal(config.SHUTDOWN_ON_ERROR);
            expect(envObj.METRICS).to.equal(config.METRICS);
            expect(envObj.METRICS_PORT).to.equal(config.METRICS_PORT);
            expect(envObj.LIQUIDATION_RUN_EVERY*1000).to.equal(config.LIQUIDATION_RUN_EVERY);
            expect(envObj.MAX_BATCH_TX).to.equal(config.MAX_BATCH_TX);
            expect(envObj.LOG_LEVEL).to.equal(config.LOG_LEVEL);
            removeEnvVariables();
        } catch(err) {
            exitWithError(err);
        }
    });
});
