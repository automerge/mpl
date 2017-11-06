import PeerStats from './network/peer-stats'

import PeerGroup from './network/peergroup'
import EventEmitter from 'events'
import config from './config'

export default class Network extends EventEmitter {
  constructor(docSet, wrtc) {
    super()

    this.peergroup = new PeerGroup(docSet, wrtc)
    this.peerStats = new PeerStats(this.peergroup)

    this.connected = false
  }

  connect(config) {
    if (this.connected) throw "network already connected - disconnect first"

    // allow connect without a config to use the previous connect's config.
    this.config = config || this.config

    let name   = this.config.name || process.env.NAME
    let peerId = this.config.peerId
    if (!peerId) throw new Error("peerId required, not found in config")
    this.peergroup.join(peerId, name)

    this.connected = true
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
    this.peergroup.close()
    this.connected = false
  }
}
