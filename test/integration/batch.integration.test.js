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
    if(!app._isShutdown) {
      await closeNode(true);
    }
    await ganache.close();
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
      await bootNode({batch_contract: batchContract._address, polling_interval: 1, max_tx_number: 5});
      await ganache.helper.timeTravelOnce(1000, app, true);
      const result = await protocolHelper.waitForEventAtSameBlock(protocolVars, app, ganache, "AgreementLiquidatedV2", 5, tx.blockNumber);
      await app.shutdown();
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
      await bootNode({batch_contract: batchContract._address, polling_interval: 1, max_tx_number: 3});
      await ganache.helper.timeTravelOnce(1000, app, true);
      const result1 = await protocolHelper.waitForEventAtSameBlock(protocolVars, app, ganache, "AgreementLiquidatedV2", 3, tx.blockNumber);
      const result2 = await protocolHelper.waitForEventAtSameBlock(protocolVars, app, ganache, "AgreementLiquidatedV2", 2, result1);
      await app.shutdown();
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
      await bootNode({batch_contract: batchContract._address, polling_interval: 1, max_tx_number: 10});
      // blockGasLimit random number picked lower than the gas limit of the tx needed for batch call
      app.setTestFlag("REVERT_ON_BLOCK_GAS_LIMIT", { blockGasLimit: 6894439 });
      await ganache.helper.timeTravelOnce(1000, app, true);
      const result1 = await protocolHelper.waitForEventAtSameBlock(protocolVars, app, ganache, "AgreementLiquidatedV2", 5, tx.blockNumber);
      const result2 = await protocolHelper.waitForEventAtSameBlock(protocolVars, app, ganache, "AgreementLiquidatedV2", 5, result1 + 1);
      await app.shutdown();
      expect(result1).gt(tx.blockNumber);
      expect(result2).gt(result1);
    } catch (err) {
      exitWithError(err);
    }
  });
});
