import Peer from './peer'
import lz4  from 'lz4'
import EventEmitter from 'events'

export default class PeerGroup extends EventEmitter {
  constructor(options) {
    super()

    // XXX cleanup this
    this.options = options;

    this.Signaler     = undefined
    this.Peers        = {}
    this.Handshakes   = {}
    this.processSignal = this.processSignal.bind(this)
  }

  join(signaler) {
    this.Signaler = signaler
    signaler.on('hello', this.processSignal)
    signaler.on('offer', this.processSignal)
    signaler.on('reply', this.processSignal)
    signaler.on('error', (message,e) => {
      console.log("SIGNALER ERROR-MESSAGE",message)
      console.log("ERROR",e)
    })

    // add ourselves to the peers list with a do-nothing signaller
    let me = this.getOrCreatePeer(signaler.session, signaler.name, undefined)

    // we define "connect" and "disconnect" for ourselves as whether
    // we're connected to the signaller.
    signaler.on('connect', () => {
      me.emit('connect')
    })
    signaler.on('disconnect', () => {
      me.emit('disconnect')
    })

    // notify the signaller we're ready to connect.
    signaler.start()
  }

  close() {
    if(this.Signaler) {
      this.Signaler.stop()
      this.Signaler = undefined
      for (let id in this.Peers) {
        this.Peers[id].close()
        delete this.Peers[id]
      }
      // throw away all cached handshakes
      this.Handshakes = {}
      this.removeAllListeners()
    }
  }

  peers() {
    let values = []

    Object.keys(this.Peers).forEach((key) => {
      values.push(this.Peers[key])
    })

    return values
  }

  getOrCreatePeer(id, name, handler) {
    if(!this.Peers[id]) {
      let peer = new Peer(this.options, id, name, handler)
      // pvh moved this here from peer.js but doesn't understand it
      peer.on('closed', () => {
        delete this.Peers[peer.id]
        if (this.Handshakes[peer.id]) {
          this.Handshakes[peer.id]()
        }
      })
      this.Peers[id] = peer
      this.emit("peer", peer)
    }
    return this.Peers[id]
  }

  beginHandshake(id, name, handler) {
    delete this.Handshakes[id] // we're moving now, so discard this handshake

    // this delete gives us the old semantics but i don't know why we do it
    delete this.Peers[id]
    let peer = this.getOrCreatePeer(id, name, handler);
    peer.establishDataChannel();
  }

  processSignal(msg, signal, handler) {
    let id = msg.session
    let name = msg.name

    if (msg.action == "hello") {
      if (id in this.Peers) {
        // we save a handshake for later if we already know them
        this.Handshakes[id] = () => { this.beginHandshake(id,name,handler) }
      } else {
        this.beginHandshake(id,name,handler)
      }
    }
    else {
      let peer = this.getOrCreatePeer(id,name,handler)
      peer.handleSignal(signal)
    }
  }
}
