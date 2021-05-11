const Web3 = require("web3");
const SDKConfig = require("@superfluid-finance/js-sdk/src/getConfig.js");
const IResolver = require("@superfluid-finance/ethereum-contracts/build/contracts/IResolver.json");
const ICFA = require("@superfluid-finance/ethereum-contracts/build/contracts/IConstantFlowAgreementV1.json");
const ISuperfluid = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperfluid.json");
const ISuperToken = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperToken.json");
const SuperTokenModel = require("./../database/models/superTokenModel");

/*
 *
 * Web3 and superfluid client:
 *
 * - Create web3 connections
 * - Load superfluid contracts
 */
class Client {

    constructor(app) {
        this.app = app;
        this.CFAv1;
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
            var web3Provider = new Web3.providers.HttpProvider(this.app.config.HTTP_NODE);
            this.web3HTTP = new Web3(web3Provider);
            console.log("ChainId: ", await this.getNetworkId());
            const resolverAddress = SDKConfig(await this.getNetworkId()).resolverAddress;
            const superfluidIdent = `Superfluid.${this.version}`;
            console.log("Resolver: ", resolverAddress);
            this.resolver = new this.web3HTTP.eth.Contract(
                IResolver.abi,
                resolverAddress
            );
            const superfluidAddress = await this.resolver.methods.get(superfluidIdent).call();
            console.log("Superfluid: ", superfluidAddress);
            this.sf = new this.web3HTTP.eth.Contract(
                ISuperfluid.abi,
                superfluidAddress
            );
            const cfaIdent = this.web3HTTP.utils.sha3(`org.superfluid-finance.agreements.ConstantFlowAgreement.${this.version}`);
            const cfaAddress = await this.sf.methods.getAgreementClass(
                cfaIdent
            ).call();
            console.log("CFA: ", cfaAddress);
            this.CFAv1 = new this.web3HTTP.eth.Contract(
                ICFA.abi,
                cfaAddress
            );
            this.initialize = true;
        } catch(err) {
            this.app.logger.error(`Web3Client: ${err}`);
            process.exit(1);
        }
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
            this.app.logger.startSpinner("Connecting to Node: WS Mode");
            if(await this.web3HTTP.eth.net.isListening()) {
                this.web3HTTP.eth.transactionConfirmationBlocks = 3;
                this.app.logger.stopSpinnerWithSuccess("Node connected (WS)");
            } else {
                this.app.logger.error("Error: not connected");
            }
        } catch(e) {
            this.app.logger.error(e);
            process.exit(1);
        }
    }

    async _loadSuperTokensFromDB() {
        try {
            console.log("Load Listed SuperTokens from DB");
            const superTokensDB = await SuperTokenModel.findAll({
                attributes: ['address'],
                where: {listed: 1}
            });
            for(let sp of superTokensDB) {
                console.log(sp.address)
                let superToken = await new this.web3.eth.Contract(ISuperToken.abi, sp.address);
                let superTokenHTTP = await new this.web3HTTP.eth.Contract(ISuperToken.abi, sp.address);
                this.superTokens[sp.address] = superToken;
                this.superTokensHTTP[sp.address] = superTokenHTTP;
                this.superTokensCount++;
            }
        } catch(error) {
            console.log(error);
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
                    console.log("Adding listed SuperToken ", superTokenAddress);
                    this.superTokens[superTokenAddress] = superToken;
                    this.superTokensHTTP[superTokenAddress] = await new this.web3HTTP.eth.Contract(ISuperToken.abi, sp);
                    this.superTokensCount++;
                    isListed = 1;
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

    async signAndBroadcast(tx) {
        let gasPrice;
        if(this.getNetworkId() === "5") {
            gasPrice = 10e9;
        } else {
            gasPrice = this.app.config.GAS_PRICE | 1e9;
        }

        this.app.logger.startSpinner("Sending Transaction");
        let account = this.getAccount();
        let privKey = account._privateKey.toString("hex");

        let nonce = await this.web3HTTP.eth.getTransactionCount(account.address, "pending");
        const unsignedTx = {
            chainId : await this.web3HTTP.eth.net.getId(),
            to : tx.to,
            from : account.address,
            data : tx.abi,
            nonce : nonce,
            gasPrice: gasPrice,
            gasLimit : 3000000,
        };

        const signedTx = await this.web3HTTP.eth.accounts.signTransaction(
            unsignedTx, privKey
        );
        let result = await this.web3HTTP.eth.sendSignedTransaction(signedTx.rawTransaction);
        this.app.logger.stopSpinnerWithSuccess("Transaction send");
        return result;
    }
}

module.exports = Client;
