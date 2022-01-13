const { PollingBlockTracker } = require("eth-block-tracker");
const superTokenEvents = require("../models/SuperTokensEventsAbi");
const CFAEvents = require("../models/CFAEventsAbi");
const IDAEvents = require("../models/IDAEventsAbi");
const TOGAEvents = require("../models/TOGAEventsAbi");
const decoder = require("ethjs-abi");
const { wad4human } = require("@decentral.ee/web3-helpers");

class EventTracker {
  constructor (app) {
    this.app = app;
    this.lastTimeNewBlocks = 0;
  }

  updateBlockNumber (oldSeenBlock) {
    this.oldSeenBlock = oldSeenBlock;
  }

  getPastBlockAndParseEvents (oldBlock, newBlock) {
    this.app.client.web3.eth.getPastLogs({
      fromBlock: oldBlock,
      toBlock: newBlock,
      address: this.app.client.getSFAddresses()
    }).then((result) => {
      for (const log of result) {
        const tokenEvent = this._parseEvent(superTokenEvents, log);
        if (tokenEvent) {
          this.processSuperTokenEvent(tokenEvent);
        } else {
          const cfaEvent = this._parseEvent(CFAEvents, log);
          if (cfaEvent) {
            this.processAgreementEvent(cfaEvent);
          } else {
            const idaEvent = this._parseEvent(IDAEvents, log);
            if (idaEvent) {
              this.processIDAEvent(idaEvent);
            } else {
              const togaEvent = this._parseEvent(TOGAEvents, log);
              if (togaEvent) {
                this.processTOGAEvent(togaEvent);
              }
            }
          }
        }
      }
    });
  }

  async start (oldBlock) {
    if (this.app.client.isInitialized === undefined || !this.app.client.isInitialized) {
      throw Error("BlockTracker.start() - client is not initialized ");
    }
    if (oldBlock) {
      this.oldSeenBlock = oldBlock;
    }
    const provider = this.app.client.web3.eth.currentProvider;
    this.blockTracker = new PollingBlockTracker({
      provider,
      pollingInterval: this.app.config.POLLING_INTERVAL
    });
    const self = this;
    try {
      this.blockTracker.on("sync", ({ newBlock }) => {
        self.lastTimeNewBlocks = new Date();
        const _newBlock = Number(newBlock);
        const _oldBlock = Number(self.oldSeenBlock);
        const newBlockWithOffset = _newBlock - self.app.config.BLOCK_OFFSET;
        self.app.logger.debug(`[${self.app.config.BLOCK_OFFSET}] oldBlock:${_oldBlock} newBlock:${_newBlock} withOffset: ${newBlockWithOffset}`);
        if (_newBlock - _oldBlock + 1 >= self.app.config.BLOCK_OFFSET) {
          if (_oldBlock) {
            self.app.db.queries.updateBlockNumber(newBlockWithOffset);
            self.getPastBlockAndParseEvents(_oldBlock + 1, newBlockWithOffset);
            self.updateBlockNumber(newBlockWithOffset);
            self.app.db.queries.updateBlockNumber(newBlockWithOffset);
          } else if (self.oldSeenBlock) {
            self.getPastBlockAndParseEvents(_oldBlock, newBlockWithOffset);
            self.updateBlockNumber(newBlockWithOffset);
          }
        } else {
          self.app.logger.warn(`skip getting new blocks: new block ${_newBlock}, old block ${_oldBlock}`);
          self.app.client.addSkipBlockRequest();
        }
        self.app.client.addTotalRequest();
      });
    } catch (err) {
      this.app.logger.error(err);
      // retry how many times? - process.exit(1) || this.start(oldBlock);
    }
  }

