const sinon = require('sinon')
const { expect } = require('chai')
const AccountManager = require('../../src/web3client/accountManager')
const { Web3 } = require('web3')
const bip39 = require('bip39')
const hdkey = require('ethereumjs-wallet').hdkey
const BN = require('bn.js')

describe('Account Manager', () => {
  const derivePath = "m/44'/60'/0'/0/"
  const invalidAddress = '0xInvalidAddress'

  let accountManager, app, mnemonic, getBalanceStub, getTransactionCountStub
  let privateKeys = []

  const web3 = new Web3('http://fake:8545')

  beforeEach(() => {
    accountManager = new AccountManager(web3)
    mnemonic = bip39.generateMnemonic() // generate random mnemonic
    for (let i = 0; i < 3; i++) {
      privateKeys[i] = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
        .derivePath(derivePath + i)
        .getWallet()
        .getPrivateKeyString()

      accountManager.addAccountFromPrivateKey(privateKeys[i])
    }

    // stub for getBalance method - always return 100 ether
    getBalanceStub = sinon.stub(web3.eth, 'getBalance')
    getBalanceStub.returns(Promise.resolve(web3.utils.toWei('100', 'ether')))
    // stub getTransactionCount method - always return 10
    getTransactionCountStub = sinon.stub(web3.eth, 'getTransactionCount')
    getTransactionCountStub.returns(10)
  })

  afterEach(() => {
    getBalanceStub.restore()
    getTransactionCountStub.restore()
    privateKeys = []
  })

  it('#1.1 - should throw an error if web3 is not defined', () => {
    expect(() => new AccountManager()).to.throw('AccountManager: web3 is not defined')
  })

  it('#1.2 - should throw an error if mnemonic is invalid', () => {
    expect(() => accountManager
      .addAccountFromMnemonic('invalid mnemonic')).to.throw('AccountManager: invalid mnemonic')
  })

  it('#1.3 - should throw an error if index is invalid', () => {
    expect(() => accountManager
      .addAccountFromMnemonic(mnemonic, -1)).to.throw('AccountManager: invalid index')
  })

  it('#1.4 - should construct with correct parameters', () => {
    expect(accountManager.app).to.equal(app)
    expect(accountManager.accounts.length).to.equal(privateKeys.length)
  })

  it('#1.5 - should add an account from a mnemonic', () => {
    const accountsLength = accountManager.accounts.length
    accountManager.addAccountFromMnemonic(mnemonic, 10)
    expect(accountManager.accounts.length).to.equal(accountsLength + 1)
  })

  it('#1.6 - should add an account from a private key', () => {
    const accountsLength = accountManager.accounts.length
    const privateKey = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
      .derivePath(derivePath + 10)
      .getWallet()
      .getPrivateKeyString()
    accountManager.addAccountFromPrivateKey(privateKey)

    expect(accountManager.accounts.length).to.equal(accountsLength + 1)
  })

  it('#1.7 - should get an account by index', () => {
    const account = accountManager.getAccount(0)
    expect(account).to.have.property('address')
    expect(account).to.have.property('signTransaction')
  })

  it('#1.8 - should get an account address by index', () => {
    const address = accountManager.getAccountAddress(0)
    expect(address).to.be.a('string')
  })

  it('#1.9 - should get an account by address', () => {
    const account = accountManager.getAccount(0)
    const retrievedAccount = accountManager.getAccountFromAddress(account.address)
    expect(retrievedAccount).to.eql(account)
  })

  it('#1.10 - should get an account index by address', () => {
    const account = accountManager.getAccount(0)
    const index = accountManager.getAccountIndex(account.address)
    expect(index).to.equal(0)
  })

  it('#1.11 - should get an account balance', async () => {
    const balance = await accountManager.getAccountBalance(0)
    expect(balance).to.equal(web3.utils.toWei('100', 'ether'))
    expect(getBalanceStub.calledOnce).to.be.true
  })

  it('#1.12 - should check if an account balance is below minimum', async () => {
    const threshold = new BN(web3.utils.toWei('200', 'ether'))
    const result = await accountManager.isAccountBalanceBelowMinimum(0, threshold)
    expect(result.isBelow).to.be.true
    expect(result.balance.toString()).to.equal(web3.utils.toWei('100', 'ether'))
    expect(getBalanceStub.calledOnce).to.be.true
  })

  it('#1.13 - should check if an account balance is above minimum', async () => {
    const threshold = new BN(web3.utils.toWei('50', 'ether'))
    const result = await accountManager.isAccountBalanceBelowMinimum(0, threshold)
    expect(result.isBelow).to.be.false
    expect(result.balance.toString()).to.equal(web3.utils.toWei('100', 'ether'))
    expect(getBalanceStub.calledOnce).to.be.true
  })

  it('#1.14 - should sign a transaction', async () => {
    const account = accountManager.getAccount(0)
    const tx = {
      from: account.address,
      to: account.address,
      value: web3.utils.toWei('1', 'ether')
    }
    const stub = sinon.stub(account, 'signTransaction').returns(Promise.resolve({ rawTransaction: '0x123' }))
    const signedTx = await account.signTransaction(tx)
    sinon.assert.calledWith(stub, tx)
    expect(signedTx).to.eql({ rawTransaction: '0x123' })
  })

  it('#1.15 - should handle signTransaction rejection', async () => {
    const account = accountManager.getAccount(0)
    const tx = {
      from: account.address,
      to: account.address,
      value: web3.utils.toWei('1', 'ether')
    }
    const errorMsg = 'Error signing transaction'
    sinon.stub(account, 'signTransaction').returns(Promise.reject(new Error(errorMsg)))
    try {
      await account.signTransaction(tx)
    } catch (err) {
      expect(err).to.be.an('Error')
      expect(err.message).to.equal(errorMsg)
    }
  })

  it('#1.16 - should throw an error if trying to get account with invalid index', () => {
    const invalidIndex = 1000
    expect(() => accountManager
      .getAccount(invalidIndex)).to.throw('AccountManager: account does not exist')
  })

  it('#1.17 - should throw an error if trying to get account address with invalid index', () => {
    const invalidIndex = 1000
    expect(() => accountManager
      .getAccountAddress(invalidIndex)).to.throw('AccountManager: account does not exist')
  })

  it('#1.18 - should return undefined if trying to get account with invalid address', () => {
    const account = accountManager.getAccountFromAddress(invalidAddress)
    expect(account).to.be.undefined
  })

  it('#1.19 - should throw an error if trying to get account index with invalid address', () => {
    expect(() => accountManager
      .getAccountIndex(invalidAddress)).to.throw('AccountManager: account does not exist')
  })

  it('#1.20 - should get an account nonce by calling getTransactionCount', async () => {
    const accountNonce = await accountManager.getTransactionCount(0)
    expect(accountNonce).to.equal(10)
    expect(getTransactionCountStub.calledOnce).to.be.true
  })

  it('#1.21 - should get an account nonce by calling txCount on account', async () => {
    const account = accountManager.getAccount(0)
    const stub = sinon.stub(account, 'txCount').returns(Promise.resolve(10))
    const accountNonce = await account.txCount()
    expect(accountNonce).to.equal(10)
    sinon.assert.calledOnce(stub)
  })

  it("#1.22 - should add private key with '0x' prefix if not exists", () => {
    const privateKeyWithoutPrefix = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    accountManager.addAccountFromPrivateKey(privateKeyWithoutPrefix)
    const account = accountManager.accounts[accountManager.accounts.length - 1]
    expect(account.address).to.equal('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')
  })

  it("#1.23 - should add private key with '0x' prefix if exists", () => {
    const privateKeyWithPrefix = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    accountManager.addAccountFromPrivateKey(privateKeyWithPrefix)
    const account = accountManager.accounts[accountManager.accounts.length - 1]
    expect(account.address).to.equal('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')
  })
})
