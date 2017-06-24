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

  setName(name) {
    this.peers().forEach((peer) => {
      peer.send({name: name})
    })
    this.self().name = name
    this.self().emit('rename',name)
  }

  processSignal(msg, signal, handler) {
    let id = msg.session
    if (!id) throw new Error("Tried to process a signal that had no peer ID")
    let name = msg.name
    
    let peer;
    switch(msg.action) {
      case "hello":
        // on a "hello" we throw out the peer
        if (this.Peers[id]) console.log("ALREADY HAVE A PEER UNDERWAY - NEW HELLO - RESET",id)
        delete this.Peers[id]
        peer = this.getOrCreatePeer(id, name, handler);
        peer.establishDataChannel();
        break;
      case "offer":
        // on an "offer" we can create a peer if we don't have one
        // but this is might get wonky, since it could be a peer that's trying to reconnect 
        peer = this.getOrCreatePeer(id, name, handler);
        peer.handleSignal(signal)
        break;
      case "reply":
        peer = this.Peers[id] // we definitely don't want replies for unknown peers.
        if (!peer) throw "Received an offer or a reply for a peer we don't have registered."
        peer.handleSignal(signal)
        break;
      default:
        throw new Error("Unrecognized signal:", signal)
    }
  }
}
