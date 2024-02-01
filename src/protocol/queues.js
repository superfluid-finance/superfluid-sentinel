const async = require("async");

const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));

async function trigger (fn, ms) {
  await timeout(ms);
  await fn.drain();
}

// keeps DB up to date based on latest relevant on-chain events
class Queues {
  constructor (app) {
    this.app = app;
    this._isShutdown = false;
  }

  init () {
    this.estimationQueue = this.newEstimationQueue();
    this.agreementUpdateQueue = this.newAgreementQueue();
  }

  async run (fn, time) {
    // don't run if shutting down
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
          if (task.self.app.client.superToken.isSuperTokenRegistered(task.token)) {
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
          task.self.app.logger.error("newEstimationQueue: " +  err);
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
          const senderFilterCFA = {
            filter: {
              sender: task.account
            },
            fromBlock: task.blockNumber,
            toBlock: task.blockNumber
          };

          const senderFilerGDA = {
            filter: {
              distributor: task.account
            },
            fromBlock: task.blockNumber,
            toBlock: task.blockNumber
          };

          const senderFilerGDAConnections = {
            filter: {
              account: task.account
            },
            fromBlock: task.blockNumber,
            toBlock: task.blockNumber
          };

          const flowUpdatedEvents = await task.self.app.queues._handleAgreementEvents(
              task,
              senderFilterCFA,
              "CFA",
              "FlowUpdated",
              task.self.app.protocol.getCFAAgreementEvents
          );
          let flowDistributionUpdatedEvents = await task.self.app.queues._handleAgreementEvents(
              task,
              senderFilerGDA,
              "GDA",
              "FlowDistributionUpdated",
              task.self.app.protocol.getGDAgreementEvents
          );

          let PoolConnectionUpdated = await task.self.app.queues._handleAgreementEvents(
              task,
              senderFilerGDAConnections,
              "GDAC",
              "PoolConnectionUpdated",
              task.self.app.protocol.getGDAgreementEvents
          );
          // merge both
          const events = [...flowUpdatedEvents, ...flowDistributionUpdatedEvents, ...PoolConnectionUpdated];
          await task.self.app.queues._processEvents(task, events);
          break;
        } catch (err) {
          keepTrying++;
          task.self.app.logger.cerror("Queues.agreementUpdateQueue(): " + err);
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
    if(this._isShutdown) {
      throw Error("Queues.addQueuedEstimation(): shutdown");
    }

    if(this.isEstimationTaskInQueue(token, account)) {
      this.app.logger.debug(`Queues.addQueuedEstimation(): estimation task already in queue for account: ${account} token: ${token}`);
      return;
    }
    this.estimationQueue.push({
      self: this,
      account: account,
      token: token,
      parentCaller: parentCaller
    });
  }

  isEstimationTaskInQueue(token, account) {
    if (this.estimationQueue === undefined) {
        throw Error("Queues.isEstimationTaskInQueue(): Need EstimationQueue to be set first");
    }
    let currentTaskNode = this.estimationQueue._tasks.head;
    while (currentTaskNode) {
      const taskData = currentTaskNode.data
      if (taskData.account === account && taskData.token === token) {
        return true;
      }

      currentTaskNode = currentTaskNode.next;
    }

    return false;
  }

  // get all tasks in the queue as array
  getEstimationTasks(queue = undefined) {
        let currentTaskNode = this.estimationQueue._tasks.head;
        const tasks = [];
        while (currentTaskNode) {
            tasks.push(currentTaskNode.data);
            currentTaskNode = currentTaskNode.next;
        }

        return tasks;
    }

  getAgreementQueueLength () {
    return this.agreementUpdateQueue.length();
  }

  getEstimationQueueLength () {
    return this.estimationQueue.length();
  }

  async shutdown() {
    try {
      this._isShutdown = true;
      this.app.circularBuffer.push("shutdown", null, "queues shutting down");

      if(this.estimationQueue.length() > 0) {
        this.app.circularBuffer.push("shutdown", null, `queues shutting down - estimationQueue length: ${this.estimationQueue.length()}`);
      }

      this.estimationQueue.pause();
      this.app.logger.info("estimationQueue successfully shut down");

      if(this.agreementUpdateQueue.length() > 0) {
        this.app.circularBuffer.push("shutdown", null, `queues shutting down - agreementUpdateQueue length: ${this.agreementUpdateQueue.length()}`);
      }
      this.agreementUpdateQueue.pause();
      this.app.logger.info("agreementUpdateQueue successfully shut down");

    } catch (error) {
      this.app.logger.error("Error during queue shutdown:", error);
    }
  }

  async _handleAgreementEvents(task, senderFilter, source, eventName, getAgreementEventsFunc) {
    const app = task.self.app;
    let allFlowUpdatedEvents = await getAgreementEventsFunc(
        eventName,
        senderFilter,
        app
    );

    // return if no events
    if (!allFlowUpdatedEvents || allFlowUpdatedEvents.length === 0) {
      return [];
    }
    allFlowUpdatedEvents = allFlowUpdatedEvents.map(
        app.models.event.transformWeb3Event
    );
    allFlowUpdatedEvents.sort((a, b) => a.blockNumber - b.blockNumber);
    //todo: review this
    if (source === "GDA") {
      allFlowUpdatedEvents = await Promise.all(allFlowUpdatedEvents.map(async (event) => {
        event.sender = event.distributor;
        event.receiver = event.pool;
        event.agreementId = await app.protocol.generateGDAId(event.distributor, event.pool);
        event.flowRate = event.newDistributorToPoolFlowRate;
        event.source = "GDA";
        return event;
      }));
    } else if(source === "GDAC") {
      allFlowUpdatedEvents = await Promise.all(allFlowUpdatedEvents.map(async (event) => {
        event.sender = event.account;
        event.receiver = event.pool;
        event.agreementId = await app.protocol.generateGDAId(event.sender, event.receiver);
        event.source = "GDAC";
        return event;
      }));
    } else {
      allFlowUpdatedEvents.forEach((event) => {
        event.agreementId = app.protocol.generateCFAId(event.sender, event.receiver);
        event.source = "CFA";
      });
    }
    if (allFlowUpdatedEvents.length === 0) {
      task.self.app.logger.debug(`Didn't find ${eventName} for sender: ${task.account} in blockNumber: ${task.blockNumber} / blockHash ${task.blockHash}`);
    }
    return allFlowUpdatedEvents;
  }

  async _processEvents(task, events) {
    for (const event of events) {
      //in the case of connection/disconnect, don't update the agreement. Still need to update the estimation
      if(event.source !== "GDAC") {
        await task.self.app.db.models.AgreementModel.upsert({
          agreementId: event.agreementId,
          superToken: event.token,
          sender: event.sender,
          receiver: event.receiver,
          flowRate: event.flowRate,
          blockNumber: event.blockNumber,
          source: event.source
        });
      }

      if (["CFA", "GDA", "GDAC"].includes(event.source)) {
        let accounts = [];
        if(event.source === "CFA") {
            accounts = [event.sender, event.receiver];
        } else if(event.source === "GDA") {
            accounts = [event.distributor, event.pool];
        } else {
          accounts = [event.account, event.receiver];
        }
        accounts.forEach(account => {
          task.self.app.queues.addQueuedEstimation(event.token, account, "agreementUpdateQueue");
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