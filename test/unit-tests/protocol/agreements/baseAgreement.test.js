const BaseAgreement = require('../../../../src/protocol/agreements/baseAgreement')
const chai = require('chai')
const sinon = require('sinon')
const expect = chai.expect

describe('BaseAgreement', () => {
  let app
  let baseAgreement
  let addTotalRequestStub

  beforeEach(() => {
    addTotalRequestStub = sinon.stub()
    app = { client: { addTotalRequest: addTotalRequestStub } }
    baseAgreement = new BaseAgreement(app)
  })

  it('constructor should throw error when app is not defined', () => {
    expect(() => new BaseAgreement()).to.throw('BaseAgreement: app is not defined')
  })

  it('addTotalRequest should call app.client.addTotalRequest', () => {
    baseAgreement.addTotalRequest()
    expect(addTotalRequestStub.calledOnce).to.be.true
  })

  it('getNetFlow should throw error', async () => {
    try {
      await baseAgreement.getNetFlow()
      throw new Error('Expected getNetFlow to throw, but it did not')
    } catch (err) {
      expect(err.message).to.equal('getNetFlow method should be implemented by subclasses')
    }
  })

  it('getPastEvents should throw error', async () => {
    try {
      await baseAgreement.getPastEvents()
      throw new Error('Expected getPastEvents to throw, but it did not')
    } catch (err) {
      expect(err.message).to.equal('getAgreementEvents method should be implemented by subclasses')
    }
  })
})
