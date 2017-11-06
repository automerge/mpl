import Peer from './peer'
import EventEmitter from 'events'
import Automerge from 'automerge'
const IPFS = require('ipfs')
const Room = require('ipfs-pubsub-room')

export default class PeerGroup extends EventEmitter {
  constructor(docSet, wrtc) {
    super()

    const ipfs = new IPFS({
      repo: 'ipfs/pubsub-demo/' + Math.random(),
      EXPERIMENTAL: {
        pubsub: true
      },
      config: {
        "Addresses": {
          "API": "",
          "Gateway": "",
          "Swarm": [
            "/ip4/0.0.0.0/tcp/0",
        ]}}
    })
    
    ipfs.once('ready', () => ipfs.id((err, info) => {
      if (err) { throw err }
      console.log('IPFS node ready with address ' + info.id)
    
      const room = Room(ipfs, 'ampl-experiment')
    
      room.on('peer joined', (peer) => console.log('peer ' + peer + ' joined'))
      room.on('peer left', (peer) => console.log('peer ' + peer + ' left'))
    
      // send and receive messages
    
      room.on('peer joined', (peer) => room.sendTo(peer, 'Hello ' + peer + '!'))
      room.on('message', (message) => console.log('got message from ' + message.from + ': ' + message.data.toString()))
    
      // broadcast message every 2 seconds
    
      setInterval(() => room.broadcast('hey everyone!'), 2000)
    }))

    this.ipfs = ipfs
    
    this.docSet = docSet
    this.wrtc = wrtc

    this.Peers        = {}
    this.connections  = {}
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
    if (!this.Peers[id]) {
      let peer = new Peer(id, name, handler, this.wrtc)
      this.Peers[id] = peer
      this.connections[id] = new Automerge.Connection(this.docSet, msg => {
        console.log('send to ' + id + ':', msg)
        peer.send(msg)
      })

      peer.on('message', msg => {
        console.log('receive from ' + id + ':', msg)
        this.connections[id].receiveMsg(msg)
      })

      peer.on('closed', () => {
        this.connections[id].close()
        delete this.connections[id]
        delete this.Peers[id]
      })

      this.connections[id].open()
      this.emit("peer", peer)
    }

    return this.Peers[id]
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
