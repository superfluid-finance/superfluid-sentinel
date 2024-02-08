const express = require('express')
const { register, accountBalanceGauge } = require('./metrics/metrics') // import the register and custom metrics
class HTTPServer {
  constructor (app) {
    this.app = app
    this.server = express()
    this.port = this.app.config.METRICS_PORT
    this.register = register
  }

  async updateAccountBalance () {
    try {
      const balance = await this.app.client.getAccountBalance()
      accountBalanceGauge.set(Number(balance))
    } catch (e) {
      console.error('Failed to update account balance:', e)
    }
  }

  start () {
    this.server.get('/', async (req, res) => {
      const healthcheck = await this.app.healthReport.fullReport()
      try {
        res.send(healthcheck)
      } catch (e) {
        healthcheck.message = e
        res.status(503).send()
      }
    })

    // helper function for argument parsing
    const parseTimeframe = (timeframe) => {
      const units = {
        m: 60,
        h: 3600,
        d: 3600 * 24,
        w: 3600 * 24 * 7,
        M: 3600 * 24 * 30,
        y: 3600 * 24 * 365
      }

      const regex = /^(\d+)([mhdwMy])$/
      const match = timeframe.match(regex)

      if (match) {
        const value = parseInt(match[1], 10)
        const unit = match[2]
        return value * units[unit]
      }

      return null
    }

    // get a list of upcoming liquidations - configurable timeframe, defaults to 1h
    this.server.get('/nextliquidations', async (req, res) => {
      const timeframeParam = req.query.timeframe || '1h'
      const timeframeInSeconds = parseTimeframe(timeframeParam)

      if (timeframeInSeconds === null) {
        res.status(400).send({ message: 'Invalid timeframe format. Use a value like "2h", "5d", etc.' })
        return
      }

      const liquidations = await this.app.db.bizQueries.getLiquidations(
        this.app.time.getTimeWithDelay(-timeframeInSeconds),
        this.app.config.TOKENS,
        this.app.config.EXCLUDED_TOKENS
      )

      try {
        res.send(liquidations)
      } catch (e) {
        liquidations.message = e
        res.status(503).send()
      }
    })

    this.server.get('/metrics', async (req, res) => {
      res.setHeader('Content-Type', this.register.contentType)
      res.send(await this.register.metrics())
    })

    this.balanceInterval = setInterval(() => {
      this.updateAccountBalance()
    }, 30 * 60 * 1000) // 30 minutes

    this.runningInstance = this.server.listen(this.port, () => {
      this.app.logger.info(`Metrics: listening via http on port ${this.port}`)
    })
  }

  close () {
    // stop the balance interval
    clearInterval(this.balanceInterval)
    this.runningInstance.close(() => {
      console.debug('HTTP server closed')
    })
  }
}

module.exports = HTTPServer
