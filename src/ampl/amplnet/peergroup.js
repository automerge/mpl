import Peer from './peer'
import lz4  from 'lz4'
import EventEmitter from 'events'

export default class PeerGroup extends EventEmitter {
  constructor(options) {
    super()

    // XXX cleanup this
    this.options = options;

    this.Signaler     = undefined
    this.Peers        = {}
    this.Handshakes   = {}
    this.processSignal = this.processSignal.bind(this)
  }

  join(signaler) {
    this.Signaler = signaler
    signaler.on('hello', this.processSignal)
    signaler.on('offer', this.processSignal)
    signaler.on('reply', this.processSignal)
    signaler.on('error', (message,e) => {
      console.log("ERROR-MESSAGE",message)
      console.log("ERROR",e)
    })

    let me = new Peer(this.options, signaler.session, signaler.name)
    this.Peers[me.id] = me
    if(!me.self) this.initialize_peerconnection()
    this.emit("peer", me)

    signaler.on('connect', () => {
      me.emit('connect')
    })
    signaler.on('disconnect', () => {
      me.emit('disconnect')
    })
    signaler.start()
  }

  close() {
    if(this.Signaler) {
      this.Signaler.stop()
      this.Signaler = undefined
      for (let id in this.Peers) {
        this.Peers[id].close()
      }
      this.Handshakes = {}
      this.removeAllListeners()
    }
  }

  // xxx and this
  beginHandshake(id, name, handler) {
    delete this.Handshakes[id]
    let peer = new Peer(this.options, id, name, handler)
    this.Peers[peer.id] = peer
    if(!peer.self) this.initialize_peerconnection()
    this.emit("peer", peer)

    peer.establishDataChannel();
  }

  processSignal(msg, signal, handler) {
    let id = msg.session
    let name = msg.name

    var callback = function() { };

    if (msg.action == "hello") {
      let begin = () => { this.beginHandshake(id,name,handler) }
      if (id in this.Peers) {
        this.Handshakes[id] = begin
      } else {
        begin()
      }
      return;
    }

    let peer
    if(this.Peers[id])
      peer = this.Peers[id]
    else {
      peer = new Peer(this.options, id, name, handler)
      this.Peers[id] = peer
      if(!peer.self) peer.initialize_peerconnection()
      this.emit("peer", peer)
    }

    if (signal.type == "offer") callback = function() {
      peer.webrtc.createAnswer(function(answer) {
        peer.webrtc.setLocalDescription(answer,function() {
          peer.send_signal(answer)
        },function(e) {
          console.log("Error setting setLocalDescription",e)
        })
      }, function(e) {
        console.log("Error creating answer",e)
      });
    }
    if (signal.sdp) {
      peer.webrtc.setRemoteDescription(new this.wrtc.RTCSessionDescription(signal), callback, function(e) {
        console.log("Error setRemoteDescription",e)
      })
    } else if (signal.candidate) {
      peer.webrtc.addIceCandidate(new this.wrtc.RTCIceCandidate(signal));
    }
  }

  notice(peer,desc) {
    return (event) => console.log("notice:" + peer.id + ": " + desc, event)
  }
}
