const Environment = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-environment");
const Web3 = require('web3');
const ganache = require("../scripts/setGanache");
const App = require("../src/app");

let app;
let accounts;
let snapId;
let web3;

const setup = async () => {
    web3 = new Web3(ganache.provider);
    accounts = await web3.eth.getAccounts();
    await Environment((error) => {
            if(error)
                console.log(error);
        },{ web3: web3 }
    );
    //Node Account: 0x868d9f52f84d33261c03c8b77999f83501cf5a99
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

const startNode = () => {
    const { fork } = require("child_process");
    const path = require("path");
    const newProcess = fork(path.join(__dirname, "../bootNode"), []);
}

const bootNode = () => {
    app = new App({
        wsNode: "ws://127.0.0.1:8545",
        httpNode: "http://127.0.0.1:8545",
        mnemonic: "clutch mutual favorite scrap flag rifle tone brown forget verify galaxy return",
        epochBlock: 0,
        DB: "TestDatabase.sqlite",
        prv: "test",
        timeoutFn: 300000,
        pullStep: 500000,
        gasPrice:5000000000,
        concurrency: 1,
        coldBoot: 1,
        listenMode: 1,
        numberRetries: 3,
        testResolver: process.env.TEST_RESOLVER_ADDRESS
    });
    app.start();
}

const closeNode = () => {
    if(app !== undefined)
        app.shutdown();
}

describe("Integration scripts tests", () => {

    before(async function() {
        await setup();
        snapId = await takeSnapshot();
    });

    beforeEach(async () => {
        console.log("Revert to snapshot")
        revertToSnapShot(snapId);
        //Start Node itseft
        console.log("start agent");
        bootNode();
    });


   afterEach(async () => {
        closeNode();
    });

    it("after", async () => {
        //Start a stream
        //
    });

})
