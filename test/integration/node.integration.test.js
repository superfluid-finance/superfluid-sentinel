const protocolHelper = require("../../test/utils/protocolHelper");
const expect = require("chai").expect;
const startGanache = require("../../test/utils/ganache");
const App = require("../../src/app");

const AGENT_ACCOUNT = "0x868D9F52f84d33261c03C8B77999f83501cF5A99";

let app, accounts, snapId, protocolVars, web3, ganache, provider;

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

describe("Agent configurations tests", () => {

    before(async function () {
        ganache = await startGanache();
        provider = await ganache.provider;
        protocolVars = await protocolHelper.setup(provider, AGENT_ACCOUNT);
        web3 = protocolVars.web3;
        accounts = protocolVars.accounts;
        snapId = await ganache.helper.takeEvmSnapshot(provider);
    });

    beforeEach(async () => {
    });

    afterEach(async () => {
        try {
            await ganache.helper.revertToSnapShot(provider, snapId);
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

    it("Should use delay paramater when sending liquidation", async () => {
        try {
            console.log("EHRUHAEKLRHAEKRH")
            expect(false).eq(false);
            /*
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
            await ganache.helper.timeTravelOnce(1);
            await bootNode({additional_liquidation_delay: 2700});
            const tx = await protocolVars.superToken.methods.transferAll(accounts[2]).send({
                from: accounts[0],
                gas: 1000000
            });
            await ganache.helper.timeTravelOnce(3580, app, true);
            const result = await protocolHelper.waitForEvent(protocolVars, app, ganache, "AgreementLiquidatedV2", tx.blockNumber);
            await app.shutdown();
            expect(result[0].returnValues.liquidatorAccount).to.equal(AGENT_ACCOUNT);

             */
        } catch (err) {
            protocolHelper.exitWithError(err);
        }
    });

    it.skip("Change state if not getting new blocks", async () => {
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
            await ganache.helper.timeTravelOnce(1);
            await bootNode();
            let healthy;
            while (true) {
                await protocolHelper.timeout(9000);
                const report = await app.healthReport.fullReport();
                healthy = report.healthy;
                if (!healthy) break;
            }
            await app.shutdown();
            expect(healthy).eq(false);
        } catch (err) {
            protocolHelper.exitWithError(err);
        }
    });

    it.skip("Get PIC on Boot and change after", async () => {
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
            await ganache.helper.timeTravelOnce(5);
            await bootNode({toga_contract: protocolVars.toga._address});
            let picInfo
            while (true) {
                await protocolHelper.timeout(5000);
                picInfo = await app.getPICInfo(protocolVars.superToken._address);
                if (picInfo.length > 0) break;
            }

            expect(picInfo[0].pic).to.be.equal(accounts[0]);
            //PIC changes
            await protocolVars.superToken.methods.transfer(protocolVars.toga._address, "100000000000000000").send({
                from: accounts[1],
                gas: 1000000
            });
            await ganache.helper.timeTravelOnce(5);
            while (true) {
                await protocolHelper.timeout(8000);
                picInfo = await app.getPICInfo(protocolVars.superToken._address);
                if (picInfo.length > 0) break;
            }
            await app.shutdown();
            expect(picInfo[0].pic).to.be.equal(accounts[1]);
        } catch (err) {
            protocolHelper.exitWithError(err);
        }
    });

    it.skip("When observer, no need for wallet / address", async () => {
        try{
            await bootNode({observer: "true", fastsync: "false"});
            expect(app.getConfigurationInfo().OBSERVER).to.be.true;
            await app.shutdown();
        } catch(err) {
            protocolHelper.exitWithError(err);
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
                const estimation = await app.db.queries.getAddressEstimations(accounts[0]);
                if (estimation.length > 0) {
                    console.log(estimation);
                    break;
                }
                await protocolHelper.timeout(1000);
            }
            await protocolHelper.timeout(1000);
            const tx = await protocolVars.superToken.methods.transferAll(accounts[2]).send({
                from: accounts[0],
                gas: 1000000
            });
            const result = await protocolHelper.waitForEvent(protocolVars, app, ganache, "AgreementLiquidatedV2", tx.blockNumber);
            protocolHelper.expectLiquidationV2(result[0], AGENT_ACCOUNT, accounts[0], "0");
        } catch (err) {
            protocolHelper.exitWithError(err);
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
            const result = await protocolHelper.waitForEvent(protocolVars, app, ganache, "AgreementLiquidatedV2", tx.blockNumber);
            protocolHelper.expectLiquidationV2(result[0], AGENT_ACCOUNT, accounts[0], "0");
        } catch (err) {
            protocolHelper.exitWithError(err);
        }
    });
});
