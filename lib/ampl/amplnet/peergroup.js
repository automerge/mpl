'use strict';

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var Peers = {};
var Handshakes = {};
var WebRTCConfig = {
  'iceServers': [{ url: 'stun:stun.l.google.com:19302' }, { url: 'stun:stun1.l.google.com:19302' }, { url: 'stun:stun2.l.google.com:19302' }, { url: 'stun:stun3.l.google.com:19302' }, { url: 'stun:stun4.l.google.com:19302' }]
};

var lz4 = require('lz4');

var notice = function notice(peer, desc) {
  return function (event) {
    return console.log("notice:" + peer.id + ": " + desc, event);
  };
};

function Peer(id, name, send_signal) {
  var _this = this;

  this.id = id;
  this.name = name;
  this.handlers = { connect: [], closed: [], disconnect: [], message: [] };
  this.self = send_signal == undefined;

  this.on = function (type, handler) {
    _this.handlers[type].push(handler);
  };

  this.dispatch = function (type, arg) {
    _this.handlers[type].forEach(function (h) {
      return h(arg);
    });
  };

  this.send_signal = send_signal;

  this.close = function () {
    try {
      _this.webrtc.close();
    } catch (err) {
      // nope
    }
  };

  this.send = function (message) {
    if (_this.self) return; // dont send messages to ourselves
    if (!("data_channel" in _this)) return; // dont send messages to disconnected peers
    console.log("---------------");
    console.log("---------------");
    console.log("SENDING MESSAGE");
    console.log("---------------");
    console.log("---------------");
    console.log(JSON.stringify(message));

    var buffer = new Buffer(JSON.stringify(message), 'utf8');
    var compressed = lz4.encode(buffer);
    _this.data_channel.send(compressed.toString('base64'));
  };

  Peers[this.id] = this;

  if (!this.self) {
    initialize_peerconnection(this);
  }

  dispatch("peer", this);
}

function initialize_peerconnection(peer) {
  var webrtc = new wrtc.RTCPeerConnection(WebRTCConfig);

  webrtc.onicecandidate = function (event) {
    if (event.candidate) {
      peer.send_signal(event.candidate);
    }
  };

  webrtc.oniceconnectionstatechange = function (event) {
    console.log("notice:statechange", peer.id, webrtc.iceConnectionState, event);
    if (webrtc.iceConnectionState == "disconnected") {
      peer.dispatch('disconnect');
    }
    if (webrtc.iceConnectionState == "failed" || webrtc.iceConnectionState == "closed") {
      delete Peers[peer.id];
      peer.dispatch('closed');
      if (Handshakes[peer.id]) {
        Handshakes[peer.id]();
      }
    }
  };

  webrtc.onconnecting = notice(peer, "onconnecting");
  webrtc.onopen = notice(peer, "onopen");
  webrtc.onaddstream = notice(peer, "onaddstream");
  webrtc.onremovestream = notice(peer, "onremovestream");
  webrtc.ondatachannel = function (event) {
    console.log("DATA CHANNEL!");
    peer.data_channel = event.channel;
    peer.data_channel.onmessage = function (msg) {
      return process_message(peer, msg);
    };
    peer.data_channel.onerror = function (e) {
      return notice(peer, "datachannel error", e);
    };
    peer.data_channel.onclose = function () {
      return notice(peer, "datachannel closed");
    };
    peer.data_channel.onopen = function () {
      return notice(peer, "datachannel opened");
    };
    peer.dispatch('connect');
  };
  peer.webrtc = webrtc;
}

