const traveler = require("ganache-time-traveler");

async function timeTravelOnce(time, app, setAppTime = false) {
    const block1 = await web3.eth.getBlock("latest");
    console.log("current block time", block1.timestamp);
    console.log(`time traveler going to the future +${time}...`);
    await traveler.advanceTimeAndBlock(time);
    const block2 = await web3.eth.getBlock("latest");
    console.log("new block time", block2.timestamp);
    if(setAppTime)
        app.setTime(block2.timestamp * 1000);
    return block2.timestamp;
}

async function takeEvmSnapshot() {
    return new Promise((resolve, reject) => {
      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_snapshot',
        //id: new Date().getTime()
      }, (err, snapshotId) => {
        if (err) { return reject(err) }
        return resolve(snapshotId)
      })
    })
}

async function revertToSnapShot(evmSnapshotId) {
    return new Promise((resolve, reject) => {
      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_revert',
        params: [evmSnapshotId],
      }, (err, result) => {
        if (err) {
            return reject(err)
        }
        if (!result.result) {
            throw new Error("revertToEvmSnapShot failed: ", result);
        }
        this.takeEvmSnapshot().then(resolve).catch(reject);
      })
    })
}

module.exports = {
    timeTravelOnce,
    takeEvmSnapshot,
    revertToSnapShot
}