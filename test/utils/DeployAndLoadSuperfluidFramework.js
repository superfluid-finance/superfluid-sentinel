/*
* Notes:
*   - SuperfluidFrameworkDeployer requires ethers. This is a different library supported by Sentinel, this is why we have to use Web3 and Ethers.
*   - This scripts looks like a detour, but is not. I want to lay down the foundation for the next steps, like migration to ethers
* */


// Self implementation notes:
// 1. TOGA and Batch Contract are not register in the resolver. We need to access to them. PR needed.
// 2. Update deployer on monorepo to use new ethers functions.
// 3. Update deployer on monorepo to make variables public.

const {ethers} = require("ethers");
const SuperfluidFrameworkDeployer = require("../utils/SuperfluidFrameworkDeployer");
const IResolver = require("@superfluid-finance/ethereum-contracts/build/contracts/IResolver.json");
const ISuperfluid = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperfluid.json");
const IConstantFlowAgreementV1 = require("@superfluid-finance/ethereum-contracts/build/contracts/IConstantFlowAgreementV1.json");
const IInstantDistributionAgreementV1 = require("@superfluid-finance/ethereum-contracts/build/contracts/IInstantDistributionAgreementV1.json");
const IGeneralDistributionAgreementV1 = require("@superfluid-finance/ethereum-contracts/build/contracts/IGeneralDistributionAgreementV1.json");
const Governance = require("@superfluid-finance/ethereum-contracts/build/contracts/SuperfluidGovernanceBase.json");
const ISuperToken = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperToken.json");

async function DeployAndLoadSuperfluidFramework(web3, provider) {

    // web3 is required to load the framework
    if (!web3) {
        throw new Error("DeployAndLoadSuperfluidFramework: web3 is not defined");
    }

    const MINT_AMOUNT = ethers.parseEther("100000000").toString();

    sfDeployer = await SuperfluidFrameworkDeployer.deployTestFramework(provider);
    contractsFramework = await sfDeployer.frameworkDeployer.getFramework();

    await sfDeployer.frameworkDeployer.deployWrapperSuperToken("Fake DAI Token", "fDAI", 18, MINT_AMOUNT);
    await sfDeployer.frameworkDeployer.deployWrapperSuperToken("Fake USDC Token", "fUSDC", 18, MINT_AMOUNT);

    const resolver = new web3.eth.Contract(IResolver.abi, contractsFramework[8]);
    const superfluid = new web3.eth.Contract(ISuperfluid.abi, contractsFramework[1]);
    const fDAIxAddress = await resolver.methods.get("supertokens.test.fDAIx");
    const fUSDCxAddress = await resolver.methods.get("supertokens.test.fUSDCx");
    const superTokens = {
        fDAIx: new web3.eth.Contract(ISuperToken.abi, fDAIxAddress),
        fUSDCx: new web3.eth.Contract(ISuperToken.abi, fUSDCxAddress)
    };

    const tokens = {
        fDAI: await superTokens.fDAIx.methods.getUnderlyingToken(),
        fUSDC: await superTokens.fUSDCx.methods.getUnderlyingToken()
    }

    const cfa = new web3.eth.Contract(IConstantFlowAgreementV1.abi, contractsFramework[2]);
    const ida = new web3.eth.Contract(IInstantDistributionAgreementV1.abi, contractsFramework[4]);
    const gda = new web3.eth.Contract(IGeneralDistributionAgreementV1.abi, contractsFramework[5]);

    const agreements = {
        cfa: cfa,
        ida: ida,
        gda: gda
    }
    const governance = new web3.eth.Contract(Governance.abi, contractsFramework[0]);

    return {
        governance: governance,
        host: superfluid,
        resolver: resolver,
        agreements: agreements,
        superTokens: superTokens,
        tokens: tokens
    };
}

module.exports = DeployAndLoadSuperfluidFramework;