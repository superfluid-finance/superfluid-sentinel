const IResolver = require("@superfluid-finance/ethereum-contracts/build/contracts/IResolver.json");
const ISuperfluid = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperfluid.json");
const ISuperToken = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperToken.json");
const SuperfluidGovernance = require("@superfluid-finance/ethereum-contracts/build/contracts/SuperfluidGovernanceBase.json");
const ICFA = require("@superfluid-finance/ethereum-contracts/build/contracts/IConstantFlowAgreementV1.json");
const IGDA = require("@superfluid-finance/ethereum-contracts/build/contracts/IGeneralDistributionAgreementV1.json");
const IIDA = require("@superfluid-finance/ethereum-contracts/build/contracts/IInstantDistributionAgreementV1.json");
const BatchContract = require("@superfluid-finance/ethereum-contracts/build/contracts/BatchLiquidator.json");
const TogaContract = require("@superfluid-finance/ethereum-contracts/build/contracts/TOGA.json");

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
        const [
            cfaAddress,
            idaAddress,
            gdaAddress
        ] = await Promise.all([
            this.sf.methods.getAgreementClass(cfaHashID).call(),
            this.sf.methods.getAgreementClass(idaHashID).call(),
            this.sf.methods.getAgreementClass(gdaHashID).call()
        ]);

        await this._loadAgreementContracts(cfaAddress, idaAddress, gdaAddress);
        // depending on the network/configuration we are using, we might not have a batch contract or a toga contract
        await this._loadBatchContract(this.app.config.BATCH_ADDRESS);
        await this._loadTogaContract(this.app.config.TOGA_ADDRESS);
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
            this.app.logger.info("Contracts: loaded superfluid contract");
        } catch (err) {
            this.app.logger.error("Contracts: Error loading superfluid contract");
            throw err;
        }
    }

    async _loadSuperfluidGovernanceContract (govAddress) {
        try {
            this.gov = this.app.client.RPCClient.getContract(SuperfluidGovernance.abi, govAddress);
            this.app.logger.info("Contracts: loaded governance contract");
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
        } catch (err) {
            this.app.logger.error("Contracts: Error loading agreement contracts");
            throw err;
        }
    }

    async _loadBatchContract (batchAddress) {
        try {
            if (batchAddress !== undefined) {
                this.batch = new this.app.client.RPCClient.getContract(BatchContract.abi, batchAddress);
                this.app.logger.info("Contracts: loaded batch contract");
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
                this.toga = new this.app.client.RPCClient.getContract(TogaContract.abi, togaAddress);
                this.app.logger.info("Contracts: loaded toga contract");
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