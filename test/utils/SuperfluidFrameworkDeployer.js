const SuperfluidPoolDeployerLibraryArtifact = require("@superfluid-finance/ethereum-contracts/build/hardhat/contracts/agreements/gdav1//SuperfluidPoolDeployerLibrary.sol/SuperfluidPoolDeployerLibrary.json");
const SuperfluidGovDeployerLibraryArtifact = require("@superfluid-finance/ethereum-contracts/build/hardhat/contracts/utils/SuperfluidFrameworkDeploymentSteps.sol/SuperfluidGovDeployerLibrary.json");
const SuperfluidHostDeployerLibraryArtifact = require("@superfluid-finance/ethereum-contracts/build/hardhat/contracts/utils/SuperfluidFrameworkDeploymentSteps.sol/SuperfluidHostDeployerLibrary.json");
const SuperfluidCFAv1DeployerLibraryArtifact = require("@superfluid-finance/ethereum-contracts/build/hardhat/contracts/utils/SuperfluidFrameworkDeploymentSteps.sol/SuperfluidCFAv1DeployerLibrary.json");
const SuperfluidIDAv1DeployerLibraryArtifact = require("@superfluid-finance/ethereum-contracts/build/hardhat/contracts/utils/SuperfluidFrameworkDeploymentSteps.sol/SuperfluidIDAv1DeployerLibrary.json");
const SuperfluidGDAv1DeployerLibraryArtifact = require("@superfluid-finance/ethereum-contracts/build/hardhat/contracts/utils/SuperfluidFrameworkDeploymentSteps.sol/SuperfluidGDAv1DeployerLibrary.json");
const SuperTokenDeployerLibraryArtifact = require("@superfluid-finance/ethereum-contracts/build/hardhat/contracts/utils/SuperfluidFrameworkDeploymentSteps.sol/SuperTokenDeployerLibrary.json");
const SuperfluidPeripheryDeployerLibraryArtifact = require("@superfluid-finance/ethereum-contracts/build/hardhat/contracts/utils/SuperfluidFrameworkDeploymentSteps.sol/SuperfluidPeripheryDeployerLibrary.json");
const SuperfluidPoolLogicDeployerLibraryArtifact = require("@superfluid-finance/ethereum-contracts/build/hardhat/contracts/utils/SuperfluidFrameworkDeploymentSteps.sol/SuperfluidPoolLogicDeployerLibrary.json");
const SuperfluidFlowNFTLogicDeployerLibraryArtifact = require("@superfluid-finance/ethereum-contracts/build/hardhat/contracts/utils/SuperfluidFrameworkDeploymentSteps.sol/SuperfluidFlowNFTLogicDeployerLibrary.json");
const SuperfluidPoolNFTLogicDeployerLibraryArtifact = require("@superfluid-finance/ethereum-contracts/build/hardhat/contracts/utils/SuperfluidFrameworkDeploymentSteps.sol/SuperfluidPoolNFTLogicDeployerLibrary.json");
const ProxyDeployerLibraryArtifact = require("@superfluid-finance/ethereum-contracts/build/hardhat/contracts/utils/SuperfluidFrameworkDeploymentSteps.sol/ProxyDeployerLibrary.json");
const CFAv1ForwarderDeployerLibraryArtifact = require("@superfluid-finance/ethereum-contracts/build/hardhat/contracts/utils/SuperfluidFrameworkDeploymentSteps.sol/CFAv1ForwarderDeployerLibrary.json");
const IDAv1ForwarderDeployerLibraryArtifact = require("@superfluid-finance/ethereum-contracts/build/hardhat/contracts/utils/SuperfluidFrameworkDeploymentSteps.sol/IDAv1ForwarderDeployerLibrary.json");
const GDAv1ForwarderDeployerLibraryArtifact = require("@superfluid-finance/ethereum-contracts/build/hardhat/contracts/utils/SuperfluidFrameworkDeploymentSteps.sol/GDAv1ForwarderDeployerLibrary.json");
const SuperfluidLoaderDeployerLibraryArtifact = require("@superfluid-finance/ethereum-contracts/build/hardhat/contracts/utils/SuperfluidFrameworkDeploymentSteps.sol/SuperfluidLoaderDeployerLibrary.json");
const SuperfluidFrameworkDeployerArtifact = require("@superfluid-finance/ethereum-contracts/build/hardhat/contracts/utils/SuperfluidFrameworkDeployer.sol/SuperfluidFrameworkDeployer.json");
const SlotsBitmapLibraryArtifact = require("@superfluid-finance/ethereum-contracts/build/hardhat/contracts/libs/SlotsBitmapLibrary.sol/SlotsBitmapLibrary.json");
const TokenDeployerLibraryArtifact = require("@superfluid-finance/ethereum-contracts/build/hardhat/contracts/utils/SuperfluidFrameworkDeploymentSteps.sol/TokenDeployerLibrary.json");

