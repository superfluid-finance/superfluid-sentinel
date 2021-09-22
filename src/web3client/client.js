const Web3 = require("web3");
const SDKConfig = require("@superfluid-finance/js-sdk/src/getConfig.js");
const IResolver = require("@superfluid-finance/ethereum-contracts/build/contracts/IResolver.json");
const ICFA = require("@superfluid-finance/ethereum-contracts/build/contracts/IConstantFlowAgreementV1.json");
const IIDA = require("@superfluid-finance/ethereum-contracts/build/contracts/IInstantDistributionAgreementV1.json");
const ISuperfluid = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperfluid.json");
const ISuperToken = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperToken.json");
const SuperTokenModel = require("./../database/models/superTokenModel");
const CLO = require("../inc/Clown.json");
    const BatchContract = require("../inc/BatchLiquidator.json");
const {wad4human} = require("@decentral.ee/web3-helpers");
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
        this.superTokenNames = new Map();
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
            let x = 0;
            const web3 = new Web3.providers.WebsocketProvider(this.app.config.WS_RPC_NODE, {
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
                a += this.reconnectAttempts;
                //this.app.logger(`client.initialize() - reconnect #${this.reconnectAttempts}`);
                console.log("\nWeb3Client: reconnect #" + this.reconnectAttempts);
            })
            this.web3 = new Web3(web3);
            const web3Provider = new Web3.providers.HttpProvider(this.app.config.HTTP_RPC_NODE, {
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
            this.app.logger.error(`client.initialize() - ${err}`);
            throw new Error(`Web3Client: ${err}`);
        }
    }

    async init() {
        try {
            this.app.logger.info(`Web3Client start`);
            await this.initialize();
            await this._loadSuperfluidContracts();
            if(this.app.config.PRIVATE_KEY !== undefined) {
                this.app.logger.info("using provided private key");
                const account = this.web3.eth.accounts.privateKeyToAccount(this.app.config.PRIVATE_KEY);
                this.agentAccounts = { address: account.address, _privateKey: account.privateKey };
            } else if(this.app.config.MNEMONIC !== undefined) {
                this.app.logger.info("using provided mnemonic");
                this.agentAccounts = this.app.genAccounts(this.app.config.MNEMONIC, this.app.config.MNEMONIC_INDEX);
            } else {
                throw Error('No account configured. Either PRIVATE_KEY or MNEMONIC needs to be set.');
            }
            this.app.logger.info(`account: ${this.agentAccounts.address}`);
            const accBalance = await this.app.client.getAccountBalance();
            this.app.logger.info(`balance: ${wad4human(accBalance)}`);
            if(accBalance === "0") {
                this.app.logger.warn("!!!ACCOUNT NOT FUNDED!!!  Will fail to execute liquidations!");
            }
            // Node HTTP
            this.app.logger.info("Connecting to Node: HTTP");
            this.web3HTTP.eth.transactionConfirmationBlocks = 3;
            // Node Websocket
            this.app.logger.info("Connecting to Node: WS");
            this.web3.eth.transactionConfirmationBlocks = 3;
        } catch(err) {
            this.app.logger.error(err);
            throw err;
        }
    }

    async loadBatchContract() {
        try {
            if(this.app.config.BATCH_CONTRACT !== undefined) {
                this.batch = new this.web3.eth.Contract(BatchContract, this.app.config.BATCH_CONTRACT);
            }
        } catch(err) {
            this.app.logger.error(err);
            throw Error(`client.loadBatchContract() : ${err}`)
        }
    }

    async _loadSuperfluidContracts() {
        try {
            this.app.logger.debug(`_loadSuperfluidContracts()`);
            let resolverAddress;
            if(this.app.config.TEST_RESOVER !== undefined) {
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
            //Agent is a member of a clown
            if(this.app.config.CLO_ADDR !== undefined) {
                this.clo = new this.web3.eth.Contract(CLO, this.app.config.CLO_ADDR);
                this.app.logger.info(`CLO address: ${this.app.config.CLO_ADDR}`);
            }
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
            const tokenInfo = `SuperToken (${tokenSymbol} - ${tokenName}): ${superTokenAddress}`;
            this.app.logger.info(tokenInfo);
            this.superTokenNames[newSuperToken] = tokenInfo;
            this.superTokens[superTokenAddress] = superTokenWS;
            this.superTokensHTTP[superTokenAddress] = superTokenHTTP;
            this.superTokensCount++;
            isListed = 1;
        } else if(this.app.config.LISTEN_MODE == 1) {
            const tokenInfo = `SuperToken (${tokenSymbol} - ${tokenName}): ${superTokenAddress}`;
            this.app.logger.info(tokenInfo);
            this.superTokenNames[newSuperToken] = tokenInfo;
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
        if(this.networkId === undefined) {
            this.networkId = await this.web3HTTP.eth.net.getId();
        }
        return this.networkId;
    }

    getAccountAddress() {
        return this.agentAccounts.address;
    }

    async getAccountBalance() {
        return this.web3.eth.getBalance(this.agentAccounts.address);
    }

    getAccount() {
        return this.agentAccounts;
    }

    getSuperTokenInstances() {
        return this.superTokens;
    }

    getSuperfluidInstance(address) {
        return new this.web3HTTP.eth.Contract(ISuperfluid, address);
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
        } catch(err) {
            this.app.logger.error("estimating tx");
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
