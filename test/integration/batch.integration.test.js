const protocolHelper = require("../../test/utils/protocolHelper");
const expect = require("chai").expect;
const startGanache = require("../../test/utils/ganache");
const App = require("../../src/app");

const AGENT_ACCOUNT = "0x868D9F52f84d33261c03C8B77999f83501cF5A99";
const DEFAULT_REWARD_ADDRESS = "0x0000000000000000000000000000000000000045";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

let app, accounts, snapId, helper, web3, ganache, provider;

const exitWithError = (error) => {
  console.error(error);
  process.exit(1);
};

const bootNode = async (config) => {
  const sentinelConfig = protocolHelper.getSentinelConfig(config);
  app = new App(sentinelConfig);
  app.start();
  while (!app.isInitialized()) {
    await protocolHelper.timeout(5000);
  }
};

const closeNode = async (force = false) => {
  if (app !== undefined) {
    return app.shutdown(force);
  }
};

describe("Batch liquidation tests", () => {
  before(async function () {
    ganache = await startGanache();
    provider = await ganache.provider;
    helper = await protocolHelper.setup(provider, AGENT_ACCOUNT);
    helper.provider = provider;
    helper.togaAddress = helper.sf.toga.options.address;
    helper.batchAddress = helper.sf.batch.options.address;
    web3 = helper.web3;
    accounts = helper.accounts;
    snapId = await ganache.helper.takeEvmSnapshot(provider);
  });

  beforeEach(async () => {
  });

  afterEach(async () => {
    try {
      console.log("loading snapshot...");
      const result = await ganache.helper.revertToSnapShot(provider, snapId);
      snapId = await ganache.helper.takeEvmSnapshot(provider);
      expect(result).to.be.true;
    } catch (err) {
      protocolHelper.exitWithError(err);
    }
  });

  after(async () => {
    if(!app._isShutdown) {
      await closeNode(true);
    }
    await ganache.close();
  });

  it.only("Send a batch Liquidation to close multi streams", async () => {
    console.log("Batch Contract address : " + helper.sf.batch.options.address);
    try {
      for(let i = 1; i <= 5; i++) {
        await helper.operations.createStream(helper.sf.superToken.options.address, accounts[i], accounts[0], "1000000000000000");
      }
      await ganache.helper.timeTravelOnce(provider, web3, 60);
      let tx;
      for(let i = 1; i <= 5; i++) {
        tx = await helper.sf.superToken.methods.transferAll(accounts[9]).send({ from: accounts[i],  gas: 1000000 });
      }
      await ganache.helper.timeTravelOnce(provider, web3, 60);

      await bootNode({
        pic: ZERO_ADDRESS,
        resolver: helper.sf.resolver.options.address,
        batch_contract: helper.sf.batch.options.address,
        toga_contract: helper.togaAddress,
        max_tx_number: 5,
        liquidation_job_awaits: 15000,
        log_level: "debug"
      });
      await ganache.helper.timeTravelOnce(provider, web3, 1000, app, true);
      const result = await protocolHelper.waitForEventAtSameBlock(helper, app, ganache, "AgreementLiquidatedV2", 5, tx.blockNumber);
      await app.shutdown();
      expect(result).gt(tx.blockNumber);
    } catch (err) {
      exitWithError(err);
    }
  });

});
