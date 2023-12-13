require("./loadCmdArgs");
const localManifest = require("../../manifest.json");
const metadata = require("@superfluid-finance/metadata/networks.json");
const axios = require("axios");

class Config {
  constructor (config) {
    if (typeof config === "object") {
      this._initializeFromConfigObject(config);
    } else {
        this._initializeFromEnvVariables();
    }

    // token filter affects ONLY_LISTED_TOKENS and EXCLUDED_TOKENS
    if (this.TOKENS !== undefined) {
      this.ONLY_LISTED_TOKENS = false;
      this.EXCLUDED_TOKENS = undefined;

      // Check for duplicate tokens in TOKENS
      if (this._hasDuplicates(this.TOKENS)) {
        throw Error("Config.constructor(): duplicate tokens set from configuration: TOKENS");
      }
    }

    if (this.EXCLUDED_TOKENS !== undefined && this._hasDuplicates(this.EXCLUDED_TOKENS)) {
        throw Error("Config.constructor(): duplicate tokens set from configuration: EXCLUDED_TOKENS");
    }
    if (this.HTTP_RPC_NODE === undefined) {
      throw Error("Config.constructor(): required configuration item missing: HTTP_RPC_NODE");
    }
  }

  _initializeFromConfigObject(config) {
    this.RUN_TEST_ENV = this._parseToBool(config.run_test_env, true);
    this.LOG_LEVEL = config.log_level;
    this.HTTP_RPC_NODE = config.http_rpc_node;
    this.OBSERVER = this._parseToBool(config.observer);
    this.MNEMONIC = config.mnemonic;
    this.MNEMONIC_INDEX = config.mnemonic_index;
    this.PRIVATE_KEY = config.private_key;
    this.MAX_QUERY_BLOCK_RANGE = config.max_query_block_range || 2000;
    this.TOKENS = config.TOKENS?.split(",");
    this.EXCLUDED_TOKENS = config.EXCLUDED_TOKENS?.split(",");
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
    this.RESOLVER = config.resolver || process.env.RESOLVER_ADDRESS;
    this.SHUTDOWN_ON_ERROR = config.shutdown_on_error;
    this.LIQUIDATION_JOB_AWAITS = config.liquidation_job_awaits;
    this.ONLY_LISTED_TOKENS = this._parseToBool(config.only_listed_tokens);
    this.TOGA_CONTRACT = config.toga_contract;
    this.FASTSYNC = config.fastsync !== "false";
    this.IPFS_GATEWAY = process.env.IPFS_GATEWAY || "https://cloudflare-ipfs.com/ipfs/"
    this.PIRATE = this._parseToBool(config.pirate);
    this.INSTANCE_NAME = config.INSTANCE_NAME || "Sentinel";
  }

  _initializeFromEnvVariables() {
    this.HTTP_RPC_NODE = process.env.HTTP_RPC_NODE;
    this.OBSERVER = this._parseToBool(process.env.OBSERVER, false);
    this.MNEMONIC = process.env.MNEMONIC;
    this.MNEMONIC_INDEX = process.env.MNEMONIC_INDEX || 0;
    this.PRIVATE_KEY = process.env.PRIVATE_KEY;
    this.MAX_QUERY_BLOCK_RANGE = process.env.MAX_QUERY_BLOCK_RANGE || 2000;
    this.TOKENS = undefined;
    this.TOKENS = process.env.TOKENS?.split(",");
    this.EXCLUDED_TOKENS = process.env.EXCLUDED_TOKENS?.split(",");
    this.DB = (process.env.DB_PATH !== undefined && process.env.DB_PATH !== "") ? process.env.DB_PATH : "./db.sqlite";
    this.ADDITIONAL_LIQUIDATION_DELAY = process.env.ADDITIONAL_LIQUIDATION_DELAY || 0;
    this.TX_TIMEOUT = process.env.TX_TIMEOUT * 1000 || 60000;
    this.PROTOCOL_RELEASE_VERSION = process.env.PROTOCOL_RELEASE_VERSION || "v1";
    this.MAX_GAS_PRICE = process.env.MAX_GAS_PRICE || 500000000000;
    this.RETRY_GAS_MULTIPLIER = process.env.RETRY_GAS_MULTIPLIER || 1.15;
    this.PIC = process.env.PIC;
    this.METRICS = this._parseToBool(process.env.METRICS, true);
    this.METRICS_PORT = process.env.METRICS_PORT || 9100;
    this.FASTSYNC = this._parseToBool(process.env.FASTSYNC, true);
    this.IPFS_GATEWAY = process.env.IPFS_GATEWAY || "https://cloudflare-ipfs.com/ipfs/";
    this.PIRATE = this._parseToBool(process.env.PIRATE, false);
    this.SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
    this.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    this.TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    this.TELEMETRY = this._parseToBool(process.env.TELEMETRY, true);
    this.TELEMETRY_URL = process.env.TELEMETRY_URL || "https://sentinel-telemetry.x.superfluid.dev";
    this.TELEMETRY_INTERVAL = process.env.TELEMETRY_INTERVAL * 1000 || 43200000; // defaults to 12 hours

    // extra options: undoc and excluded from cmdline parser. Use .env file to change the defaults.
    this.CONCURRENCY = process.env.CONCURRENCY || 1;
    this.ONLY_LISTED_TOKENS = this._parseToBool(process.env.ONLY_LISTED_TOKENS, false);
    this.NUM_RETRIES = process.env.NUM_RETRIES || 10;
    this.COLD_BOOT = process.env.COLD_BOOT || 0;
    this.SHUTDOWN_ON_ERROR = this._parseToBool(process.env.SHUTDOWN_ON_ERROR, false);
    this.LIQUIDATION_JOB_AWAITS = process.env.LIQUIDATION_JOB_AWAITS * 1000 || 30000;
    this.MAX_BATCH_TX = process.env.MAX_BATCH_TX || 10;
    this.RESOLVER = process.env.RESOLVER;
    this.LOG_LEVEL = process.env.LOG_LEVEL || "info";
    this.POLLING_INTERVAL = process.env.POLLING_INTERVAL * 1000 || 30000;
    this.BLOCK_OFFSET = process.env.BLOCK_OFFSET || 12;
    this.MAX_TX_NUMBER = process.env.MAX_TX_NUMBER || 100;
    this.NO_REMOTE_MANIFEST = this._parseToBool(process.env.NO_REMOTE_MANIFEST, false);
    this.INSTANCE_NAME =  process.env.INSTANCE_NAME || "Sentinel";
  }

