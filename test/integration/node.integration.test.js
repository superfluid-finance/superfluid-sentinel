const protocolHelper = require('../../test/utils/protocolHelper')
const expect = require('chai').expect
const startGanache = require('../../test/utils/ganache')
const App = require('../../src/app')

const AGENT_ACCOUNT = '0x868D9F52f84d33261c03C8B77999f83501cF5A99'
const DEFAULT_REWARD_ADDRESS = '0x0000000000000000000000000000000000000045'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

let app, accounts, snapId, helper, web3, ganache, provider

const bootNode = async (config) => {
  const sentinelConfig = protocolHelper.getSentinelConfig(config)
  app = new App(sentinelConfig)
  app.start()
  while (!app.isInitialized()) {
    await protocolHelper.timeout(5000)
  }
}

const closeNode = async (force = false) => {
  if (app !== undefined) {
    return app.shutdown(force)
  }
}

describe('Agent configurations tests', () => {
  before(async function () {
    ganache = await startGanache()
    provider = await ganache.provider
    helper = await protocolHelper.setup(provider, AGENT_ACCOUNT)
    helper.provider = provider
    helper.togaAddress = helper.sf.toga.options.address
    helper.batchAddress = helper.sf.batch.options.address
    web3 = helper.web3
    accounts = helper.accounts
    snapId = await ganache.helper.takeEvmSnapshot(provider)
  })

  beforeEach(async () => {
  })

  afterEach(async () => {
    try {
      await ganache.helper.revertToSnapShot(provider, snapId)
    } catch (err) {
      protocolHelper.exitWithError(err)
    }
  })

  after(async () => {
    if (!app._isShutdown) {
      await closeNode(true)
    }
    await ganache.close()
  })

  it('Should use delay parameter when sending liquidation', async () => {
    try {
      await helper.operations.createStream(helper.sf.superToken.options.address, accounts[0], accounts[2], '100000000000')
      await ganache.helper.timeTravelOnce(provider, web3, 1)
      await bootNode({
        pic: ZERO_ADDRESS,
        resolver: helper.sf.resolver.options.address,
        toga_contract: helper.togaAddress,
        additional_liquidation_delay: 2700,
        log_level: 'debug'
      })
      const tx = await helper.sf.superToken.methods.transferAll(accounts[2]).send({
        from: accounts[0],
        gas: 1000000
      })
      await ganache.helper.timeTravelOnce(provider, web3, 3580, app, true)
      const result = await protocolHelper.waitForEvent(helper, app, ganache, 'AgreementLiquidatedV2', tx.blockNumber)
      await app.shutdown()
      protocolHelper.expectLiquidationV2(result[0], AGENT_ACCOUNT, accounts[0], '1')
    } catch (err) {
      protocolHelper.exitWithError(err)
    }
  })

  it('Change state if not getting new blocks', async () => {
    try {
      await helper.operations.createStream(helper.sf.superToken.options.address, accounts[0], accounts[2], '100000000000')
      await ganache.helper.timeTravelOnce(provider, web3, 1)
      await bootNode({ resolver: helper.sf.resolver.options.address, rpc_stuck_threshold: 10 })
      let healthy
      while (true) {
        await protocolHelper.timeout(9000)
        const report = await app.healthReport.fullReport()
        healthy = report.healthy
        if (!healthy) break
      }
      await app.shutdown()
      expect(healthy).eq(false)
    } catch (err) {
      protocolHelper.exitWithError(err)
    }
  })

  // TODO: Superfluid Deployers need to deploy and register peripherals contracts
  it.skip('Get PIC on Boot and change after', async () => {
    try {
      await helper.operations.createStream(helper.sf.superToken.options.address, accounts[0], accounts[2], '100000000000')
      // became pic
      await helper.superToken.methods.transfer(helper.toga._address, '100000000000000000').send({
        from: accounts[0],
        gas: 1000000
      })
      await ganache.helper.timeTravelOnce(5)
      await bootNode({ toga_contract: helper.toga._address })
      let picInfo
      while (true) {
        await protocolHelper.timeout(5000)
        picInfo = await app.getPICInfo(helper.superToken._address)
        if (picInfo.length > 0) break
      }

      expect(picInfo[0].pic).to.be.equal(accounts[0])
      // PIC changes
      await helper.superToken.methods.transfer(helper.toga._address, '100000000000000000').send({
        from: accounts[1],
        gas: 1000000
      })
      await ganache.helper.timeTravelOnce(5)
      while (true) {
        await protocolHelper.timeout(8000)
        picInfo = await app.getPICInfo(helper.superToken._address)
        if (picInfo.length > 0) break
      }
      await app.shutdown()
      expect(picInfo[0].pic).to.be.equal(accounts[1])
    } catch (err) {
      protocolHelper.exitWithError(err)
    }
  })

  it.skip('Start node, subscribe to new Token and perform estimation', async () => {
    try {
      await bootNode({ pic: ZERO_ADDRESS, resolver: helper.sf.resolver.options.address, log_level: 'debug', toga_contract: helper.togaAddress })
      await helper.operations.createStream(helper.sf.superToken.options.address, accounts[0], accounts[2], '1000000000')
      const tx = await helper.sf.superToken.methods.transferAll(accounts[2]).send({
        from: accounts[0],
        gas: 1000000
      })
      const result = await protocolHelper.waitForEvent(helper, app, ganache, 'AgreementLiquidatedV2', tx.blockNumber)
      const activityLog = app.circularBuffer.toArray().filter((element) => { return element.stateChange === 'new token found' })
      expect(activityLog.length).to.equal(1)
      await app.shutdown()
      protocolHelper.expectLiquidationV2(result[0], AGENT_ACCOUNT, accounts[0], '0')
    } catch (err) {
      protocolHelper.exitWithError(err)
    }
  })
  // not yet supported
  it.skip('When token is listed afterwards, and there is already existing negative accounts, liquidations should still be performed', async () => {
    try {
      const data = helper.cfa.methods.createFlow(
        helper.superToken._address,
        accounts[2],
        '1000000000000000000',
        '0x'
      ).encodeABI()
      await helper.host.methods.callAgreement(helper.cfa._address, data, '0x').send({
        from: accounts[0],
        gas: 1000000
      })
      const tx = await helper.superToken.methods.transferAll(accounts[2]).send({
        from: accounts[0],
        gas: 1000000
      })
      //  const timestamp = await ganache.helper.timeTravelOnce(3600 * 4);
      await bootNode()
      const result = await protocolHelper.waitForEvent(helper, app, ganache, 'AgreementLiquidatedV2', tx.blockNumber)
      protocolHelper.expectLiquidationV2(result[0], AGENT_ACCOUNT, accounts[0], '0')
    } catch (err) {
      protocolHelper.exitWithError(err)
    }
  })

  it('When observer, no need for wallet / address', async () => {
    try {
      await bootNode({ observer: 'true', fastsync: 'false', resolver: helper.sf.resolver.options.address })
      expect(app.getConfigurationInfo().OBSERVER).to.be.true
      await app.shutdown()
    } catch (err) {
      protocolHelper.exitWithError(err)
    }
  })
})
