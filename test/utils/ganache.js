const ganache = require("ganache");

const option = {
  chain: {
    chainId: 1337,
  },
  server: {
    port: 8545
  },
  wallet: {
    mnemonic: "wing hold whip adjust armor strong prison crouch pelican unveil plastic category",
    totalAccounts: 10,
  },
  miner: {
    blockTime: 0,
    callGasLimit : 0x1fffffffffffff
  },
  logging: {
    logger: {
      log: () => {} // don't do anything
    }
  }
};

let server;
let isServerStarted = false;

async function startGanache() {
  return new Promise((resolve, reject) => {
    if (isServerStarted) {
      resolve(server);
      return;
    }

    server = ganache.server(option);
    server.listen(option.server.port, function (err, data) {
      if (err) {
        console.error(err);
        reject(err);
      } else {
        console.log("starting ganache...");
        server.helper = require("./ganacheHelper");
        isServerStarted = true;
        resolve(server);
      }
    });
  });
}

module.exports = startGanache;