function beginHandshake(id, name, handler) {
  delete Handshakes[id];
  var peer = new Peer(id, name, handler);

  console.log("DATA CHANNEL START");
  var data = peer.webrtc.createDataChannel("datachannel", { protocol: "tcp" });
  data.onmessage = function (msg) {
    return process_message(peer, msg);
  };
  data.onclose = notice(peer, "data:onclose");
  data.onerror = notice(peer, "data:error");
  data.onopen = function (event) {
    console.log("DATA CHANNEL OPEN!");
    peer.data_channel = data;
    peer.dispatch('connect');
  };
  peer.webrtc.createOffer(function (desc) {
    peer.webrtc.setLocalDescription(desc, function () {
      peer.send_signal(desc);
    }, function (e) {
      return console.log("error on setLocalDescription", e);
    });
  }, function (e) {
    return console.log("error with createOffer", e);
  });
}

function processSignal(msg, signal, handler) {
  var id = msg.session;
  var name = msg.name;

  var callback = function callback() {};

  if (msg.action == "hello") {
    var begin = function begin() {
      beginHandshake(id, name, handler);
    };
    if (id in Peers) {
      Handshakes[id] = begin;
    } else {
      begin();
    }
    return;
  }

  var peer = Peers[id] || new Peer(id, name, handler);

  if (signal.type == "offer") callback = function callback() {
    peer.webrtc.createAnswer(function (answer) {
      peer.webrtc.setLocalDescription(answer, function () {
        peer.send_signal(answer);
      }, function (e) {
        console.log("Error setting setLocalDescription", e);
      });
    }, function (e) {
      console.log("Error creating answer", e);
    });
  };
  if (signal.sdp) {
    peer.webrtc.setRemoteDescription(new wrtc.RTCSessionDescription(signal), callback, function (e) {
      console.log("Error setRemoteDescription", e);
    });
  } else if (signal.candidate) {
    peer.webrtc.addIceCandidate(new wrtc.RTCIceCandidate(signal));
  }
}

var Signaler = undefined;
var HANDLERS = { peer: [] };

function close() {
  console.log("STOP SIGNALER");
  if (Signaler) {
    Signaler.stop();
    Signaler = undefined;
    for (var id in Peers) {
      console.log("CLOSE PEER", id);
      Peers[id].close();
    }
    Handshakes = {};
    HANDLERS = { peer: [] };
  }
}

function join(signaler) {
  Signaler = signaler;
  signaler.on('hello', processSignal);
  signaler.on('offer', processSignal);
  signaler.on('reply', processSignal);
  signaler.on('error', function (message, e) {
    console.log("ERROR-MESSAGE", message);
    console.log("ERROR", e);
  });
  var me = new Peer(signaler.session, signaler.name);
  signaler.on('connect', function () {
    me.dispatch('connect');
  });
  signaler.on('disconnect', function () {
    me.dispatch('disconnect');
  });
  signaler.start();
}

function process_message(peer, msg) {
  console.log("---------------");
  console.log("---------------");
  console.log("RECEIVING MESSAGE");
  console.log("---------------");
  console.log("---------------");
  var decompressed = lz4.decode(Buffer.from(msg.data, 'base64'));
  var data = decompressed.toString('utf8');
  console.log("message size", data.length);
  console.log("INCOMING MSG", msg);

  var message = JSON.parse(data);
  peer.dispatch('message', message);
}

function dispatch() {
  var args = Array.from(arguments);
  var type = args.shift();
  HANDLERS[type].forEach(function (handler) {
    return handler.apply(undefined, _toConsumableArray(args));
  });
}

function onHandler(type, handler) {
  if (HANDLERS[type]) {
    HANDLERS[type].push(handler);
  }
}

var wrtc = void 0;
// we're in electron/browser
if (typeof window != 'undefined') {
  wrtc = {
    RTCPeerConnection: RTCPeerConnection,
    RTCIceCandidate: RTCIceCandidate,
    RTCSessionDescription: RTCSessionDescription
  };
}
// byowebrtc
else {
    wrtc = {
      RTCPeerConnection: undefined,
      RTCIceCandidate: undefined,
      RTCSessionDescription: undefined
    };
  }

function setWRTC(inWrtc) {
  console.log("SETTING WRTC");
  wrtc = inWrtc;
}

module.exports = {
  setWRTC: setWRTC,
  join: join,
  close: close,
  on: onHandler
};