
import PeerGroup from './peergroup'
import Automerge from 'automerge'

export default class DeltaRouter {
  constructor(peergroup, getAutomergeCB, applyAutomergeDeltasCB) {
    this.peergroup = peergroup;
    this.getAutomergeCB = getAutomergeCB;
    this.applyAutomergeDeltasCB = applyAutomergeDeltasCB;

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
        this.listenToPeer(peer)
      }
    })

    this.peergroup.on('peer', (peer) => {
        this.listenToPeer(peer)
    })
  }

  listenToPeer(peer) {
    // send our clock to peers when we first connect so they
    // can catch us up on anything we missed.
    peer.on('connect', () => {
      if (peer.self == false) { // FIXME - remove once we take self out of peers
        this.sendVectorClockToPeer(peer)
      }
    })

    peer.on('message', (m) => {
      let state = this.getAutomergeCB()

      // right now we only care about a single docId
      if (m.docId != state.docId) {
        return
      }

      // try and apply deltas we receive
      if (m.deltas && m.deltas.length > 0) {
        console.log("APPLY DELTAS",m.deltas.length)
        this.applyAutomergeDeltasCB(m.deltas)
        this.broadcastVectorClock()
      }

      // and if we get a vector clock, send the peer anything they're missing
      if (m.vectorClock) { // ignore acks for all but the last send
        console.log("got vector clock from", peer.id, m.vectorClock)

        // we maintain an estimated clock that assumes messages we sent will be applied by our peer
        // POSSIBLE BUG: i haven't checked but this clock should be reset after reconnect but probably isn't!
        //let theirEstimatedClock = this.clockMax(m.vectorClock, this.clocks[peer.id] || {})
        let theirEstimatedClock = m.vectorClock // clock estimation disabled for now
        let myClock = Automerge.getVClock(state)

        if (this.isAheadOf(myClock, theirEstimatedClock)) {
          console.log("We are ahead - send deltas",peer.id)
          this.sendDeltasToPeer(peer)
        }

        // it should be safe to use the estimated clock but for this purpose m.vectorClock would work too
        if (this.isAheadOf(theirEstimatedClock, myClock)) {
          console.log("We are behind - request deltas",peer.id)
          this.sendVectorClockToPeer(peer)
        }

        // update the clock after sending to prevent exceptions above from falsely moving our
        // estimated peer clock forward
        this.clocks[peer.id] = theirEstimatedClock

      }
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
    let state = this.getAutomergeCB()
    let myClock = Automerge.getVClock(state)
    let theirClock = this.clocks[peer.id];

    if (theirClock) {
      let deltas = Automerge.getDeltasAfter(state, theirClock)
      if (deltas.length > 0) {
        console.log("SEND DELTAS",deltas.length)
        // we definitely shuoldn't be passing "boardTitle" like this
        peer.send({docId: state.docId, docTitle: state.boardTitle, vectorClock: myClock, deltas:deltas})
        
        // update our estimate of their clock to assume the deltas we just sent will all arrive
        this.clocks[peer.id] = this.clockMax(myClock,theirClock)
      }
    }
  }

  sendVectorClockToPeer(peer) {
    let state = this.getAutomergeCB()
    let myClock = Automerge.getVClock(state)
    console.log("send vector clock to peer",myClock)
    // we definitely shuoldn't be passing "boardTitle" like this
    peer.send({ docId: state.docId, docTitle: state.boardTitle, vectorClock: myClock })
  }

  isAheadOf(leftClock, rightClock) {
    for (let i in leftClock) {
      let a = leftClock[i]
      let b = (rightClock[i] || 0)
      if (a > b) return true
    }
    return false
  }

  /* This should probably be a feature of Automerge */
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
