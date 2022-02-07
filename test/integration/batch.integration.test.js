const BatchLiquidator = require("@superfluid-finance/ethereum-contracts/build/contracts/BatchLiquidator.json");

const protocolHelper = require("../utils/protocolHelper");
const expect = require("chai").expect;
const ganache = require("../utils/ganache");
const App = require("../../src/app");

const AGENT_ACCOUNT = "0x868D9F52f84d33261c03C8B77999f83501cF5A99";

let app, accounts, snapId, protocolVars, web3, batchContract;

// eslint-disable-next-line promise/param-names
const delay = ms => new Promise(res => setTimeout(res, ms));
const exitWithError = (error) => {
  console.error(error);
  process.exit(1);
};

const deployBatchContract = async () => {
  if (batchContract === undefined) {
    const contract = new web3.eth.Contract(BatchLiquidator.abi);
    const res = await contract.deploy({
      data: BatchLiquidator.bytecode
    }).send({
      from: accounts[0],
      gas: 1500000,
      gasPrice: "1000"
    });
    batchContract = res;
    console.log(`BatchLiquidator address: ${res._address}`);
  }
};

const bootNode = async (delayParam = 0, maxTxNumber) => {
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
    liquidation_run_every: 30000,
    batch_contract: batchContract._address,
    max_tx_number: maxTxNumber,
    fastsync: "false"
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

const waitForEventAtSameBlock = async (eventName, numberOfEvents, blockNumber) => {
  while (true) {
    try {
      console.log(`checking block: ${blockNumber}`);
      const events = await protocolVars.superToken.getPastEvents(eventName, {
        fromBlock: blockNumber,
        toBlock: blockNumber
      });
      if (events.length === numberOfEvents) {
        return Number(events[0].blockNumber);
      }
      await delay(1000);
      await ganache.helper.timeTravelOnce(1, app, true);
      blockNumber += 1;
    } catch (err) {
      exitWithError(err);
    }
  }
};

describe("Integration scripts tests", () => {
  before(async function () {
    protocolVars = await protocolHelper.setup(ganache.provider, AGENT_ACCOUNT);
    web3 = protocolVars.web3;
    accounts = protocolVars.accounts;
    await deployBatchContract();
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

  it("Send a batch Liquidation to close multi streams", async () => {
    try {
      const flowData1 = protocolVars.cfa.methods.createFlow(protocolVars.superToken._address, accounts[0], "1000000000000000", "0x").encodeABI();
      await protocolVars.host.methods.callAgreement(protocolVars.cfa._address, flowData1, "0x").send({
        from: accounts[1],
        gas: 1000000
      });
      await protocolVars.host.methods.callAgreement(protocolVars.cfa._address, flowData1, "0x").send({
        from: accounts[2],
        gas: 1000000
      });
      await protocolVars.host.methods.callAgreement(protocolVars.cfa._address, flowData1, "0x").send({
        from: accounts[3],
        gas: 1000000
      });
      await protocolVars.host.methods.callAgreement(protocolVars.cfa._address, flowData1, "0x").send({
        from: accounts[4],
        gas: 1000000
      });
      await protocolVars.host.methods.callAgreement(protocolVars.cfa._address, flowData1, "0x").send({
        from: accounts[5],
        gas: 1000000
      });
      const tx = await protocolVars.superToken.methods.transferAll(accounts[9]).send({
        from: accounts[1],
        gas: 1000000
      });
      await protocolVars.superToken.methods.transferAll(accounts[9]).send({
        from: accounts[2],
        gas: 1000000
      });
      await protocolVars.superToken.methods.transferAll(accounts[9]).send({
        from: accounts[3],
        gas: 1000000
      });
      await protocolVars.superToken.methods.transferAll(accounts[9]).send({
        from: accounts[4],
        gas: 1000000
      });
      await protocolVars.superToken.methods.transferAll(accounts[9]).send({
        from: accounts[5],
        gas: 1000000
      });
      await bootNode(-900);
      await ganache.helper.timeTravelOnce(1000, app, true);
      const result = await waitForEventAtSameBlock("AgreementLiquidatedBy", 5, tx.blockNumber);
      await closeNode();
      expect(result).gt(tx.blockNumber);
    } catch (err) {
      exitWithError(err);
    }
  });

  it("Don't go over limit of tx per liquidation job", async () => {
    try {
      const flowData1 = protocolVars.cfa.methods.createFlow(protocolVars.superToken._address, accounts[0], "1000000000000000", "0x").encodeABI();
      await protocolVars.host.methods.callAgreement(protocolVars.cfa._address, flowData1, "0x").send({
        from: accounts[1],
        gas: 1000000
      });
      await protocolVars.host.methods.callAgreement(protocolVars.cfa._address, flowData1, "0x").send({
        from: accounts[2],
        gas: 1000000
      });
      await protocolVars.host.methods.callAgreement(protocolVars.cfa._address, flowData1, "0x").send({
        from: accounts[3],
        gas: 1000000
      });
      await protocolVars.host.methods.callAgreement(protocolVars.cfa._address, flowData1, "0x").send({
        from: accounts[4],
        gas: 1000000
      });
      await protocolVars.host.methods.callAgreement(protocolVars.cfa._address, flowData1, "0x").send({
        from: accounts[5],
        gas: 1000000
      });
      const tx = await protocolVars.superToken.methods.transferAll(accounts[9]).send({
        from: accounts[1],
        gas: 1000000
      });
      await protocolVars.superToken.methods.transferAll(accounts[9]).send({
        from: accounts[2],
        gas: 1000000
      });
      await protocolVars.superToken.methods.transferAll(accounts[9]).send({
        from: accounts[3],
        gas: 1000000
      });
      await protocolVars.superToken.methods.transferAll(accounts[9]).send({
        from: accounts[4],
        gas: 1000000
      });
      await protocolVars.superToken.methods.transferAll(accounts[9]).send({
        from: accounts[5],
        gas: 1000000
      });
      await bootNode(-900, 3);
      await ganache.helper.timeTravelOnce(1000, app, true);
      const result1 = await waitForEventAtSameBlock("AgreementLiquidatedBy", 3, tx.blockNumber);
      const result2 = await waitForEventAtSameBlock("AgreementLiquidatedBy", 2, result1);
      await closeNode();
      expect(result1).gt(tx.blockNumber);
      expect(result2).gt(result1);
    } catch (err) {
      exitWithError(err);
    }
  });

  it("Go over the gasLimit, reduce batch size", async () => {
    try {
      for (let i = 1; i <= 5; i++) {
        for (let j = 6; j <= 7; j++) {
          console.log(`Sending from i=${i} , j=${j} , ${accounts[i]} -> ${accounts[j]}`);
          const flow = protocolVars.cfa.methods.createFlow(protocolVars.superToken._address, accounts[j], "1000000000000000", "0x").encodeABI();
          await protocolVars.host.methods.callAgreement(protocolVars.cfa._address, flow, "0x").send({
            from: accounts[i],
            gas: 1000000
          });
        }
      }
      const tx = await protocolVars.superToken.methods.transferAll(accounts[9]).send({
        from: accounts[1],
        gas: 1000000
      });
      await protocolVars.superToken.methods.transferAll(accounts[9]).send({
        from: accounts[2],
        gas: 1000000
      });
      await protocolVars.superToken.methods.transferAll(accounts[9]).send({
        from: accounts[3],
        gas: 1000000
      });
      await protocolVars.superToken.methods.transferAll(accounts[9]).send({
        from: accounts[4],
        gas: 1000000
      });
      await protocolVars.superToken.methods.transferAll(accounts[9]).send({
        from: accounts[5],
        gas: 1000000
      });
      await bootNode(-900, 10);
      await ganache.helper.timeTravelOnce(1000, app, true);
      const result1 = await waitForEventAtSameBlock("AgreementLiquidatedBy", 5, tx.blockNumber);
      const result2 = await waitForEventAtSameBlock("AgreementLiquidatedBy", 5, result1 + 1);
      expect(result1).gt(tx.blockNumber);
      expect(result2).gt(result1);
    } catch (err) {
      exitWithError(err);
    }
  });
});
