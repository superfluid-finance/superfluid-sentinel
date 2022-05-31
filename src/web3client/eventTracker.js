const { PollingBlockTracker } = require("eth-block-tracker");
const superTokenEvents = require("../models/SuperTokensEventsAbi");
const CFAEvents = require("../models/CFAEventsAbi");
const IDAEvents = require("../models/IDAEventsAbi");
const TOGAEvents = require("../models/TOGAEventsAbi");
const decoder = require("ethjs-abi");
const { wad4human } = require("@decentral.ee/web3-helpers");
const BN = require("bn.js");

class EventTracker {
  constructor (app) {
    this.app = app;
    this.lastTimeNewBlocks = 0;
  }

  updateBlockNumber (oldSeenBlock) {
    this.potentialOldest = this.oldSeenBlock;
    this.oldSeenBlock = oldSeenBlock;
  }

  rewindBlockNumber() {
    this.oldSeenBlock = this.potentialOldest;
  }

  async getPastBlockAndParseEvents (oldBlock, newBlock) {
    if(Number(oldBlock) <= Number(newBlock)) {
      let eventsFromBlocks = await this.app.client.web3.eth.getPastLogs({fromBlock: oldBlock,
        toBlock: newBlock,
        address: this.app.client.getSFAddresses()
      });
      // scan blocks from new tokens to subscribe before processing the remaining data
      const newTokens = await this.findNewTokens(eventsFromBlocks);
      if(newTokens) {
        eventsFromBlocks = await this.app.client.web3.eth.getPastLogs({fromBlock: oldBlock,
          toBlock: newBlock,
          address: this.app.client.getSFAddresses()
        });
      }
      for (const log of eventsFromBlocks) {
        this.processSuperTokenEvent(this._parseEvent(superTokenEvents, log));
        this.processIDAEvent(this._parseEvent(IDAEvents, log));
        await this.processTOGAEvent(this._parseEvent(TOGAEvents, log));
      }
    }
  }

  async start (oldBlock) {
    if (this.app.client.isConnected === undefined || !this.app.client.isConnected) {
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
      this.blockTracker.on("sync", async ({ newBlock }) => {
        self.lastTimeNewBlocks = new Date();
        const _newBlock = Number(newBlock);
        const _oldBlock = Number(self.oldSeenBlock);
        const newBlockWithOffset = _newBlock - self.app.config.BLOCK_OFFSET;
        self.app.logger.debug(`[${self.app.config.BLOCK_OFFSET}] oldBlock:${_oldBlock} newBlock:${_newBlock} withOffset: ${newBlockWithOffset}`);
        if (_newBlock - _oldBlock + 1 >= self.app.config.BLOCK_OFFSET) {
          if (_oldBlock) {
            await self.getPastBlockAndParseEvents(_oldBlock + 1, newBlockWithOffset);
            self.updateBlockNumber(newBlockWithOffset);
            self.app.db.queries.updateBlockNumber(newBlockWithOffset);
          } else if (self.oldSeenBlock) {
            await self.getPastBlockAndParseEvents(_oldBlock, newBlockWithOffset);
            self.updateBlockNumber(newBlockWithOffset);
          }
        } else {
          self.app.logger.warn(`skip getting new blocks: new block ${_newBlock}, old block ${_oldBlock}`);
          self.app.client.addSkipBlockRequest();
        }
        self.app.client.addTotalRequest();
      }).on('error', err => {
        self.app.logger.warn(`rewinding to old block: ${self.potentialOldest}`);
        self.rewindBlockNumber();
        self.app.db.queries.updateBlockNumber(this.oldSeenBlock);
      });
    } catch (err) {
      this.app.logger.error(err);
      // retry how many times? - process.exit(1) || this.start(oldBlock);
    }
  }

  processSuperTokenEvent (event) {
    try {
      if(event) {
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
          case "AgreementLiquidatedV2": {
            this.app.logger.info(`Liquidation: tx ${event.transactionHash}, token ${this.app.client.superTokenNames[event.address.toLowerCase()]}, liquidated acc ${event.targetAccount}, liquidator acc ${event.liquidatorAccount}, reward ${wad4human(event.rewardAmount)}`);
            const ramount = new BN(event.rewardAmount)
            const delta = new BN(event.targetAccountBalanceDelta)
            const isBailout = ramount.add(delta).lt(0);
            if (isBailout) {
              this.app.logger.warn(`${event.id} has to be bailed out with amount ${wad4human(event.targetAccountBalanceDelta)}`);
            }
            break;
          }
        }
      }


    } catch (err) {
      this.app.logger.error(err);
      throw Error(`EventTracker.processSuperTokenEvent(): ${err}`);
    }
  }

  async processAgreementEvent (event) {
    try {
      if(event && !this.app.client.isSuperTokenRegistered(event.token)) {
        this.app.logger.debug(`found a new token at ${event.token}`);
        await this.app.client.loadSuperToken(event.token, true);
        return true;
      }
      return false;
    } catch (err) {
      this.app.logger.error(err);
      throw Error(`EventTracker.processAgreementEvent(): ${err}`);
    }
  }

  processIDAEvent (event) {
    try {
      if(event && event.eventName === "IndexUpdated") {
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
      if(event && event.eventName === "NewPIC") {
        if (this.app.client.isSuperTokenRegistered(event.token)) {
          this.app.logger.info(`[TOGA]: ${event.eventName} [${event.token}] new pic ${event.pic}`);
          await this.app.protocol.calculateAndSaveTokenDelay(event.token);
        } else {
          this.app.logger.debug(`[TOGA]: token ${event.token} is not subscribed`);
        }
      }
    } catch (err) {
      this.app.logger.error(err);
      throw Error(`EventTracker.processTOGAEvent(): ${err}`);
    }
  }

  async findNewTokens(events) {
    for (const log of events) {
      return this.processAgreementEvent(this._parseEvent(CFAEvents, log));
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
    if(this.blockTracker !== undefined)
      return this.blockTracker.removeAllListeners();
  }
}

module.exports = EventTracker;