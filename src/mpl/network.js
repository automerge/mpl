import PeerStats from './network/peer-stats'

import EventEmitter from 'events'
import config from './config'

import IPFS from 'ipfs'
import Room from 'ipfs-pubsub-room'
import Automerge from 'automerge'

export default class Network extends EventEmitter {
  constructor(docSet, wrtc) { // XXX: remove wrtc reference
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

    this.Peers = {}
    this.connections = {}

    this.ipfs = ipfs

    this.docSet = docSet

    this.connected = false
  }

  connect(config) {
    if (this.connected) throw "network already connected - disconnect first"

    // allow connect without a config to use the previous connect's config.
    this.config = config || this.config

    let name   = this.config.name || process.env.NAME
    
    this.ipfs.once('ready', () => this.ipfs.id((err, info) => {
      if (err) { throw err }
      console.log('IPFS node ready with address ' + info.id)
    
      this.room = Room(this.ipfs, 'ampl-experiment')
    
      this.room.on('peer joined', (peer) => {
        console.log('peer ' + peer + ' joined')
        if (peer == info.id) { return }
        this.getOrCreatePeer(peer, peer, undefined)
      })
      this.room.on('peer left', (peer) => {
        console.log('peer ' + peer + ' left')
        delete this.Peers[peer]
        // this is wrong (i think?)
      })
    
      // send and receive messages    
      this.room.on('message', (message) => {
        console.log('Automerge.Connection> receive ' + message.from + ': ' + message.data.toString())
        this.connections[message.from].receiveMsg(JSON.parse(message.data.toString()))
      })
    }))

    this.connected = true
  }

  getOrCreatePeer(id, name, handler) {
      if (!this.Peers[id]) {
        this.Peers[id] = name
        this.connections[id] = new Automerge.Connection(this.docSet, msg => {
          console.log('Automerge.Connection> send to ' + id + ':', msg)
          this.room.sendTo(id, JSON.stringify(msg))
        })
  
        this.connections[id].open()
      }
      return this.Peers[id]
  }
    
  broadcastActiveDocId(docId) {
    // todo: this.webRTCSignaler.broadcastActiveDocId(docId)
  }

  getPeerDocs() {
    // todo: return this.webRTCSignaler.getPeerDocs()
  }

  disconnect() {
    if (this.connected == false) throw "network already disconnected - connect first"
    console.log("NETWORK DISCONNECT")
    this.ipfs.stop()
    this.connected = false
  }
}
