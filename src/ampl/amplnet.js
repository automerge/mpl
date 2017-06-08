import ss from './amplnet/slack-signaler'
import bs from './amplnet/bonjour-signaler'

import peergroup from './amplnet/peergroup'
import Tesseract from 'tesseract'
import EventEmitter from 'events'
import config from './config'

function clockMax(c1,c2) {
  let keys = Object.keys(c1).concat(Object.keys(c2))
  let maxclock = {}
  for (let i in keys) {
    let key = keys[i]
    maxclock[key] = Math.max(c1[key] || 0, c2[key] || 0)
  }
  return maxclock
}

export default class aMPLNet extends EventEmitter {
  constructor(options) {
    super()

    this.token  = config.slackBotToken || process.env.SLACK_BOT_TOKEN
    this.name   = process.env.NAME
    this.peergroup = peergroup
    this.connected = false

    if (options) {
      if (options.wrtc) {
        peergroup.setWRTC(options.wrtc);
      } 
    }

  }

  connect(config) {
    if (this.connected) throw "network already connected - disconnect first"
    this.config = config || this.config
    this.peers  = {}
    this.clocks = {}
    this.seqs = {}
    this.PEERS = []

    this.peer_id = this.config.peerId
    this.doc_id = this.config.docId
    this.store  = this.config.store

    this.connected = true

    if (this.doc_id) {
      let bot;
      if (process.env.SLACK_BOT_TOKEN) {
        bot = ss.init({doc_id: this.doc_id, name: this.name, bot_token: this.token, session: this.peer_id })
      }
      else {
        bot = bs.init({doc_id: this.doc_id, name: this.name, session: this.peer_id })
      }

      peergroup.on('peer', (peer) => {
        this.PEERS.push(peer)
        this.seqs[peer.id] = 0
        if (peer.self == true) { this.SELF = peer } 
        this.peers[peer.id] = {
          connected: false,
          name: peer.name,
          lastActivity: Date.now(),
          messagesSent: 0,
          messagesReceived: 0
        }
        this.emit('peer')

        peer.on('disconnect', () => {
          this.PEERS.splice(this.PEERS.indexOf(peer))
          this.peers[peer.id].connected = false
          this.emit('peer')
        })

        peer.on('closed', () => {
          delete this.peers[peer.id]
          this.emit('peer')
        })

        peer.on('connect', () => {
          this.peers[peer.id].connected = true
          this.peers[peer.id].lastActivity = Date.now()
          this.peers[peer.id].messagesSent += 1
          this.emit('peer')
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
          this.peers[peer.id].lastActivity = Date.now()
          this.peers[peer.id].messagesReceived += 1
          this.emit('peer')
        })

      })

      peergroup.join(bot)
    } else {
      console.log("Network disabled")
      console.log("TRELLIS_DOC_ID:", this.doc_id)
    }
  }

  broadcast(state, action) {
    let clock = Tesseract.getVClock(state)
    this.clocks[this.SELF.id] = clock
    if (action == "APPLY_DELTAS") {
      this.PEERS.forEach((peer) => {
        peer.send({vectorClock: clock })
        this.peers[peer.id].messagesSent += 1
      })
    } else {
      this.PEERS.forEach((peer) => {
        this.updatePeer(peer, state, this.clocks[peer.id])
      })
    }
    this.emit('peer')
  }

  updatePeer(peer, state, clock) {
    if (peer == undefined) return
    if (clock == undefined) return
    let myClock = Tesseract.getVClock(state)
    this.clocks[peer.id] = clockMax(myClock,clock)
    this.seqs[peer.id] += 1
    let deltas = Tesseract.getDeltasAfter(state, clock)
    if (deltas.length > 0) {
      peer.send({deltas: deltas, seq: this.seqs[peer.id], vectorClock: myClock})
      this.peers[peer.id].messagesSent += 1
    }
  }

  // FIXME
  //    - close peerGroup connection so we stop receiving messages
  //    - stop any subscriptions to the store
  //    - stop any modifications/dispatches to the store
  //    - reset this.PEERS ... and this.peers? why do we have both still?
  disconnect() {
    if (this.connected == false) throw "network already disconnected - connect first"
    console.log("NETWORK DISCONNECT")
    delete this.store
    peergroup.close()
    this.connected = false
    this.emit('peer')
  }
}
