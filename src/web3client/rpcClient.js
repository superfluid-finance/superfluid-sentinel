const Web3 = require("web3");

/*
    RPCClient is a wrapper class for web3
    It is used to connect to a RPC node and send transactions
*/

class RPCClient {
    constructor(app) {
        this.app = app;
        this.isConnected = false;
    }

    // initialize the RPCClient
    async connect() {
        try {
            this.app.logger.info(`RPC Client connecting to RPC...`);
            if (!this.app.config.HTTP_RPC_NODE) {
                throw new Error(`RPCClient.connect(): no HTTP RPC set`);
            }
            
            const web3Provider = new Web3.providers.HttpProvider(
                this.app.config.HTTP_RPC_NODE, {
                keepAlive: true,
            });

            this.web3 = new Web3(web3Provider);
            this.web3.eth.currentProvider.sendAsync = function (payload, callback) {
                return this.send(payload, callback);
            };

            this.isConnected = true;
            this.app.logger.info(`RPC Client connected to RPC`);
        } catch (err) {
            this.app.logger.error(err);
            throw new Error(`RPCClient.initialize(): ${err}`);
        }
    }

    async disconnect() {
        this.web3.currentProvider.disconnect();
    }

    async getChainId() {
        if (this.chainId === undefined) {
            this.chainId = await this.web3.eth.getChainId();
        }
        return this.chainId;
    }

    async getCurrentBlockNumber(offset = 0) {
        return (await this.web3.eth.getBlockNumber()) - offset;
    }

    async sendSignedTransaction(signed) {
        const gasPrice = signed.tx.txObject.gasPrice;
        const gasLimit = signed.tx.txObject.gasLimit;

        if (this._testMode === "TIMEOUT_ON_LOW_GAS_PRICE" && gasPrice <= this._testOption.minimumGas) {
            await new Promise((resolve) => setTimeout(resolve, signed.tx.timeout * 2));
        } else if (this._testMode === "REVERT_ON_BLOCK_GAS_LIMIT" && gasLimit > this._testOption.blockGasLimit) {
            throw new Error("block gas limit");
        } else {
            return this.web3.eth.sendSignedTransaction(signed.tx.rawTransaction);
        }
    }

    async signTransaction(unsignedTx, pk) {
        return this.web3.eth.accounts.signTransaction(unsignedTx, pk);
    }

    // set test mode for RPCClient
    setTestFlag(flag, options) {
        this._testMode = flag;
        this._testOption = options;
    }
}

module.exports = RPCClient;
