require("./loadCmdArgs");
const networkConfigs = require("../../package.json").networks;

class Config {

    constructor(config) {
        if(typeof config === "object") {
            // used by tests
            // TODO: make less redundant
            this.RUN_TEST_ENV = true;
            this.LOG_LEVEL = "debug";

            this.HTTP_RPC_NODE = config.http_rpc_node;
            this.WS_RPC_NODE = config.ws_rpc_node;
            this.MNEMONIC = config.mnemonic;
            this.MNEMONIC_INDEX = config.mnemonic_index;
            this.PRIVATE_KEY = config.private_key;
            this.MAX_QUERY_BLOCK_RANGE = config.max_query_block_range || 2000;
            if(config.tokens !== undefined && config.tokens !== "") {
                this.TOKENS = config.tokens.split(",");
            }
            this.DB = (config.db_path !== undefined && config.db_path !== "") ? config.db_path : "./db.sqlite";
            this.ADDITIONAL_LIQUIDATION_DELAY = config.additional_liquidation_delay || 0;
            this.TX_TIMEOUT = config.tx_timeout*1000 || 60000;
            this.PROTOCOL_RELEASE_VERSION = config.protocol_release_version || "v1";
            this.MAX_GAS_PRICE = config.max_gas_price || 500000000000;
            this.RETRY_GAS_MULTIPLIER = config.retry_gas_multiplier || 1.15;
            this.CLO_ADDR = config.clo_addr;

            this.EPOCH_BLOCK = config.epoch_block;
            this.BATCH_CONTRACT =config.batch_contract;

            this.CONCURRENCY = config.concurrency;
            this.COLD_BOOT = config.cold_boot;
            this.LISTEN_MODE = config.listen_mode;
            this.NUM_RETRIES = config.number_retries;
            this.TEST_RESOLVER = config.test_resolver;
            this.SHUTDOWN_ON_ERROR = config.shutdown_on_error;
            this.LIQUIDATION_JOB_AWAITS = config.liquidation_job_awaits;
        } else {

            this.HTTP_RPC_NODE = process.env.HTTP_RPC_NODE;
            this.WS_RPC_NODE = process.env.WS_RPC_NODE;
            this.MNEMONIC = process.env.MNEMONIC;
            this.MNEMONIC_INDEX = process.env.MNEMONIC_INDEX || 0;
            this.PRIVATE_KEY = process.env.PRIVATE_KEY;
            this.MAX_QUERY_BLOCK_RANGE = process.env.MAX_QUERY_BLOCK_RANGE || 2000;
            if(process.env.TOKENS !== undefined && process.env.TOKENS !== "") {
                this.TOKENS = process.env.TOKENS.split(",");
            }
            this.DB = (process.env.DB_PATH !== undefined && process.env.DB_PATH !== "") ? process.env.DB_PATH : "./db.sqlite";
            this.ADDITIONAL_LIQUIDATION_DELAY = process.env.ADDITIONAL_LIQUIDATION_DELAY || 0;
            this.TX_TIMEOUT = process.env.TX_TIMEOUT*1000 || 60000;
            this.PROTOCOL_RELEASE_VERSION = process.env.PROTOCOL_RELEASE_VERSION || "v1";
            this.MAX_GAS_PRICE = process.env.MAX_GAS_PRICE || 500000000000;
            this.RETRY_GAS_MULTIPLIER = process.env.RETRY_GAS_MULTIPLIER || 1.15;
            this.CLO_ADDR = process.env.CLO_ADDR;

            //extra options: undoc and excluded from cmdline parser. Use .env file to change the defaults.
            this.CONCURRENCY = process.env.CONCURRENCY || 1;
            this.LISTEN_MODE = process.env.LISTEN_MODE || 0;
            this.NUM_RETRIES = process.env.NUM_RETRIES || 10;
            this.COLD_BOOT = process.env.COLD_BOOT || 0;
            this.SHUTDOWN_ON_ERROR = process.env.SHUTDOWN_ON_ERROR || false;
            this.METRICS = process.env.METRICS || true;
            this.METRICS_PORT = process.env.METRICS_PORT || 3000;
            this.LIQUIDATION_JOB_AWAITS = process.env.LIQUIDATION_JOB_AWAITS*1000 || 30000;
            this.MAX_BATCH_TX = process.env.MAX_BATCH_TX || 20;
            this.LOG_LEVEL = process.env.LOG_LEVEL || "info"
        }

        if (this.HTTP_RPC_NODE === undefined) {
            throw Error('required configuration item missing: HTTP_RPC_NODE');
        }
        if (this.WS_RPC_NODE === undefined) {
            throw Error('required configuration item missing: WS_RPC_NODE');
        }
    }

    loadNetworkInfo(chainId) {
        this.EPOCH_BLOCK = networkConfigs[chainId].epoch || 0;
        this.BATCH_CONTRACT = networkConfigs[chainId].batch;
    }

    getConfigurationInfo() {
        return {
            HTTP_RPC_NODE: this.HTTP_RPC_NODE,
            WS_RPC_NODE: this.WS_RPC_NODE,
            MAX_QUERY_BLOCK_RANGE: this.MAX_QUERY_BLOCK_RANGE,
            TOKENS: this.TOKENS,
            DB_PATH: this.DB,
            ADDITIONAL_LIQUIDATION_DELAY: this.ADDITIONAL_LIQUIDATION_DELAY,
            TX_TIMEOUT: this.TX_TIMEOUT,
            PROTOCOL_RELEASE_VERSION: this.PROTOCOL_RELEASE_VERSION,
            MAX_GAS_PRICE: this.MAX_GAS_PRICE,
            RETRY_GAS_MULTIPLIER: this.RETRY_GAS_MULTIPLIER,
            CLO_ADDR: this.CLO_ADDR,
            CONCURRENCY: this.CONCURRENCY,
            LISTEN_MODE: this.LISTEN_MODE,
            NUM_RETRIES: this.NUM_RETRIES,
            COLD_BOOT: this.COLD_BOOT,
            SHUTDOWN_ON_ERROR: this.SHUTDOWN_ON_ERROR,
            METRICS: this.METRICS,
            METRICS_PORT: this.METRICS_PORT,
            LIQUIDATION_JOB_AWAITS: this.LIQUIDATION_JOB_AWAITS,
            MAX_BATCH_TX: this.MAX_BATCH_TX,
            LOG_LEVEL: this.LOG_LEVEL
        }
    }
}

module.exports = Config;
