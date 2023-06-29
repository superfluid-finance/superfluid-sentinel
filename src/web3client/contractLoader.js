const IResolver = require("@superfluid-finance/ethereum-contracts/build/contracts/IResolver.json");
const ISuperfluid = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperfluid.json");
const ISuperToken = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperToken.json");
const SuperfluidGovernance = require("@superfluid-finance/ethereum-contracts/build/contracts/SuperfluidGovernanceBase.json");
const ICFA = require("@superfluid-finance/ethereum-contracts/build/contracts/IConstantFlowAgreementV1.json");
const IGDA = require("../abis/IGeneralDistributionAgreementV1.json");
const IIDA = require("@superfluid-finance/ethereum-contracts/build/contracts/IInstantDistributionAgreementV1.json");
const BatchContract = require("../abis/BatchLiquidator.json");
const TogaContract = require("@superfluid-finance/ethereum-contracts/build/contracts/TOGA.json");

/*
    ContractLoader is a class that loads all the contracts that are needed for the app to run
*/
class ContractLoader {
    constructor (web3, app) {

        if(!web3) throw new Error("ContractLoader: web3 is not defined");
        if(!app) throw new Error("ContractLoader: app is not defined");

        this.web3 = web3;
        this.app = app;
        // signal that the contracts have not been loaded yet
        this.initialized = false;
    }
    // initialize all contracts
    async initialize () {

        await this.loadResolverContract(this.app.config.RESOLVER_ADDRESS);

        const superfluidAddress = await this.resolver.methods.get(`Superfluid.${this.version}`).call();
        await this.loadSuperfluidContract(superfluidAddress);

        const governanceAddress = await this.sf.methods.getGovernance().call();
        await this.loadSuperfluidGovernanceContract(governanceAddress);

        const cfaHashID = this.web3.utils.sha3("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
        const gdaHashID = this.web3.utils.sha3("org.superfluid-finance.agreements.GeneralDistributionAgreement.v1");
        const idaHashID = this.web3.utils.sha3("org.superfluid-finance.agreements.InstantDistributionAgreement.v1");

        const [cfaAddress, idaAddress, gdaAddress] = await Promise.all([
            this.sf.methods.getAgreementClass(cfaHashID).call(),
            this.sf.methods.getAgreementClass(idaHashID).call(),
            this.sf.methods.getAgreementClass(gdaHashID).call()
        ]);
        await this.loadAgreementContracts(cfaAddress, idaAddress, gdaAddress);
        // depending on the network/configuration we are using, we might not have a batch contract or a toga contract
        await this.loadBatchContract(this.app.config.BATCH_ADDRESS);
        await this.loadTogaContract(this.app.config.TOGA_ADDRESS);
        this.initialized = true;
    }

    async loadResolverContract (resolverAddress) {
        this.resolver = new this.web3.eth.Contract(IResolver.abi, resolverAddress);
    }

    async loadSuperfluidContract (superfluidAddress) {
        this.sf = new this.web3.eth.Contract(ISuperfluid.abi, superfluidAddress);
    }

    async loadSuperfluidGovernanceContract (govAddress) {
        this.gov = new this.web3.eth.Contract(SuperfluidGovernance.abi, govAddress);
    }

    async loadAgreementContracts (cfaAddress, idaAddress, gdaAddress) {
        this.CFAv1 = new this.web3.eth.Contract(ICFA.abi, cfaAddress);
        this.IDAv1 = new this.web3.eth.Contract(IIDA.abi, idaAddress);
        this.GDAv1 = new this.web3.eth.Contract(IGDA.abi, gdaAddress);
    }

    async loadBatchContract (batchAddress) {
        if (batchAddress !== undefined) {
            this.batch = new this.web3.eth.Contract(BatchContract.abi, this.app.config.BATCH_CONTRACT);
        } else {
            this.app.logger.info("ContractLoader: Batch Contract not found");
        }
    }

    async loadTogaContract (togaAddress) {
        if (togaAddress !== undefined) {
            this.toga = new this.web3.eth.Contract(TogaContract.abi, this.app.config.TOGA_CONTRACT);
        } else {
            this.app.logger.info("ContractLoader: TOGA Contract not found");
        }
    }


    async getSuperToken (superTokenAddress) {
        const superToken = new this.web3.eth.Contract(ISuperToken.abi, superTokenAddress);
        const [tokenName, tokenSymbol] = await Promise.all(
            [
                superToken.methods.name().call(),
                superToken.methods.symbol().call()
            ]
        );
        return {superToken, tokenName, tokenSymbol};
    }
}

module.exports = ContractLoader;