// Transaction class is a static class that handles all the transaction related operations

class Transaction {
  constructor (app) {
    if (!app) throw new Error("Transaction: app is not defined");
    this.app = app;
  }

  async signWithContext (wallet, transactionWithContext) {
    try {
      const updatedGas = this.app.gasEstimator.getUpdatedGasPrice(
        transactionWithContext.gasPrice,
        transactionWithContext.retry,
        transactionWithContext.step
      );

      transactionWithContext.gasPrice = updatedGas.gasPrice;

      const unsignedTx = {
        chainId: transactionWithContext.chainId,
        to: transactionWithContext.target,
        from: transactionWithContext.address,
        data: transactionWithContext.tx,
        nonce: transactionWithContext.nonce,
        gasPrice: transactionWithContext.gasPrice,
        gasLimit: transactionWithContext.gasLimit
      };

      const signedTransaction = await wallet.signTransaction(unsignedTx);

      const signedWithContext = transactionWithContext;
      signedWithContext.signed = signedTransaction;
      signedWithContext.hitGasPriceLimit = updatedGas.hitGasPriceLimit;

      return {
        signedWithContext,
        signingError: undefined
      };
    } catch (err) {
      return {
        signedWithContext: undefined,
        signingError: err
      };
    }
  }
}

module.exports = Transaction;
