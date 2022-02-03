const protocolHelper = require("../utils/protocolHelper");
const expect = require("chai").expect;
const ganache = require("../utils/ganache");
const App = require("../../src/app");

const AGENT_ACCOUNT = "0x868D9F52f84d33261c03C8B77999f83501cF5A99";

let app, accounts, snapId, protocolVars, web3;

const bootNode = async (config) => {
  const sentinelConfig = protocolHelper.getSentinelConfig(config);
  app = new App(sentinelConfig);
  app.start();
  while (!app.isInitialized()) {
    await protocolHelper.timeout(3000);
  }
};

const closeNode = async (force = false) => {
  if (app !== undefined) {
    return app.shutdown(force);
  }
};

describe("IDA integration tests", () => {
  before(async function () {
    protocolVars = await protocolHelper.setup(ganache.provider, AGENT_ACCOUNT);
    web3 = protocolVars.web3;
    accounts = protocolVars.accounts;
    snapId = await ganache.helper.takeEvmSnapshot();
  });

  beforeEach(async () => {
  });

  afterEach(async () => {
    try {
      snapId = await ganache.helper.revertToSnapShot(snapId.result);
    } catch (err) {
      exitWithError(err);
    }
  });

  after(async () => {
    if(!app._isShutdown) {
      await closeNode(true);
    }
    await ganache.close();
  });

  it("Get critical after IDA distribuiton", async () => {
    try {
      const cfaData = protocolVars.cfa.methods.createFlow(
        protocolVars.superToken._address,
        accounts[2],
        "1000000000000",
        "0x"
      ).encodeABI();
      await protocolVars.host.methods.callAgreement(protocolVars.cfa._address, cfaData, "0x").send({
        from: accounts[0],
        gas: 1000000
      });
      await ganache.helper.timeTravelOnce(60);
      await bootNode({pic: accounts[0]});
      const data = protocolVars.ida.methods.createIndex(
        protocolVars.superToken._address, 6, "0x"
      ).encodeABI();
      await protocolVars.host.methods.callAgreement(protocolVars.ida._address, data, "0x").send({
        from: accounts[0],
        gas: 1000000
      });
      const subscriptionData = protocolVars.ida.methods.updateSubscription(
        protocolVars.superToken._address, 6, accounts[1], 100, "0x"
      ).encodeABI();
      await protocolVars.host.methods.callAgreement(protocolVars.ida._address, subscriptionData, "0x").send({
        from: accounts[0],
        gas: 1000000
      });
      const approveSubData = protocolVars.ida.methods.approveSubscription(
        protocolVars.superToken._address, accounts[0], 6, "0x"
      ).encodeABI();
      await protocolVars.host.methods.callAgreement(protocolVars.ida._address, approveSubData, "0x").send({
        from: accounts[1],
        gas: 1000000
      });
      await ganache.helper.timeTravelOnce(60);
      const balance = await protocolVars.superToken.methods.realtimeBalanceOfNow(accounts[0]).call();
      const availableBalance = web3.utils.toBN(balance.availableBalance.toString());
      const distData = protocolVars.ida.methods.distribute(
        protocolVars.superToken._address,
        6,
        availableBalance.sub(web3.utils.toBN("1000000000000")).toString(),
        "0x"
      ).encodeABI();
      const tx = await protocolVars.host.methods.callAgreement(protocolVars.ida._address, distData, "0x").send({
        from: accounts[0],
        gas: 1000000
      });
      const result = await protocolHelper.waitForEvent(protocolVars, app, ganache, "AgreementLiquidatedBy", tx.blockNumber);
      await app.shutdown();
      protocolHelper.expectLiquidation(result[0], AGENT_ACCOUNT, accounts[0]);
    } catch (err) {
      exitWithError(err);
    }
  });
});
