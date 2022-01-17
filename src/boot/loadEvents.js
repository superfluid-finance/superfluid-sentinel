const async = require("async");

class LoadEvents {
  constructor (app) {
    this.app = app;
    ;
  }

  async start () {
    try {
      this.app.logger.info("getting past event to find SuperTokens");
      const systemInfo = await this.app.db.models.SystemModel.findOne();
      const lastEventBlockNumber = await this.app.db.models.FlowUpdatedModel.findOne({
        order: [["blockNumber", "DESC"]]
      });
      let blockNumber = lastEventBlockNumber === null
        ? parseInt(this.app.config.EPOCH_BLOCK)
        : lastEventBlockNumber.blockNumber;
      if (systemInfo !== null) {
        if (systemInfo.superTokenBlockNumber > blockNumber) {
          blockNumber = systemInfo.superTokenBlockNumber;
        }
        if ((await this.app.client.getChainId()) !== systemInfo.chainId) {
          throw new Error("different network than from the saved data");
        }
      }
      let pullCounter = blockNumber;
      const currentBlockNumber = await this.app.client.getCurrentBlockNumber(this.app.config.BLOCK_OFFSET);
      const testBlockNumber = await this.app.client.getCurrentBlockNumber(0);
      this.app.logger.info(`scanning blocks from ${pullCounter} to ${currentBlockNumber} - real ${testBlockNumber}`);
      const queue = async.queue(async function (task) {
        let keepTrying = 1;
        while (true) {
          try {
            task.self.app.logger.info(`getting blocks: trying #${keepTrying} - from:${task.fromBlock} to:${task.toBlock}`);
            let query = {
              fromBlock: task.fromBlock,
              toBlock: task.toBlock
            };
            if (task.self.app.config.TOKENS) {
              query = {
                filter: {
                  token: task.self.app.config.TOKENS
                },
                fromBlock: task.fromBlock,
                toBlock: task.toBlock
              };
            }
            let result = await task.self.app.protocol.getAgreementEvents("FlowUpdated", query);
            result = result.map(task.self.app.models.event.transformWeb3Event);
            for (const event of result) {
              const agreementId = task.self.app.protocol.generateId(event.sender, event.receiver);
              const hashId = task.self.app.protocol.generateId(event.token, agreementId);
              await task.self.app.db.models.FlowUpdatedModel.create({
                address: event.address,
                blockNumber: event.blockNumber,
                superToken: event.token,
                sender: event.sender,
                receiver: event.receiver,
                flowRate: event.flowRate,
                agreementId: agreementId,
                hashId: hashId
              });
            }
            break;
          } catch (err) {
            keepTrying++;
            task.self.app.logger.error(err);
            if (keepTrying > task.self.app.config.NUM_RETRIES) {
              process.exit(1);
            }
          }
        }
      }, this.app.config.CONCURRENCY);

      while (pullCounter <= currentBlockNumber) {
        const end = (pullCounter + parseInt(this.app.config.MAX_QUERY_BLOCK_RANGE));
        queue.push({
          self: this,
          fromBlock: pullCounter,
          toBlock: end > currentBlockNumber ? currentBlockNumber : end
        });
        pullCounter = end + 1;
      }
      await queue.drain();
      const tokens = await this.app.db.models.FlowUpdatedModel.findAll({
        attributes: ["superToken"],
        group: ["superToken"]
      });
      // fresh database
      if (systemInfo === null) {
        await this.app.db.models.SystemModel.create({
          blockNumber: blockNumber,
          chainId: await this.app.client.getChainId(),
          superTokenBlockNumber: currentBlockNumber
        });
      } else {
        systemInfo.superTokenBlockNumber = currentBlockNumber;
        await systemInfo.save();
      }
      // Load supertokens
      await this.app.client.loadSuperTokens(tokens.map(({ superToken }) => superToken));

      this.app.logger.info("start getting delays PIC system");
      // we need to query each supertoken to check pic address
      const DelayChecker = async.queue(async function (task) {
        let keepTrying = 10;
        while (true) {
          try {
            await task.self.app.protocol.calculateAndSaveTokenDelay(task.token);
            break;
          } catch (err) {
            keepTrying++;
            task.self.app.logger.error(err);
            if (keepTrying > task.self.app.config.NUM_RETRIES) {
              task.self.app.logger.error(`exhausted number of retries`);
              process.exit(1);
            }
          }
        }
      }, this.app.config.CONCURRENCY);
      const superTokens = this.app.client.superTokensAddresses;
      for (const st of superTokens) {
        DelayChecker.push({
          self: this,
          token: st
        });
      }

      if (superTokens.length > 0) {
        await DelayChecker.drain();
      }
      this.app.logger.info("finish getting delays PIC system");
      this.app.logger.info("finish past event to find SuperTokens");
      return currentBlockNumber;
    } catch (err) {
      this.app.logger.error(err);
      process.exit(1);
    }
  }
}

module.exports = LoadEvents;
