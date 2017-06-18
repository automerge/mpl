import EventEmitter from 'events'

// Listen to peergroup, and when it adds a peer, listen to that peer
// so that we can tell others about it when it connects / disconnects.
export default class WebRTCSignaler {
  // todo: should this have the peergroup or should the peergroup listen to it?
  constructor(peergroup) {
    peergroup.on('peer', (peer) => {
      // XXX fix this too
      if (peer.self == true) { this.SELF = peer }
      
      peer.on('connect', () => {
        this.broadcastKnownPeers()
      })
      peer.on('disconnect', () => {
        // XXX: orion, why do we broadcast disconnects?
        this.broadcastKnownPeers()
      })

      peer.on('message', (m) => {
        if (m.knownPeers) {
          this.locatePeersThroughFriends(peer, m.knownPeers)
        }

        if (m.action) { // we only care about 'action'-carrying messages, which are signals.
          this.routeSignal(peer,m)
        }
      })
    })

    this.peergroup = peergroup;
  }

  // whenever anyone connects or disconnects we tell everyone everything.
  broadcastKnownPeers() {
    this.peergroup.peers().forEach((peer) => {
      let connectedPeerIds = this.peergroup.peers().filter( (p) => p.connected ).map( (p) => { peer.id } )
      console.log("Broadcasting known peers to " + peer.id, connectedPeerIds)
      peer.send({knownPeers: connectedPeerIds})
    })
  }

  locatePeersThroughFriends(peer, knownPeers) {
    let ids = Object.keys(knownPeers)
    for (let i in ids) {
      let remotePeerId = ids[i]
      if (!(remotePeerId in this.peerStats) && remotePeerId < this.SELF.id) {
        // fake a hello message
        let msg = {action: "hello", session: ids[i], name: knownPeers[remotePeerId].name}
        // process the hello message to get the offer material
        this.peergroup.processSignal(msg, undefined, (offer) => {
          // send the exact same offer through the system
          let offerMsg = { action: "offer", name: this.SELF.name, session:this.SELF.id, doc_id:this.doc_id, to:remotePeerId, body:offer }
          peer.send(offerMsg)
        })
      }
    }
  }

  handleSignal(peer, m) {
    this.peergroup.processSignal(m, m.body , (reply) => {
      if (m.action == "offer") {
        let replyMsg = {
          action:  "reply",
          name:    this.SELF.name,
          session: this.SELF.id,
          doc_id:  this.doc_id,
          to:      m.session,
          body:    reply
        }
        peer.send(replyMsg)
      }
    })
  }

  // note that this forwarding logic only works in a highly connected network;
  // if you're not connected to the peer it is bound for, this won't work.
  forwardSignal(peer, m) {
    // this is inefficient; todo: look up the peer by id
    this.peergroup.peers().forEach((p) => {
      if (p.id == m.to) {
        p.send(m)
      }
    })
  }

  // When we get a signal, forward it to the peer we know who wants it unless it's for us, in which case process it.
  routeSignal(peer, m) {
    if (m.to == this.SELF.id) {
      this.handleSignal(peer, m)
    } else {
      this.forwardSignal(peer, m)
    }
  }
}
