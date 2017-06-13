import Peer from './peer'
import lz4  from 'lz4'
import EventEmitter from 'events'

let wrtc

// we're in electron/browser
if (typeof window != 'undefined') {
  wrtc = {
    RTCPeerConnection: RTCPeerConnection,
    RTCIceCandidate: RTCIceCandidate,
    RTCSessionDescription: RTCSessionDescription
  }
}
// byowebrtc
else {
  wrtc = {
    RTCPeerConnection: undefined,
    RTCIceCandidate: undefined,
    RTCSessionDescription: undefined
  }
}

export default class PeerGroup extends EventEmitter {
  constructor() {
    super()

    this.Signaler     = undefined
    this.Peers        = {}
    this.Handshakes   = {}
    this.WebRTCConfig = {
      'iceServers': [
        {url:'stun:stun.l.google.com:19302'},
        {url:'stun:stun1.l.google.com:19302'},
        {url:'stun:stun2.l.google.com:19302'},
        {url:'stun:stun3.l.google.com:19302'},
        {url:'stun:stun4.l.google.com:19302'}
      ]
    }

    this.processSignal = this.processSignal.bind(this)
  }

  setWRTC(inWrtc) {
    wrtc = inWrtc
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

    let me = new Peer(signaler.session, signaler.name)
    this.Peers[me.id] = me
    if(!me.self) this.initialize_peerconnection(me)
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

  process_message(peer, msg) {
    var decompressed = lz4.decode(Buffer.from(msg.data, 'base64'));
    var data = decompressed.toString('utf8');

    let message = JSON.parse(data)
    peer.emit('message',message)
  }

  initialize_peerconnection(peer) {
    var webrtc = new wrtc.RTCPeerConnection(this.WebRTCConfig)

    webrtc.onicecandidate = function(event) {
      if (event.candidate) {
        peer.send_signal(event.candidate)
      }
    }

    webrtc.oniceconnectionstatechange = function(event) {
      if (webrtc.iceConnectionState == "disconnected") {
        peer.emit('disconnect')
      }
      if (webrtc.iceConnectionState == "failed" || webrtc.iceConnectionState == "closed") {
        delete this.Peers[peer.id]
        peer.emit('closed')
        if (this.Handshakes[peer.id]) {
          this.Handshakes[peer.id]()
        }
      }
    }

    webrtc.onconnecting   = this.notice(peer,"onconnecting")
    webrtc.onopen         = this.notice(peer,"onopen")
    webrtc.onaddstream    = this.notice(peer,"onaddstream")
    webrtc.onremovestream = this.notice(peer,"onremovestream")
    webrtc.ondatachannel  = (event) => {
      peer.data_channel = event.channel
      peer.data_channel.onmessage = msg => this.process_message(peer, msg)
      peer.data_channel.onerror = e => this.notice(peer,"datachannel error",e)
      peer.data_channel.onclose = () => this.notice(peer,"datachannel closed")
      peer.data_channel.onopen = () => this.notice(peer,"datachannel opened")
      peer.emit('connect')
    }

    peer.webrtc = webrtc
  }

  beginHandshake(id, name, handler) {
    delete this.Handshakes[id]
    let peer = new Peer(id, name, handler)
    this.Peers[peer.id] = peer
    if(!peer.self) this.initialize_peerconnection(peer)
    this.emit("peer", peer)

    let data = peer.webrtc.createDataChannel("datachannel",{protocol: "tcp"});
    data.onmessage = msg => this.process_message(peer, msg)
    data.onclose   = this.notice(peer,"data:onclose")
    data.onerror   = this.notice(peer,"data:error")
    data.onopen    = (event) => {
      peer.data_channel = data
      peer.emit('connect')
    }
    peer.webrtc.createOffer(desc => {
      peer.webrtc.setLocalDescription(desc,
        () => {
            peer.send_signal(desc)
        },
        e  => console.log("error on setLocalDescription",e))
    }, e => console.log("error with createOffer",e));
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
      peer = new Peer(id, name, handler)
      this.Peers[id] = peer
      if(!peer.self) this.initialize_peerconnection(peer)
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
      peer.webrtc.setRemoteDescription(new wrtc.RTCSessionDescription(signal), callback, function(e) {
        console.log("Error setRemoteDescription",e)
      })
    } else if (signal.candidate) {
      peer.webrtc.addIceCandidate(new wrtc.RTCIceCandidate(signal));
    }
  }

  notice(peer,desc) {
    return (event) => console.log("notice:" + peer.id + ": " + desc, event)
  }
}
