import Peer from './peer'
import EventEmitter from 'events'

export default class PeerGroup extends EventEmitter {
  constructor(name, session, wrtc) {
    super()

    this.wrtc = wrtc;
    this.session = session;
    this.name = name;

    this.Peers        = {}
    this.processSignal = this.processSignal.bind(this)
  }

  join() {
    // add ourselves to the peers list with a do-nothing signaller
    // this has to happen after all the listeners register... which suggests
    // we have some kind of an antipattern going
    this.me = this.getOrCreatePeer(this.session, this.name, undefined)
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
      // pvh moved this here from peer.js but doesn't understand it
      peer.on('closed', () => {
        delete this.Peers[peer.id]
      })
      this.Peers[id] = peer
      this.emit("peer", peer)
    }
    return this.Peers[id]
  }

  beginHandshake(id, name, handler) {

  }

  processSignal(msg, signal, handler) {
    let id = msg.session
    let name = msg.name
    
    // FIXME - this could be cleaner 
    if (msg.action == "hello") {    // this delete gives us the old semantics but i don't know why we do it
      delete this.Peers[id]
      let peer = this.getOrCreatePeer(id, name, handler);
      peer.establishDataChannel();
    }
    else if (msg.action == "offer" || msg.action == "reply") {
        let peer = this.getOrCreatePeer(id,name,handler)
        peer.handleSignal(signal)
    }
    else {
      console.log("what the fuck kind of signal is", signal)
    }
  }
}
