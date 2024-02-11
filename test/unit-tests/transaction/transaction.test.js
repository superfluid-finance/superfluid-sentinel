const sinon = require('sinon');
const { expect } = require('chai');
const Transaction = require('../../../src/transaction/transaction');

describe('Transaction', () => {
    let transaction;
    let mockApp;
    let mockWallet;

    beforeEach(() => {
        mockWallet = {
            signTransaction: sinon.stub()
        };

        mockApp = {
            gasEstimator: {
                getUpdatedGasPrice: sinon.stub()
            }
        };

        transaction = new Transaction(mockApp);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('#1.1 - should throw error when app is not defined', () => {
        expect(() => new Transaction()).to.throw('Transaction: app is not defined');
    });

    it('#1.2 - should sign transaction with context and update gas price', async () => {
        const transactionWithContext = {
            chainId: 1,
            target: 'targetAddress',
            address: 'walletAddress',
            tx: 'transactionData',
            nonce: 0,
            gasPrice: '100',
            gasLimit: '21000',
            retry: 1,
            step: 1.1
        };
        const updatedGasPrice = '110';

        mockApp.gasEstimator.getUpdatedGasPrice.returns({
            gasPrice: updatedGasPrice,
            hitGasPriceLimit: false
        });

        mockWallet.signTransaction.resolves('signedTransactionData');
        const {
            signedWithContext,
            signingError
        } = await transaction.signWithContext(mockWallet, transactionWithContext);

        expect(signedWithContext.gasPrice).to.equal(updatedGasPrice);
        expect(mockWallet.signTransaction.calledOnce).to.be.true;

        signedWithContext.hitGasPriceLimit = false;
        signedWithContext.signed = 'signedTransactionData';

        expect(signedWithContext).to.deep.equal(transactionWithContext);
    });

    it('#2.3 - should handle error when signing transaction fails', async () => {
        const transactionWithContext = {
            chainId: 1,
            target: 'targetAddress',
            address: 'walletAddress',
            tx: 'transactionData',
            nonce: 0,
            gasPrice: '100',
            gasLimit: '21000',
            retry: 1,
            step: 1.1
        };
        const signingError = new Error('signing error');

        mockApp.gasEstimator.getUpdatedGasPrice.returns({
            gasPrice: '110',
            hitGasPriceLimit: false
        });

        mockWallet.signTransaction.rejects(signingError);
        const {
            signedWithContext,
            signingError: error
        } = await transaction.signWithContext(mockWallet, transactionWithContext);

        expect(signedWithContext).to.be.undefined;
        expect(error).to.equal(signingError);
    });

    it('#3.3 - should handler hit gas price limit', async () => {
        const transactionWithContext = {
            chainId: 1,
            target: 'targetAddress',
            address: 'walletAddress',
            tx: 'transactionData',
            nonce: 0,
            gasPrice: '100',
            gasLimit: '21000',
            retry: 1,
            step: 1.1
        };
        const updatedGasPrice = '110';

        mockApp.gasEstimator.getUpdatedGasPrice.returns({
            gasPrice: updatedGasPrice,
            hitGasPriceLimit: true
        });

        mockWallet.signTransaction.resolves('signedTransactionData');
        const {
            signedWithContext,
            signingError
        } = await transaction.signWithContext(mockWallet, transactionWithContext);

        expect(signedWithContext.gasPrice).to.equal(updatedGasPrice);
        expect(mockWallet.signTransaction.calledOnce).to.be.true;

        signedWithContext.hitGasPriceLimit = true;
        signedWithContext.signed = 'signedTransactionData';

        expect(signedWithContext).to.deep.equal(transactionWithContext);
    });


});
