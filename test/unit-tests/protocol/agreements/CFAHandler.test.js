const CFAHandler = require('../../../../src/protocol/agreements/CFAHandler')
const chai = require('chai')
const sinon = require('sinon')
const expect = chai.expect

describe('CFAHandler', () => {
  let app
  let cfaHandler
  let addTotalRequestStub
  let getNetFlowStub
  let getPastEventsStub
  let getFlowStub
  let soliditySha3Stub

  beforeEach(() => {
    addTotalRequestStub = sinon.stub()
    getNetFlowStub = sinon.stub()
    getPastEventsStub = sinon.stub()
    getFlowStub = sinon.stub().returns({
      call: sinon.stub().resolves({ detail: 'flowDetail' })
    })
    soliditySha3Stub = sinon.stub()

    app = {
      client: {
        addTotalRequest: addTotalRequestStub,
        soliditySha3: soliditySha3Stub,
        contracts: {
          CFAv1: {
            methods: {
              getNetFlow: getNetFlowStub,
              getFlow: getFlowStub

            },
            getPastEvents: getPastEventsStub
          }
        }
      },
      config: {}
    }
    cfaHandler = new CFAHandler(app)
  })

  it('should call getNetFlow and return its result', async () => {
    const token = 'token'
    const account = 'account'
    const expectedNetFlow = 'netFlow'
    getNetFlowStub.withArgs(token, account).returns({ call: sinon.stub().resolves(expectedNetFlow) })

    const netFlow = await cfaHandler.getUserNetFlow(token, account)

    expect(addTotalRequestStub.calledOnce).to.be.true
    expect(netFlow).to.equal(expectedNetFlow)
  })

  it('should call getPastEvents and return its result', async () => {
    const eventName = 'eventName'
    const filter = {}
    const expectedEvents = ['event1', 'event2']
    getPastEventsStub.withArgs(eventName, filter).returns(Promise.resolve(expectedEvents))

    const events = await cfaHandler.getPastEvents(eventName, filter)

    expect(addTotalRequestStub.calledOnce).to.be.true
    expect(events).to.eql(expectedEvents)
  })

  it('should return a unique identifier', () => {
    const sender = 'sender'
    const receiver = 'receiver'
    const expectedID = 'uniqueID'
    soliditySha3Stub.withArgs(sender, receiver).returns(expectedID)
    const id = cfaHandler.getAgreementID(sender, receiver)
    expect(app.client.soliditySha3.calledWith(sender, receiver)).to.be.true
    expect(id).to.equal(expectedID)
  })

  it('should return flow details if an active flow exists', async () => {
    const superToken = 'superToken'
    const sender = 'sender'
    const receiver = 'receiver'
    const expectedFlowDetails = { detail: 'flowDetail' }
    const flowDetails = await cfaHandler.checkFlow(superToken, sender, receiver)
    expect(app.client.contracts.CFAv1.methods.getFlow.calledWith(superToken, sender, receiver)).to.be.true
    expect(flowDetails).to.eql(expectedFlowDetails)
  })

  describe('getDeleteTransaction', () => {
    let superToken, sender, receiver

    beforeEach(() => {
      superToken = 'superToken'
      sender = 'sender'
      receiver = 'receiver'
      // Reset app.client.contracts for each test
      app.client.contracts.batch = undefined // Reset batch to undefined for each test
      app.client.contracts.sf = {
        methods: {
          callAgreement: sinon.stub().returns({
            encodeABI: sinon.stub().returns('encodedCallAgreementTx')
          })
        }
      }
    })

    it('should use batch interface on L2 networks', async () => {
      app.config.NETWORK_TYPE = 'evm-l2'
      app.client.contracts.batch = {
        methods: {
          deleteFlow: sinon.stub().returns({
            encodeABI: sinon.stub().returns('encodedBatchTx')
          })
        }
      }
      app.client.contracts.getBatchAddress = sinon.stub().returns('batchContractAddress')

      const result = cfaHandler.getDeleteTransaction(superToken, sender, receiver)

      expect(result.tx).to.equal('encodedBatchTx')
      expect(result.target).to.equal('batchContractAddress')
    })

    it('should use conventional host interface on L1 networks', async () => {
      app.config.NETWORK_TYPE = 'evm-l1' // Assuming 'evm-l1' denotes L1 networks
      app.client.contracts.getCFAv1Address = sinon.stub().returns('CFAv1Address')
      app.client.contracts.CFAv1.methods.deleteFlow = sinon.stub().returns({
        encodeABI: sinon.stub().returns('encodedDeleteFlowABI')
      })
      app.client.contracts.getSuperfluidAddress = sinon.stub().returns('superfluidContractAddress')

      const result = cfaHandler.getDeleteTransaction(superToken, sender, receiver)

      expect(result.tx).to.equal('encodedCallAgreementTx')
      expect(result.target).to.equal('superfluidContractAddress')
    })
  })
})
