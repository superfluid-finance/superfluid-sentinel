const Environment = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-environment");
const IResolver = require("@superfluid-finance/ethereum-contracts/build/contracts/IResolver.json");
const ICFA = require("@superfluid-finance/ethereum-contracts/build/contracts/IConstantFlowAgreementV1.json");
const IIDA = require("@superfluid-finance/ethereum-contracts/build/contracts/IInstantDistributionAgreementV1.json");
const ISuperfluid = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperfluid.json");
const ISuperToken = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperToken.json");
const IToken = require("@superfluid-finance/ethereum-contracts/build/contracts/TestToken.json");

const Web3 = require("web3");

async function setup (provider, agentAccount) {
  const web3 = new Web3(provider);
  const accounts = await web3.eth.getAccounts();
  await Environment((error) => {
    if (error) {
      console.log(error);
    }
  }, [":", "fTUSD"], { web3: web3 }
  );
  const resolverAddress = process.env.RESOLVER_ADDRESS;
  const superfluidIdent = `Superfluid.test`;
  const resolver = new web3.eth.Contract(IResolver.abi, resolverAddress);
  const superfluidAddress = await resolver.methods.get(superfluidIdent).call();
  const host = new web3.eth.Contract(ISuperfluid.abi, superfluidAddress);
  const cfaIdent = web3.utils.sha3("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
  const idaIdent = web3.utils.sha3("org.superfluid-finance.agreements.InstantDistributionAgreement.v1");
  const cfaAddress = await host.methods.getAgreementClass(cfaIdent).call();
  const idaAddress = await host.methods.getAgreementClass(idaIdent).call();
  const cfa = new web3.eth.Contract(ICFA.abi, cfaAddress);
  const ida = new web3.eth.Contract(IIDA.abi, idaAddress);
  const superTokenAddress = await resolver.methods.get("supertokens.test.fTUSDx").call();
  const superToken = new web3.eth.Contract(ISuperToken.abi, superTokenAddress);
  const tokenAddress = await superToken.methods.getUnderlyingToken().call();
  const token = new web3.eth.Contract(IToken.abi, tokenAddress);

  for (const account of accounts) {
    await token.methods.mint(account, "10000000000000000000000").send({ from: account });
    await token.methods.approve(superTokenAddress, "10000000000000000000000").send({ from: account });
    await superToken.methods.upgrade("10000000000000000000000").send({
      from: account,
      gas: 400000
    });
  }

  await web3.eth.sendTransaction({
    to: agentAccount,
    from: accounts[9],
    value: web3.utils.toWei("10", "ether")
  });
  return {
    web3: web3,
    accounts: accounts,
    ida: ida,
    cfa: cfa,
    host: host,
    superToken: superToken,
    token: token,
    resolver: resolver
  };
}

module.exports = {
  setup
};
