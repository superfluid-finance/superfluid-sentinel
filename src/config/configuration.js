require("dotenv").config();
class Config {

    constructor(config) {
        if(typeof config === "object") {
            this.WS_NODE = config.wsNode;
            this.HTTP_NODE = config.httpNode;
            this.MNEMONIC = config.mnemonic;
            this.EPOCH_BLOCK = config.epochBlock;
            this.DB = config.DB;
            process.env.DB = this.DB;
            this.PROTOCOL_RELEASE_VERSION = config.prv;
            this.TIMEOUT_FN = config.timeoutFn;
            this.PULL_STEP = config.pullStep;
            this.CONCURRENCY = config.concurrency;
            this.COLD_BOOT = config.coldBoot;
            this.LISTEN_MODE = config.listenMode;
            this.NUM_RETRIES = config.numberRetries;
            this.TEST_RESOLVER = config.testResolver
            this.shutdownOnError = false;
        } else {
            this.WS_NODE = process.env.WS_NODE;
            this.HTTP_NODE = process.env.HTTP_NODE;
            this.MNEMONIC = process.env.MNEMONIC;
            this.EPOCH_BLOCK = process.env.EPOCH_BLOCK || 0;
            this.DB = process.env.DB || "database.sqlite";
            this.PROTOCOL_RELEASE_VERSION = process.env.PROTOCOL_RELEASE_VERSION;
            this.TIMEOUT_FN = process.env.TIMEOUT_FN || 60000;
            this.PULL_STEP = process.env.PULL_STEP || 10000;
            this.GAS_PRICE = process.env.GAS_PRICE;
            this.GAS_LIMIT = process.env.GAS_LIMIT;
            this.CONCURRENCY = process.env.CONCURRENCY !== undefined ? process.env.CONCURRENCY : 1;
            this.COLD_BOOT = process.env.COLD_BOOT == 1 ? true : false;
            this.LISTEN_MODE = process.env.LISTEN_MODE;
            this.NUM_RETRIES = 7;
            this.shutdownOnError = false;
        }
    }
}

module.exports = Config;
