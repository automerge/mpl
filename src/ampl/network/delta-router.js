
import PeerGroup from './peergroup'
import Tesseract from 'tesseract'

export default class DeltaRouter {
  constructor(peergroup, store) {
    this.peergroup = peergroup;
    this.store = store;
    
    this.clocks = {}
    this.seqs = {}

    // on initialization, tell all our peers about our current vector clock 
    this.peergroup.peers().forEach( (peer) => {
      if (peer.self == false) {
        this.sendVectorClock(peer)
      }
    })

    // listen for new peers
    this.peergroup.on('peer', (peer) => {
      this.seqs[peer.id] = 0
      
      // send our clock to peers when we first connect so they
      // can catch us up on anything we missed.
      peer.on('connect', () => {
        if (peer.self == false) {
          this.sendVectorClock(peer)
        }
      })

      peer.on('message', (m) => {
        let store = this.store

        // right now we only care about a single docId
        if (m.docId != this.store.getState().docId) {
          return
        }

        // try and apply deltas we receive
        if (m.deltas && m.deltas.length > 0) {
          this.store.dispatch({
            type: "APPLY_DELTAS",
            deltas: m.deltas
          })
        }

        // and if we get a vector clock, send the peer anything they're missing
        if (m.vectorClock && (m.deltas || m.seq == this.seqs[peer.id])) { // ignore acks for all but the last send
          this.updatePeer(peer, this.store.getState(), m.vectorClock)
        }
      })
    })
  }
  
  // after each new local operation broadcast it to any peers that don't have it yet
  broadcastState(state, action) {
    let clock = Tesseract.getVClock(state)
    this.clocks[this.peergroup.self().id] = clock
    // if what we did was APPLY_DELTAS (which we probably got off the network)
    if (action == "APPLY_DELTAS") {
      // we'll want to tell our peers that we received some deltas so 
      // their vector clock for us gets updated
      this.peergroup.peers().forEach((peer) => {
        // XXX FIXME: we ought to check if if those peers might want some of our newfound deltas here too! 
        try {
          // docId probably shouldn't be here, but here it is for now.
          peer.send({docId: state.docId, vectorClock: clock })
          // XXX why no seq here?
        }
        catch (e) {
          console.log("Error sending to ["+peer.id+"]:", e)
        }
      })
    } else {
      this.peergroup.peers().forEach((peer) => {
        this.updatePeer(peer, state, this.clocks[peer.id])
      })
    }
  }

  sendVectorClock(peer) {
    // why SEQ always zero here?
    peer.send({docId: this.store.getState().docId, vectorClock: Tesseract.getVClock(this.store.getState()), seq:0})
  }

  updatePeer(peer, state, clock) {
    if (peer == undefined) return
    if (clock == undefined) return
    let myClock = Tesseract.getVClock(state)
    this.clocks[peer.id] = this.clockMax(myClock,clock)
    this.seqs[peer.id] += 1
    let deltas = Tesseract.getDeltasAfter(state, clock)
    if (deltas.length > 0) {
      // docId probably shouldn't be here, but here it is for now.
      peer.send({docId: state.docId, deltas: deltas, seq: this.seqs[peer.id], vectorClock: myClock})
    }
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
