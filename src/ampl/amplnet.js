import ss from './amplnet/slack-signaler'
import BonjourSignaler from './amplnet/bonjour-signaler'
import WebRTCSignaler from './amplnet/webrtc-signaler' // this has a different and also crazy interface

import PeerGroup from './amplnet/peergroup'
import Tesseract from 'tesseract'
import EventEmitter from 'events'
import config from './config'

export default class aMPLNet extends EventEmitter {
  constructor(options) {
    super()

    this.token  = config.slackBotToken || process.env.SLACK_BOT_TOKEN
    this.name   = config.name || process.env.NAME
    this.peergroup = new PeerGroup(options)
    this.connected = false
  }


  connect(config) {
    if (this.connected) throw "network already connected - disconnect first"
    this.config = config || this.config
    this.peerStats  = {}
    this.clocks = {}
    this.seqs = {}
    
    this.peer_id = this.config.peerId
    this.doc_id = this.config.docId
    this.store  = this.config.store

    this.connected = true

    if (this.doc_id) {
      if (process.env.SLACK_BOT_TOKEN) {
        this.signaler = ss.init({doc_id: this.doc_id, name: this.name, bot_token: this.token, session: this.peer_id })
      }
      else {
        this.signaler = new BonjourSignaler({doc_id: this.doc_id, name: this.name, session: this.peer_id })
      }

      this.webRTCSignaler = new WebRTCSignaler(this.peergroup)

      this.peergroup.on('peer', (peer) => {
        console.log("ON PEER",peer.id,peer.self)
        this.seqs[peer.id] = 0
        
        this.peerStats[peer.id] = {
          connected: false,
          self: peer.self,
          name: peer.name,
          lastActivity: Date.now(),
          messagesSent: 0,
          messagesReceived: 0
        }
        this.emit('peer')

        peer.on('disconnect', () => {
          this.peerStats[peer.id].connected = false
          this.emit('peer')
        })

        peer.on('closed', () => {
          delete this.peerStats[peer.id]
          this.emit('peer')
        })

        peer.on('connect', () => {
          this.peerStats[peer.id].connected = true
          this.peerStats[peer.id].lastActivity = Date.now()
          this.peerStats[peer.id].messagesSent += 1
          this.emit('peer')
        })

        peer.on('message', (m) => {
          this.peerStats[peer.id].lastActivity = Date.now()
          this.peerStats[peer.id].messagesReceived += 1
          this.emit('peer')
        })

        // END PEER STATS

        peer.on('connect', () => {
          if (peer.self == false) {
            peer.send({vectorClock: Tesseract.getVClock(this.store.getState()), seq:0})
          }
        })

        peer.on('message', (m) => {
          let store = this.store

          if (m.deltas && m.deltas.length > 0) {
            this.store.dispatch({
              type: "APPLY_DELTAS",
              deltas: m.deltas
            })
          }

          if (m.vectorClock && (m.deltas || m.seq == this.seqs[peer.id])) { // ignore acks for all but the last send
            this.updatePeer(peer,this.store.getState(), m.vectorClock)
          }
        })
      })

      this.peergroup.join(this.signaler)
    } else {
      console.log("Network disabled")
      console.log("TRELLIS_DOC_ID:", this.doc_id)
    }
  }

  clockMax(clock1, clock2) {
    let maxclock  = {}
    let keys      = Object.keys(clock1).concat(Object.keys(clock2))

    for (let i in keys) {
      let key = keys[i]
      maxclock[key] = Math.max(clock1[key] || 0, clock2[key] || 0)
    }

    return maxclock
  }

  broadcastState(state, action) {
    let clock = Tesseract.getVClock(state)
    this.clocks[this.peergroup.self().id] = clock
    if (action == "APPLY_DELTAS") {
      this.peergroup.peers().forEach((peer) => {
        try {
          peer.send({vectorClock: clock })
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
    this.emit('peer')
  }

  updatePeer(peer, state, clock) {
    if (peer == undefined) return
    if (clock == undefined) return
    let myClock = Tesseract.getVClock(state)
    this.clocks[peer.id] = this.clockMax(myClock,clock)
    this.seqs[peer.id] += 1
    let deltas = Tesseract.getDeltasAfter(state, clock)
    if (deltas.length > 0) {
      peer.send({deltas: deltas, seq: this.seqs[peer.id], vectorClock: myClock})
      this.peerStats[peer.id].messagesSent += 1
    }
  }

  disconnect() {
    if (this.connected == false) throw "network already disconnected - connect first"
    console.log("NETWORK DISCONNECT")
    delete this.store
    this.peergroup.close()
    this.connected = false
    this.emit('peer')
  }
}
