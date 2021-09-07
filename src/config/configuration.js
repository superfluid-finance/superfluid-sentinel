require("./loadCmdArgs");
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
            this.TX_TIMEOUT = config.timeoutFn;
            this.BLOCK_RANGE = config.blockRange;
            this.CONCURRENCY = config.concurrency;
            this.COLD_BOOT = config.coldBoot;
            this.LISTEN_MODE = config.listenMode;
            this.NUM_RETRIES = config.numberRetries;
            this.TEST_RESOLVER = config.testResolver
            this.shutdownOnError = false;
            this.LIQUIDATION_DELAY = config.liquidationDelay || 0;
            this.MAX_GAS_FEE = config.maxFee;
            this.CLO_ADDR = config.cloAddr;
            this.PRIVATE_KEY = config.PRIVATE_KEY;
        } else {
            this.WS_RPC_NODE = process.env.WS_NODE;
            this.HTTP_RPC_NODE = process.env.HTTP_NODE;
            this.MNEMONIC = process.env.MNEMONIC;
            this.EPOCH_BLOCK = process.env.EPOCH_BLOCK || 0;
            this.DB = process.env.DB || "database.sqlite";
            this.PROTOCOL_RELEASE_VERSION = process.env.PROTOCOL_RELEASE_VERSION;
            this.TX_TIMEOUT = process.env.TX_TIMEOUT || 10000;
            this.BLOCK_RANGE = process.env.BLOCK_RANGE || 2000;
            this.GAS_PRICE = process.env.GAS_PRICE;
            this.GAS_LIMIT = process.env.GAS_LIMIT;
            this.CONCURRENCY = process.env.CONCURRENCY !== undefined ? process.env.CONCURRENCY : 1;
            this.COLD_BOOT = process.env.COLD_BOOT == 1 ? true : false;
            this.LISTEN_MODE = process.env.LISTEN_MODE;
            this.LIQUIDATION_DELAY = process.env.LIQUIDATION_DELAY || 0;
            this.MAX_GAS_FEE = process.env.MAX_GAS_FEE;
            this.NUM_RETRIES = 7;
            this.shutdownOnError = false;
            this.CLO_ADDR = process.env.CLO_ADDR;
            this.PRIVATE_KEY = process.env.PRIVATE_KEY;
        }
    }
}

module.exports = Config;
