class BaseError extends Error {
  constructor (isOperational, description) {
    super(description);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;
    this.isOperational = isOperational;
    Error.captureStackTrace(this);
  }
}

class EVM extends BaseError {
  constructor (isOperational, description, originalMessage) {
    super(isOperational, description );
    this.originalMessage = originalMessage;
  }
}

class GasBlockLimitError extends EVM {
  constructor(description, originalMessage) {
    super(false, description, originalMessage );
  }
}

class TxUnderpricedError extends EVM {
  constructor(description, originalMessage) {
    super(false, description, originalMessage);
  }
}

class TxAlreadyKnownError extends EVM {
  constructor(description, originalMessage) {
    super(false, description, originalMessage);
  }
}

class AccountFundsError extends EVM {
  constructor(description, originalMessage) {
    super(false, description, originalMessage);
  }
}

class AccountNonceError extends EVM{
  constructor(description, originalMessage) {
    super(false, description, originalMessage);
  }
}

class SmartContractError extends EVM {
  constructor(description, originalMessage) {
    super(false, description, originalMessage);
  }
}

class TimeoutError extends BaseError {
  constructor(isOperational, description) {
    super(isOperational, description );
  }
}

function EVMErrorParser(err) {
    const message = err.message.toLowerCase();
    if(message.includes("block gas limit")) {
      return new GasBlockLimitError("block gas limit", err.message);
    }
    if(message.includes("insufficient funds")) {
      return new AccountFundsError("insufficient funds", err.message);
    }
    if(message.includes("nonce too low") ||
        message.includes("transaction nonce"))
    {
      return new AccountNonceError("nonce too low", err.message);
    }
    if(message.includes("transaction underpriced")) {
      return new TxUnderpricedError("transaction underpriced", err.message);
    }
    if(message.includes("already known")) {
      return new TxUnderpricedError("tx already known", err.message);
    }
    if(message.includes("execution reverted") ||
        err.message.toLowerCase().includes("reverted by the evm") ||
        err.message.toLowerCase().includes("vm exception"))
    {
      return new SmartContractError("execution reverted", err.message);
    }
    //don't default to BaseError in the case on custom error
    if(err instanceof TimeoutError) {
      return err;
    }

    return new BaseError(true, message);
}

module.exports = {
  EVMErrorParser,
  TimeoutError,
  GasBlockLimitError,
  TxUnderpricedError,
  TxAlreadyKnownError,
  AccountFundsError,
  AccountNonceError,
  SmartContractError,
  BaseError
}
