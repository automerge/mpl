
import PeerGroup from './peergroup'
import Tesseract from 'tesseract'

export default class DeltaRouter {
  constructor(peergroup, getTesseractCB, applyTesseractDeltasCB) {
    this.peergroup = peergroup;
    this.getTesseractCB = getTesseractCB;
    this.applyTesseractDeltasCB = applyTesseractDeltasCB;
    
    this.clocks = {}

    // on initialization, tell all our existing peers about our current vector clock 
    this.peergroup.peers().forEach( (peer) => {
      if (peer.self == false) {
        this.sendVectorClockToPeer(peer)
      }
    })

    // listen for new peers
    this.peergroup.on('peer', (peer) => {
      
      // send our clock to peers when we first connect so they
      // can catch us up on anything we missed.
      peer.on('connect', () => {
        if (peer.self == false) { // FIXME - remove once we take self out of peers
          this.sendVectorClockToPeer(peer)
        }
      })

      peer.on('message', (m) => {
        let state = this.getTesseractCB()

        // right now we only care about a single docId
        if (m.docId != state.docId) {
          return
        }

        // try and apply deltas we receive
        if (m.deltas && m.deltas.length > 0) {
          console.log("APPLY DELTAS",m.deltas.length)
          this.applyTesseractDeltasCB(m.deltas)
          this.broadcastVectorClock()
        }

        // and if we get a vector clock, send the peer anything they're missing
        if (m.vectorClock) { // ignore acks for all but the last send
          console.log("got vector clock from", peer.id)
          this.clocks[peer.id] = this.clockMax(m.vectorClock, this.clocks[peer.id] || {})

          if (this.aheadOf(peer)) {
            console.log("We are ahead - send deltas",peer.id)
            this.sendDeltasToPeer(peer)
          }

          if (this.behind(peer)) {
            console.log("We are behind - request deltas",peer.id)
            this.sendVectorClockToPeer(peer)
          }
        }
      })
    })
  }

  // after each new local operation broadcast it to any peers that don't have it yet
  broadcastVectorClock() {
    console.log("broadcast vector clock")
    this.peergroup.peers().forEach((peer) => {
      this.sendVectorClockToPeer(peer)
    })
  }

  broadcastState() {
    console.log("broadcast state")
    this.peergroup.peers().forEach((peer) => {
      this.sendDeltasToPeer(peer)
    })
  }

  sendDeltasToPeer(peer) {
    console.log("maybe send deltas")
    let state = this.getTesseractCB()
    let myClock = Tesseract.getVClock(state)
    let theirClock = this.clocks[peer.id];

    if (theirClock) {
      let deltas = Tesseract.getDeltasAfter(state, theirClock)
      if (deltas.length > 0) {
        this.clocks[peer.id] = this.clockMax(myClock,theirClock)
        console.log("SEND DELTAS",deltas.length)
        peer.send({docId: state.docId, vectorClock: myClock, deltas:deltas})
      }
    }
  }

  sendVectorClockToPeer(peer) {
    console.log("send vector clock to peer")
    let state = this.getTesseractCB()
    let myClock = Tesseract.getVClock(state)
    peer.send({ docId: state.docId, vectorClock: myClock })
  }

  behind(peer) {
    let clock = this.clocks[peer.id]
    let state = this.getTesseractCB()
    let myClock = Tesseract.getVClock(state)
    for (let i in Object.keys(clock)) {
      if (clock[i] > (myClock[i] || 0)) return true
    }
    return false
  }

  aheadOf(peer) {
    let clock = this.clocks[peer.id]
    let state = this.getTesseractCB()
    let myClock = Tesseract.getVClock(state)
    for (let i in Object.keys(myClock)) {
      if (myClock[i] > (clock[i] || 0)) return true
    }
    return false
  }

  /* This should probably be a feature of Tesseract */
  clockMax(clock1, clock2) {
    let maxclock  = {}
    let keys      = Object.keys(clock1).concat(Object.keys(clock2))

    for (let i in keys) {
      let key = keys[i]
      maxclock[key] = Math.max(clock1[key] || 0, clock2[key] || 0)
    }

    return maxclock
  }

}
