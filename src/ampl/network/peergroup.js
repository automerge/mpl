import Peer from './peer'
import EventEmitter from 'events'

export default class PeerGroup extends EventEmitter {
  constructor(wrtc) {
    super()

    this.wrtc = wrtc;

    this.Peers        = {}
    this.processSignal = this.processSignal.bind(this)
  }

  join(session, name) {
    // add ourselves to the peers list with a do-nothing signaller
    // this has to happen after all the listeners register... which suggests
    // we have some kind of an antipattern going
    this.me = this.getOrCreatePeer(session, name, undefined)
  }

  close() {
    for (let id in this.Peers) {
      this.Peers[id].close()
      delete this.Peers[id]
    }
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
      let peer = new Peer(id, name, handler, this.wrtc)
      peer.on('closed', () => {
        delete this.Peers[peer.id]
      })
      this.Peers[id] = peer
      this.emit("peer", peer)
    }
    return this.Peers[id]
  }

  processSignal(msg, signal, handler) {
    let id = msg.session
    if (!id) throw new Error("Tried to process a signal that had no peer ID")
    let name = msg.name
    if (!name) throw new Error("Tried to process a signal that had no name")
    
    if (msg.action == "hello") {
      delete this.Peers[id]
      let peer = this.getOrCreatePeer(id, name, handler);
      peer.establishDataChannel();
    }
    else if (msg.action == "offer" || msg.action == "reply") {
        let peer = this.Peers[id]
        if (!peer) throw "Received an offer or a reply for a peer we don't have registered."
        
        peer.handleSignal(signal)
    }
    else {
      console.log("UNRECOGNIZED SIGNAL:", signal)
    }
  }
}
