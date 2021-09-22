const Environment = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-environment");
const IResolver = require("@superfluid-finance/ethereum-contracts/build/contracts/IResolver.json");
const ICFA = require("@superfluid-finance/ethereum-contracts/build/contracts/IConstantFlowAgreementV1.json");
const IIDA = require("@superfluid-finance/ethereum-contracts/build/contracts/IInstantDistributionAgreementV1.json");
const ISuperfluid = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperfluid.json");
const ISuperToken = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperToken.json");
const IToken = require("@superfluid-finance/ethereum-contracts/build/contracts/TestToken.json");
const BatchLiquidator = require("@superfluid-finance/ethereum-contracts/build/contracts/BatchLiquidator.json");

const expect = require('chai').expect
const Web3 = require('web3');
const traveler = require("ganache-time-traveler");
const ganache = require("../../scripts/setGanache");
const App = require("../../src/app");

const AGENT_ACCOUNT = "0x868D9F52f84d33261c03C8B77999f83501cF5A99";

let app, accounts, snapId, web3, ida, cfa, host, superToken, token, resolver, resolverAddress, batchContract;

const delay = ms => new Promise(res => setTimeout(res, ms));
const exitWithError = (error) => {
    console.error(error);
    process.exit(1);
}

const deployBatchContract = async () => {
    if(batchContract === undefined) {
        const contract = new web3.eth.Contract(BatchLiquidator.abi);
        const res = await contract.deploy({
                data: BatchLiquidator.bytecode
            }).send({
                from: accounts[0],
                gas: 1500000,
                gasPrice: '1000'
            });
        //batchContract = new web3.eth.Contract(BatchLiquidator.abi, res._address);
        batchContract = res;
        console.log(`BatchLiquidator address: ${res._address}`);
    }
}
const setup = async () => {
    web3 = new Web3(ganache.provider);
    accounts = await web3.eth.getAccounts();
    await Environment((error) => {
            if(error)
                console.log(error);
        },{ web3: web3 }
    );
    resolverAddress = process.env.TEST_RESOLVER_ADDRESS;
    const superfluidIdent = `Superfluid.test`;
    resolver = new web3.eth.Contract(IResolver.abi,resolverAddress);
    const superfluidAddress = await resolver.methods.get(superfluidIdent).call();
    host = new web3.eth.Contract(ISuperfluid.abi,superfluidAddress);
    const cfaIdent = web3.utils.sha3("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
    const idaIdent = web3.utils.sha3("org.superfluid-finance.agreements.InstantDistributionAgreement.v1");
    const cfaAddress = await host.methods.getAgreementClass(cfaIdent).call();
    const idaAddress = await host.methods.getAgreementClass(idaIdent).call();
    cfa = new web3.eth.Contract(ICFA.abi, cfaAddress);
    ida = new web3.eth.Contract(IIDA.abi, idaAddress);
    const superTokenAddress = await resolver.methods.get("supertokens.test.fTUSDx").call();
    superToken = new web3.eth.Contract(ISuperToken.abi, superTokenAddress);
    const tokenAddress = await superToken.methods.getUnderlyingToken().call();
    const govAddress = await resolver.methods.get("TestGovernance.test").call();
    console.log("Governance Address ", govAddress);
    token = new web3.eth.Contract(IToken.abi, tokenAddress);
    await deployBatchContract();

    for(const account of accounts) {
        await token.methods.mint(account,"10000000000000000000000").send({from: account});
        await token.methods.approve(superTokenAddress, "10000000000000000000000").send({from: account});
        await superToken.methods.upgrade("10000000000000000000000").send({from: account, gas:400000});
    }

    await web3.eth.sendTransaction({to:AGENT_ACCOUNT, from:accounts[9], value:web3.utils.toWei("10", "ether")})
};

const takeSnapshot = () => {
    return new Promise((resolve, reject) => {
      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_snapshot',
        id: new Date().getTime()
      }, (err, snapshotId) => {
        if (err) { return reject(err) }
        return resolve(snapshotId)
      })
    })
  }
