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
    this.connected = false
  }

  connect(config) {
    if (this.connected) throw "network already connected - disconnect first"
    
    this.peergroup = new PeerGroup(this.wrtc)

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

    let name   = config.name || process.env.NAME
    let peerId = config.peerId
    if (!peerId) throw "a peerId is required for the peergroup to start"
    this.peergroup.join(peerId, name)

    this.signaler.start()
    this.connected = true
  }

  disconnect() {
    if (this.connected == false) throw "network already disconnected - connect first"
    console.log("NETWORK DISCONNECT")
    this.signaler.stop()
    this.peergroup.close()
    this.connected = false
  }
}
