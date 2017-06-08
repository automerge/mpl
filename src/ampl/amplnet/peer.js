import lz4 from 'lz4'

export default class Peer {
  constructor(id, name, send_signal) {
    this.id           = id
    this.name         = name
    this.handlers     = { connect: [], closed:[], disconnect: [], message: [] }
    this.self         = (send_signal == undefined)
    this.send_signal  = send_signal
  }

  on(type, handler) {
    this.handlers[type].push(handler)
  }

  dispatch(type, arg) {
    this.handlers[type].forEach((h) => h(arg))
  }

  close() {
    try {
      this.webrtc.close()
    } catch (err) {
      // nope
    }
  }

  send(message) {
    if (this.self) return; // dont send messages to ourselves
    if (!("data_channel" in this)) return; // dont send messages to disconnected peers

    var buffer = new Buffer(JSON.stringify(message), 'utf8')
    var compressed = lz4.encode(buffer);
    this.data_channel.send(compressed.toString('base64'))
  }
}
