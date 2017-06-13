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
      console.log("ERROR-MESSAGE",message)
      console.log("ERROR",e)
    })

    let me = new Peer(this.options, signaler.session, signaler.name)
    this.Peers[me.id] = me
    if(!me.self) peer.initializePeerConnection()
    this.emit("peer", me)

    signaler.on('connect', () => {
      me.emit('connect')
    })
    signaler.on('disconnect', () => {
      me.emit('disconnect')
    })
    signaler.start()
  }

  close() {
    if(this.Signaler) {
      this.Signaler.stop()
      this.Signaler = undefined
      for (let id in this.Peers) {
        this.Peers[id].close()
      }
      this.Handshakes = {}
      this.removeAllListeners()
    }
  }

  // xxx and this
  beginHandshake(id, name, handler) {
    delete this.Handshakes[id]
    let peer = new Peer(this.options, id, name, handler)
    this.Peers[peer.id] = peer
    if(!peer.self) peer.initializePeerConnection()
    this.emit("peer", peer)

    peer.establishDataChannel();
  }

  processSignal(msg, signal, handler) {
    let id = msg.session
    let name = msg.name

    if (msg.action == "hello") {
      let begin = () => { this.beginHandshake(id,name,handler) }
      if (id in this.Peers) {
        this.Handshakes[id] = begin
      } else {
        begin()
      }
      return;
    }

    let peer
    if(this.Peers[id])
      peer = this.Peers[id]
    else {
      peer = new Peer(this.options, id, name, handler)
      this.Peers[id] = peer
      if(!peer.self) peer.initializePeerConnection()
      this.emit("peer", peer)
    }

    peer.handleSignal(signal)
  }

  notice(peer,desc) {
    return (event) => console.log("notice:" + peer.id + ": " + desc, event)
  }
}
