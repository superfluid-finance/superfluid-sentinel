/*
 * Prints the TOGA status of the connected network.
 * Requires HTTP_RPC_NODE to be set. If an .env file exists in the project root, it reads it.
 */

require("dotenv").config();
const togaArtifact = require("@superfluid-finance/ethereum-contracts/build/truffle/TOGA.json");
const { Web3 } = require("web3");
const axios = require("axios");
const { wad4human } = require("@decentral.ee/web3-helpers");
const metadata = require("@superfluid-finance/metadata");

async function getSuperTokens (graphAPI) {
  const query = `query MyQuery {
  tokens(where: {isSuperToken: true}) {
    name
    symbol
    isSuperToken
    isListed
    id
  }
}`;
  const res = await axios.post(graphAPI, { query });

  if (res.status !== 200 || res.data.errors) {
    console.error(res.data);
    process.exit(1);
  }

  return res.data.data.tokens;
}

(async () => {
  const web3 = new Web3(process.env.HTTP_RPC_NODE);
  const chainId = parseInt(await web3.eth.getChainId());
  const network = metadata.getNetworkByChainId(chainId);
  if (network === undefined) {
    console.error(`no network config found for chainId ${chainId}`);
    process.exit(1);
  }
  if (network.contractsV1.toga === undefined) {
    console.error(`no TOGA contract in metadata for chainId ${chainId}`);
    process.exit(1);
  }

  const toga = new web3.eth.Contract(togaArtifact.abi, network.contractsV1.toga);
  const graphApiUrl = `https://${network.name}.subgraph.x.superfluid.dev`;
  const table = [];
  const superTokens = await getSuperTokens(graphApiUrl);

  for (let i = 0; i < superTokens.length; i++) {
    try {
      const picInfo = await toga.methods.getCurrentPICInfo(superTokens[i].id).call();
      if (picInfo.bond !== "0" || picInfo.pic !== "0x0000000000000000000000000000000000000000") {
        table.push({
          name: superTokens[i].name,
          symbol: superTokens[i].symbol,
          PIC: picInfo.pic,
          Bond: wad4human(picInfo.bond),
          ExitRatePerDay: wad4human(picInfo.exitRate * 86400n)
        });
      } else {
        console.log(`skipping ${superTokens[i].symbol} (no PIC set, zero bond)`);
      }
    } catch (err) {
      console.error(err);
    }
  }
  console.log(`Super Tokens on ${network.name} with a PIC set and/or a non-zero bond:`);
  console.table(table, ["name", "symbol", "PIC", "Bond", "ExitRatePerDay"]);
})();
