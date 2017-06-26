
import PeerGroup from './peergroup'
import Tesseract from 'tesseract'

export default class DeltaRouter {
  constructor(peergroup, getTesseractCB, applyTesseractDeltasCB) {
    this.peergroup = peergroup;
    this.getTesseractCB = getTesseractCB;
    this.applyTesseractDeltasCB = applyTesseractDeltasCB;

    this.clocks = {}

    //// --- how the network chatter works --- ///

    //// MESSAGE TYPES:

    //// Delta Message { deltas:[], vectorClock:vc }
    ////      when sending delta messages preemtively add the updated deltas to our stored clock for that peer
    ////      this prevents a cascade of repeated deltas if we send more than 1 delta before the first reply

    //// Vector Clock  { vectorClock:vc }
    ////      this lets peers know where you are and what to (or not to) send

    //// EVENTS AND WHAT TO DO:

    //// On Connect -->
    ////      send a Vector Clock to the peer (and they send one to you)
    //// On Local State Change -->
    ////      broadcast a deltas message to all peers
    //// On Vector Clock -->
    ////      if I have deltas they need --> Send Delta Message
    ////      if they have deltas I need --> Send a Vector Clock back (to trigger the deltas exchange)
    ////      otherwise do nothing and let the exchange end
    //// On Deltas Message -->
    ////      apply deltas - then send vector clock to all peers so they know my current state

    //// NOTE:

    ////      currently all messages have a docId which we filter on - multidoc is on its way

    this.peergroup.peers().forEach( (peer) => {
      if (peer.self == false) {
        this.sendVectorClockToPeer(peer)
      }
    })

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
          console.log("got vector clock from", peer.id, m.vectorClock)
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
        // we definitely shuoldn't be passing "boardTitle" like this
        peer.send({docId: state.docId, docTitle: state.boardTitle, vectorClock: myClock, deltas:deltas})
      }
    }
  }

  sendVectorClockToPeer(peer) {
    let state = this.getTesseractCB()
    let myClock = Tesseract.getVClock(state)
    console.log("send vector clock to peer",myClock)
    // we definitely shuoldn't be passing "boardTitle" like this
    peer.send({ docId: state.docId, docTitle: state.boardTitle, vectorClock: myClock })
  }

  behind(peer) {
    let clock = this.clocks[peer.id]
    let state = this.getTesseractCB()
    let myClock = Tesseract.getVClock(state)
    for (let i in clock) {
      let a = clock[i]
      let b = (myClock[i] || 0)
      if (a > b) return true
    }
    return false
  }

  aheadOf(peer) {
    let clock = this.clocks[peer.id]
    let state = this.getTesseractCB()
    let myClock = Tesseract.getVClock(state)
    for (let i in myClock) {
      let a = myClock[i]
      let b = (clock[i] || 0)
      if (a > b) return true
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
