const Errors = require("./errors/errors");
class Timer {

  timeout(ms) {
    return new Promise(res => setTimeout(res, ms));
  }
  async triggerStart (fn, time = 15000) {
    await this.timeout(time);
    return fn.start();
  }

  async startAfter(fn, data, ms= 1000) {
    setTimeout(() => fn.start(data), 1000);
  }

  promiseTimeout (promise, ms) {
    const timeout = new Promise( (resolve, reject) => {
      const id = setTimeout( () => {
        clearTimeout( id );
        //(name, isOperational, description)
        reject( new Errors.TimeoutError(true, `Promise rejected with timeout ${ms}ms`) );
      }, ms );
    } );

    // Returns a race between timeout and promise
    return Promise.race( [
      promise,
      timeout
    ] );
  }
}
module.exports = Timer;

