const Web3 = require("web3");
const SDKConfig = require("@superfluid-finance/js-sdk/src/getConfig.js");
const IResolver = require("@superfluid-finance/ethereum-contracts/build/contracts/IResolver.json");
const ICFA = require("@superfluid-finance/ethereum-contracts/build/contracts/IConstantFlowAgreementV1.json");
const IIDA = require("@superfluid-finance/ethereum-contracts/build/contracts/IInstantDistributionAgreementV1.json");
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
        this.IDAv1;
        this.IDAv1WS;
        this.sf;
        this.superTokens = new Map();
        this.superTokensHTTP = new Map();
        this.superTokensCount = 0;
        this.web3;
        this.web3HTTP;
        this.version = this.app.config.PROTOCOL_RELEASE_VERSION;
        this.isInitialized = false;
        this._testMode;
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
            this.isInitialized = true;
        } catch(err) {
            this.app.logger.error(err);
            throw new Error(`Web3Client: ${err}`);
        }
    }

    async init() {
        try {
            this.app.logger.info(`Web3Client start`);
            await this.initialize();
            await this._loadSuperfluidContracts();
            this.agentAccounts = this.app.genAccounts(this.app.config.MNEMONIC, 100);
            this.app.logger.info(`Node account: ${this.agentAccounts.address}`);
            // Node HTTP
            this.app.logger.info("Connecting to Node: HTTP");
            this.web3HTTP.eth.transactionConfirmationBlocks = 3;
            this.app.logger.info("Node connected (HTTP)");
            // Node Websocket
            this.app.logger.info("Connecting to Node: WS");
            this.web3.eth.transactionConfirmationBlocks = 3;
            this.app.logger.info("Node connected (WS)");
        } catch(err) {
            this.app.logger.error(err);
            throw err;
        }
    }

    async _loadSuperfluidContracts() {
        try {
            this.app.logger.debug(`_loadSuperfluidContracts()`);
            let resolverAddress;
            if(this.app.config.TEST_RESOVER !== undefined) {
                console.debug("Using TestResolver");
                resolverAddress = this.app.config.TEST_RESOVER;
            } else {
                resolverAddress = SDKConfig(await this.getNetworkId()).resolverAddress;
            }
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
            const cfaIdent = this.web3HTTP.utils.sha3("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
            const idaIdent = this.web3HTTP.utils.sha3("org.superfluid-finance.agreements.InstantDistributionAgreement.v1");
            const cfaAddress = await this.sf.methods.getAgreementClass(cfaIdent).call();
            const idaAddress = await this.sf.methods.getAgreementClass(idaIdent).call();
            this.app.logger.info(`CFA address: ${cfaAddress}`);
            this.app.logger.info(`IDA address: ${cfaAddress}`);
            this.CFAv1 = new this.web3HTTP.eth.Contract(ICFA.abi, cfaAddress);
            this.CFAv1WS = new this.web3.eth.Contract(ICFA.abi, cfaAddress);
            this.IDAv1 = new this.web3HTTP.eth.Contract(IIDA.abi, idaAddress);
            this.IDAv1WS = new this.web3.eth.Contract(IIDA.abi, idaAddress);
        } catch (err) {
            this.app.logger.error(err);
            throw Error(`load superfluid contract : ${err}`)
        }
    }

    async _loadSuperTokensFromDB() {
        try {
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
            let promises = superTokensDB.map(async (token) => {
                return this.loadSuperToken(token.address);
            });
            await Promise.all(promises);
        } catch(err) {
            this.app.logger.error(err);
            throw new Error(`load DB SuperTokens: ${err}`);
        }
    }

    async loadSuperTokens(newSuperTokens) {
        try {
            await this._loadSuperTokensFromDB();
            let promises = newSuperTokens.map(async (token) => {
                return  this.loadSuperToken(token);
            })
            await Promise.all(promises);
        } catch(err) {
            this.app.logger.error(err);
            throw new Error(`Load SuperTokens ${err}`);
        }
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
        const superTokenAddress = await this.resolver.methods.get(
            `supertokens.${this.version}.${tokenSymbol}`
        ).call();
        let isListed = 0;
        if(superTokenAddress === superTokenWS._address) {
            this.app.logger.info(`add listed SuperToken (${tokenSymbol} -  ${tokenName}): ${superTokenAddress}`);
            this.superTokens[superTokenAddress] = superTokenWS;
            this.superTokensHTTP[superTokenAddress] = superTokenHTTP;
            this.superTokensCount++;
            isListed = 1;
        } else if(this.app.config.LISTEN_MODE == 1) {
            this.app.logger.info(`add non listed SuperToken (${tokenSymbol} -  ${tokenName}): ${superTokenAddress}`);
            console.log(this.app.config.LISTEN_MODE);
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

    isSuperTokenRegister(token) {
        return this.superTokens[token] !== undefined;
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
    //Add parameter
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

    async disconnect() {
        this.web3.currentProvider.disconnect();
        this.web3HTTP.currentProvider.disconnect();
    }

    async sendSignedTransaction(signed) {
        if(this._testMode === "TIMEOUT_ON_LOW_GAS_PRICE") {
            if(signed.tx.txObject.gasPrice <= this._testOption.minimumGas) {
                const delay = ms => new Promise(res => setTimeout(res, ms));
                await delay(signed.tx.timeout * 2);
            } else {
                return this.web3HTTP.eth.sendSignedTransaction(signed.tx.rawTransaction);
            }
        } else {
            return this.web3HTTP.eth.sendSignedTransaction(signed.tx.rawTransaction);
        }
    }

    async signTransaction(unsignedTx, pk) {
        return this.web3HTTP.eth.accounts.signTransaction(
            unsignedTx,
            pk
        );
    }

    async _sendSignTxTimeout(tx, ms, retries) {
        const delay = ms => new Promise(res => setTimeout(res, ms));
        while(retries > 0) {
            await delay(ms);
            retries--;
        }

        return this.sendSignedTransaction(tx);
    }

    setTestFlag(flag, options) {
        this._testMode = flag;
        this._testOption = options;
    }
}

module.exports = Client;
