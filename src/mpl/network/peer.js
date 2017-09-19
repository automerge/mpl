import lz4 from 'lz4'
import sodium from 'libsodium-wrappers'
import EventEmitter from 'events'
import config from '../config'

export default class Peer extends EventEmitter {
  // XXX todo: cleanup passing args
  constructor(id, name, send_signal, wrtc) {
    super()

    this.id           = id
    this.name         = name
    this.self         = (send_signal == undefined)
    this.send_signal  = send_signal
    this.queue        = []

    this.on('connect', () => {
      if (this.connected()) {
        while (this.queue.length > 0) {
          this.send(this.queue.shift())
        }
      }
    })

    // we're in electron/browser
    if (typeof window != 'undefined') {
      this.wrtc = {
        RTCPeerConnection: RTCPeerConnection,
        RTCIceCandidate: RTCIceCandidate,
        RTCSessionDescription: RTCSessionDescription
      }
    }
    // byowebrtc <- this is for node and could undoubtedly be better handled
    else if (wrtc) {
      this.wrtc = wrtc
    }
    else {
      console.log("wrtc", wrtc)
      throw new Error("wrtc needs to be set in headless mode")
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
    if(!this.self) this.initializePeerConnection()
  }

  close() {
    try {
      if (this.webrtc) {
        this.webrtc.close()
      }
    } catch (err) {
      console.log("WebRTCPeerConnection threw an error during close().", err)
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
      this.data_channel.onopen = () => { 
        this.notice("datachannel opened")
        this.emit('connect')
      }
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
      console.log("Created a data channel and it opened.")
      this.emit('connect')
    }

    this.webrtc.createOffer(desc => {
      this.webrtc.setLocalDescription(desc,
        () => this.send_signal(desc),
        e  => console.log("error on setLocalDescription",e))
    }, e => console.log("error with createOffer",e));
  }

  connected() {
    return this.data_channel && this.data_channel.readyState == 'open'
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
    if (!config.encryptionKey) throw 'Please configure an encryption key'
    var encrypted = Buffer.from(msg.data, 'base64');
    var decrypted = Buffer.from(sodium.crypto_secretbox_open_easy(
      encrypted.slice(sodium.crypto_box_NONCEBYTES),
      encrypted.slice(0, sodium.crypto_box_NONCEBYTES),
      Buffer.from(config.encryptionKey, 'hex'), 'uint8array'));
    var data = lz4.decode(decrypted).toString('utf8');

    let message = JSON.parse(data)
    this.emit('message',message)
  }

  send(message) {
    if (this.self) return; // dont send messages to ourselves
    if (!this.connected()) { // don't send to unconnected partners.
      this.queue.push(message)
      return
    }

    var buffer = new Buffer(JSON.stringify(message), 'utf8')
    var compressed = lz4.encode(buffer);

    if (!config.encryptionKey) throw 'Please configure an encryption key'
    var secret = Buffer.from(config.encryptionKey, 'hex');
    var nonce = Buffer.from(sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES));
    var encrypted = Buffer.concat([nonce, Buffer.from(sodium.crypto_secretbox_easy(compressed, nonce, secret))]);

    this.data_channel.send(encrypted.toString('base64'))
    this.emit('sent', message)
  }
}
