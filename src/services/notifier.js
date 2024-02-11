const EventEmitter = require("events");

class Notifier extends EventEmitter {
  sendNotification (message) {
    this.emit("notification", `[${process.pid}]: ${message}`);
  }
}

module.exports = Notifier;
