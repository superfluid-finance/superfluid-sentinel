const protocolHelper = require("../utils/protocolHelper");
const expect = require("chai").expect;
const ganache = require("../utils/ganache");
const App = require("../../src/app");

const AGENT_ACCOUNT = "0x868D9F52f84d33261c03C8B77999f83501cF5A99";

let app, accounts, snapId, protocolVars, web3;

// eslint-disable-next-line promise/param-names
const delay = ms => new Promise(res => setTimeout(res, ms));
const exitWithError = (error) => {
  console.error(error);
  process.exit(1);
};

const bootNode = async (delayParam = 0) => {
  app = new App({
    http_rpc_node: "http://127.0.0.1:8545",
    mnemonic: "clutch mutual favorite scrap flag rifle tone brown forget verify galaxy return",
    mnemonic_index: 100,
    epoch_block: 0,
    db_path: "datadir/testing/test.sqlite",
    protocol_release_version: "test",
    tx_timeout: 20,
    max_query_block_range: 500000,
    max_gas_price: 4000000000,
    concurrency: 1,
    cold_boot: 1,
    only_listed_tokens: 1,
    number_retries: 3,
    additional_liquidation_delay: delayParam,
    block_offset: 1,
    liquidation_run_every: 1000
  });
  app.start();
  while (!app.isInitialized()) {
    await delay(3000);
  }
};

const closeNode = async (force = false) => {
  if (app !== undefined) {
    return app.shutdown(force);
  }
};

const waitForEvent = async (eventName, blockNumber) => {
  await printEstimations();
  while (true) {
    try {
      const newBlockNumber = await web3.eth.getBlockNumber();
      console.log(`${blockNumber} - ${newBlockNumber}`);
      const events = await protocolVars.superToken.getPastEvents(eventName, {
        fromBlock: blockNumber,
        toBlock: newBlockNumber
      });
      if (events.length > 0) {
        return events;
      }
      await delay(1000);
      await ganache.helper.timeTravelOnce(1, app, true);
    } catch (err) {
      exitWithError(err);
    }
  }
};

const printEstimations = async () => {
  console.log("==========ESTIMATIONS==========");
  const estimations = await app.getEstimations();
  for (const est of estimations) {
    console.log(`SuperToken: ${est.superToken} - account: ${est.address} : ${new Date(est.zestimation)}`);
  }
  console.log("===============================");
};

const expectLiquidation = (event, node, account) => {
  expect(event.returnValues.liquidatorAccount).to.equal(node);
  expect(event.returnValues.bailoutAmount).to.equal("0");
  expect(event.returnValues.penaltyAccount).to.equal(account);
};

describe("GAS Integration tests", () => {
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
    closeNode(true);
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
      await bootNode(-900);
      app.setTestFlag("TIMEOUT_ON_LOW_GAS_PRICE", { minimumGas: 2000000000 });
      const result = await waitForEvent("AgreementLiquidatedBy", tx.blockNumber);
      expectLiquidation(result[0], AGENT_ACCOUNT, accounts[0]);
    } catch (err) {
      exitWithError(err);
    }
  });
});