const ERC1820Registry = require("@superfluid-finance/ethereum-contracts/dev-scripts/artifacts/ERC1820Registry.json");
const { ethers } = require("hardhat");


function log(...args) {
    if (process.env.DEBUG_CONSOLE === true) {
        log(...args);
    }
    console.log(...args);
}

async function deployERC1820(provider) {

    const ERC1820_ADDRESS = "0x1820a4b7618bde71dce8cdc73aab6c95905fad24";
    const ERC1820_BIN = ERC1820Registry.bin;
    const ERC1820_DEPLOYER = "0xa990077c3205cbDf861e17Fa532eeB069cE9fF96";
    const ERC1820_PAYLOAD =
        "0xf90a388085174876e800830c35008080b909e5" +
        ERC1820_BIN +
        "1ba01820182018201820182018201820182018201820182018201820182018201820a01820182018201820182018201820182018201820182018201820182018201820";

    log("Deploying ERC1820...");
    const code = await provider.send("eth_getCode", [
        ERC1820_ADDRESS,
        "latest",
    ]);
    if (code === "0x") {
        const [from] = await provider.send("eth_accounts", []);

        await provider.send("eth_sendTransaction", [
            {
                from,
                to: ERC1820_DEPLOYER,
                value: "0x11c37937e080000",
            },
        ]);
        await provider.send("eth_sendRawTransaction", [ERC1820_PAYLOAD]);
        log("ERC1820 registry successfully deployed");
    }
}

async function _getFactoryAndReturnDeployedContract(
    contractName,
    artifact,
    signerOrOptions,
    ...args
) {
    log(`Deploying ${contractName}...`);
    const ContractFactory = await ethers.getContractFactoryFromArtifact(
        artifact,
        signerOrOptions
    );
    const contract = await ContractFactory.deploy(...args);
    await contract.waitForDeployment();
    log(`${contractName} Deployed At:`, await contract.getAddress());
    return contract;
}

