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

    this.ipfs = ipfs
    
    this.docSet = docSet
    this.wrtc = wrtc

    this.Peers        = {}
    this.connections  = {}
  }

  join(session, name) {
    // add ourselves to the peers list with a do-nothing signaller
    // this has to happen after all the listeners register... which suggests
    // we have some kind of an antipattern going

    let room;

    this.ipfs.once('ready', () => this.ipfs.id((err, info) => {
      if (err) { throw err }
      console.log('IPFS node ready with address ' + info.id)
    
      room = Room(this.ipfs, 'ampl-experiment')
    
      room.on('peer joined', (peer) => {
        console.log('peer ' + peer + ' joined')
        this.getOrCreatePeer(ipfsid, ipfsid, undefined)
      })
      room.on('peer left', (peer) => {
        console.log('peer ' + peer + ' left')
        delete this.Peers[peer]
        // this is wrong
      })
    
      // send and receive messages    
      room.on('peer joined', (peer) => room.sendTo(peer, 'Hello ' + peer + '!'))
      room.on('message', (message) => {
        console.log('got message from ' + message.from + ': ' + message.data.toString())
        this.connections[message.from].receiveMsg(JSON.parse(msg.data.toString()))
      })
    }))

    this.room = room

/*    this.ipfs.id().then( (ipfsid) => {
      this.me = this.getOrCreatePeer(ipfsid, ipfsid, undefined)      
    })*/
  }

  close() {
    for (let id in this.Peers) {
      delete this.Peers[id]
    }
    ipfs.stop()
  }

  peers() {
    return Object.values(this.Peers)
  }

  self() {
    return this.me
  }

  getOrCreatePeer(id, name, handler) {
    if (!this.Peers[id]) {
      this.Peers[id] = peer
      this.connections[id] = new Automerge.Connection(this.docSet, msg => {
        console.log('send to ' + id + ':', msg)
        this.room.sendTo(peer, msg)
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
}
