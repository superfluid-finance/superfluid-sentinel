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
            this.MAX_QUERY_BLOCK_RANGE = config.blockRange;
            this.CONCURRENCY = config.concurrency;
            this.COLD_BOOT = config.coldBoot;
            this.LISTEN_MODE = config.listenMode;
            this.NUM_RETRIES = config.numberRetries;
            this.TEST_RESOLVER = config.testResolver
            this.shutdownOnError = false;
            this.ADDITIONAL_LIQUIDATION_DELAY = config.liquidationDelay || 0;
            this.MAX_GAS_FEE = config.maxFee;
            this.CLO_ADDR = config.cloAddr;
            this.PRIVATE_KEY = config.privateKey;
            this.CHAIN_ID = config.chainId;
        } else {
            this.WS_RPC_NODE = process.env.WS_RPC_NODE;
            this.HTTP_RPC_NODE = process.env.HTTP_RPC_NODE;
            this.MNEMONIC = process.env.MNEMONIC;
            if(process.env.PATH_DB !== undefined && process.env.PATH_DB !== "") {
                this.DB = process.env.PATH_DB;
            } else {
                this.DB = "./datadir/db.sqlite";
            }
            this.PROTOCOL_RELEASE_VERSION = process.env.PROTOCOL_RELEASE_VERSION;
            this.TX_TIMEOUT = process.env.TX_TIMEOUT || 60000;
            this.MAX_QUERY_BLOCK_RANGE = process.env.MAX_QUERY_BLOCK_RANGE || 2000;
            this.COLD_BOOT = process.env.COLD_BOOT == 1 ? true : false;
            this.ADDITIONAL_LIQUIDATION_DELAY = process.env.ADDITIONAL_LIQUIDATION_DELAY || 0;
            this.MAX_GAS_FEE = process.env.MAX_GAS_FEE;
            this.CLO_ADDR = process.env.CLO_ADDR;
            this.PRIVATE_KEY = process.env.PRIVATE_KEY;
            this.RETRY_GAS_MULTIPLIER = process.env.RETRY_GAS_MULTIPLIER || 1.15;

            if(process.env.TOKENS !== undefined && process.env.TOKENS !== "") {
                this.TOKENS = process.env.TOKENS.split(",");
            }

            this.CONCURRENCY = 1;
            this.LISTEN_MODE = 1;
            this.NUM_RETRIES = 10;
            this.shutdownOnError = false;
        }

    }

    loadNetworkInfo(chainId) {
        this.EPOCH_BLOCK = networkConfigs[chainId].epoch || 0;
    }
}

module.exports = Config;
