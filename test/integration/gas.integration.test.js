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
    await protocolHelper.timeout(5000);
  }
};

const closeNode = async (force = false) => {
  if (app !== undefined) {
    return app.shutdown(force);
  }
};

describe("Gas Integration tests", () => {
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
      protocolHelper.exitWithError(err);
    }
  });

  after(async () => {
    if(!app._isShutdown) {
      await closeNode(true);
    }
    await ganache.close();
  });

  it("Scale gas on timeout", async () => {
    try {
      const data = protocolVars.cfa.methods.createFlow(
        protocolVars.superToken._address,
        accounts[2],
        "10000000000000000",
        "0x"
      ).encodeABI();
      await protocolVars.host.methods.callAgreement(protocolVars.cfa._address, data, "0x").send({
        from: accounts[0],
        gas: 1000000
      });
      const tx = await protocolVars.superToken.methods.transferAll(accounts[2]).send({
        from: accounts[0],
        gas: 1000000
      });
      await bootNode({pic: accounts[0], tx_timeout: 2});
      app.setTestFlag("TIMEOUT_ON_LOW_GAS_PRICE", { minimumGas: 3000000000 });
      const result = await protocolHelper.waitForEvent(protocolVars, app, ganache, "AgreementLiquidatedBy", tx.blockNumber);
      await app.shutdown();
      protocolHelper.expectLiquidation(result[0], AGENT_ACCOUNT, accounts[0]);
    } catch (err) {
      protocolHelper.exitWithError(err);
    }
  });
});
