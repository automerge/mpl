
import PeerGroup from './peergroup'
import Tesseract from 'tesseract'

export default class DeltaRouter {
  constructor(peergroup, store) {
    this.peergroup = peergroup;
    this.store = store;
    
    this.clocks = {}
    this.seqs = {}

    this.peergroup.on('peer', (peer) => {
      this.seqs[peer.id] = 0
      
      peer.on('connect', () => {
        if (peer.self == false) {
          peer.send({docId: this.store.getState().docId, vectorClock: Tesseract.getVClock(this.store.getState()), seq:0})
        }
      })

      peer.on('message', (m) => {
        let store = this.store

        if (m.docId != this.store.getState().docId) {
          return
        }

        if (m.deltas && m.deltas.length > 0) {
          this.store.dispatch({
            type: "APPLY_DELTAS",
            deltas: m.deltas
          })
        }

        if (m.vectorClock && (m.deltas || m.seq == this.seqs[peer.id])) { // ignore acks for all but the last send
          this.updatePeer(peer, this.store.getState(), m.vectorClock)
        }
      })
    })
  }
  
  broadcastState(state, action) {
    let clock = Tesseract.getVClock(state)
    this.clocks[this.peergroup.self().id] = clock
    if (action == "APPLY_DELTAS") {
      this.peergroup.peers().forEach((peer) => {
        try {
          // docId probably shouldn't be here, but here it is for now.
          peer.send({docId: state.docId, vectorClock: clock })
          this.peerStats[peer.id].messagesSent += 1
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
