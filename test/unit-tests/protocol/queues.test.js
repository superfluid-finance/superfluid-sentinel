const sinon = require('sinon')
const { expect } = require('chai')
const Queues = require('../../../src/protocol/queues')

describe('Queues', () => {
  let queue
  let appMock
  let sandbox

  beforeEach(() => {
    sandbox = sinon.createSandbox()

    appMock = {
      logger: {
        debug: sinon.stub(),
        info: sinon.stub(),
        error: sinon.stub()
      },
      circularBuffer: {
        push: sinon.stub()
      },
      _isShutdown: false,
      config: {
        NUM_RETRIES: 3,
        CONCURRENCY: 5
      },
      protocol: {
        liquidationData: sinon.stub().resolves({}),
        getCFAAgreementEvents: sinon.stub().resolves([]),
        getGDAgreementEvents: sinon.stub().resolves([])
      },
      db: {
        models: {
          AccountEstimationModel: {
            upsert: sinon.stub().resolves()
          },
          AgreementModel: {
            upsert: sinon.stub().resolves()
          }
        }
      },
      client: {
        superToken: {
          isSuperTokenRegistered: sinon.stub().resolves(true)
        }
      }
    }

    queue = new Queues(appMock)
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('#1.1 - should initialize queues correctly', () => {
    queue.init()

    expect(queue.estimationQueue).to.exist
    expect(queue.agreementUpdateQueue).to.exist
  })

  it('#1.2 - should not run if app is shutting down', async () => {
    appMock._isShutdown = true

    await queue.run(sinon.stub(), 5000)

    expect(appMock.logger.info.calledOnce).to.be.true
    expect(appMock.logger.info.calledWith('app.shutdown() - closing queues')).to.be.true
  })

  it('#1.3 - should add new estimation task if not exists', async () => {
    queue.init()
    // don't process anything
    queue.estimationQueue.concurrency = 0
    await queue.addQueuedEstimation('0xToken', '0xAccount', 'caller1')
    const taskExist = queue.isEstimationTaskInQueue('0xToken', '0xAccount')
    expect(taskExist).to.be.true
  })

  it('#1.3.1 - should add new estimations tasks if not exists', async () => {
    queue.init()
    // don't process anything
    queue.estimationQueue.concurrency = 0
    await queue.addQueuedEstimation('0xToken', '0xAccount', 'caller1')
    await queue.addQueuedEstimation('0xToken', '0xAccount2', 'caller1')
    await queue.addQueuedEstimation('0xToken', '0xAccount3', 'caller1')
    await queue.addQueuedEstimation('0xToken', '0xAccount4', 'caller1')
    const tasks = queue.getEstimationTasks()
    expect(tasks.length).to.equal(4)
    // test each task
    expect(tasks[0].token).to.equal('0xToken')
    expect(tasks[0].account).to.equal('0xAccount')
    expect(tasks[0].parentCaller).to.equal('caller1')

    expect(tasks[1].token).to.equal('0xToken')
    expect(tasks[1].account).to.equal('0xAccount2')
    expect(tasks[1].parentCaller).to.equal('caller1')

    expect(tasks[2].token).to.equal('0xToken')
    expect(tasks[2].account).to.equal('0xAccount3')
    expect(tasks[2].parentCaller).to.equal('caller1')

    expect(tasks[3].token).to.equal('0xToken')
    expect(tasks[3].account).to.equal('0xAccount4')
    expect(tasks[3].parentCaller).to.equal('caller1')
  })

  it('#1.4 - should not add duplicate estimation task', async () => {
    queue.init()
    // don't process anything
    queue.estimationQueue.concurrency = 0
    await queue.addQueuedEstimation('0xToken', '0xAccount', 'caller1')
    await queue.addQueuedEstimation('0xToken', '0xAccount', 'caller2')
    const tasks = queue.getEstimationTasks()
    expect(tasks.length).to.equal(1)
    expect(appMock.logger.debug.calledOnce).to.be.true
  })

  it('#1.5 - should shut down the queue correctly', async () => {
    queue.init()
    await queue.shutdown()
    expect(queue.estimationQueue.paused).to.be.true
    expect(queue.agreementUpdateQueue.paused).to.be.true
    expect(appMock.circularBuffer.push.calledOnce).to.be.true
    expect(appMock.circularBuffer.push.calledWith('shutdown', null, 'queues shutting down')).to.be.true
  })

  it.skip('#1.6 - should retry estimation tasks up to NUM_RETRIES times', async () => {
    const faultyEstimationFunction = sinon.stub().rejects(new Error('Test Error'))
    appMock.protocol.liquidationData = faultyEstimationFunction

    queue.init()
    // don't process anything
    // queue.estimationQueue.concurrency = 0;
    await queue.addQueuedEstimation('0xToken', '0xAccount', 'caller1')
    // await queue.estimationQueue.drain();

    // Ensure it was called NUM_RETRIES times
    expect(faultyEstimationFunction.callCount).to.equal(appMock.config.NUM_RETRIES)
  })
})
