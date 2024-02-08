const { expect } = require('chai')
const CircularBuffer = require('../../src/utils/circularBuffer')

describe('CircularBuffer', () => {
  let buffer

  beforeEach(() => {
    buffer = new CircularBuffer(5)
  })

  it('#1.1 - should initialize with the correct size', () => {
    expect(buffer.size).to.equal(5)
  })

  it('#1.2 - should initialize with start and end at index 0', () => {
    expect(buffer.start).to.equal(0)
    expect(buffer.end).to.equal(0)
  })

  it('#1.3 - should initialize with length 0', () => {
    expect(buffer.length).to.equal(0)
  })

  it('#1.4 - should push events into the buffer', () => {
    buffer.push('System Event 1', null, null)
    buffer.push('System Event 2', null, null)

    expect(buffer.length).to.equal(2)
    expect(buffer.get(0)).to.deep.equal({ event: 'System Event 1', error: null, stateChange: null })
    expect(buffer.get(1)).to.deep.equal({ event: 'System Event 2', error: null, stateChange: null })
  })

  it('#1.5 - should wrap around when exceeding the buffer size', () => {
    buffer.push('System Event 1', null, null)
    buffer.push('System Event 2', null, null)
    buffer.push('System Event 3', null, null)
    buffer.push('System Event 4', null, null)
    buffer.push('System Event 5', null, null)
    buffer.push('System Event 6', null, null)

    expect(buffer.length).to.equal(5)
    expect(buffer.get(0)).to.deep.equal({ event: 'System Event 2', error: null, stateChange: null })
    expect(buffer.get(1)).to.deep.equal({ event: 'System Event 3', error: null, stateChange: null })
    expect(buffer.get(2)).to.deep.equal({ event: 'System Event 4', error: null, stateChange: null })
    expect(buffer.get(3)).to.deep.equal({ event: 'System Event 5', error: null, stateChange: null })
    expect(buffer.get(4)).to.deep.equal({ event: 'System Event 6', error: null, stateChange: null })
  })

  it('#1.6 - should throw an error for an out-of-bounds index', () => {
    buffer.push('System Event 1', null, null)

    expect(() => buffer.get(1)).to.throw('Index out of bounds')
  })

  it('#1.7 - should convert the buffer to an array', () => {
    buffer.push('System Event 1', null, null)
    buffer.push('System Event 2', null, null)
    buffer.push('System Event 3', null, null)

    const result = buffer.toArray()

    expect(result).to.deep.equal([
      { event: 'System Event 1', error: null, stateChange: null },
      { event: 'System Event 2', error: null, stateChange: null },
      { event: 'System Event 3', error: null, stateChange: null }
    ])
  })
})
