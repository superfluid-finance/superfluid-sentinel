const Web3 = require("web3");
const SDKConfig = require("@superfluid-finance/js-sdk/src/getConfig.js");
const IResolver = require("@superfluid-finance/ethereum-contracts/build/contracts/IResolver.json");
const ICFA = require("@superfluid-finance/ethereum-contracts/build/contracts/IConstantFlowAgreementV1.json");
const ISuperfluid = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperfluid.json");
const ISuperToken = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperToken.json");
const SuperTokenModel = require("./../database/models/superTokenModel");

/*
 *   Web3 and superfluid client:
 * - Create web3 connections
 * - Load superfluid contracts
 */
class Client {

    constructor(app) {
        this.app = app;
        this.CFAv1;
        this.CFAv1WS;
        this.sf;
        this.superTokens = new Map();
        this.superTokensHTTP = new Map();
        this.superTokensCount = 0;
        this.web3;
        this.web3HTTP;
        this.version = this.app.config.PROTOCOL_RELEASE_VERSION;
        this.initialize;
    }

    async initialize() {
        this.app.logger.debug(`initialize()`);
        try {
            const web3 = new Web3.providers.WebsocketProvider(this.app.config.WS_NODE, {
                timeout: 10000,
                clientConfig: {
                    maxReceivedFrameSize: 100000000,
                    maxReceivedMessageSize: 100000000,
                },
                // Enable auto reconnection
                reconnect: {
                    auto: true,
                    delay: 50000,
                    onTimeout: false
                    //TODO: max attempts
                } 
            }).on("reconnect", function() {
                console.log("\nWeb3Client: reconnect #" + this.reconnectAttempts);
            })
            this.web3 = new Web3(web3);
            const web3Provider = new Web3.providers.HttpProvider(this.app.config.HTTP_NODE, {
                keepAlive: true
            });
            this.web3HTTP = new Web3(web3Provider);
            const httpChainId = await this.web3HTTP.eth.net.getId();
            const wsChainId = await this.web3.eth.net.getId();
            if(httpChainId.toString() !== wsChainId.toString()) {
                throw Error("WS and HTTP point to different networks");
            }
            console.debug("chainId: ", await this.getNetworkId());
        } catch(err) {
            this.app.logger.error(`Web3Client: ${err}`);
            throw new Error(`Web3Client: ${err}`);
        }
    }

    backoff(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }


    async reInitHttp() {
        await this.backoff(2000);
        var web3Provider = new Web3.providers.HttpProvider(this.app.config.HTTP_NODE, {
            keepAlive: true
        });
        this.web3HTTP.setProvider(web3Provider);
        await this._loadSuperTokensFromDB();
    }

    async start() {
        try {
            await this.initialize();
            await this._loadSuperfluidContracts();
            this.initialize = true;
            this.agentAccounts = this.app.genAccounts(this.app.config.MNEMONIC, 100);
            // Node HTTP
            this.app.logger.startSpinner("Connecting to Node: HTTP");
            this.web3HTTP.eth.transactionConfirmationBlocks = 3;
            this.app.logger.stopSpinnerWithSuccess("Node connected (HTTP)");
            // Node Websocket
            this.app.logger.startSpinner("Connecting to Node: WS");
            this.web3.eth.transactionConfirmationBlocks = 3;
            this.app.logger.stopSpinnerWithSuccess("Node connected (WS)");
        } catch(err) {
            this.app.logger.error(err);
            throw err;
        }
    }

    async _loadSuperfluidContracts() {
        this.app.logger.debug(`_loadSuperfluidContracts()`);
        try {
            const resolverAddress = SDKConfig(await this.getNetworkId()).resolverAddress;
            //const resolverAddress = "0x9b911F3fbd6A0Adf402f3f5C1d915E9334FED065";
            const superfluidIdent = `Superfluid.${this.version}`;
            console.debug("resolver: ", resolverAddress);
            this.resolver = new this.web3HTTP.eth.Contract(
                IResolver.abi,
                resolverAddress
            );
            const superfluidAddress = await this.resolver.methods.get(superfluidIdent).call();
            console.debug("superfluid: ", superfluidAddress);
            this.sf = new this.web3HTTP.eth.Contract(
                ISuperfluid.abi,
                superfluidAddress
            );
            const cfaIdent = this.web3HTTP.utils.sha3(`org.superfluid-finance.agreements.ConstantFlowAgreement.${this.version}`);
            //const cfaIdent = this.web3HTTP.utils.sha3(`org.superfluid-finance.agreements.ConstantFlowAgreement.v1`);
            const cfaAddress = await this.sf.methods.getAgreementClass(cfaIdent).call();
            console.log("CFA: ", cfaAddress);
            this.CFAv1 = new this.web3HTTP.eth.Contract(ICFA.abi, cfaAddress);
            this.CFAv1WS = new this.web3.eth.Contract(ICFA.abi, cfaAddress);
        } catch (err) {
            this.app.logger.error(err);
            throw Error(`Load Superfluid Contract : ${err}`)
        }
    }

