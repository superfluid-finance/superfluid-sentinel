const { Op } = require('sequelize')

/*
 * @dev Bootstrap the app from fresh or persisted state
 */
// with all events loaded, transforms raw data in the DB
// to higher level data (like estimations)
class Bootstrap {
  constructor (app) {
    this.app = app
  }

  async start () {
    this.app.logger.info('starting bootstrap')
    const systemInfo = await this.app.db.models.SystemModel.findOne()
    let blockNumber = parseInt(this.app.config.EPOCH_BLOCK)
    if (systemInfo !== null) {
      blockNumber = systemInfo.blockNumber
    }
    const currentBlockNumber = await this.app.client.getCurrentBlockNumber(this.app.config.BLOCK_OFFSET)
    if (blockNumber < currentBlockNumber) {
      try {
        const queue = this.app.queues.newEstimationQueue()
        const users = await this.app.db.bizQueries.getAccounts(blockNumber)
        for (const user of users) {
          queue.push({
            self: this,
            account: user.account,
            token: user.superToken,
            blockNumber: currentBlockNumber,
            parentCaller: 'Bootstrap.start()'
          })
        }

        if (users.length > 0) {
          await queue.drain()
        }

        const cfaFlows = await this.app.db.bizQueries.getLastCFAFlows(blockNumber)
        const gdaFlows = await this.app.db.bizQueries.getLastGDAFlows(blockNumber)
        const flows = [...cfaFlows, ...gdaFlows]
        for (const flow of flows) {
          try {
            await this.app.db.models.AgreementModel.upsert({
              agreementId: flow.agreementId,
              superToken: flow.superToken,
              sender: flow.sender,
              receiver: flow.receiver,
              flowRate: flow.flowRate,
              blockNumber,
              source: flow.source
            })
          } catch (err) {
            this.app.logger.error(err)
            throw Error(`Bootstrap.start(): ${err}`)
          }
        }
        // From all existing estimations, delete what don't have agreements
        const estimationsNow = await this.app.db.models.AccountEstimationModel.findAll({
          attributes: ['address', 'superToken']
        })

        for (const est of estimationsNow) {
          const flows = await this.app.db.models.AgreementModel.findAll({
            where: {
              [Op.and]: [
                {
                  superToken: est.superToken
                },
                {
                  sender: est.address
                }
              ]
            }
          })
          // if the sender don't have open stream, delete it from database
          if (flows.length === 0) {
            await est.destroy()
          }
        }
        systemInfo.blockNumber = currentBlockNumber
        await systemInfo.save()
        this.app.logger.info('finish bootstrap')
        return currentBlockNumber
      } catch (err) {
        this.app.logger.error(err)
        process.exit(1)
      }
    } else {
      if (blockNumber === currentBlockNumber) {
        this.app.logger.warn(`epoch block number is the same as current block: ${systemInfo.blockNumber}`)
      } else {
        this.app.logger.error(`epoch block number is from the future: ${systemInfo.blockNumber}`)
        process.exit(1)
      }
    }
  }
}

module.exports = Bootstrap
