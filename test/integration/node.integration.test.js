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
        ws_rpc_node: "ws://127.0.0.1:8545",
        http_rpc_node: "http://127.0.0.1:8545",
        mnemonic: "clutch mutual favorite scrap flag rifle tone brown forget verify galaxy return",
        mnemonic_index: 100,
        epoch_block: 0,
        db_path: "datadir/test.sqlite",
        protocol_release_version: "test",
        tx_timeout: 300000,
        max_query_block_range: 500000,
        max_gas_price: 4000000000,
        concurrency: 1,
        cold_boot: 1,
        only_listed_tokens: 1,
        number_retries: 3,
        additional_liquidation_delay: delayParam,
        liquidation_run_every: 1000,
        pic: accounts[0],
        toga_contract: protocolVars.toga._address
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

const expectBailout = (event, node, account) => {
    expect(event.returnValues.liquidatorAccount).to.equal(node);
    expect(event.returnValues.bailoutAmount).not.equal("0");
    expect(event.returnValues.penaltyAccount).to.equal(account);
};
describe("Agent configurations tests", () => {
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

    it("Should use delay paramater when sending liquidation", async () => {
        try {
            const data = protocolVars.cfa.methods.createFlow(
                protocolVars.superToken._address,
                accounts[2],
                "100000000000",
                "0x"
            ).encodeABI();
            await protocolVars.host.methods.callAgreement(protocolVars.cfa._address, data, "0x").send({
                from: accounts[0],
                gas: 1000000
            });
            await bootNode(2700);
            const tx = await protocolVars.superToken.methods.transferAll(accounts[2]).send({
                from: accounts[0],
                gas: 1000000
            });
            await ganache.helper.timeTravelOnce(3580, app, true);
            const result = await waitForEvent("AgreementLiquidatedBy", tx.blockNumber);
            expect(result[0].returnValues.liquidatorAccount).to.equal(AGENT_ACCOUNT);
        } catch (err) {
            exitWithError(err);
        }
    });

    it("Change state if not getting new blocks", async () => {
        try {
            const data = protocolVars.cfa.methods.createFlow(
                protocolVars.superToken._address,
                accounts[2],
                "100000000000",
                "0x"
            ).encodeABI();
            await protocolVars.host.methods.callAgreement(protocolVars.cfa._address, data, "0x").send({
                from: accounts[0],
                gas: 1000000
            });
            await bootNode();
            let healthy;
            while (true) {
                await delay(9000);
                const report = await app.healthReport.fullReport();
                healthy = report.healthy;
                if (!healthy) break;
            }
            expect(healthy).eq(false);
        } catch (err) {
            exitWithError(err);
        }
    });

    it("Get PIC on Boot and change after", async () => {
        try {
            const data = protocolVars.cfa.methods.createFlow(
                protocolVars.superToken._address,
                accounts[2],
                "100000000000",
                "0x"
            ).encodeABI();
            await protocolVars.host.methods.callAgreement(protocolVars.cfa._address, data, "0x").send({
                from: accounts[0],
                gas: 1000000
            });
            //became pic
            await protocolVars.superToken.methods.transfer(protocolVars.toga._address, "100000000000000000").send({
                from: accounts[0],
                gas: 1000000
            });
            await bootNode();
            let picInfo
            while (true) {
                await delay(5000);
                picInfo = await app.getPICInfo(protocolVars.superToken._address);
                if (picInfo.length > 0) break;
            }
            expect(picInfo[0].pic).to.be.equal(accounts[0]);
            //PIC changes
            await protocolVars.superToken.methods.transfer(protocolVars.toga._address, "100000000000000000").send({
                from: accounts[1],
                gas: 1000000
            });
            while (true) {
                await delay(5000);
                picInfo = await app.getPICInfo(protocolVars.superToken._address);
                if (picInfo.length > 0) break;
            }
            expect(picInfo[0].pic).to.be.equal(accounts[1]);
        } catch (err) {
            exitWithError(err);
        }
    });
    // not yet supported
    it.skip("Start node, subscribe to new Token and perform estimation", async () => {
        try {
            await bootNode();
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
            while (true) {
                const estimation = await app.db.queries.getAddressEstimation(accounts[0]);
                if (estimation.length > 0) {
                    console.log(estimation);
                    break;
                }
                await delay(1000);
            }
            await delay(1000);
            const tx = await protocolVars.superToken.methods.transferAll(accounts[2]).send({
                from: accounts[0],
                gas: 1000000
            });
            const result = await waitForEvent("AgreementLiquidatedBy", tx.blockNumber);
            expectLiquidation(result[0], AGENT_ACCOUNT, accounts[0]);
        } catch (err) {
            exitWithError(err);
        }
    });
    // not yet supported
    it.skip("When token is listed afterwards, and there is already existing negative accounts, liquidations should still be performed", async () => {
        try {
            const data = protocolVars.cfa.methods.createFlow(
                protocolVars.superToken._address,
                accounts[2],
                "1000000000000000000",
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
            //  const timestamp = await ganache.helper.timeTravelOnce(3600 * 4);
            await bootNode();
            const result = await waitForEvent("AgreementLiquidatedBy", tx.blockNumber);
            expectBailout(result[0], AGENT_ACCOUNT, accounts[0]);
        } catch (err) {
            exitWithError(err);
        }
    });
});
