const RPCClient = require('../web3client/rpcClient')

class TestRPCClient extends RPCClient {
  constructor (...args) {
    super(...args)
    this.testMode = null
    this.testOption = {}
  }

  async sendSignedTransaction (signed) {
    const gasPrice = signed.tx.txObject.gasPrice
    const gasLimit = signed.tx.txObject.gasLimit

    if (this.testMode === 'TIMEOUT_ON_LOW_GAS_PRICE' && gasPrice <= this.testOption.minimumGas) {
      await new Promise((resolve) => setTimeout(resolve, signed.tx.timeout * 2))
    } else if (this.testMode === 'REVERT_ON_BLOCK_GAS_LIMIT' && gasLimit > this.testOption.blockGasLimit) {
      throw new Error('block gas limit')
    } else {
      return super.sendSignedTransaction(signed)
    }
  }

  setTestMode (mode, options) {
    this.testMode = mode
    this.testOption = options
  }
}

module.exports = TestRPCClient
