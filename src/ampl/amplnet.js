import BonjourSignaler from './amplnet/bonjour-signaler'
import WebRTCSignaler from './amplnet/webrtc-signaler' // this has a different and also crazy interface
import DeltaRouter from './amplnet/delta-router'

import PeerGroup from './amplnet/peergroup'
import EventEmitter from 'events'
import config from './config'


export default class aMPLNet extends EventEmitter {
  constructor(options) {
    super()

    this.name   = config.name || process.env.NAME
    this.peergroup = new PeerGroup(options)
    this.connected = false
  }

  connect(config) {
    if (this.connected) throw "network already connected - disconnect first"
    this.config = config || this.config
    this.peerStats  = {}
    
    this.peer_id = this.config.peerId
    this.store  = this.config.store

    this.connected = true

    this.signaler = new BonjourSignaler({name: this.name, session: this.peer_id })
  
    this.webRTCSignaler = new WebRTCSignaler(this.peergroup)

    this.deltaRouter = new DeltaRouter(this.peergroup, this.store)

    this.peergroup.on('peer', (peer) => {
      console.log("ON PEER",peer.id,peer.self)
      
      this.peerStats[peer.id] = {
        connected: false,
        self: peer.self,
        name: peer.name,
        lastActivity: Date.now(),
        messagesSent: 0,
        messagesReceived: 0
      }
      this.emit('peer')

      peer.on('disconnect', () => {
        this.peerStats[peer.id].connected = false
        this.emit('peer')
      })

      peer.on('closed', () => {
        delete this.peerStats[peer.id]
        this.emit('peer')
      })

      peer.on('connect', () => {
        this.peerStats[peer.id].connected = true
        this.peerStats[peer.id].lastActivity = Date.now()
        this.emit('peer')
      })

      peer.on('message', (m) => {
        this.peerStats[peer.id].lastActivity = Date.now()
        this.peerStats[peer.id].messagesReceived += 1
        this.emit('peer')
      })

      peer.on('sent', (m) => {
        this.peerStats[peer.id].messagesSent += 1
        this.emit('peer')
      })
    })

    this.peergroup.join(this.signaler)
  }

  disconnect() {
    if (this.connected == false) throw "network already disconnected - connect first"
    console.log("NETWORK DISCONNECT")
    delete this.store
    this.peergroup.close()
    this.connected = false
    this.emit('peer')
  }
}
