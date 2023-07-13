require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      }
    },
    networks: {
      localhost: {
        url: "http://127.0.0.1:8545/",
        chainId: 31337,
      }
    }
  }
};
