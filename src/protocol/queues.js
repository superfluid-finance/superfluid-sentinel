const async = require("async");

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
    this.estimationQueue = this.newEstimationQueue();
    this.agreementUpdateQueue = this.newAgreementQueue();
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

  newEstimationQueue () {
    return async.queue(async function (task) {
      let keepTrying = 1;
      if (task.account === "0x0000000000000000000000000000000000000000") {
        return;
      }
      while (true) {
        try {
          if (task.self.app.client.isSuperTokenRegistered(task.token)) {
            task.self.app.logger.debug(`EstimationQueue - Parent Caller ${task.parentCaller} TransactionHash: ${task.transactionHash}`);
            const estimationData = await task.self.app.protocol.liquidationData(task.token, task.account);
            await task.self.app.db.models.AccountEstimationModel.upsert({
              address: task.account,
              superToken: task.token,
              totalNetFlowRate: estimationData.totalNetFlowRate,
              availableBalance: estimationData.availableBalance,
              totalCFADeposit: estimationData.totalCFADeposit,
              estimation: new Date(estimationData.estimation).getTime(),
              estimationPleb: new Date(estimationData.estimationPleb).getTime(),
              estimationPirate: new Date(estimationData.estimationPirate).getTime(),
              estimationHuman: estimationData.estimation,
              estimationHumanPleb:estimationData.estimationPleb,
              estimationHumanPirate: estimationData.estimationPirate,
              blockNumber: task.blockNumber,
              source: task.source
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
            task.self.app.logger.error("Queues.estimationQueue(): exhausted number of retries");
            process.exit(1);
          }
        }
      }
    }, this.app.config.CONCURRENCY);
  }

  newAgreementQueue() {
    if (this.estimationQueue === undefined) {
      throw Error("Queues.newAgreementQueue(): Need EstimationQueue to be set first");
    }
    return async.queue(async function (task) {
      let keepTrying = 1;
      if (task.account === "0x0000000000000000000000000000000000000000") {
        return;
      }

      while (true) {
        try {
          task.self.app.logger.debug(`EstimationQueue - Parent Caller ${task.parentCaller} TransactionHash: ${task.transactionHash}`);
          const senderFilter = task.self._buildFilter(task);

          const flowUpdatedEvents = await task.self._handleAgreementEvents(
              task,
              senderFilter,
              "CFA",
              "FlowUpdated",
              this.app.protocol.getCFAAgreementEvents,
              this.app.protocol.generateCFAId
          );

          const flowDistributionUpdatedEvents = await task.self._handleAgreementEvents(
              task,
              senderFilter,
              "GDA",
              "FlowDistributionUpdated",
              task.self.app.protocol.getGDAgreementEvents,
              task.self.app.protocol.generateGDAId
          );

          // merge both
          const events = [...flowUpdatedEvents, ...flowDistributionUpdatedEvents];
          await task.self._processEvents(task, events);
          break;
        } catch (err) {
          keepTrying++;
          task.self.app.logger.error(err);
          if (keepTrying > task.self.app.config.NUM_RETRIES) {
            task.self.app.logger.error("Queues.agreementUpdateQueue(): exhausted number of retries");
            process.exit(1);
          }
        }
      }
    }, this.app.config.CONCURRENCY);
  }

  async addQueuedEstimation (token, account, parentCaller) {
    if (this.estimationQueue === undefined) {
      throw Error("Queues.addQueuedEstimation(): Need EstimationQueue to be set first");
    }
    this.estimationQueue.push({
      self: this,
      account: account,
      token: token,
      parentCaller: parentCaller
    });
  }

  getAgreementQueueLength () {
    return this.agreementUpdateQueue.length();
  }

  getEstimationQueueLength () {
    return this.estimationQueue.length();
  }

  _buildFilter (task) {
    return {
      filter: {
        account: task.account
      },
      fromBlock: task.blockNumber,
      toBlock: task.blockNumber
    };
  }
  async _handleAgreementEvents(task, senderFilter, source, eventName, getAgreementEventsFunc, generateIdFunc) {
    let allFlowUpdatedEvents = await getAgreementEventsFunc(
        eventName,
        senderFilter
    );

    allFlowUpdatedEvents = allFlowUpdatedEvents.map(
        task.self.app.models.event.transformWeb3Event
    );

    allFlowUpdatedEvents.sort((a, b) => a.blockNumber - b.blockNumber)
        .forEach(e => {
          e.agreementId = generateIdFunc(e.sender, e.receiver);
          e.source = source;
        });

    if (allFlowUpdatedEvents.length === 0) {
      task.self.app.logger.debug(`Didn't find ${eventName} for sender: ${task.account} in blockNumber: ${task.blockNumber} / blockHash ${task.blockHash}`);
    }

    return allFlowUpdatedEvents;
  }

  async _processEvents(task, events) {

    for (const event of events) {

      await task.self.app.db.models.AgreementModel.upsert({
        agreementId: event.agreementId,
        superToken: event.token,
        sender: event.sender,
        receiver: event.receiver,
        flowRate: event.flowRate,
        blockNumber: event.blockNumber
      });

      if (["CFA", "GDA"].includes(event.source)) {
         const accounts = event.source === "CFA" ? [event.sender, event.receiver] : [event.distributor, event.pool];
        accounts.forEach(account => {
          task.self.app.queues.estimationQueue.push(
              task.self.app.queues._createAgreementTask(account, event, task)
          );
        });
      }
    }
  }

  // organize the task to be pushed to the queue
  _createAgreementTask(account, event, task) {
    return {
      self: task.self,
      account: account,
      token: event.token,
      blockNumber: event.blockNumber,
      blockHash: event.blockHash,
      transactionHash: event.transactionHash,
      parentCaller: "agreementUpdateQueue",
      source: event.source
    }
  }

}

module.exports = Queues;