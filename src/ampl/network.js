import BonjourSignaler from './network/bonjour-signaler'
import WebRTCSignaler from './network/webrtc-signaler'
import PeerStats from './network/peer-stats'

import PeerGroup from './network/peergroup'
import EventEmitter from 'events'
import config from './config'

export default class Network extends EventEmitter {
  constructor(wrtc) {
    super()

    this.wrtc = wrtc
    this.name   = config.name || process.env.NAME
    this.connected = false
  }

  connect(config) {
    if (this.connected) throw "network already connected - disconnect first"
    this.config = config || this.config

    this.peergroup = new PeerGroup(this.name, this.config.peerId, this.wrtc)
    this.connected = true

    this.signaler = new BonjourSignaler(this.peergroup)
    this.webRTCSignaler = new WebRTCSignaler(this.peergroup)
    this.peerStats = new PeerStats(this.peergroup)


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
