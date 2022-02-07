require("./loadCmdArgs");
const manifest = require("../../manifest.json");

class Config {
  constructor (config) {
    if (typeof config === "object") {
      // used by tests
      // TODO: make less redundant
      this.RUN_TEST_ENV = !(config.run_test_env === "false");
      this.LOG_LEVEL = "debug";
      this.HTTP_RPC_NODE = config.http_rpc_node;
      this.OBSERVER = config.observer === "true";
      this.MNEMONIC = config.mnemonic;
      this.MNEMONIC_INDEX = config.mnemonic_index;
      this.PRIVATE_KEY = config.private_key;
      this.MAX_QUERY_BLOCK_RANGE = config.max_query_block_range || 2000;
      if (config.tokens !== undefined && config.tokens !== "") {
        this.TOKENS = config.tokens.split(",");
      }
      this.DB = (config.db_path !== undefined && config.db_path !== "") ? config.db_path : "./db.sqlite";
      this.ADDITIONAL_LIQUIDATION_DELAY = config.additional_liquidation_delay || 0;
      this.TX_TIMEOUT = config.tx_timeout * 1000 || 60000;
      this.PROTOCOL_RELEASE_VERSION = config.protocol_release_version || "v1";
      this.MAX_GAS_PRICE = config.max_gas_price || 500000000000;
      this.RETRY_GAS_MULTIPLIER = config.retry_gas_multiplier || 1.15;
      this.POLLING_INTERVAL = config.polling_interval * 1000 || 10000;
      this.PIC = config.pic;
      this.MAX_BATCH_TX = config.max_batch_tx || 10;
      this.BLOCK_OFFSET = config.block_offset || 0;
      this.MAX_TX_NUMBER = config.max_tx_number || 100;
      this.EPOCH_BLOCK = config.epoch_block || 0;
      this.BATCH_CONTRACT = config.batch_contract;
      this.CONCURRENCY = config.concurrency;
      this.COLD_BOOT = config.cold_boot;
      this.NUM_RETRIES = config.number_retries;
      this.RESOLVER = config.resolver;
      this.SHUTDOWN_ON_ERROR = config.shutdown_on_error;
      this.LIQUIDATION_JOB_AWAITS = config.liquidation_job_awaits;
      this.ONLY_LISTED_TOKENS = config.only_listed_tokens === "true";
      this.TOGA_CONTRACT = config.toga_contract;
      this.FASTSYNC = config.fastsync !== "false";
      this.IPFS_GATEWAY = process.env.IPFS_GATEWAY || "https://ipfs.io/ipfs/"
    } else {
      this.HTTP_RPC_NODE = process.env.HTTP_RPC_NODE;
      this.OBSERVER = process.env.OBSERVER === "true";
      this.MNEMONIC = process.env.MNEMONIC;
      this.MNEMONIC_INDEX = process.env.MNEMONIC_INDEX || 0;
      this.PRIVATE_KEY = process.env.PRIVATE_KEY;
      this.MAX_QUERY_BLOCK_RANGE = process.env.MAX_QUERY_BLOCK_RANGE || 2000;
      if (process.env.TOKENS !== undefined && process.env.TOKENS !== "") {
        this.TOKENS = process.env.TOKENS.split(",");
      } else {
        this.TOKENS = undefined;
      }
      this.DB = (process.env.DB_PATH !== undefined && process.env.DB_PATH !== "") ? process.env.DB_PATH : "./db.sqlite";
      this.ADDITIONAL_LIQUIDATION_DELAY = process.env.ADDITIONAL_LIQUIDATION_DELAY || 0;
      this.TX_TIMEOUT = process.env.TX_TIMEOUT * 1000 || 60000;
      this.PROTOCOL_RELEASE_VERSION = process.env.PROTOCOL_RELEASE_VERSION || "v1";
      this.MAX_GAS_PRICE = process.env.MAX_GAS_PRICE || 500000000000;
      this.RETRY_GAS_MULTIPLIER = process.env.RETRY_GAS_MULTIPLIER || 1.15;
      this.PIC = process.env.PIC;
      this.METRICS = process.env.METRICS !== "false"; // default: true
      this.METRICS_PORT = process.env.METRICS_PORT || 3000;
      this.FASTSYNC = process.env.FASTSYNC !== "false";  // default: true
      this.IPFS_GATEWAY = process.env.IPFS_GATEWAY || "https://ipfs.io/ipfs/";

      // extra options: undoc and excluded from cmdline parser. Use .env file to change the defaults.
      this.CONCURRENCY = process.env.CONCURRENCY || 1;
      this.ONLY_LISTED_TOKENS = process.env.ONLY_LISTED_TOKENS === "true"; // default: false
      this.NUM_RETRIES = process.env.NUM_RETRIES || 10;
      this.COLD_BOOT = process.env.COLD_BOOT || 0;
      this.SHUTDOWN_ON_ERROR = process.env.SHUTDOWN_ON_ERROR === "true"; // default: false
      this.LIQUIDATION_JOB_AWAITS = process.env.LIQUIDATION_JOB_AWAITS * 1000 || 30000;
      this.MAX_BATCH_TX = process.env.MAX_BATCH_TX || 10;
      this.RESOLVER = process.env.RESOLVER;
      this.LOG_LEVEL = process.env.LOG_LEVEL || "info";
      this.POLLING_INTERVAL = process.env.POLLING_INTERVAL * 1000 || 30000;
      this.BLOCK_OFFSET = process.env.BLOCK_OFFSET || 12;
      this.MAX_TX_NUMBER = process.env.MAX_TX_NUMBER || 100;
    }

    // token filter also affects ONLY_LISTED_TOKENS
    if (this.TOKENS !== undefined) {
      this.ONLY_LISTED_TOKENS = false;
    }

    if (this.HTTP_RPC_NODE === undefined) {
      throw Error("Config.constructor(): required configuration item missing: HTTP_RPC_NODE");
    }

    if (this.TOKENS !== undefined &&
      Array.from(new Set(this.TOKENS.map(x => x.toLowerCase()))).length !== this.TOKENS.length
    ) {
      throw Error("Config.constructor(): duplicate tokens set from configuration: TOKENS");
    }
  }

