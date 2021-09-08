require("./loadCmdArgs");
const networkConfigs = require("../../package.json").networks;

class Config {

    constructor(config) {
        if(typeof config === "object") {
            this.WS_RPC_NODE = config.wsNode;
            this.HTTP_RPC_NODE = config.httpNode;
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
            this.PRIVATE_KEY = config.privateKey;
            this.CHAIN_ID = config.chainId;
        } else {
            this.WS_RPC_NODE = process.env.WS_RPC_NODE;
            this.HTTP_RPC_NODE = process.env.HTTP_RPC_NODE;
            this.MNEMONIC = process.env.MNEMONIC;
            this.DB = process.env.PATH_DB || "database.sqlite"; //out
            this.PROTOCOL_RELEASE_VERSION = process.env.PROTOCOL_RELEASE_VERSION;
            this.TX_TIMEOUT = process.env.TX_TIMEOUT || 10000;
            this.BLOCK_RANGE = process.env.BLOCK_RANGE || 2000;
            this.CONCURRENCY = process.env.CONCURRENCY !== undefined ? process.env.CONCURRENCY : 1;
            this.COLD_BOOT = process.env.COLD_BOOT == 1 ? true : false;
            this.LISTEN_MODE = 1//process.env.LISTEN_MODE; //out
            this.LIQUIDATION_DELAY = process.env.LIQUIDATION_DELAY || 0;
            this.MAX_GAS_FEE = process.env.MAX_GAS_FEE;
            this.NUM_RETRIES = 7; //out
            this.shutdownOnError = false; // ??
            this.CLO_ADDR = process.env.CLO_ADDR;
            this.PRIVATE_KEY = process.env.PRIVATE_KEY;
            this.CHAIN_ID = process.env.CHAIN_ID;

            if(process.env.TOKENS !== undefined && process.env.TOKENS !== "") {
                this.TOKENS = process.env.TOKENS.split(",");
            }

            this.EPOCH_BLOCK = networkConfigs[this.CHAIN_ID].epoch || 0;
        }
    }
}

module.exports = Config;
