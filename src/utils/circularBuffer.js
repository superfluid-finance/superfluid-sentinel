class CircularBuffer {
  constructor (size) {
    this.buffer = new Array(size).fill(null)
    this.size = size
    this.start = 0
    this.end = 0
    this.length = 0
  }

  push (event, error, stateChange) {
    this.buffer[this.end] = { event, error, stateChange }
    this.end = (this.end + 1) % this.size
    if (this.length === this.size) {
      this.start = (this.start + 1) % this.size
    } else {
      this.length++
    }
  }

  get (index) {
    if (index < 0 || index >= this.length) {
      throw new Error('Index out of bounds')
    }
    const bufferIndex = (this.start + index) % this.size
    return this.buffer[bufferIndex]
  }

  toArray () {
    const result = []
    for (let i = 0; i < this.length; i++) {
      result.push(this.get(i))
    }
    return result
  }
}

module.exports = CircularBuffer
