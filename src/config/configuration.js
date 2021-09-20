require("./loadCmdArgs");
const networkConfigs = require("../../package.json").networks;

class Config {

    constructor(config) {
        if(typeof config === "object") {
            this.HTTP_RPC_NODE = config.http_rpc_node;
            this.WS_RPC_NODE = config.ws_rpc_node;
            this.MNEMONIC = config.mnemonic;
            this.PRIVATE_KEY = config.private_key;
            this.MAX_QUERY_BLOCK_RANGE = config.max_query_block_range || 2000;
            if(config.tokens !== undefined && config.tokens !== "") {
                this.TOKENS = config.tokens.split(",");
            }
            this.DB = (config.path_db !== undefined && config.path_db !== "") ? config.path_db : "./datadir/db.sqlite";
            this.ADDITIONAL_LIQUIDATION_DELAY = config.additional_liquidation_delay || 0;
            this.TX_TIMEOUT = config.tx_timeout || 60000;
            this.PROTOCOL_RELEASE_VERSION = config.protocol_release_version;
            this.MAX_GAS_PRICE = config.max_gas_price;
            this.RETRY_GAS_MULTIPLIER = config.retry_gas_multiplier || 1.15;
            this.CLO_ADDR = config.clo_addr;

            this.CONCURRENCY = config.concurrency;
            this.COLD_BOOT = config.cold_boot;
            this.LISTEN_MODE = config.listen_mode;
            this.NUM_RETRIES = config.number_retries;
            this.TEST_RESOLVER = config.test_resolver;
            this.shutdownOnError = config.shutdown_on_error;

        } else {
            this.HTTP_RPC_NODE = process.env.HTTP_RPC_NODE;
            this.WS_RPC_NODE = process.env.WS_RPC_NODE;
            this.MNEMONIC = process.env.MNEMONIC;
            this.PRIVATE_KEY = process.env.PRIVATE_KEY;
            this.MAX_QUERY_BLOCK_RANGE = process.env.MAX_QUERY_BLOCK_RANGE || 2000;
            if(process.env.TOKENS !== undefined && process.env.TOKENS !== "") {
                this.TOKENS = process.env.TOKENS.split(",");
            }
            this.DB = (process.env.PATH_DB !== undefined && process.env.PATH_DB !== "") ? process.env.PATH_DB : "./datadir/db.sqlite";
            this.ADDITIONAL_LIQUIDATION_DELAY = process.env.ADDITIONAL_LIQUIDATION_DELAY || 0;
            this.TX_TIMEOUT = process.env.TX_TIMEOUT || 60000;
            this.PROTOCOL_RELEASE_VERSION = process.env.PROTOCOL_RELEASE_VERSION;
            this.MAX_GAS_PRICE = process.env.MAX_GAS_PRICE;
            this.RETRY_GAS_MULTIPLIER = process.env.RETRY_GAS_MULTIPLIER || 1.15;
            this.CLO_ADDR = process.env.CLO_ADDR;
            this.MNEMONIC_INDEX = process.env.MNEMONIC_INDEX || 100;

            this.CONCURRENCY = 1;
            this.LISTEN_MODE = 1;
            this.NUM_RETRIES = 10;
            this.COLD_BOOT = 0;
            this.shutdownOnError = false;
            this.httpServer = true;
        }
    }

    loadNetworkInfo(chainId) {
        this.EPOCH_BLOCK = networkConfigs[chainId].epoch || 0;
        this.BATCH_CONTRACT = networkConfigs[chainId].batch;
    }
}

module.exports = Config;
