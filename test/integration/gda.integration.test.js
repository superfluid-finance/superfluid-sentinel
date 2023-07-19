const protocolHelper = require("../../test/utils/protocolHelper");
const expect = require("chai").expect;
const startGanache = require("../../test/utils/ganache");
const App = require("../../src/app");

const AGENT_ACCOUNT = "0x868D9F52f84d33261c03C8B77999f83501cF5A99";
const DEFAULT_REWARD_ADDRESS = "0x0000000000000000000000000000000000000045";

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

describe("GDA integration tests", () => {
  before(async function () {
    ganache = await startGanache();
    provider = await ganache.provider;
    helper = await protocolHelper.setup(provider, AGENT_ACCOUNT);
    helper.provider = provider;
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

  it("should make estimation on flowDistribution, make liquidation", async () => {
    try {
      // create pool
      const poolAddress = await helper.operations.createPoolGDA(helper.sf.superToken.options.address, accounts[0], accounts[0]);
      await helper.operations.updateMemberGDA(poolAddress, accounts[0], accounts[2], "100");
      const tx = await helper.operations.distributeFlow(helper.sf.superToken.options.address, accounts[0], poolAddress, "10000000000000000");
      await helper.sf.superToken.methods.transferAll(accounts[2]).send({
        from: accounts[0],
        gas: 1000000
      });
      await ganache.helper.timeTravelOnce(provider, web3,1);
      await bootNode({pic: DEFAULT_REWARD_ADDRESS, resolver: helper.sf.resolver.options.address});
      await ganache.helper.timeTravelUntil(provider, web3,60);
      const result = await protocolHelper.waitForEvent(helper, app, ganache, "AgreementLiquidatedV2", tx.blockNumber);
      await app.shutdown();
      protocolHelper.expectLiquidationV2(result[0], AGENT_ACCOUNT, accounts[0], "0");
    } catch (err) {
      protocolHelper.exitWithError(err);
    }
  });

  it("should subscribe to new token and make estimation on flowDistribution from eventLoop", async () => {
    try {
      const poolAddress = await helper.operations.createPoolGDA(helper.sf.superToken.options.address, accounts[0], accounts[0]);
      await helper.operations.updateMemberGDA(poolAddress, accounts[0], accounts[2], "100");
      await ganache.helper.timeTravelOnce(provider, web3, 1);
      await bootNode({pic: DEFAULT_REWARD_ADDRESS, resolver: helper.sf.resolver.options.address, log_level: "debug"});
      await ganache.helper.timeTravelOnce(provider, web3,60);
      const tx = await helper.operations.distributeFlow(helper.sf.superToken.options.address, accounts[0], poolAddress, "10000000000000000");
      await helper.sf.superToken.methods.transferAll(accounts[2]).send({
        from: accounts[0],
        gas: 1000000
      });
      await ganache.helper.timeTravelUntil(provider, web3, 1, 20);

      // sentinel should have pick new token from distributeFlow
      const activityLog = app.circularBuffer.get(0);
      expect(activityLog.event).to.equal(helper.sf.superToken.options.address.toString());

      const result = await protocolHelper.waitForEvent(helper, app, ganache, "AgreementLiquidatedV2", tx.blockNumber);
      await app.shutdown();
      protocolHelper.expectLiquidationV2(result[0], AGENT_ACCOUNT, accounts[0], "0");
  } catch (err) {
    protocolHelper.exitWithError(err);
  }
  });
});
