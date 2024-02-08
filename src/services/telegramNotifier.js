const TelegramBot = require('node-telegram-bot-api')

/*
  Telegram Notifier service
  This is not called directly, but is used by the Notifier service
 */

class TelegramNotifier {
  constructor (app) {
    if (!app.config.TELEGRAM_BOT_TOKEN || !app.config.TELEGRAM_CHAT_ID) {
      throw new Error('Telegram botToken and ChatId must be set in config')
    }

    // notification service must be initialized
    if (!app.notifier) {
      throw new Error('Notifier must be initialized before TelegramNotifier')
    }

    this.app = app
    this.chatId = app.config.TELEGRAM_CHAT_ID
    this.bot = new TelegramBot(app.config.TELEGRAM_BOT_TOKEN)
    this.app.notifier.on('notification', message => {
      this.sendNotification(message)
    })
  }

  async sendNotification (message) {
    try {
      await this.bot.sendMessage(this.chatId, message)
      this.app.logger.info(`TelegramNotifier: Sent notification to Telegram: ${message}`)
    } catch (error) {
      this.app.logger.error(`TelegramNotifier: Error sending notification to Telegram: ${error}`)
    }
  }
}

module.exports = TelegramNotifier
