const ErrorsTest = require("../../src/utils/errors/errors");

const expect = require("chai").expect;

const exitWithError = (error) => {
  console.error(error);
  process.exit(1);
};

describe("Custom errors", () => {
  it("#1.1 - should parse to right exception", async () => {
    try {
      expect(ErrorsTest.EVMErrorParser(new Error("block gas limit"))).to.be.an.instanceof(ErrorsTest.GasBlockLimitError);
      expect(ErrorsTest.EVMErrorParser(new Error("insufficient funds"))).to.be.an.instanceof(ErrorsTest.AccountFundsError);
      expect(ErrorsTest.EVMErrorParser(new Error("nonce too low"))).to.be.an.instanceof(ErrorsTest.AccountNonceError);
      expect(ErrorsTest.EVMErrorParser(new Error("transaction nonce"))).to.be.an.instanceof(ErrorsTest.AccountNonceError);
      expect(ErrorsTest.EVMErrorParser(new Error("transaction underpriced"))).to.be.an.instanceof(ErrorsTest.TxUnderpricedError);
      expect(ErrorsTest.EVMErrorParser(new Error("already known"))).to.be.an.instanceof(ErrorsTest.TxUnderpricedError);
      expect(ErrorsTest.EVMErrorParser(new Error("execution reverted"))).to.be.an.instanceof(ErrorsTest.SmartContractError);
      expect(ErrorsTest.EVMErrorParser(new Error("reverted by the evm"))).to.be.an.instanceof(ErrorsTest.SmartContractError);
      expect(ErrorsTest.EVMErrorParser(new Error("should not match"))).to.be.an.instanceof(ErrorsTest.BaseError);
      expect(ErrorsTest.EVMErrorParser(new ErrorsTest.TimeoutError(false, "myTimeout"))).to.be.an.instanceof(ErrorsTest.TimeoutError);
    } catch (err) {
      exitWithError(err);
    }
  });

  it("#1.2 - should maintain instances of exception parsed", async () => {
    try {
      const myParsedError = new Error("block gas limit");
      expect(ErrorsTest.EVMErrorParser(myParsedError)).to.be.an.instanceof(ErrorsTest.GasBlockLimitError);
    } catch (err) {
      exitWithError(err);
    }
  });
});
