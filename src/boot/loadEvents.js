const async = require("async");

class LoadEvents {
  constructor (app) {
    this.app = app;
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
        blockNumber = Math.max(blockNumber, systemInfo.superTokenBlockNumber);
        const currentChainId = await this.app.client.getChainId();
        if (currentChainId !== systemInfo.chainId) {
          throw new Error("different network than from the saved data");
        }
      }

      let pullCounter = blockNumber;
      const currentBlockNumber = await this.app.client.getCurrentBlockNumber(this.app.config.BLOCK_OFFSET);
      const realBlockNumber = currentBlockNumber + this.app.config.BLOCK_OFFSET;

      this.app.logger.info(`scanning blocks from ${pullCounter} to ${currentBlockNumber} - real ${realBlockNumber}`);
      const queue = async.queue(async function (task) {
        let keepTrying = 1;
        while (true) {
          try {
            task.self.app.logger.info(`getting blocks: trying #${keepTrying} - from:${task.fromBlock} to:${task.toBlock}`);

            const query = task.self.app.config.TOKENS
                ? { filter: { token: task.self.app.config.TOKENS }, fromBlock: task.fromBlock, toBlock: task.toBlock }
                : { fromBlock: task.fromBlock, toBlock: task.toBlock };

            let result = await task.self.app.protocol.getCFAAgreementEvents("FlowUpdated", query);
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
            // this often happens due to RPC rate limiting, thus it's wise to add some delay here
            await task.self.app.timer.timeout(keepTrying * 1000); // linear backoff
            if (keepTrying > task.self.app.config.NUM_RETRIES) {
              process.exit(1);
            }
          }
        }
      }, this.app.config.CONCURRENCY);
      //
      while (pullCounter <= currentBlockNumber) {
        const end = (pullCounter + parseInt(this.app.config.MAX_QUERY_BLOCK_RANGE));
        queue.push({self: this, fromBlock: pullCounter, toBlock: end > currentBlockNumber ? currentBlockNumber : end });
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
      if(!this.app.config.OBSERVER) {
        this.app.logger.info("start getting delays PIC system");
        // we need to query each supertoken to check pic address
        const delayChecker = async.queue(async function (task) {
          let keepTrying = 10;
          while (true) {
            try {
              await task.self.app.protocol.calculateAndSaveTokenDelay(task.token, false);
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
          delayChecker.push({
            self: this,
            token: st
          });
        }

        if (superTokens.length > 0 && !this.app.config.OBSERVER) {
          await delayChecker.drain();
        }
        this.app.logger.info("finish getting delays PIC system");
      } else {
        this.app.logger.info("running as observer, ignoring PIC system");
      }

      this.app.logger.info("finish past event to find SuperTokens");
      return currentBlockNumber;
    } catch (err) {
      this.app.logger.error(err);
      process.exit(1);
    }
  }
}

module.exports = LoadEvents;
