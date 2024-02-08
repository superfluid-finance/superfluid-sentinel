/*
 * Tests if a sentinel can successfully sync to the head of the connected chain,
 * using the snapshot set for the chain in manifest.json (if set).
 *
 * Requires HTTP_RPC_NODE to be set. If an .env file exists in the project root, it reads it.
 * exec: yarn test-sync RPC_URL
 */
require('dotenv').config()
const App = require('./../src/app')

/*
 * Verify if can boot with snapshot data
 */
const delay = ms => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  const myArgs = process.argv.slice(2)
  try {
    const config = {
      run_test_env: 'false',
      http_rpc_node: myArgs[0] ? myArgs[0] : process.env.HTTP_RPC_NODE,
      protocol_release_version: 'v1',
      observer: 'true',
      log_level: 'info',
      block_offset: 12,
      num_retries: 10,
      db_path: './snapshots/verification.sqlite',
      cold_boot: 1, // make sure a pre-existing DB file is overwritten
      max_query_block_range: 2000,
      metrics: 'false'
    }
    const sentinel = new App(config)
    sentinel.start()
    while (!sentinel.isInitialized()) {
      await delay(10000)
    }
    await sentinel.shutdown()
    console.log('Sentinel booted with snapshot database')
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})()
