const { IncomingWebhook } = require('@slack/webhook')

/*
  Slack Notifier service
  This is not called directly, but is used by the Notifier service
 */

class SlackNotifier {
  constructor (app, options) {
    if (!app.config.SLACK_WEBHOOK_URL) {
      throw new Error('Slack webhook url must be set in config')
    }

    // notification service must be initialized
    if (!app.notifier) {
      throw new Error('Notifier must be initialized before SlackNotifier')
    }

    this.app = app
    this.webhook = new IncomingWebhook(app.config.SLACK_WEBHOOK_URL, options)
    this.app.notifier.on('notification', message => {
      this.sendNotification(message)
    })
  }

  async sendNotification (message) {
    try {
      await this.webhook.send({
        text: message
      })
      this.app.logger.info(`SlackNotifier: Sent notification to Slack: ${message}`)
    } catch (error) {
      this.app.logger.error(`SlackNotifier: Error sending notification to Slack: ${error}`)
    }
  }
}

module.exports = SlackNotifier