    async _loadSuperTokensFromDB() {
        console.debug("load supertoken from database");
        let filter = {
            attributes: ['address'],
            where: {listed: 1}
        };

        if(this.app.config.LISTEN_MODE == 1) {
            filter = {
                attributes: ['address']
            };
        }
        const superTokensDB = await SuperTokenModel.findAll(filter);
        let promises = superTokensDB.map(async (address) => { 
            return  this.loadSuperToken(address); 
        })
        await Promise.all(promises);
    }

    async loadSuperTokens(newSuperTokens) {
        await this._loadSuperTokensFromDB();
        let promises = newSuperTokens.map(async (token) => { 
            return  this.loadSuperToken(token); 
        })
        await Promise.all(promises)
    }

    async loadSuperToken(newSuperToken) {
        if (this.superTokens.has(newSuperToken)) {
            return;
        }

        const superTokenWS = new this.web3.eth.Contract(ISuperToken.abi, newSuperToken);
        const superTokenHTTP = new this.web3HTTP.eth.Contract(ISuperToken.abi, newSuperToken);
        const [tokenName, tokenSymbol] = await Promise.all(
            [
                superTokenWS.methods.name().call(),
                superTokenWS.methods.symbol().call()
            ]
        );

        console.log(`new token: ${tokenSymbol} - ${tokenName}`);
        const superTokenAddress = await this.resolver.methods.get(
            `supertokens.${this.version}.${tokenSymbol}`
        ).call();

        let isListed = 0;
        if(superTokenAddress === superTokenWS._address) {
            console.log("adding listed SuperToken ", superTokenAddress);
            this.superTokens[superTokenAddress] = superTokenWS;
            this.superTokensHTTP[superTokenAddress] = superTokenHTTP;
            this.superTokensCount++;
            isListed = 1;
        } else if(this.app.config.LISTEN_MODE == 1) {
            console.log("adding non listed SuperToken ", superTokenWS._address);
            this.superTokens[superTokenWS._address] = superTokenWS;
            this.superTokensHTTP[superTokenHTTP._address] = superTokenHTTP;
            this.superTokensCount++;
        }
        //persistence database
        await SuperTokenModel.upsert({
            address: newSuperToken,
            symbol: tokenSymbol,
            name : tokenName,
            listed: isListed
        });
    }

    async getNetworkId() {
        return await this.web3HTTP.eth.net.getId();
    }

    getAccountAddress() {
        return this.agentAccounts.address;
    }

    getAccount() {
        return this.agentAccounts;
    }

    async getAccountBalance() {
        return await this.web3HTTP.eth.getBalance(this.getAccountAddress());
    }

    async getGasPrice() {
        return await this.web3HTTP.eth.getGasPrice();
    }

    getSuperTokenInstances() {
        return this.superTokens;
    }

    getSuperfluidInstance(address) {
        return new this.web3HTTP.eth.Contract(ISuperfluid, address);
    }

    async getCurrentNonce() {
        return await this.web3HTTP.eth.getTransactionCount(this.getAccountAddress());
    }

    async getCurrentBlockNumber() {
        return await new this.web3HTTP.eth.getBlockNumber();
    }

    async getNodeInfo() {
        return await this.web3HTTP.eth.getNodeInfo();
    }

    async estimateGasPrice() {
        return this.web3HTTP.eth.getGasPrice();
    }

    async estimateTxGasCost(tx) {

        try {
            const unsignedTx = {
                to : tx.to,
                from : this.getAccount().address,
                data : tx.abi,
            };
            return await this.web3HTTP.eth.estimateGas(unsignedTx);
        } catch(error) {
            this.app.logger.error("Error estimating tx");
            return 0;
        }

    }
}

module.exports = Client;
