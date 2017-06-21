
import PeerGroup from './peergroup'
import Tesseract from 'tesseract'

export default class DeltaRouter {
  constructor(peergroup, getTesseractCB, applyTesseractDeltasCB) {
    this.peergroup = peergroup;
    this.getTesseractCB = getTesseractCB;
    this.applyTesseractDeltasCB = applyTesseractDeltasCB;
    
    this.clocks = {}
    this.seqs = {}

    // on initialization, tell all our existing peers about our current vector clock 
    this.peergroup.peers().forEach( (peer) => {
      if (peer.self == false) {
        this.updatePeer(peer, this.getTesseractCB())
      }
    })

    // listen for new peers
    this.peergroup.on('peer', (peer) => {
      this.seqs[peer.id] = 0
      
      // send our clock to peers when we first connect so they
      // can catch us up on anything we missed.
      peer.on('connect', () => {
        if (peer.self == false) {
          this.updatePeer(peer, this.getTesseractCB())
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
          this.applyTesseractDeltasCB(m.deltas)
          this.peergroup.peers().forEach((peer) => {
            this.updatePeer(peer, this.getTesseractCB())
          })
        }

        // and if we get a vector clock, send the peer anything they're missing
        if (m.vectorClock && (m.deltas || m.seq == this.seqs[peer.id])) { // ignore acks for all but the last send
          this.clocks[peer.id] = m.vectorClock
          this.updatePeer(peer, state)
        }
      })
    })
  }

  // after each new local operation broadcast it to any peers that don't have it yet
  broadcastState(state) {
    let myClock = Tesseract.getVClock(state)
    this.clocks[this.peergroup.self().id] = myClock

    this.peergroup.peers().forEach((peer) => {
      this.updatePeer(peer, state)
    })
  }

  updatePeer(peer, state) {
    if (peer == undefined) return
    
    // docId probably shouldn't be here, but here it is for now.
    let myClock = Tesseract.getVClock(state)
    let msg = {docId: state.docId, vectorClock: myClock}

    let theirClock = this.clocks[peer.id];
    if (theirClock) {
      let deltas = Tesseract.getDeltasAfter(state, theirClock)
      if (deltas.length > 0) {
        // update their clock to assume they received all these updates 
        this.clocks[peer.id] = this.clockMax(myClock,theirClock)
        this.seqs[peer.id] += 1

        msg.deltas = deltas
        msg.seq = this.seqs[peer.id] 
      }
    }
    peer.send(msg)
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
