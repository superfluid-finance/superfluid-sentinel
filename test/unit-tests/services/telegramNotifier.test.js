const sinon = require('sinon')
const { expect } = require('chai')
const TelegramBot = require('node-telegram-bot-api')
const TelegramNotifierTest = require('../../../src/services/telegramNotifier')

describe('TelegramNotifier', () => {
  let telegramNotifier
  let appMock
  let sandbox
  let sendMessageStub

  beforeEach(() => {
    sandbox = sinon.createSandbox()

    appMock = {
      config: {
        TELEGRAM_BOT_TOKEN: 'bot-token',
        TELEGRAM_CHAT_ID: 'chat-id'
      },
      notifier: {
        on: sinon.stub()
      },
      logger: {
        info: sinon.stub(),
        error: sinon.stub()
      }
    }

    sendMessageStub = sandbox.stub()
    sandbox.stub(TelegramBot.prototype, 'sendMessage').callsFake(sendMessageStub)
    telegramNotifier = new TelegramNotifierTest(appMock)
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('#1.1 - should throw an error if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are not set', () => {
    appMock.config.TELEGRAM_BOT_TOKEN = null
    appMock.config.TELEGRAM_CHAT_ID = null

    expect(() => new TelegramNotifierTest(appMock)).to.throw('Telegram botToken and ChatId must be set in config')
  })

  it('#1.2 - should throw an error if notifier is not initialized', () => {
    appMock.notifier = null
    expect(() => new TelegramNotifierTest(appMock)).to.throw('Notifier must be initialized before TelegramNotifier')
  })

  it('#1.3 - should send a notification to telegram', async () => {
    const message = 'test message'
    await telegramNotifier.sendNotification(message)

    expect(sendMessageStub.calledOnceWith(appMock.config.TELEGRAM_CHAT_ID, message)).to.be.true
    expect(appMock.logger.info.calledOnceWith(`TelegramNotifier: Sent notification to Telegram: ${message}`)).to.be.true
  })

  it('#1.4 - should handle an error when sending a notification to telegram', async () => {
    const message = 'test message'
    const error = new Error('test error')
    sendMessageStub.throws(error)
    await telegramNotifier.sendNotification(message)
    expect(appMock.logger.error.calledOnceWith(`TelegramNotifier: Error sending notification to Telegram: ${error}`)).to.be.true
  })
})
