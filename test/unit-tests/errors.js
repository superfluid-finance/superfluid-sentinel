const Errors = require("../../src/utils/errors/errors");

const expect = require("chai").expect;

const exitWithError = (error) => {
  console.error(error);
  process.exit(1);
};

describe("Custom errors", () => {
  it("#1.1 - should parse to right exception", async () => {
    try {
      expect(Errors.EVMErrorParser(new Error("block gas limit"))).to.be.an.instanceof(Errors.GasBlockLimitError);
      expect(Errors.EVMErrorParser(new Error("insufficient funds"))).to.be.an.instanceof(Errors.AccountFundsError);
      expect(Errors.EVMErrorParser(new Error("nonce too low"))).to.be.an.instanceof(Errors.AccountNonceError);
      expect(Errors.EVMErrorParser(new Error("transaction nonce"))).to.be.an.instanceof(Errors.AccountNonceError);
      expect(Errors.EVMErrorParser(new Error("transaction underpriced"))).to.be.an.instanceof(Errors.TxUnderpricedError);
      expect(Errors.EVMErrorParser(new Error("already known"))).to.be.an.instanceof(Errors.TxUnderpricedError);
      expect(Errors.EVMErrorParser(new Error("execution reverted"))).to.be.an.instanceof(Errors.SmartContractError);
      expect(Errors.EVMErrorParser(new Error("reverted by the evm"))).to.be.an.instanceof(Errors.SmartContractError);
      expect(Errors.EVMErrorParser(new Error("should not match"))).to.be.an.instanceof(Errors.BaseError);
      expect(Errors.EVMErrorParser(new Errors.TimeoutError(false, "myTimeout"))).to.be.an.instanceof(Errors.TimeoutError);
    } catch (err) {
      exitWithError(err);
    }
  });

  it("#1.2 - should maintain instances of exception parsed", async () => {
    try {
      const myParsedError = new Error("block gas limit");
      expect(Errors.EVMErrorParser(myParsedError)).to.be.an.instanceof(Errors.GasBlockLimitError);
    } catch (err) {
      exitWithError(err);
    }
  });
});
