const IResolver = require("@superfluid-finance/ethereum-contracts/build/truffle/IResolver.json");
const ISuperfluid = require("@superfluid-finance/ethereum-contracts/build/truffle/ISuperfluid.json");
const ISuperToken = require("@superfluid-finance/ethereum-contracts/build/truffle/ISuperToken.json");
const SuperfluidGovernance = require("@superfluid-finance/ethereum-contracts/build/truffle/SuperfluidGovernanceBase.json");
const ICFA = require("@superfluid-finance/ethereum-contracts/build/truffle/IConstantFlowAgreementV1.json");
const IGDA = require("@superfluid-finance/ethereum-contracts/build/truffle/IGeneralDistributionAgreementV1.json");
const IIDA = require("@superfluid-finance/ethereum-contracts/build/truffle/IInstantDistributionAgreementV1.json");
const BatchContract = require("@superfluid-finance/ethereum-contracts/build/truffle/BatchLiquidator.json");
const TogaContract = require("@superfluid-finance/ethereum-contracts/build/truffle/TOGA.json");

/*
    Contracts is a class that loads all the contracts that are needed for the app to run
*/
class Contracts {
    constructor(app) {

        if(!app) throw new Error("Contracts: app is not defined");

        this.app = app;
        // signal that the contracts have not been loaded yet
        this.initialized = false;
    }
    // initialize all contracts
    async initialize () {

        if(this.initialized) return;
        this.app.logger.info("Contracts: Initializing contracts...");
        await this._loadResolverContract(this.app.config.RESOLVER);
        const superfluidAddress = await this.resolver.methods.get(`Superfluid.${this.app.config.PROTOCOL_RELEASE_VERSION}`).call();
        await this._loadSuperfluidContract(superfluidAddress);

        const governanceAddress = await this.sf.methods.getGovernance().call();
        await this._loadSuperfluidGovernanceContract(governanceAddress);

        const cfaHashID = this.app.client.soliditySha3("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
        const gdaHashID = this.app.client.soliditySha3("org.superfluid-finance.agreements.GeneralDistributionAgreement.v1");
        const idaHashID = this.app.client.soliditySha3("org.superfluid-finance.agreements.InstantDistributionAgreement.v1");

        const cfaAddress = await this.sf.methods.getAgreementClass(cfaHashID).call();
        const idaAddress = await this.sf.methods.getAgreementClass(idaHashID).call();
        // sentinel will continue without GDA if it is not found
        let gdaAddress;
        try {
            gdaAddress = await this.sf.methods.getAgreementClass(gdaHashID).call();
        } catch (err) {
            this.app.logger.warn("Contracts: GDA contract not found, sentinel will continue without it");
        }

        await this._loadAgreementContracts(cfaAddress, idaAddress, gdaAddress);
        // depending on the network/configuration we are using, we might not have a batch contract or a toga contract
        await this._loadBatchContract(this.app.config.BATCH_CONTRACT);
        await this._loadTogaContract(this.app.config.TOGA_CONTRACT);
        this.initialized = true;


        this.app.logger.info("Contracts: Contracts initialized");
    }

    async getSuperTokenInstance (superTokenAddress) {
        const superToken = this.app.client.RPCClient.getContract(ISuperToken.abi, superTokenAddress);
        const [tokenName, tokenSymbol] = await Promise.all(
            [
                superToken.methods.name().call(),
                superToken.methods.symbol().call()
            ]
        );
        return {superToken, tokenName, tokenSymbol};
    }

    getAgreementsAddresses() {
        return [this.CFAv1.options.address, this.IDAv1.options.address, this.GDAv1.options.address]
    }

    getTogaAddress() {
        if(this.toga) {
            return this.toga.options.address;
        }
    }

    getCFAv1Address() {
        if(this.CFAv1) {
            return this.CFAv1.options.address;
        }
    }

    getIDAv1Address() {
        if(this.IDAv1) {
            return this.IDAv1.options.address;
        }
    }

    getGDAv1Address() {
        if(this.GDAv1) {
            return this.GDAv1.options.address;
        }
    }

    getBatchAddress() {
        if(this.batch) {
            return this.batch.options.address;
        }
    }

    getSuperfluidAddress() {
        if(this.sf) {
            return this.sf.options.address;
        }
    }

    async _loadResolverContract (resolverAddress) {
        try {
            this.resolver = this.app.client.RPCClient.getContract(IResolver.abi, resolverAddress);
        } catch (err) {
            this.app.logger.error("Contracts: Error loading resolver contract");
            throw err;
        }

    }

    async _loadSuperfluidContract (superfluidAddress) {
        try {
            this.sf = this.app.client.RPCClient.getContract(ISuperfluid.abi, superfluidAddress);
            this.app.logger.info("Contracts: loaded superfluid contract at address: " + superfluidAddress);
        } catch (err) {
            this.app.logger.error("Contracts: Error loading superfluid contract");
            throw err;
        }
    }

    async _loadSuperfluidGovernanceContract (govAddress) {
        try {
            this.gov = this.app.client.RPCClient.getContract(SuperfluidGovernance.abi, govAddress);
            this.app.logger.info("Contracts: loaded governance contract at address: " + govAddress);
        } catch (err) {
            this.app.logger.error("Contracts: Error loading superfluid governance contract");
            throw err;
        }
    }

    async _loadAgreementContracts (cfaAddress, idaAddress, gdaAddress) {
        try {
            this.CFAv1 = this.app.client.RPCClient.getContract(ICFA.abi, cfaAddress);
            this.IDAv1 = this.app.client.RPCClient.getContract(IIDA.abi, idaAddress);
            this.GDAv1 = this.app.client.RPCClient.getContract(IGDA.abi, gdaAddress);
            this.app.logger.info("Contracts: loaded agreements contracts");
            this.app.logger.info(`CFA at address: ${cfaAddress} | IDA at address: ${idaAddress} | GDA at address: ${gdaAddress}`);
        } catch (err) {
            this.app.logger.error("Contracts: Error loading agreement contracts");
            throw err;
        }
    }

    async _loadBatchContract (batchAddress) {
        try {
            if (batchAddress !== undefined) {
                this.batch = this.app.client.RPCClient.getContract(BatchContract.abi, batchAddress);
                this.app.logger.info("Contracts: loaded batch contract at address: " + batchAddress);
            } else {
                this.app.logger.info("Contracts: Batch Contract not found");
            }
        } catch (err) {
            this.app.logger.error("Contracts: Error loading batch contract");
            throw err;
        }
    }

    async _loadTogaContract (togaAddress) {
        try {
            if (togaAddress !== undefined) {
                this.toga = this.app.client.RPCClient.getContract(TogaContract.abi, togaAddress);
                this.app.logger.info("Contracts: loaded toga contract at address: " + togaAddress);
            } else {
                this.app.logger.info("Contracts: TOGA Contract not found");
            }
        } catch (err) {
            this.app.logger.error("Contracts: Error loading toga contract");
            throw err;
        }
    }
}

module.exports = Contracts;