const protocolHelper = require("../../test/utils/protocolHelper");
const expect = require("chai").expect;
const startGanache = require("../../test/utils/ganache");
const App = require("../../src/app");

const AGENT_ACCOUNT = "0x868D9F52f84d33261c03C8B77999f83501cF5A99";
const DEFAULT_REWARD_ADDRESS = "0x0000000000000000000000000000000000000045";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

let app, accounts, snapId, helper, web3, ganache, provider;

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

describe("IDA integration tests", () => {
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

  it("Get critical after IDA distribution", async () => {
    try {
      await helper.operations.createStream(helper.sf.superToken.options.address, accounts[0], accounts[2], "1000000000000");
      await ganache.helper.timeTravelOnce(provider, web3,1);
      await bootNode({pic: ZERO_ADDRESS, resolver: helper.sf.resolver.options.address, log_level: "debug", toga_contract: helper.togaAddress});
      await helper.operations.createIDAIndex(helper.sf.superToken.options.address, accounts[0], "6");
      await helper.operations.updateIDASubscription(helper.sf.superToken.options.address, accounts[0], accounts[1], "6", "100");
      await ganache.helper.timeTravelOnce(provider, web3,60);
      const balance = await helper.sf.superToken.methods.realtimeBalanceOfNow(accounts[0]).call();
      const availableBalance = balance.availableBalance;
      const tx = await helper.operations.distributeIDA(helper.sf.superToken.options.address, accounts[0], "6", availableBalance);
      await ganache.helper.timeTravelOnce(provider, web3,60);
      const result = await protocolHelper.waitForEvent(helper, app, ganache, "AgreementLiquidatedV2", tx.blockNumber);
      await app.shutdown();
      protocolHelper.expectLiquidationV2(result[0], AGENT_ACCOUNT, accounts[0], "0");
    } catch (err) {
      
      protocolHelper.exitWithError(err);
    }
  });
});
