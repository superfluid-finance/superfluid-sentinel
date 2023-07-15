/* eslint-disable no-undef */
const traveler = require("ganache-time-traveler");

// eslint-disable-next-line promise/param-names
const delay = ms => new Promise(res => setTimeout(res, ms));

async function timeTravelOnce (time, app, setAppTime = false) {
  const block1 = await web3.eth.getBlock("latest");
  console.log("current block time", block1.timestamp);
  console.log(`time traveler going to the future +${time}...`);
  await traveler.advanceTimeAndBlock(time);
  const block2 = await web3.eth.getBlock("latest");
  console.log("new block time", block2.timestamp);
  if (setAppTime) {
    app.setTime(block2.timestamp * 1000);
  }
  return block2.timestamp;
}

async function timeTravelUntil (time, ticks, app, setAppTime) {
  while (ticks > 0) {
    await delay(1000);
    await timeTravelOnce(time, app, setAppTime);
    ticks--;
  }
}

async function takeEvmSnapshot (provider) {
  return await provider.send("evm_snapshot");
}

async function revertToSnapShot (provider, snapshotId) {
  return await provider.send("evm_revert", [snapshotId] );
}

module.exports = {
  timeTravelOnce,
  timeTravelUntil,
  takeEvmSnapshot,
  revertToSnapShot
};
