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

describe("Integration scripts tests", async () => {

    before(async function(done) {
        await setup();
        snapId = await takeSnapshot();
        startNode();
        done();
    });

    beforeEach(async (done) => {
        console.log("Revert to snapshot")
        await revertToSnapShot(snapId);
        done();
    });
/*
    it("after", async (done) => {
        console.log("HERE");
        done();
    });
*/
});
