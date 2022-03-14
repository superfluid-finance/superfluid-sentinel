const Environment = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-environment");
const IResolver = require("@superfluid-finance/ethereum-contracts/build/contracts/IResolver.json");
const ICFA = require("@superfluid-finance/ethereum-contracts/build/contracts/IConstantFlowAgreementV1.json");
const IIDA = require("@superfluid-finance/ethereum-contracts/build/contracts/IInstantDistributionAgreementV1.json");
const ISuperfluid = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperfluid.json");
const ISuperToken = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperToken.json");
const IToken = require("@superfluid-finance/ethereum-contracts/build/contracts/TestToken.json");
const SuperfluidGovernance = require("@superfluid-finance/ethereum-contracts/build/contracts/SuperfluidGovernanceBase.json");
const TOGA = require("@superfluid-finance/ethereum-contracts/build/contracts/TOGA.json");
const TokenCustodian = require("@superfluid-finance/ethereum-contracts/build/contracts/TokenCustodian.json");

const Web3 = require("web3");
const expect = require("chai").expect;

async function setup(provider, agentAccount) {

    const MIN_BOND_DURATION = 3600 * 24 * 7; // 604800 s

    const web3 = new Web3(provider);
    const accounts = await web3.eth.getAccounts();
    await Environment((error) => {
            if (error) {
                console.log(error);
            }
        }, [":", "fTUSD"], {web3: web3}
    );

    const resolverAddress = process.env.RESOLVER_ADDRESS;
    const superfluidIdent = `Superfluid.test`;
    const resolver = new web3.eth.Contract(IResolver.abi, resolverAddress);
    const superfluidAddress = await resolver.methods.get(superfluidIdent).call();
    const host = new web3.eth.Contract(ISuperfluid.abi, superfluidAddress);
    const govAddress = await host.methods.getGovernance().call();
    const gov = new web3.eth.Contract(SuperfluidGovernance.abi, govAddress);
    await gov.methods.setPPPConfig(host._address,"0x0000000000000000000000000000000000000000", 3600, 900).send({from:accounts[0]});
    const cfaIdent = web3.utils.sha3("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
    const idaIdent = web3.utils.sha3("org.superfluid-finance.agreements.InstantDistributionAgreement.v1");
    const cfaAddress = await host.methods.getAgreementClass(cfaIdent).call();
    const idaAddress = await host.methods.getAgreementClass(idaIdent).call();
    const cfa = new web3.eth.Contract(ICFA.abi, cfaAddress);
    const ida = new web3.eth.Contract(IIDA.abi, idaAddress);
    const superTokenAddress = await resolver.methods.get("supertokens.test.fTUSDx").call();
    const superToken = new web3.eth.Contract(ISuperToken.abi, superTokenAddress);
    const tokenAddress = await superToken.methods.getUnderlyingToken().call();
    const token = new web3.eth.Contract(IToken.abi, tokenAddress);
    /*Deploy TOGA contract*/
    const custodianContract = new web3.eth.Contract(TokenCustodian.abi);
    const custodian = await custodianContract.deploy({data: TokenCustodian.bytecode}).send({from: accounts[0], gas: 500000})
    const togaContract = new web3.eth.Contract(TOGA.abi);
    const toga = await togaContract.deploy({data: TOGA.bytecode, arguments: [superfluidAddress, MIN_BOND_DURATION, custodian._address]}).send({from: accounts[1], gas: 2000000})

    for (const account of accounts) {
        await token.methods.mint(account, "10000000000000000000000").send({from: account});
        await token.methods.approve(superTokenAddress, "10000000000000000000000").send({from: account});
        await superToken.methods.upgrade("10000000000000000000000").send({
            from: account,
            gas: 400000
        });
    }

    await web3.eth.sendTransaction({
        to: agentAccount,
        from: accounts[9],
        value: web3.utils.toWei("10", "ether")
    });
    return {
        web3: web3,
        accounts: accounts,
        ida: ida,
        cfa: cfa,
        host: host,
        gov: gov,
        superToken: superToken,
        token: token,
        resolver: resolver,
        toga: toga
    };
}

function expectLiquidation(event, node, account) {
    expect(event.returnValues.liquidatorAccount).to.equal(node);
    expect(event.returnValues.bailoutAmount).to.equal("0");
    expect(event.returnValues.penaltyAccount).to.equal(account);
};

//TODO:REFACTOR
function expectLiquidationV2(event, node, account, expectPeriodSlot) {
    const periodSlot = event.returnValues.liquidationTypeData[event.returnValues.liquidationTypeData.length - 1];
    expect(event.returnValues.liquidatorAccount).to.equal(node);
    expect(event.returnValues.targetAccount).to.equal(account);
    expect(periodSlot).to.equal(expectPeriodSlot);
    if(expectPeriodSlot === 2) {
        expect(event.returnValues.targetAccountBalanceDelta).to.not.equal("0")
    }
};

//TODO:REFACTOR
function expectLiquidationV2Bailout(event, node, account, expectPeriodSlot) {
    const periodSlot = event.returnValues.liquidationTypeData[event.returnValues.liquidationTypeData.length - 1];
    expect(event.returnValues.liquidatorAccount).to.equal(node);
    expect(event.returnValues.targetAccount).to.equal(account);
    expect(periodSlot).to.equal(expectPeriodSlot);
    expect(event.returnValues.targetAccountBalanceDelta).to.not.equal("0")
};

function expectBailout(event, node, account) {
    expect(event.returnValues.liquidatorAccount).to.equal(node);
    expect(event.returnValues.bailoutAmount).not.equal("0");
    expect(event.returnValues.penaltyAccount).to.equal(account);
};

function getSentinelConfig(config) {
    const myBaseConfig = {
        http_rpc_node: "http://127.0.0.1:8545",
        mnemonic: "clutch mutual favorite scrap flag rifle tone brown forget verify galaxy return",
        mnemonic_index: 100,
        epoch_block: 0,
        db_path: "datadir/testing/test.sqlite",
        protocol_release_version: "test",
        log_level: "info",
        tx_timeout: 20,
        max_query_block_range: 500000,
        max_gas_price: 4000000000,
        concurrency: 1,
        cold_boot: 1,
        only_listed_tokens: 1,
        number_retries: 3,
        additional_liquidation_delay: 0,
        block_offset: 1,
        liquidation_job_awaits: 5000,
        fastsync: "false"
    };

    return { ...myBaseConfig, ...config };
}

function exitWithError(error) {
    console.error(error);
    process.exit(1);
};
//TODO:REFACTOR
async function waitForEvent(protocolVars, sentinel, ganache, eventName, blockNumber) {
    while (true) {
        try {
            const newBlockNumber = await protocolVars.web3.eth.getBlockNumber();
            console.log(`${blockNumber} - ${newBlockNumber}`);
            const events = await protocolVars.superToken.getPastEvents(eventName, {
                fromBlock: blockNumber,
                toBlock: newBlockNumber
            });
            if (events.length > 0) {
                return events;
            }
            await timeout(1000);
            await ganache.helper.timeTravelOnce(1, sentinel, true);
        } catch (err) {
            exitWithError(err);
        }
    }
};

//TODO:REFACTOR
async function waitForEventAtSameBlock(protocolVars, sentinel, ganache, eventName, numberOfEvents, blockNumber) {
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
            await timeout(1000);
            await ganache.helper.timeTravelOnce(1, sentinel, true);
            blockNumber += 1;
        } catch (err) {
            exitWithError(err);
        }
    }
};
async function timeout(ms) {
    return new Promise(res => setTimeout(res, ms));
}

module.exports = {
    setup,
    expectLiquidation,
    expectLiquidationV2,
    expectLiquidationV2Bailout,
    expectBailout,
    getSentinelConfig,
    timeout,
    waitForEvent,
    waitForEventAtSameBlock,
    exitWithError
};
