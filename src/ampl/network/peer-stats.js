import EventEmitter from 'events'

export default class PeerStats extends EventEmitter {
  constructor(peergroup) {
    super()
    this.peergroup = peergroup
    this.peerStats  = {}
    this.peergroup.on('peer', (peer) => {
      console.log("ON PEER",peer.id,peer.self)

      this.peerStats[peer.id] = {
        connected: peer.self,
        self: peer.self,
        name: peer.name,
        lastActivity: Date.now(),
        messagesSent: 0,
        messagesReceived: 0
      }

      this.emit('peer')

      peer.on('disconnect', () => {
        this.peerStats[peer.id].connected = peer.self 
        this.emit('peer')
      })

      peer.on('closed', () => {
        delete this.peerStats[peer.id]
        this.emit('peer')
      })

      peer.on('connect', () => {
        this.peerStats[peer.id].connected = true
        this.peerStats[peer.id].lastActivity = Date.now()
        this.emit('peer')
      })

      peer.on('rename', (name) => { // this is only used for self
        this.peerStats[peer.id].name = name
        this.emit('peer')
      })

      peer.on('message', (m) => {
        if (m.name) { // this comes in off the network
          this.peerStats[peer.id].name = m.name
        }
        if (m.docId) {
          this.peerStats[peer.id].docId = m.docId
        }
        if (m.docTitle) {
          this.peerStats[peer.id].docTitle = m.docTitle
        }

        this.peerStats[peer.id].lastActivity = Date.now()
        this.peerStats[peer.id].messagesReceived += 1
        this.emit('peer')
      })

      peer.on('sent', (m) => {
        this.peerStats[peer.id].messagesSent += 1
        this.emit('peer')
      })
    })
  }

  getStats() {
    return this.peerStats
  }
}
