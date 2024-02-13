class Time {
  constructor (app) {
    if (!app) throw new Error("Time: app is not defined");
    this.app = app;
    this.baseTime = undefined;
  }

  getDelayedTime () {
    return this.getTimeWithDelay(this.app.config.ADDITIONAL_LIQUIDATION_DELAY);
  }

  getTimeWithDelay (delaySeconds) {
    if (this.baseTime === undefined) {
      const date = new Date();
      return date.getTime() - (delaySeconds * 1000);
    }

    return new Date(this.baseTime).getTime() - delaySeconds;
  }

  setTime (time) {
    this.baseTime = time;
  }

  resetTime () {
    this.baseTime = undefined;
  }
}

module.exports = Time;
