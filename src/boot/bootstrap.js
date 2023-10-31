const { Op } = require("sequelize");

/*
 * @dev Bootstrap the app from fresh or persisted state
 */
// with all events loaded, transforms raw data in the DB
// to higher level data (like estimations)
class Bootstrap {
  constructor (app) {
    this.app = app;
  }

  async start () {
    this.app.logger.info("starting bootstrap");
    const systemInfo = await this.app.db.models.SystemModel.findOne();
    let blockNumber = parseInt(this.app.config.EPOCH_BLOCK);
    if (systemInfo !== null) {
      blockNumber = systemInfo.blockNumber;
    }
    const currentBlockNumber = await this.app.client.getCurrentBlockNumber(this.app.config.BLOCK_OFFSET);
    if (blockNumber < currentBlockNumber) {
      try {
        const queue = this.app.queues.newEstimationQueue();
        const users = await this.app.db.queries.getAccounts(blockNumber);
        for (const user of users) {
          queue.push({
            self: this,
            account: user.account,
            token: user.superToken,
            blockNumber: currentBlockNumber,
            parentCaller: "Bootstrap.start()"
          });
        }

        if (users.length > 0) {
          await queue.drain();
        }

        const cfaFlows = await this.app.db.queries.getLastCFAFlows(blockNumber);
        const gdaFlows = await this.app.db.queries.getLastGDAFlows(blockNumber);

        // AVOID AVAX PROBLEMATIC FLOWS - TODO: REMOVE THIS AFTER PROTOCOL FIX -----v
        const receiversFilter = ["0x98111049a4b760FAEdAF95ffC9E5DFB80846ae10", "0xf3AFf6EFdaADE25A1dD04f58b0ff8a2F2e16B07b", "0x254DE04a9d7284205475DCd4c07D08d2cB633A9C"];
        const filteredGDAFlows = gdaFlows.filter((flow) => (
            flow.sender !== "0xa9e3725CeE7b6C807665d41D603d6d0F71C27044" &&
            flow.superToken !== "0x24f3631dbbf6880C684c5e59578C21194e285Baf" &&
            !receiversFilter.includes(flow.receiver)
        ));
       // ^----- AVOID AVAX PROBLEMATIC FLOWS - TODO: REMOVE THIS AFTER PROTOCOL FIX

        const flows = [...cfaFlows, ...filteredGDAFlows];
        for (const flow of flows) {
          try {
            await this.app.db.models.AgreementModel.upsert({
              agreementId: flow.agreementId,
              superToken: flow.superToken,
              sender: flow.sender,
              receiver: flow.receiver,
              flowRate: flow.flowRate,
              blockNumber: blockNumber,
              source: flow.source
            });
          } catch (err) {
            this.app.logger.error(err);
            throw Error(`Bootstrap.start(): ${err}`);
          }
        }
        // From all existing estimations, delete what don't have agreements
        const estimationsNow = await this.app.db.models.AccountEstimationModel.findAll({
          attributes: ["address", "superToken"]
        });

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
          });
          // if the sender don't have open stream, delete it from database
          if (flows.length === 0) {
            await est.destroy();
          }
        }
        systemInfo.blockNumber = currentBlockNumber;
        await systemInfo.save();
        this.app.logger.info("finish bootstrap");

        return currentBlockNumber;
      } catch (err) {
        this.app.logger.error(err);
        process.exit(1);
      }
    } else {
      if(blockNumber === currentBlockNumber) {
        this.app.logger.warn(`epoch block number is the same as current block: ${systemInfo.blockNumber}`);
      } else {
        this.app.logger.error(`epoch block number is from the future: ${systemInfo.blockNumber}`);
        process.exit(1);
      }
    }
  }
}

module.exports = Bootstrap;
