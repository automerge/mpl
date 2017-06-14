import ss from './amplnet/slack-signaler'
import bs from './amplnet/bonjour-signaler'

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
    this.peers  = {}
    this.clocks = {}
    this.seqs = {}
    
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

      this.peergroup.on('peer', (peer) => {
        console.log("ON PEER",peer.id)
        this.seqs[peer.id] = 0
        if (peer.self == true) { this.SELF = peer }
        this.peers[peer.id] = {
          connected: false,
          self: peer.self,
          name: peer.name,
          lastActivity: Date.now(),
          messagesSent: 0,
          messagesReceived: 0
        }
        this.emit('peer')

        peer.on('disconnect', () => {
          this.peers[peer.id].connected = false
          this.broadcastKnownPeers()
          this.emit('peer')
        })

        peer.on('closed', () => {
          delete this.peers[peer.id]
          this.emit('peer')
        })

        peer.on('connect', () => {
          console.log("ON PEER CONNECT",peer.id)
          this.peers[peer.id].connected = true
          this.peers[peer.id].lastActivity = Date.now()
          this.peers[peer.id].messagesSent += 1
          this.emit('peer')
          if (peer.self == false) {
            peer.send({vectorClock: Tesseract.getVClock(this.store.getState()), seq:0})
          }
          this.broadcastKnownPeers()
        })

        peer.on('message', (m) => {
          let store = this.store

          this.routeSignal(peer,m)

          if (m.knownPeers) {
//            this.peersOfPeers[peer.id] = m.knownPeers
            this.locatePeersThroughFriends(peer, m.knownPeers)
          }

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

      this.peergroup.join(bot)
    } else {
      console.log("Network disabled")
      console.log("TRELLIS_DOC_ID:", this.doc_id)
    }
  }

  routeSignal(peer, m) {
    if (m.action) {
      if (m.to == this.SELF.id) {
        // its for me - process it
        console.log("GOT SIGNAL", m)
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
            console.log("SEND REPLY", m)
            peer.send(replyMsg)
          }
        })
      } else {
        // its not for me - forward it on
        console.log("SIGNAL: ROUTE TO",m.to)
        this.peergroup.peers().forEach((p) => {
          if (p.id == m.to) {
            console.log("SENDING")
            p.send(m)
          }
        })
      }
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


  locatePeersThroughFriends(peer, knownPeers) {
    let ids = Object.keys(knownPeers)
    for (let i in ids) {
      let remotePeerId = ids[i]
      console.log("Considering peer", remotePeerId)
      if (!(remotePeerId in this.peers) && knownPeers[remotePeerId].connected && remotePeerId < this.SELF.id) {
        // fake a hello message
        console.log("Hello", remotePeerId)
        let msg = {action: "hello", session: ids[i], name: knownPeers[remotePeerId].name}
        // process the hello message to get the offer material
        this.peergroup.processSignal(msg, undefined, (offer) => {
          console.log("SEND OFFER", remotePeerId)
          // send the exact same offer through the system
          let offerMsg = { action: "offer", name: this.SELF.name, session:this.SELF.id, doc_id:this.doc_id, to:remotePeerId, body:offer}
          peer.send(offerMsg)
        })
      }
    }
  }

  broadcastKnownPeers() {
    this.peergroup.peers().forEach((peer) => {
      console.log("Broadcasting known peers to " + peer.id, Object.keys(this.peers))
      peer.send({knownPeers: this.peers })
    })
  }

  broadcastState(state, action) {
    let clock = Tesseract.getVClock(state)
    this.clocks[this.SELF.id] = clock
    if (action == "APPLY_DELTAS") {
      this.peergroup.peers().forEach((peer) => {
        peer.send({vectorClock: clock })
        this.peers[peer.id].messagesSent += 1
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
      this.peers[peer.id].messagesSent += 1
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
