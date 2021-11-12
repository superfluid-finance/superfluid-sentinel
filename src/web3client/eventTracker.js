const { PollingBlockTracker } = require("eth-block-tracker");
const superTokenEvents = require("../models/SuperTokensEventsAbi");
const CFAEvents = require("../models/CFAEventsAbi");
const IDAEvents = require("../models/IDAEventsAbi");
const TOGAEvents = require("../models/TOGAEventsAbi")
const decoder = require("ethjs-abi");
const { wad4human } = require("@decentral.ee/web3-helpers");

class EventTracker {

    constructor(app) {
        this.app = app;
        this.blockTracker;
        this.oldSeenBlock
    }

    updateBlockNumber(oldSeenBlock) {
        this.oldSeenBlock = oldSeenBlock;
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
                        } else {
                            const toga = this._parseEvent(TOGAEvents,log);
                            if(toga) {
                                this.processTOGAEvent(toga);
                            }
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
        try {
            this.blockTracker.on('sync', ({ newBlock }) => {
                const _newBlock = Number(newBlock);
                const _oldBlock = Number(self.oldSeenBlock);
                const newBlockOffset = _newBlock - self.app.config.BLOCK_OFFSET;
                console.log(`[${self.app.config.BLOCK_OFFSET}] oldBlock: ${_oldBlock}, newBlock ${_newBlock} = ${newBlockOffset}`)
                console.log
                if(_newBlock - _oldBlock >= self.app.config.BLOCK_OFFSET) {
                    if (_oldBlock) {
                        self.app.logger.debug(`sync #${_oldBlock + 1} -> #${newBlockOffset}`);
                        self.app.db.queries.updateBlockNumber(newBlockOffset);
                        self.getPastBlockAndParseEvents(_oldBlock + 1, newBlockOffset);
                        self.updateBlockNumber(newBlockOffset);
                    } else if(self.oldSeenBlock) {
                        self.app.logger.debug(`first sync #${_oldBlock + 1} -> #${newBlockOffset}`);
                        self.getPastBlockAndParseEvents(_oldBlock, newBlockOffset);
                        self.updateBlockNumber(newBlockOffset);
                    }
                } else {
                    self.app.logger.warn(`skip getting new blocks: new block ${_newBlock}, old block ${_oldBlock}`);
                    self.app.client.addSkipBlockRequest();
                }
                self.app.client.addTotalRequest();
            });
        } catch(err) {
            this.app.logger.error(err);
            //retry how many times? - process.exit(1) || this.start(oldBlock);
        }
    }

    processSuperTokenEvent(event) {
        try {

            if (event.removed) {
                this.app.logger.warn(`Event removed: ${event.eventName}, blockNumber ${event.blockNumber}, tx ${event.transactionHash}`);
            }
            switch(event.eventName) {
                case "AgreementStateUpdated" : {
                    console.log(`${event.eventName} [${event.address}] -  ${event.account}`);
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
                    console.log(`${event.eventName} [${event.address}] - sender ${event.from} receiver ${event.to}`);
                    this.app.queues.estimationQueue.push([
                        {
                            self: this,
                            account: event.from,
                            token: event.address,
                            blockNumber: event.blockNumber,
                            blockHash: event.blockHash,
                            transactionHash: event.transactionHash,
                            parentCaller: "processSuperTokenEvent",
                        },
                        {
                            self: this,
                            account: event.to,
                            token: event.address,
                            blockNumber: event.blockNumber,
                            blockHash: event.blockHash,
                            transactionHash: event.transactionHash,
                            parentCaller: "processSuperTokenEvent",
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
        } catch(err) {
            console.error(`subscription ${err}`);
            throw Error(`subscription ${err}`);
        }
    }

    async processAgreementEvent(event) {
        try {
            if(!this.app.client.isSuperTokenRegister(event.token)) {
                this.app.logger.warn(`found a new token at ${event.token}`);
                //if subscribe to all tokens add this one:

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
                        console.log(`[IndexUpdated] - ${event.eventName} [${event.token}] - publisher ${event.publisher}`);
                        this.app.queues.estimationQueue.push([
                            {
                                self: this,
                                account: event.publisher,
                                token: event.token,
                                blockNumber: event.blockNumber,
                                blockHash: event.blockHash,
                                transactionHash: event.transactionHash,
                                parentCaller: "processIDAEvent",
                            }
                        ]);
                        break;
                    }
                }
            } else {
                this.app.logger.debug(`[IDA]: token ${event.token} is not subscribed`);
            }
    } catch(err) {
        this.app.logger.error(err);
        throw Error(`ida events ${err}`);
    }
    }

    async processTOGAEvent(event) {
        console.log("TOGA")
        console.log(event)
        try {
            if(this.app.client.isSuperTokenRegister(event.token)) {
                switch(event.eventName) {
                    case "NewPIC" : {
                        console.log(`${event.eventName} [${event.token}] new pic ${event.pic}`);
                        this.app.protocol.calculateAndSaveTokenDelay(event.token);
                        break;
                    }
                }
            } else {
                this.app.logger.debug(`[TOGA]: token ${event.token} is not subscribed`);
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