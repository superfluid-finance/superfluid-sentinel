const ConfigModule = require("../../src/config/configuration");
const expect = require("chai").expect;

// Define default configuration.
const defaultConfig = {
  HTTP_RPC_NODE: "http://127.0.0.1:8545",
  MNEMONIC: "clutch mutual favorite scrap flag rifle tone brown forget verify galaxy return",
  MNEMONIC_INDEX: 0,
  PRIVATE_KEY: "0x4b2058f23c4a47002e35c06e9c0beb6af7ff8f1638dee7e38dec852a3b4aef84",
  MAX_QUERY_BLOCK_RANGE: 100,
  TOKENS: "0x79DA1bBa37Ce32c094c7373B4c2F87e27DaA7C19,0x92b83E6c3d7279c9dE09d99604a479468aF02De9,0xc752367ea7C1B19ea0b531bBa5eb4502E967ccFa",
  DB_PATH: "test/db.sqlite",
  ADDITIONAL_LIQUIDATION_DELAY: 10,
  TX_TIMEOUT: 100,
  PROTOCOL_RELEASE_VERSION: "v1",
  MAX_GAS_PRICE: 500,
  RETRY_GAS_MULTIPLIER: 1.1,
  PIC: "0xAB4075f621100563f4551C0Ca50944809b03E948",
  CONCURRENCY: 1,
  ONLY_LISTED_TOKENS: false,
  NUM_RETRIES: 5,
  COLD_BOOT: 0,
  SHUTDOWN_ON_ERROR: true,
  METRICS: true,
  METRICS_PORT: 3555,
  LIQUIDATION_JOB_AWAITS: 55,
  MAX_BATCH_TX: 5,
  LOG_LEVEL: "debug",
  POLLING_INTERVAL: 10,
  BLOCK_OFFSET: 2,
  MAX_TX_NUMBER: 50,
  OBSERVER: true,
  FASTSYNC: false,
  IPFS_GATEWAY: "http://localhost:8080/ipfs/",
  PIRATE: false,
  NO_REMOTE_MANIFEST: false
};

// set environment variables from the given config object
function setEnvironmentVariables(config) {
  for (const [key, value] of Object.entries(config)) {
    process.env[key] = value;
  }
}

// clear all environment variables set from the given config object
function clearEnvironmentVariables(config) {
  for (const key of Object.keys(config)) {
    delete process.env[key];
  }
}

describe("Test Agent user configurations", () => {

  beforeEach(() => {
    setEnvironmentVariables(defaultConfig);
  });

  afterEach(() => {
    clearEnvironmentVariables(defaultConfig);
  });

  // The actual test.
  it("#1.1 - should boot agent with env variables", () => {
    const config = new ConfigModule();
    for (const [key, value] of Object.entries(config)) {
      expect(config[key]).to.equal(value);
    }
  });
});
