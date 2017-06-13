import lz4 from 'lz4'
import EventEmitter from 'events'

export default class Peer extends EventEmitter {
  // XXX todo: cleanup passing args
  constructor(options, id, name, send_signal) {
    super()

    this.id           = id
    this.name         = name
    this.self         = (send_signal == undefined)
    this.send_signal  = send_signal

    // we're in electron/browser
    if (typeof window != 'undefined') {
      this.wrtc = {
        RTCPeerConnection: RTCPeerConnection,
        RTCIceCandidate: RTCIceCandidate,
        RTCSessionDescription: RTCSessionDescription
      }
    }
    // byowebrtc <- this is for node and could undoubtedly be better handled
    else if (options && options.wrtc) {
      this.wrtc = options.wrtc
    }
    
    this.WebRTCConfig = {
      'iceServers': [
        {url:'stun:stun.l.google.com:19302'},
        {url:'stun:stun1.l.google.com:19302'},
        {url:'stun:stun2.l.google.com:19302'},
        {url:'stun:stun3.l.google.com:19302'},
        {url:'stun:stun4.l.google.com:19302'}
      ]
    }

    // I'm not sure this should be here, but we call it literally
    // every time we instantiate a Peer(), so let's leave it here for now
    if(!me.self) peer.initializePeerConnection()
  }

  close() {
    try {
      this.webrtc.close()
    } catch (err) {
      // nope
    }
  }

  notice(desc) {
    return (event) => console.log("notice:" + this.id + ": " + desc, event)
  }

  initializePeerConnection() {
    var webrtc = new this.wrtc.RTCPeerConnection(this.WebRTCConfig)

    webrtc.onicecandidate = (event) => {
      if (event.candidate) {
        this.send_signal(event.candidate)
      }
    }

    webrtc.oniceconnectionstatechange = (event) => {
      if (webrtc.iceConnectionState == "disconnected") {
        this.emit('disconnect')
      }
      if (webrtc.iceConnectionState == "failed" || webrtc.iceConnectionState == "closed") {
        this.emit('closed')
        // XXX FIX THIS -> peergroup on('closed' should get these lines
        /* delete this.Peers[peer.id]
        if (this.Handshakes[peer.id]) {
          this.Handshakes[peer.id]()
        }*/
      }
    }

    webrtc.onconnecting   = () => this.notice("onconnecting")
    webrtc.onopen         = () => this.notice("onopen")
    webrtc.onaddstream    = () => this.notice("onaddstream")
    webrtc.onremovestream = () => this.notice("onremovestream")
    webrtc.ondatachannel  = (event) => {
      this.data_channel = event.channel
      this.data_channel.onmessage = (msg) => this.processMessage(msg)
      this.data_channel.onerror = e => this.notice("datachannel error",e)
      this.data_channel.onclose = () => this.notice("datachannel closed")
      this.data_channel.onopen = () => this.notice("datachannel opened")
      this.emit('connect')
    }

    this.webrtc = webrtc
  }

  establishDataChannel() {
    let data = this.webrtc.createDataChannel("datachannel",{protocol: "tcp"});
    data.onmessage = (msg) => this.processMessage(msg)
    data.onclose   = () => this.notice("data:onclose")
    data.onerror   = () => this.notice("data:error")
    data.onopen    = (event) => {
      this.data_channel = data
      this.emit('connect')
    }

    this.webrtc.createOffer(desc => {
      this.webrtc.setLocalDescription(desc,
        () => this.send_signal(desc),
        e  => console.log("error on setLocalDescription",e))
    }, e => console.log("error with createOffer",e));
  }

  handleSignal(signal) {
    if (signal.sdp) {
      // no callback for answers; but we make one if this is an offer
      var callback = () => { };
      if (signal.type == "offer") callback = () => {
        this.webrtc.createAnswer((answer) => {
          this.webrtc.setLocalDescription(
            answer,
            () => this.send_signal(answer),
            (e) => console.log("Error setting setLocalDescription",e)
          )
        }, 
        (e) => console.log("Error creating answer",e) );
      }
      this.webrtc.setRemoteDescription(
        new this.wrtc.RTCSessionDescription(signal), 
        callback, 
        (e) => console.log("Error setRemoteDescription",e))
    } else if (signal.candidate) {
      this.webrtc.addIceCandidate(new this.wrtc.RTCIceCandidate(signal));
    }
  }

  processMessage(msg) {
    var decompressed = lz4.decode(Buffer.from(msg.data, 'base64'));
    var data = decompressed.toString('utf8');

    let message = JSON.parse(data)
    this.emit('message',message)
  }

  send(message) {
    if (this.self) return; // dont send messages to ourselves
    if (!("data_channel" in this)) return; // dont send messages to disconnected peers

    var buffer = new Buffer(JSON.stringify(message), 'utf8')
    var compressed = lz4.encode(buffer);
    this.data_channel.send(compressed.toString('base64'))
  }
}
