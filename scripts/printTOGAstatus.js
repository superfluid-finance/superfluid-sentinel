/*
 * Prints the TOGA status of the connected network.
 * Requires HTTP_RPC_NODE to be set. If an .env file exists in the project root, it reads it.
 */

require('dotenv').config()
const togaABI = require('../src/inc/TOGA.json')
const Web3 = require('web3')
const axios = require('axios')
const { wad4human, toBN } = require('@decentral.ee/web3-helpers')

/* CONFIGS */
const NETWORKS = {
  100: {
    name: 'xdai',
    theGraphQueryUrl: 'https://api.thegraph.com/subgraphs/name/superfluid-finance/protocol-v1-xdai',
    toga: '0xb7DE52F4281a7a276E18C40F94cd93159C4A2d22'
  },
  137: {
    name: 'matic',
    theGraphQueryUrl: 'https://api.thegraph.com/subgraphs/name/superfluid-finance/protocol-v1-matic',
    toga: '0x6AEAeE5Fd4D05A741723D752D30EE4D72690A8f7'
  }
}

async function getSuperTokens (graphAPI) {
  const query = `query MyQuery {
  tokens(where: {isSuperToken: true}) {
    name
    symbol
    isSuperToken
    isListed
    id
  }
}`
  const res = await axios.post(graphAPI, { query })

  if (res.status !== 200 || res.data.errors) {
    console.error(res.data)
    process.exit(1)
  }

  return res.data.data.tokens
}

(async () => {
  const web3 = new Web3(process.env.HTTP_RPC_NODE)
  const chainId = await web3.eth.getChainId()
  const networkConfig = NETWORKS[chainId]
  if (networkConfig === undefined) {
    console.error(`no config found for chainId ${chainId}`)
    process.exit(1)
  }

  const toga = new web3.eth.Contract(togaABI, networkConfig.toga)
  const table = []
  const superTokens = await getSuperTokens(networkConfig.theGraphQueryUrl)

  for (let i = 0; i < superTokens.length; i++) {
    try {
      const picInfo = await toga.methods.getCurrentPICInfo(superTokens[i].id).call()
      if (picInfo.bond !== '0' || picInfo.pic !== '0x0000000000000000000000000000000000000000') {
        table.push({
          name: superTokens[i].name,
          symbol: superTokens[i].symbol,
          PIC: picInfo.pic,
          Bond: wad4human(picInfo.bond),
          ExitRatePerDay: wad4human(toBN(picInfo.exitRate).mul(toBN(3600 * 24)))
        })
      } else {
        console.log(`skipping ${superTokens[i].symbol} (no PIC set, zero bond)`)
      }
    } catch (err) {
      console.error(err)
    }
  }
  console.log(`Super Tokens on ${networkConfig.name} with a PIC set and/or a non-zero bond:`)
  console.table(table, ['name', 'symbol', 'PIC', 'Bond', 'ExitRatePerDay'])
})()