const revertToSnapShot = (id) => {
    return new Promise((resolve, reject) => {
      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_revert',
        params: [id],
        id: new Date().getTime()
      }, (err, result) => {
        if (err) { return reject(err) }
        return resolve(result)
      })
    })
}

async function timeTravelOnce(time, setAppTime = false) {
    const block1 = await web3.eth.getBlock("latest");
    console.log("current block time", block1.timestamp);
    console.log(`time traveler going to the future +${time}...`);
    await traveler.advanceTimeAndBlock(time);
    const block2 = await web3.eth.getBlock("latest");
    if(setAppTime)
        app.setTime(block2.timestamp * 1000);
    return {timestamp: block2.timestamp, blockNumber: block2.number};
}

const bootNode = async (delayParam = 0) => {
    app = new App({
        ws_rpc_node: "ws://127.0.0.1:8545",
        http_rpc_node: "http://127.0.0.1:8545",
        mnemonic: "clutch mutual favorite scrap flag rifle tone brown forget verify galaxy return",
        mnemonic_index: 100,
        epoch_block: 0,
        DB: "TestDatabase.sqlite",
        protocol_release_version: "test",
        tx_timeout: 300000,
        max_query_block_range: 500000,
        max_gas_price:4000000000,
        concurrency: 1,
        cold_boot: 1,
        listen_mode: 1,
        number_retries: 3,
        test_resolver: resolverAddress,
        additional_liquidation_delay: delayParam,
        liquidation_run_every: 5000,
        batch_contract: batchContract._address
    });
    app.start();
    while(!app.isInitialized()) {
        await delay(3000);
    }
}

const closeNode = async (force = false) => {
    if(app !== undefined)
        return app.shutdown(force);
}

const waitForEventAtSameBlock = async (eventName, numberOfEvents, blockNumber) => {
    while(true) {
        try {
            console.log(`checking block: ${blockNumber}`);
            const events = await superToken.getPastEvents(eventName, {fromBlock: blockNumber, toBlock: blockNumber});
            if(events.length ===  numberOfEvents) {
                return true;
            }
            await delay(1000);
            const r = await timeTravelOnce(1, true);
            blockNumber += 1;
        } catch(err) {
            exitWithError(err);
        }
    }
}

describe("Integration scripts tests", () => {

    before(async function() {
        await setup();
        snapId = await takeSnapshot();
    });

    beforeEach(async () => {
        await setup();
    });

   afterEach(async () => {
        //closeNode();
    });

    after(async () => {
        closeNode(true);
    });

    it("Send a batch Liquidation to close multi streams", async () => {
        try {
            const flowData1 = cfa.methods.createFlow(superToken._address,accounts[0],"1000000000000000","0x").encodeABI();
            await host.methods.callAgreement(cfa._address, flowData1, "0x").send({from: accounts[1], gas: 1000000});
            await host.methods.callAgreement(cfa._address, flowData1, "0x").send({from: accounts[2], gas: 1000000});
            await host.methods.callAgreement(cfa._address, flowData1, "0x").send({from: accounts[3], gas: 1000000});
            await host.methods.callAgreement(cfa._address, flowData1, "0x").send({from: accounts[4], gas: 1000000});
            await host.methods.callAgreement(cfa._address, flowData1, "0x").send({from: accounts[5], gas: 1000000});
            //await timeTravelOnce(1);
            const tx = await superToken.methods.transferAll(accounts[9]).send({from: accounts[1], gas: 1000000});
            await superToken.methods.transferAll(accounts[9]).send({from: accounts[2], gas: 1000000});
            await superToken.methods.transferAll(accounts[9]).send({from: accounts[3], gas: 1000000});
            await superToken.methods.transferAll(accounts[9]).send({from: accounts[4], gas: 1000000});
            await superToken.methods.transferAll(accounts[9]).send({from: accounts[5], gas: 1000000});
            await bootNode();
            let result = await waitForEventAtSameBlock("AgreementLiquidatedBy", 5, tx.blockNumber);
            expect(result).to.equal(true);
        } catch(err) {
            exitWithError(err);
        }
    });
});