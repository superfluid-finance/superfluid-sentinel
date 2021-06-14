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
        this.agreements = new Map();
        this.superTokens = new Map();
        this.superTokensHTTP = new Map();
        this.superTokensCount = 0;
        this.web3;
        this.web3HTTP;
        this.version = this.app.config.PROTOCOL_RELEASE_VERSION;
        this.initialize;
    }

    async initialize() {
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
                }
            }).on("reconnect", function() {
                console.log("\nWeb3Client: reconnect #" + this.reconnectAttempts);
            });
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
            this._loadSuperfluidContracts();
            this.initialize = true;
        } catch(err) {
            this.app.logger.error(`Web3Client: ${err}`);
            process.exit(1);
        }
    }

    backoff(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }


    async reInitHttp() {
        await this.backoff(2000);
        var web3Provider = new Web3.providers.HttpProvider(this.app.config.HTTP_NODE);
        this.web3HTTP.setProvider(web3Provider);
        await this._loadSuperTokensFromDB();
    }

    async start() {
        try {
            await this.initialize();
        } catch(err) {
            this.app.logger.error("Initializing framework: ", err);
            throw err;
        }

        try {
            this.agentAccounts = this.app.genAccounts(this.app.config.MNEMONIC, 100);
            this.app.logger.startSpinner("Connecting to Node: HTTP");
            if(await this.web3HTTP.eth.net.isListening()) {
                this.web3HTTP.eth.transactionConfirmationBlocks = 3;
                this.app.logger.stopSpinnerWithSuccess("Node connected (HTTP)");
            } else {
                this.app.logger.error("Error: Node HTTP not connected");
            }
            this.app.logger.startSpinner("Connecting to Node: WS");
            if(await this.web3.eth.net.isListening()) {
                this.web3.eth.transactionConfirmationBlocks = 3;
                this.app.logger.stopSpinnerWithSuccess("Node connected (WS)");
            } else {
                this.app.logger.error("Error: Node WS not connected");
            }
        } catch(e) {
            this.app.logger.error(e);
            process.exit(1);
        }
    }

    async _loadSuperfluidContracts() {
            const resolverAddress = SDKConfig(await this.getNetworkId()).resolverAddress;
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
            const cfaAddress = await this.sf.methods.getAgreementClass(
                cfaIdent
            ).call();
            console.log("CFA: ", cfaAddress);
            this.CFAv1 = new this.web3HTTP.eth.Contract(ICFA.abi, cfaAddress);
            this.CFAv1WS = new this.web3.eth.Contract(ICFA.abi, cfaAddress);
    }

    async _loadSuperTokensFromDB() {
            console.log("Load Listed SuperTokens from DB");
            let filter;
            if(this.app.config.LISTEN_MODE == 1) {
                filter = {
                    attributes: ['address']
                };
            } else {
                filter = {
                    attributes: ['address'],
                    where: {listed: 1}
                };
            }
            const superTokensDB = await SuperTokenModel.findAll(filter);
            for(let sp of superTokensDB) {
                console.log(sp.address)
                let superToken = await new this.web3.eth.Contract(ISuperToken.abi, sp.address);
                let superTokenHTTP = await new this.web3HTTP.eth.Contract(ISuperToken.abi, sp.address);
                this.superTokens[sp.address] = superToken;
                this.superTokensHTTP[sp.address] = superTokenHTTP;
                this.superTokensCount++;
            }
    }

    async loadSuperTokens(newSuperTokens) {
        await this._loadSuperTokensFromDB();
        for(let sp of newSuperTokens) {
            if(this.superTokens[sp] === undefined) {
                let superToken = await new this.web3.eth.Contract(ISuperToken.abi, sp);
                const tokenResponse = await Promise.all(
                    [
                        superToken.methods.name().call(),
                        superToken.methods.symbol().call()
                    ]
                );
                let tokenName = tokenResponse[0];
                let tokenSymbol = tokenResponse[1];
                console.log(`new token: ${tokenSymbol} - ${tokenName}`);
                const superTokenAddress = await this.resolver.methods.get(
                    `supertokens.${this.version}.${tokenSymbol}`
                ).call();
                let isListed = 0;
                //listed superToken
                if(superTokenAddress === superToken._address) {
                    console.log("adding listed SuperToken ", superTokenAddress);
                    this.superTokens[superTokenAddress] = superToken;
                    this.superTokensHTTP[superTokenAddress] = await new this.web3HTTP.eth.Contract(ISuperToken.abi, sp);
                    this.superTokensCount++;
                    isListed = 1;
                } else if(this.app.config.LISTEN_MODE == 1) {
                    console.log("adding non listed SuperToken ", superToken._address);
                    this.superTokens[superToken._address] = superToken;
                    this.superTokensHTTP[superToken._address] = await new this.web3HTTP.eth.Contract(ISuperToken.abi, sp);
                    this.superTokensCount++;
                }
                //persistence database
                await SuperTokenModel.upsert({
                    address: sp,
                    symbol: tokenSymbol,
                    name : tokenName,
                    listed: isListed
                });
            }
        }
    }

    async loadSuperToken(newSuperToken) {
        if(this.superTokens[newSuperToken] === undefined) {
            let superToken = await new this.web3.eth.Contract(ISuperToken.abi, newSuperToken);
            const tokenResponse = await Promise.all(
                [
                    superToken.methods.name().call(),
                    superToken.methods.symbol().call()
                ]
            );
            let tokenName = tokenResponse[0];
            let tokenSymbol = tokenResponse[1];
            console.log(`new token: ${tokenSymbol} - ${tokenName}`);
            const superTokenAddress = await this.resolver.methods.get(
                `supertokens.${this.version}.${tokenSymbol}`
            ).call();
            let isListed = 0;
            //listed superToken
            if(superTokenAddress === superToken._address) {
                console.log("adding listed SuperToken ", superTokenAddress);
                this.superTokens[superTokenAddress] = superToken;
                this.superTokensHTTP[superTokenAddress] = await new this.web3HTTP.eth.Contract(ISuperToken.abi, superTokenAddress);
                this.superTokensCount++;
                isListed = 1;
            } else if(this.app.config.LISTEN_MODE == 1) {
                console.log("adding non listed SuperToken ", superToken._address);
                this.superTokens[superToken._address] = superToken;
                this.superTokensHTTP[superToken._address] = await new this.web3HTTP.eth.Contract(ISuperToken.abi, superToken.address);
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