  _parseToBool(value, defaultValue = false) {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    if (typeof value === "string") {
      value = value.trim().toLowerCase();
      if (value === "false" || value === "0" || value === "") {
        return false;
      }
      return true;
    }
    return value === true || value === 1;
  }

  _hasDuplicates(array) {
    return Array.from(new Set(array.map(x => x.toLowerCase()))).length !== array.length;
  }

  async getManifestCIDAndNetworkType (chainId, dbFileExist) {
    let schemaVersion = Number(localManifest["schema-version"]);
    let cid = localManifest.networks[chainId]?.cid;
    let networkType = localManifest.networks[chainId]?.network_type;
    let returnError;
    const manifestUrl = "https://raw.githubusercontent.com/superfluid-finance/superfluid-sentinel/master/manifest.json";
    if (!dbFileExist && !this.NO_REMOTE_MANIFEST) {
      try {
        const response = await axios.get(manifestUrl);
        const remoteManifestSchemaVersion = Number(response?.data["schema-version"]);
        // if version don't match, this sentinel is outdated, continue with local file
        if(schemaVersion === remoteManifestSchemaVersion) {
          schemaVersion = remoteManifestSchemaVersion;
          cid = response?.data?.networks?.[chainId]?.cid;
          networkType = response?.data?.networks?.[chainId]?.network_type;
        } else {
          returnError = "Remote manifest schema version don't match local version. Please update sentinel and resync database"
        }

      } catch (error) {
        returnError = error;
      }
    }
    return { cid, networkType, schemaVersion, returnError };
  }

  async loadNetworkInfo (chainId, dbFileExist) {
    const network = metadata.filter(x => x.chainId === Number(chainId))[0];
    if(network === undefined) {
        throw Error(`Config.loadNetworkInfo(): unknown chainId: ${chainId}`);
    }
    const contractsV1 = network.contractsV1 || {};
    this.EPOCH_BLOCK = network.startBlockV1 || 0;
    const { cid, networkType, schemaVersion, returnError } = await this.getManifestCIDAndNetworkType(chainId, dbFileExist);
    this.CID = cid;
    this.NETWORK_TYPE = networkType;
    this.SCHEMA_VERSION = schemaVersion;


    this.BATCH_CONTRACT = contractsV1.batchLiquidator || undefined;
    this.TOGA_CONTRACT = contractsV1.toga || undefined;
    if(this.RESOLVER === undefined) {
      this.RESOLVER = contractsV1.resolver || undefined;
    }
    return returnError;
  }

  getConfigurationInfo () {
    return {
      INSTANCE_NAME: this.INSTANCE_NAME,
      HTTP_RPC_NODE: this.HTTP_RPC_NODE,
      FASTSYNC: this.FASTSYNC,
      OBSERVER: this.OBSERVER,
      MAX_QUERY_BLOCK_RANGE: this.MAX_QUERY_BLOCK_RANGE,
      TOKENS: this.TOKENS,
      EXCLUDED_TOKENS: this.EXCLUDED_TOKENS,
      DB_PATH: this.DB,
      ADDITIONAL_LIQUIDATION_DELAY: this.ADDITIONAL_LIQUIDATION_DELAY,
      TX_TIMEOUT: this.TX_TIMEOUT,
      PROTOCOL_RELEASE_VERSION: this.PROTOCOL_RELEASE_VERSION,
      MAX_GAS_PRICE: this.MAX_GAS_PRICE,
      RETRY_GAS_MULTIPLIER: this.RETRY_GAS_MULTIPLIER,
      PIC: this.PIC,
      PIRATE: this.PIRATE,
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
      MAX_TX_NUMBER: this.MAX_TX_NUMBER,
      SLACK_WEBHOOK_URL: this.SLACK_WEBHOOK_URL,
      TELEGRAM_BOT_TOKEN: this.TELEGRAM_BOT_TOKEN,
      TELEGRAM_CHAT_ID: this.TELEGRAM_CHAT_ID,
    };
  }
}

module.exports = Config;
