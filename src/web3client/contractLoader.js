const IResolver = require("@superfluid-finance/ethereum-contracts/build/contracts/IResolver.json");
const ISuperfluid = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperfluid.json");
const ISuperToken = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperToken.json");
const SuperfluidGovernance = require("@superfluid-finance/ethereum-contracts/build/contracts/SuperfluidGovernanceBase.json");
const ICFA = require("@superfluid-finance/ethereum-contracts/build/contracts/IConstantFlowAgreementV1.json");
const IGDA = require("../abis/IGeneralDistributionAgreementV1.json");
const IIDA = require("@superfluid-finance/ethereum-contracts/build/contracts/IInstantDistributionAgreementV1.json");

/*
    ContractLoader is a class that loads all the contracts that are needed for the app to run
*/
class ContractLoader {
    constructor (web3, app) {

        if(!web3) throw new Error("ContractLoader: web3 is not defined");
        if(!app) throw new Error("ContractLoader: app is not defined");

        this.web3 = web3;
        this.app = app;
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

    async loadSuperToken (superTokenAddress) {
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