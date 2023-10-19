

const DeployAndLoadSuperfluidFramework = require("../utils/DeployAndLoadSuperfluidFramework");
const { Web3 } = require("web3");
const ethers = require("ethers");
const expect = require("chai").expect;

const ISuperfluidPool = require("@superfluid-finance/ethereum-contracts/build/truffle/ISuperfluidPool.json");


let helper;

async function setup(provider, agentAccount) {
    const MIN_BOND_DURATION = 3600 * 24 * 7; // 604800

    const httpProvider = new Web3.providers.HttpProvider("http://127.0.0.1:8545");
    const web3 = new Web3(httpProvider);
    const accounts = await web3.eth.getAccounts();
    const providerEthers = new ethers.JsonRpcProvider("http://127.0.0.1:8545",null,{polling: true});
    const account = await providerEthers.getSigner();

    await web3.eth.sendTransaction({
        from: accounts[0],
        to: account.address,
        value: web3.utils.toWei("100", "ether"),
        type: "0x0"
    });

    const sf = await DeployAndLoadSuperfluidFramework(web3, account,  accounts[0]);
    for (const account of accounts) {
        await sf.tokens.fDAI.methods.mint(account, "10000000000000000000000").send({from: account});
        await sf.tokens.fDAI.methods.approve(sf.superTokens.fDAIx.options.address, "10000000000000000000000").send({from: account});
        await sf.superTokens.fDAIx.methods.upgrade("10000000000000000000000").send({
            from: account,
            gas: 400000
        });
    }

    await web3.eth.sendTransaction({
        to: agentAccount,
        from: accounts[9],
        value: web3.utils.toWei("10", "ether"),
        type: "0x0"
    });
    helper = {};
    helper.web3 = web3;
    helper.accounts = accounts;
    helper.sf = {
        ida: sf.agreements.ida,
        cfa: sf.agreements.cfa,
        gda: sf.agreements.gda,
        host: sf.host,
        gov: sf.governance,
        superToken: sf.superTokens.fDAIx,
        token: sf.tokens.fDAI,
        resolver: sf.resolver,
        batch: sf.batchLiquidator,
        toga: sf.toga,
        instantiatePool: (poolAddress) => {
            return new web3.eth.Contract(ISuperfluidPool.abi, poolAddress);
        }
    }

    helper.operations = {
        createStream: async (superTokenAddress, sender, receiver, flowRate) => {
            if(helper === undefined) {
                throw new Error("helper is undefined");
            }
            const data = helper.sf.cfa.methods.createFlow(superTokenAddress, receiver, flowRate, "0x").encodeABI();
            return helper.sf.host.methods.callAgreement(helper.sf.cfa.options.address, data, "0x").send({from: sender,gas: 1000000});
        },
        updateStream: async (superTokenAddress, sender, receiver, flowRate) => {
            if(helper === undefined) {
                throw new Error("helper is undefined");
            }
            const data = helper.sf.cfa.methods.updateFlow(superTokenAddress, receiver, flowRate, "0x").encodeABI();
            return helper.sf.host.methods.callAgreement(helper.sf.cfa.options.address, data, "0x").send({from: sender,gas: 1000000});
        },
        deleteStream: async (superTokenAddress, sender, receiver) => {
            if(helper === undefined) {
                throw new Error("helper is undefined");
            }
            const data = helper.sf.cfa.methods.deleteFlow(superTokenAddress, sender, receiver, "0x").encodeABI();
            return helper.sf.host.methods.callAgreement(helper.sf.cfa.options.address, data, "0x").send({from: sender,gas: 1000000});
        },
        createIDAIndex: async (superTokenAddress, sender, indexId) => {
            if(helper === undefined) {
                throw new Error("helper is undefined");
            }
            const data = helper.sf.ida.methods.createIndex(superTokenAddress, indexId, "0x").encodeABI();
            return helper.sf.host.methods.callAgreement(helper.sf.ida.options.address, data, "0x").send({from: sender,gas: 1000000});
        },
        updateIDASubscription: async (superTokenAddress, sender, receiver, indexId, amount) => {
            if(helper === undefined) {
                throw new Error("helper is undefined");
            }
            const data = helper.sf.ida.methods.updateSubscription(superTokenAddress, indexId, receiver, amount, "0x").encodeABI();
            return helper.sf.host.methods.callAgreement(helper.sf.ida.options.address, data, "0x").send({from: sender,gas: 1000000});
        },
        approveIDASubscription: async (superTokenAddress, sender, receiver, indexId) => {
            if(helper === undefined) {
                throw new Error("helper is undefined");
            }
            const data = helper.sf.ida.methods.approveSubscription(superTokenAddress, sender, indexId, "0x").encodeABI();
            return helper.sf.host.methods.callAgreement(helper.sf.ida.options.address, data, "0x").send({from: receiver,gas: 1000000});
        },
        distributeIDA: async (superTokenAddress, sender, indexId, sendAmount) => {
            if(helper === undefined) {
                throw new Error("helper is undefined");
            }
            const data = helper.sf.ida.methods.distribute(superTokenAddress, indexId, sendAmount, "0x").encodeABI();
            return helper.sf.host.methods.callAgreement(helper.sf.ida.options.address, data, "0x").send({from: sender,gas: 1000000});
        },
        createPoolGDA: async (superTokenAddress, sender, admin) => {
            if(helper === undefined) {
                throw new Error("helper is undefined");
            }
            let poolConfig = {transferabilityForUnitsOwner:true, distributionFromAnyAddress:true};
            const tx = await helper.sf.gda.methods.createPool(superTokenAddress, admin, poolConfig).send({from: sender,gas: 1000000});
            const events = await helper.sf.gda.getPastEvents("PoolCreated", {fromBlock: tx.blockNumber, toBlock: tx.blockNumber});
            return events[0].returnValues.pool;
        },
        connectPoolGDA: async (poolAddress, sender) => {
            if(helper === undefined) {
                throw new Error("helper is undefined");
            }
            const data = helper.sf.gda.methods.connectPool(poolAddress, "0x").encodeABI();
            return helper.sf.host.methods.callAgreement(helper.sf.gda.options.address, data, "0x").send({from: sender ,gas: 1000000});

        },
        distributeFlow: async (superTokenAddress, sender, pool, flowRate) => {
            if(helper === undefined) {
                throw new Error("helper is undefined");
            }
            const data = helper.sf.gda.methods.distributeFlow(superTokenAddress, sender, pool, flowRate, "0x").encodeABI();
            const tx = await helper.sf.host.methods.callAgreement(helper.sf.gda.options.address, data, "0x").send({from: sender , gas: 1000000});
            const events = await helper.sf.gda.getPastEvents("FlowDistributionUpdated", {fromBlock: tx.blockNumber, toBlock: tx.blockNumber});
            return tx;
        },
        updateMemberGDA: async (poolAddress, admin, member, newUnits) => {
            if(helper === undefined) {
                throw new Error("helper is undefined");
            }
            const pool = helper.sf.instantiatePool(poolAddress);
            return pool.methods.updateMemberUnits(member, newUnits).send({from: admin, gas: 1000000});
        }
    }

    return helper;

}

async function getPoolEvent(blockNumber) {
    return helper.sf.gda.getPastEvents("PoolCreated", {fromBlock: blockNumber, toBlock: blockNumber});

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
            const events = await protocolVars.sf.superToken.getPastEvents(eventName, {
                fromBlock: blockNumber,
                toBlock: newBlockNumber
            });
            if (events.length > 0) {
                return events;
            }
            await timeout(1000);
            await ganache.helper.timeTravelOnce(protocolVars.provider, protocolVars.web3, 1, sentinel, true);
        } catch (err) {
            exitWithError(err);
        }
    }
};

//TODO:REFACTOR
async function waitForEventAtSameBlock(protocolVars, sentinel, ganache, eventName, numberOfEvents, blockNumber) {
    blockNumber = Number(blockNumber);
    while (true) {
        try {
            console.log(`checking block: ${blockNumber}`);
            const events = await protocolVars.sf.superToken.getPastEvents(eventName, {
                fromBlock: blockNumber,
                toBlock: blockNumber
            });
            if (events.length === numberOfEvents) {
                return Number(events[0].blockNumber);
            }
            await timeout(1000);
            await ganache.helper.timeTravelOnce(protocolVars.provider, protocolVars.web3, 1, sentinel, true);
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
