// eslint-disable-next-line promise/param-names
const delay = ms => new Promise(res => setTimeout(res, ms))

async function timeTravelOnce (provider, web3, time, app, setAppTime = false) {
  const block1 = await web3.eth.getBlock('latest')
  console.log('current block time', block1.timestamp.toString())
  console.log(`time traveler going to the future + ${time} ...`)

  const hexTime = '0x' + Number(time).toString(16)
  await provider.send('evm_increaseTime', [hexTime])
  // generate new block
  await provider.send('evm_mine')

  const block2 = await web3.eth.getBlock('latest')
  console.log('new block time', block2.timestamp.toString())
  if (setAppTime) {
    app.setTime(Number(block2.timestamp) * 1000)
  }
  return Number(block2.timestamp)
}

async function timeTravelUntil (provider, web3, time, ticks, app, setAppTime) {
  while (ticks > 0) {
    await delay(1000)
    await timeTravelOnce(provider, web3, time, app, setAppTime)
    ticks--
  }
}

async function takeEvmSnapshot (provider) {
  return await provider.send('evm_snapshot')
}

async function revertToSnapShot (provider, snapshotId) {
  return await provider.send('evm_revert', [snapshotId])
}

module.exports = {
  timeTravelOnce,
  timeTravelUntil,
  takeEvmSnapshot,
  revertToSnapShot
}