  loadNetworkInfo (chainId) {
    this.EPOCH_BLOCK = manifest.networks[chainId].epoch || 0;
    this.BATCH_CONTRACT = manifest.networks[chainId].batch;
    this.TOGA_CONTRACT = manifest.networks[chainId].toga || undefined;
    this.CID = manifest.networks[chainId].cid || undefined;
  }

  getConfigurationInfo () {
    return {
      HTTP_RPC_NODE: this.HTTP_RPC_NODE,
      FASTSYNC: this.FASTSYNC,
      OBSERVER: this.OBSERVER,
      MAX_QUERY_BLOCK_RANGE: this.MAX_QUERY_BLOCK_RANGE,
      TOKENS: this.TOKENS,
      DB_PATH: this.DB,
      ADDITIONAL_LIQUIDATION_DELAY: this.ADDITIONAL_LIQUIDATION_DELAY,
      TX_TIMEOUT: this.TX_TIMEOUT,
      PROTOCOL_RELEASE_VERSION: this.PROTOCOL_RELEASE_VERSION,
      MAX_GAS_PRICE: this.MAX_GAS_PRICE,
      RETRY_GAS_MULTIPLIER: this.RETRY_GAS_MULTIPLIER,
      PIC: this.PIC,
      CONCURRENCY: this.CONCURRENCY,
      ONLY_LISTED_TOKENS: this.ONLY_LISTED_TOKENS,
      NUM_RETRIES: this.NUM_RETRIES,
      COLD_BOOT: this.COLD_BOOT,
      SHUTDOWN_ON_ERROR: this.SHUTDOWN_ON_ERROR,
      METRICS: this.METRICS,
      METRICS_PORT: this.METRICS_PORT,
      LIQUIDATION_JOB_AWAITS: this.LIQUIDATION_JOB_AWAITS,
      MAX_BATCH_TX: this.MAX_BATCH_TX,
      LOG_LEVEL: this.LOG_LEVEL,
      POLLING_INTERVAL: this.POLLING_INTERVAL,
      BLOCK_OFFSET: this.BLOCK_OFFSET,
      MAX_TX_NUMBER: this.MAX_TX_NUMBER
    };
  }
}

module.exports = Config;
