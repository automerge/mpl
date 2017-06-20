import Peer from './peer'
import lz4  from 'lz4'
import EventEmitter from 'events'

export default class PeerGroup extends EventEmitter {
  constructor(name, session, options) {
    super()

    // XXX cleanup this
    this.options = options;

    this.session = session;
    this.name = name;

    this.Peers        = {}
    this.Handshakes   = {}
    this.processSignal = this.processSignal.bind(this)
  }

  join() {
    // add ourselves to the peers list with a do-nothing signaller
    this.me = this.getOrCreatePeer(this.session, this.name, undefined)
  }

  close() {
    for (let id in this.Peers) {
      this.Peers[id].close()
      delete this.Peers[id]
    }
    // throw away all cached handshakes
    this.Handshakes = {}
    this.removeAllListeners()
  }

  peers() {
    return Object.values(this.Peers)
  }

  self() {
    return this.me
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
    
    // FIXME - this could be cleaner 
    if (msg.action == "hello") {
      if (id in this.Peers) {
        // we save a handshake for later if we already know them
        this.Handshakes[id] = () => { this.beginHandshake(id,name,handler) }
      } else {
        this.beginHandshake(id,name,handler)
      }
    }
    else if (msg.action == "offer") {
      if (id in this.Peers) {
        this.Handshakes[id] = () => {
          let peer = this.getOrCreatePeer(id,name,handler)
          peer.handleSignal(signal)
        }
      } else {
        let peer = this.getOrCreatePeer(id,name,handler)
        peer.handleSignal(signal)
      }
    }
    else {
      let peer = this.getOrCreatePeer(id,name,handler)
      peer.handleSignal(signal)
    }
  }
}
