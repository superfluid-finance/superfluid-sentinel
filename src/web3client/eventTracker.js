const { PollingBlockTracker } = require("eth-block-tracker");
const superTokenEvents = require("../models/SuperTokensEventsAbi");
const CFAEvents = require("../models/CFAEventsAbi");
const IDAEvents = require("../models/IDAEventsAbi");
const decoder = require("ethjs-abi");
const { wad4human } = require("@decentral.ee/web3-helpers");

class EventTracker {

    constructor(app) {
        this.app = app;
        this.blockTracker;
        this.oldSeenBlock
        this.lastSeenBlock;
    }

    updateBlockNumber(oldSeenBlock, lastSeenBlock) {
        this.oldSeenBlock = oldSeenBlock;
        this.lastSeenBlock = lastSeenBlock;
    }

    getPastBlockAndParseEvents(oldBlock, newBlock) {
        this.app.client.web3.eth.getPastLogs({
            fromBlock: oldBlock,
            toBlock: newBlock,
            address: this.app.client.getSFAddresses()
        }).then((result) => {
            for(const log of result) {
                const stoken = this._parseEvent(superTokenEvents,log);
                if(stoken) {
                    this.processSuperTokenEvent(stoken);
                } else {
                    const cfa = this._parseEvent(CFAEvents,log);
                    if(cfa) {
                        this.processAgreementEvent(cfa);
                    } else {
                        const ida = this._parseEvent(IDAEvents,log);
                        if(ida) {
                            this.processIDAEvent(ida);
                        }
                    }
                }
            }
        });
    }

    async start(oldBlock) {
        if(this.app.client.isInitialized === undefined || !this.app.client.isInitialized) {
            throw Error("BlockTracker.start() - client is not initialized ");
        }
        if(oldBlock) {
            this.oldSeenBlock = oldBlock;
        }
        const provider = this.app.client.web3.eth.currentProvider;
        this.blockTracker = new PollingBlockTracker({provider, pollingInterval: this.app.config.POLLING_INTERNVAL})
        const self = this;
        this.blockTracker.on('sync', ({ newBlock, oldBlock }) => {
            if (oldBlock) {
                self.app.logger.debug(`sync #${Number(oldBlock) + 1} -> #${Number(newBlock)}`);
                self.app.db.queries.updateBlockNumber(oldBlock);
                self.getPastBlockAndParseEvents(Number(oldBlock) + 1, newBlock);
                self.updateBlockNumber(oldBlock + 1, newBlock);
            } else if(self.oldSeenBlock) {
                self.app.logger.debug(`first sync #${Number(self.oldSeenBlock) + 1} -> #${Number(newBlock)}`);
                self.getPastBlockAndParseEvents(self.oldSeenBlock, newBlock);
                self.updateBlockNumber(self.oldSeenBlock + 1, newBlock);
            }
        })
    }

    async processSuperTokenEvent(event) {
        try {

            if (event.removed) {
                this.app.logger.warn(`Event removed: ${event.eventName}, blockNumber ${event.blockNumber}, tx ${event.transactionHash}`);
            }
            switch(event.eventName) {
                case "AgreementStateUpdated" : {
                    this.app.queues.agreementUpdateQueue.push({
                        self: this,
                        account: event.account,
                        blockNumber: event.blockNumber
                    });
                    break;
                }
                case "Transfer" : {
                    this.app.queues.estimationQueue.push([
                        {
                            self: this,
                            account: event.from,
                            token: event.address
                        },
                        {
                            self: this,
                            account: event.to,
                            token: event.address
                        }
                    ]);
                    break;
                }
                case "AgreementLiquidatedBy": {
                    this.app.logger.info(`Liquidation: tx ${event.transactionHash}, token ${this.app.client.superTokenNames[event.address.toLowerCase()]}, liquidated acc ${event.penaltyAccount}, liquidator acc ${event.liquidatorAccount}, reward ${wad4human(event.rewardAmount)}`);
                    if (event.bailoutAmount.toString() !== "0") {
                        this.app.logger.warn(`${event.id} has to be bailed out with amount ${wad4human(event.bailoutAmount)}`);
                    }
                }
            }
        } catch(err) {
            console.error(`subscription ${err}`);
            throw Error(`subscription ${err}`);
        }
    }

    async processAgreementEvent(event) {
        try {
            if(!this.app.client.isSuperTokenRegister(event.token)) {
                this.app.logger.warn(`found a new token at ${event.token}`);
            }
        } catch(err) {
            this.app.logger.error(err);
            throw Error(`agreement subscription ${err}`);
        }
    }

    async processIDAEvent(event) {
        try {
        if(this.app.client.isSuperTokenRegister(event.token)) {
            switch(event.eventName) {
                case "IndexUpdated" : {
                    //Recalculate balances
                    const subscribers = await this.app.db.queries.getIDASubscribers(event.token, event.publisher);
                    this.app.queues.estimationQueue.push([
                        {
                            self: this,
                            account: event.publisher,
                            token: event.token
                        }
                    ]);
                    break;
                }
                default: {
                    //Save to DB
                    this.app.queues.IDAQueue.push({
                        self: this,
                        event: event
                    });
                }
            }
        } else {
            this.app.logger.debug(`token:${event.token} is not subscribed`);
        }
    } catch(err) {
        this.app.logger.error(err);
        throw Error(`ida events ${err}`);
    }
    }

    _parseEvent(abi, log) {
        let event = log;
        for(let a in abi) {
            const decodeResult = decoder.decodeLogItem(abi[a.toString()], log);
            if(decodeResult) {
                event.returnValues = decodeResult;
                event.event = decodeResult._eventName;
                return this.app.models.event.transformWeb3Event(event);
            }
        }
    }

    _disconnect() {
        return this.blockTracker.removeAllListeners();
    }
}

module.exports = EventTracker;