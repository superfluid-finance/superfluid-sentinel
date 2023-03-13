const EventEmitter = require('events');

class Notifier extends EventEmitter {
    sendNotification(message) {
        this.emit('notification', message);
    }
}

module.exports = Notifier;