  processSuperTokenEvent (event) {
    try {
      if (event.removed) {
        this.app.logger.warn(`Event removed: ${event.eventName}, blockNumber ${event.blockNumber}, tx ${event.transactionHash}`);
      }
      switch (event.eventName) {
        case "AgreementStateUpdated" : {
          this.app.logger.debug(`${event.eventName} [${event.address}] -  ${event.account}`);
          this.app.queues.agreementUpdateQueue.push({
            self: this,
            account: event.account,
            blockNumber: event.blockNumber,
            blockHash: event.blockHash,
            transactionHash: event.transactionHash,
            parentCaller: "processSuperTokenEvent"
          });
          break;
        }
        case "Transfer" : {
          this.app.logger.debug(`${event.eventName} [${event.address}] - sender ${event.from} receiver ${event.to}`);
          this.app.queues.estimationQueue.push([
            {
              self: this,
              account: event.from,
              token: event.address,
              blockNumber: event.blockNumber,
              blockHash: event.blockHash,
              transactionHash: event.transactionHash,
              parentCaller: "processSuperTokenEvent"
            },
            {
              self: this,
              account: event.to,
              token: event.address,
              blockNumber: event.blockNumber,
              blockHash: event.blockHash,
              transactionHash: event.transactionHash,
              parentCaller: "processSuperTokenEvent"
            }
          ]);
          break;
        }
        case "AgreementLiquidatedBy": {
          this.app.logger.info(`Liquidation: tx ${event.transactionHash}, token ${this.app.client.superTokenNames[event.address.toLowerCase()]}, liquidated acc ${event.penaltyAccount}, liquidator acc ${event.liquidatorAccount}, reward ${wad4human(event.rewardAmount)}`);
          if (event.bailoutAmount.toString() !== "0") {
            this.app.logger.warn(`${event.id} has to be bailed out with amount ${wad4human(event.bailoutAmount)}`);
          }
          break;
        }
      }
    } catch (err) {
      this.app.logger.error(err);
      throw Error(`EventTracker.processSuperTokenEvent(): ${err}`);
    }
  }

  processAgreementEvent (event) {
    try {
      if (!this.app.client.isSuperTokenRegistered(event.token)) {
        this.app.logger.debug(`found a new token at ${event.token}`);
        // TODO: if subscribe to all tokens add this one
      }
    } catch (err) {
      this.app.logger.error(err);
      throw Error(`EventTracker.processAgreementEvent(): ${err}`);
    }
  }

  async processIDAEvent (event) {
    try {
      if(event.eventName === "IndexUpdated") {
        if (this.app.client.isSuperTokenRegistered(event.token)) {
          this.app.logger.debug(`[IndexUpdated] - ${event.eventName} [${event.token}] - publisher ${event.publisher}`);
          this.app.queues.estimationQueue.push([
            {
              self: this,
              account: event.publisher,
              token: event.token,
              blockNumber: event.blockNumber,
              blockHash: event.blockHash,
              transactionHash: event.transactionHash,
              parentCaller: "processIDAEvent"
            }
          ]);
        } else {
          this.app.logger.debug(`[IDA]: token ${event.token} is not subscribed`);
        }
      }
    } catch (err) {
      this.app.logger.error(err);
      throw Error(`EventTracker.processIDAEvent(): ${err}`);
    }
  }

  async processTOGAEvent (event) {
    try {
      if(event.eventName === "NewPIC") {
        if (this.app.client.isSuperTokenRegistered(event.token)) {
          this.app.logger.info(`[TOGA]: ${event.eventName} [${event.token}] new pic ${event.pic}`);
          this.app.protocol.calculateAndSaveTokenDelay(event.token);
        } else {
          this.app.logger.debug(`[TOGA]: token ${event.token} is not subscribed`);
        }
      }
    } catch (err) {
      this.app.logger.error(err);
      throw Error(`EventTracker.processTOGAEvent(): ${err}`);
    }
  }

  _parseEvent (abi, log) {
    const event = log;
    for (const a in abi) {
      const decodeResult = decoder.decodeLogItem(abi[a.toString()], log);
      if (decodeResult) {
        event.returnValues = decodeResult;
        event.event = decodeResult._eventName;
        return this.app.models.event.transformWeb3Event(event);
      }
    }
  }

  _disconnect () {
    return this.blockTracker.removeAllListeners();
  }
}

module.exports = EventTracker;
