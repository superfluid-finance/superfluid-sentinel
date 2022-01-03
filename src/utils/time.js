class Time {
  construtor (app) {
    this.app = app;
  }

  getTime () {
    if (this.baseTime === undefined) {
      return new Date();
    }

    return new Date(this.baseTime);
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