async function deployTestFramework(signer) {
    log("Deploying Superfluid Framework...");
    await deployERC1820(signer.provider);
    const SlotsBitmapLibrary = await _getFactoryAndReturnDeployedContract(
        "SlotsBitmapLibrary",
        SlotsBitmapLibraryArtifact,
        signer
    );
    //signer = signer.provider;
    const SuperfluidGovDeployerLibrary =
        await _getFactoryAndReturnDeployedContract(
            "SuperfluidGovDeployerLibrary",
            SuperfluidGovDeployerLibraryArtifact,
            signer
        );
    const SuperfluidHostDeployerLibrary =
        await _getFactoryAndReturnDeployedContract(
            "SuperfluidHostDeployerLibrary",
            SuperfluidHostDeployerLibraryArtifact,
            signer
        );
    const SuperfluidCFAv1DeployerLibrary =
        await _getFactoryAndReturnDeployedContract(
            "SuperfluidCFAv1DeployerLibrary",
            SuperfluidCFAv1DeployerLibraryArtifact,
            signer
        );
    const SuperfluidIDAv1DeployerLibrary =
        await _getFactoryAndReturnDeployedContract(
            "SuperfluidIDAv1DeployerLibrary",
            SuperfluidIDAv1DeployerLibraryArtifact,
            {
                signer,
                libraries: {
                    SlotsBitmapLibrary: await SlotsBitmapLibrary.getAddress(),
                },
            }
        );

    const SuperfluidPoolDeployerLibrary =
        await _getFactoryAndReturnDeployedContract(
            "SuperfluidPoolDeployerLibrary",
            SuperfluidPoolDeployerLibraryArtifact,
            signer
        );

    const SuperfluidGDAv1DeployerLibrary =
        await _getFactoryAndReturnDeployedContract(
            "SuperfluidGDAv1DeployerLibrary",
            SuperfluidGDAv1DeployerLibraryArtifact,
            {
                signer,
                libraries: {
                    SuperfluidPoolDeployerLibrary:
                        await SuperfluidPoolDeployerLibrary.getAddress(),
                     SlotsBitmapLibrary:
                         await SlotsBitmapLibrary.getAddress(),
                },
            }
        );
    const SuperTokenDeployerLibrary =
        await _getFactoryAndReturnDeployedContract(
            "SuperTokenDeployerLibrary",
            SuperTokenDeployerLibraryArtifact,
            {
                signer,
            }
        );
    const SuperfluidPeripheryDeployerLibrary =
        await _getFactoryAndReturnDeployedContract(
            "SuperfluidPeripheryDeployerLibrary",
            SuperfluidPeripheryDeployerLibraryArtifact,
            signer
        );

    const SuperfluidPoolLogicDeployerLibrary =
        await _getFactoryAndReturnDeployedContract(
            "SuperfluidPoolLogicDeployerLibrary",
            SuperfluidPoolLogicDeployerLibraryArtifact,
            signer
        );
    const SuperfluidFlowNFTLogicDeployerLibrary =
        await _getFactoryAndReturnDeployedContract(
            "SuperfluidFlowNFTLogicDeployerLibrary",
            SuperfluidFlowNFTLogicDeployerLibraryArtifact,
            signer
        );
    const SuperfluidPoolNFTLogicDeployerLibrary =
        await _getFactoryAndReturnDeployedContract(
            "SuperfluidPoolNFTLogicDeployerLibrary",
            SuperfluidPoolNFTLogicDeployerLibraryArtifact,
            signer
        );
    const ProxyDeployerLibrary = await _getFactoryAndReturnDeployedContract(
        "ProxyDeployerLibrary",
        ProxyDeployerLibraryArtifact,
        signer
    );
    const CFAv1ForwarderDeployerLibrary =
        await _getFactoryAndReturnDeployedContract(
            "CFAv1ForwarderDeployerLibrary",
            CFAv1ForwarderDeployerLibraryArtifact,
            signer
        );
    const IDAv1ForwarderDeployerLibrary =
        await _getFactoryAndReturnDeployedContract(
            "IDAv1ForwarderDeployerLibrary",
            IDAv1ForwarderDeployerLibraryArtifact,
            signer
        );
    const GDAv1ForwarderDeployerLibrary =
        await _getFactoryAndReturnDeployedContract(
            "GDAv1ForwarderDeployerLibrary",
            GDAv1ForwarderDeployerLibraryArtifact,
            signer
        );
    const SuperfluidLoaderDeployerLibrary =
        await _getFactoryAndReturnDeployedContract(
            "SuperfluidLoaderDeployerLibrary",
            SuperfluidLoaderDeployerLibraryArtifact,
            signer
        );
    const TokenDeployerLibrary = await _getFactoryAndReturnDeployedContract(
        "TokenDeployerLibrary",
        TokenDeployerLibraryArtifact,
        signer
    );

    const sfDeployer = await _getFactoryAndReturnDeployedContract(
        "SuperfluidFrameworkDeployer",
        SuperfluidFrameworkDeployerArtifact,
        {
            signer,
            libraries: {
                SuperfluidGovDeployerLibrary:
                    await SuperfluidGovDeployerLibrary.getAddress(),
                SuperfluidHostDeployerLibrary:
                    await SuperfluidHostDeployerLibrary.getAddress(),
                SuperfluidCFAv1DeployerLibrary:
                    await SuperfluidCFAv1DeployerLibrary.getAddress(),
                SuperfluidIDAv1DeployerLibrary:
                    await SuperfluidIDAv1DeployerLibrary.getAddress(),
                SuperfluidGDAv1DeployerLibrary:
                    await SuperfluidGDAv1DeployerLibrary.getAddress(),
                SuperfluidPeripheryDeployerLibrary:
                    await SuperfluidPeripheryDeployerLibrary.getAddress(),
                SuperTokenDeployerLibrary:
                    await SuperTokenDeployerLibrary.getAddress(),
                SuperfluidPoolLogicDeployerLibrary:
                    await SuperfluidPoolLogicDeployerLibrary.getAddress(),
                SuperfluidFlowNFTLogicDeployerLibrary:
                    await SuperfluidFlowNFTLogicDeployerLibrary.getAddress(),
                SuperfluidPoolNFTLogicDeployerLibrary:
                    await SuperfluidPoolNFTLogicDeployerLibrary.getAddress(),
                ProxyDeployerLibrary:
                    await ProxyDeployerLibrary.getAddress(),
                CFAv1ForwarderDeployerLibrary:
                    await CFAv1ForwarderDeployerLibrary.getAddress(),
                IDAv1ForwarderDeployerLibrary:
                    await IDAv1ForwarderDeployerLibrary.getAddress(),
                GDAv1ForwarderDeployerLibrary:
                    await GDAv1ForwarderDeployerLibrary.getAddress(),
                SuperfluidLoaderDeployerLibrary:
                    await SuperfluidLoaderDeployerLibrary.getAddress(),
                TokenDeployerLibrary:
                    await TokenDeployerLibrary.getAddress(),
            },
        }
    );
    const numSteps = await sfDeployer.getNumSteps();
    for (let i = 0; i < numSteps; i++) {
        await sfDeployer.executeStep(i);
    }
    const sf = await sfDeployer.getFramework();
    return {frameworkDeployer: sfDeployer};
}


module.exports = {
    deployTestFramework,
}