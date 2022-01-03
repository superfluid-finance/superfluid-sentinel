const async = require("async");
const EstimationModel = require("../database/models/accountEstimationModel");
const AgreementModel = require("../database/models/agreementModel");

const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));

async function trigger (fn, ms) {
  await timeout(ms);
  await fn.drain();
}

class Queues {
  constructor (app) {
    this.app = app;
  }

  init () {
    this.estimationQueue = async.queue(async function (task) {
      let keepTrying = 1;
      if (task.account === "0x0000000000000000000000000000000000000000") {
        return;
      }
      while (true) {
        try {
          if (task.self.app.client.isSuperTokenRegistered(task.token)) {
            task.self.app.logger.debug(`Parent Caller ${task.parentCaller}`);
            task.self.app.logger.debug(`EstimationQueue - BlockHash: ${task.blockHash} TransactionHash: ${task.transactionHash}`);
            const estimationData = await task.self.app.protocol.liquidationData(task.token, task.account);
            await EstimationModel.upsert({
              address: task.account,
              superToken: task.token,
              totalNetFlowRate: estimationData.totalNetFlowRate,
              totalBalance: estimationData.totalBalance,
              zestimation: new Date(estimationData.estimation).getTime(),
              zestimationHuman: estimationData.estimation,
              blockNumber: task.blockNumber
            });
            const estimationOutput = new Date(estimationData.estimation).getTime() > 0 ? estimationData.estimation : "no estimation found";
            task.self.app.logger.debug(`[${task.token}]: ${task.account} - ${estimationOutput}`);
          } else {
            task.self.app.logger.debug(`reject account: ${task.account} supertoken: ${task.token} not subscribed`);
          }
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
    }, 1);

    this.agreementUpdateQueue = async.queue(async function (task) {
      let keepTrying = 1;
      if (task.account === "0x0000000000000000000000000000000000000000") {
        return;
      }
      while (true) {
        try {
          task.self.app.logger.debug(`Parent Caller ${task.parentCaller}`);
          task.self.app.logger.debug(`AgreementUpdateQueue - BlockHash: ${task.blockHash} TransactionHash: ${task.transactionHash}`);
          const senderFilter = {
            filter: {
              sender: task.account
            },
            fromBlock: task.blockNumber,
            toBlock: task.blockNumber
          };

          let allFlowUpdatedEvents = await task.self.app.protocol.getAgreementEvents(
            "FlowUpdated",
            senderFilter
          );

          allFlowUpdatedEvents = allFlowUpdatedEvents.map(
            task.self.app.models.event.transformWeb3Event
          );

          allFlowUpdatedEvents.sort(function (a, b) {
            return a.blockNumber > b.blockNumber;
          }).forEach(e => {
            e.agreementId = task.self.app.protocol.generateId(e.sender, e.receiver);
          });

          if (allFlowUpdatedEvents.length === 0) {
            task.self.app.logger.debug(`Didn't find FlowUpdated for sender: ${task.account} in blockNumber: ${task.blockNumber} / blockHash ${task.blockHash}`);
          } else {
            task.self.app.logger.debug(allFlowUpdatedEvents);
          }
          for (const event of allFlowUpdatedEvents) {
            await AgreementModel.upsert({
              agreementId: event.agreementId,
              superToken: event.token,
              sender: event.sender,
              receiver: event.receiver,
              flowRate: event.flowRate,
              blockNumber: event.blockNumber
            });
            task.self.app.queues.estimationQueue.push([{
              self: task.self,
              account: event.sender,
              token: event.token,
              blockNumber: event.blockNumber,
              blockHash: event.blockHash,
              transactionHash: event.transactionHash,
              parentCaller: "agreementUpdateQueue"
            }, {
              self: task.self,
              account: event.receiver,
              token: event.token,
              blockNumber: event.blockNumber,
              blockHash: event.blockHash,
              transactionHash: event.transactionHash,
              parentCaller: "agreementUpdateQueue"
            }]);
          }
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
    }, 1);
  }

  async run (fn, time) {
    if (this.app._isShutdown) {
      this.app.logger.info(`app.shutdown() - closing queues`);
      return;
    }
    await trigger(fn, time);
    await this.run(fn, time);
  }

  async start () {
    this.run(this.estimationQueue, 5000);
    this.run(this.agreementUpdateQueue, 5000);
  }

  async addQueuedEstimation (token, account, parentCaller) {
    this.estimationQueue.push({
      self: this,
      account: account,
      token: token,
      parentCaller: parentCaller
    });
  }

  async addQueuedAgreement (account, blockNumber, parentCaller) {
    this.agreementUpdateQueue.push({
      self: this,
      account: account,
      blockNumber: blockNumber,
      parentCaller: parentCaller
    });
  }

  getAgreementQueueLength () {
    return this.agreementUpdateQueue.length();
  }

  getEstimationQueueLength () {
    return this.estimationQueue.length();
  }
}

module.exports = Queues;
