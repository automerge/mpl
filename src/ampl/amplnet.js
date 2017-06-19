import BonjourSignaler from './amplnet/bonjour-signaler'
import WebRTCSignaler from './amplnet/webrtc-signaler' // this has a different and also crazy interface

import PeerGroup from './amplnet/peergroup'
import EventEmitter from 'events'
import config from './config'


export default class aMPLNet extends EventEmitter {
  constructor(options) {
    super()

    // xxx NO REALLY, FIX ME.
    this.options = options
    this.name   = config.name || process.env.NAME
    this.connected = false
  }

  connect(config) {
    if (this.connected) throw "network already connected - disconnect first"
    this.config = config || this.config

    this.peergroup = new PeerGroup(this.name, this.config.peerId, this.options)

    this.peerStats  = {}

    this.connected = true

    this.signaler = new BonjourSignaler(this.peergroup, {name: this.name, session: this.config.peerId })
    this.webRTCSignaler = new WebRTCSignaler(this.peergroup)

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

    // we define "connect" and "disconnect" for ourselves as whether
    // we're connected to the signaller.
    this.signaler.on('connect', () => {
      this.peergroup.self().emit('connect')
    })
    this.signaler.on('disconnect', () => {
      this.peergroup.self().emit('disconnect')
    })

    this.peergroup.join()
    this.signaler.start()
  }

  disconnect() {
    if (this.connected == false) throw "network already disconnected - connect first"
    console.log("NETWORK DISCONNECT")
    this.peergroup.close()
    this.connected = false
    this.emit('peer')
  }
}
