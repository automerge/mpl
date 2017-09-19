'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lz = require('lz4');

var _lz2 = _interopRequireDefault(_lz);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Peer = function (_EventEmitter) {
  _inherits(Peer, _EventEmitter);

  // XXX todo: cleanup passing args
  function Peer(id, name, send_signal, wrtc) {
    _classCallCheck(this, Peer);

    var _this = _possibleConstructorReturn(this, (Peer.__proto__ || Object.getPrototypeOf(Peer)).call(this));

    _this.id = id;
    _this.name = name;
    _this.self = send_signal == undefined;
    _this.send_signal = send_signal;
    _this.queue = [];

    _this.on('connect', function () {
      if (_this.connected()) {
        while (_this.queue.length > 0) {
          _this.send(_this.queue.shift());
        }
      }
    });

    // we're in electron/browser
    if (typeof window != 'undefined') {
      _this.wrtc = {
        RTCPeerConnection: RTCPeerConnection,
        RTCIceCandidate: RTCIceCandidate,
        RTCSessionDescription: RTCSessionDescription
      };
    }
    // byowebrtc <- this is for node and could undoubtedly be better handled
    else if (wrtc) {
        _this.wrtc = wrtc;
      } else {
        console.log("wrtc", wrtc);
        throw new Error("wrtc needs to be set in headless mode");
      }

    _this.WebRTCConfig = {
      'iceServers': [{ url: 'stun:stun.l.google.com:19302' }, { url: 'stun:stun1.l.google.com:19302' }, { url: 'stun:stun2.l.google.com:19302' }, { url: 'stun:stun3.l.google.com:19302' }, { url: 'stun:stun4.l.google.com:19302' }]

      // I'm not sure this should be here, but we call it literally
      // every time we instantiate a Peer(), so let's leave it here for now
    };if (!_this.self) _this.initializePeerConnection();
    return _this;
  }

  _createClass(Peer, [{
    key: 'close',
    value: function close() {
      try {
        if (this.webrtc) {
          this.webrtc.close();
        }
      } catch (err) {
        console.log("WebRTCPeerConnection threw an error during close().", err);
      }
    }
  }, {
    key: 'notice',
    value: function notice(desc) {
      var _this2 = this;

      return function (event) {
        return console.log("notice:" + _this2.id + ": " + desc, event);
      };
    }
  }, {
    key: 'initializePeerConnection',
    value: function initializePeerConnection() {
      var _this3 = this;

      var webrtc = new this.wrtc.RTCPeerConnection(this.WebRTCConfig);

      webrtc.onicecandidate = function (event) {
        if (event.candidate) {
          _this3.send_signal(event.candidate);
        }
      };

      webrtc.oniceconnectionstatechange = function (event) {
        if (webrtc.iceConnectionState == "disconnected") {
          _this3.emit('disconnect');
        }
        if (webrtc.iceConnectionState == "failed" || webrtc.iceConnectionState == "closed") {
          _this3.emit('closed');
        }
      };

      webrtc.onconnecting = function () {
        return _this3.notice("onconnecting");
      };
      webrtc.onopen = function () {
        return _this3.notice("onopen");
      };
      webrtc.onaddstream = function () {
        return _this3.notice("onaddstream");
      };
      webrtc.onremovestream = function () {
        return _this3.notice("onremovestream");
      };
      webrtc.ondatachannel = function (event) {
        _this3.data_channel = event.channel;
        _this3.data_channel.onmessage = function (msg) {
          return _this3.processMessage(msg);
        };
        _this3.data_channel.onerror = function (e) {
          return _this3.notice("datachannel error", e);
        };
        _this3.data_channel.onclose = function () {
          return _this3.notice("datachannel closed");
        };
        _this3.data_channel.onopen = function () {
          _this3.notice("datachannel opened");
          _this3.emit('connect');
        };
      };

      this.webrtc = webrtc;
    }
  }, {
    key: 'establishDataChannel',
    value: function establishDataChannel() {
      var _this4 = this;

      var data = this.webrtc.createDataChannel("datachannel", { protocol: "tcp" });
      data.onmessage = function (msg) {
        return _this4.processMessage(msg);
      };
      data.onclose = function () {
        return _this4.notice("data:onclose");
      };
      data.onerror = function () {
        return _this4.notice("data:error");
      };
      data.onopen = function (event) {
        _this4.data_channel = data;
        console.log("Created a data channel and it opened.");
        _this4.emit('connect');
      };

      this.webrtc.createOffer(function (desc) {
        _this4.webrtc.setLocalDescription(desc, function () {
          return _this4.send_signal(desc);
        }, function (e) {
          return console.log("error on setLocalDescription", e);
        });
      }, function (e) {
        return console.log("error with createOffer", e);
      });
    }
  }, {
    key: 'connected',
    value: function connected() {
      return this.data_channel && this.data_channel.readyState == 'open';
    }
  }, {
    key: 'handleSignal',
    value: function handleSignal(signal) {
      var _this5 = this;

      if (signal.sdp) {
        // no callback for answers; but we make one if this is an offer
        var callback = function callback() {};
        if (signal.type == "offer") callback = function callback() {
          _this5.webrtc.createAnswer(function (answer) {
            _this5.webrtc.setLocalDescription(answer, function () {
              return _this5.send_signal(answer);
            }, function (e) {
              return console.log("Error setting setLocalDescription", e);
            });
          }, function (e) {
            return console.log("Error creating answer", e);
          });
        };
        this.webrtc.setRemoteDescription(new this.wrtc.RTCSessionDescription(signal), callback, function (e) {
          return console.log("Error setRemoteDescription", e);
        });
      } else if (signal.candidate) {
        this.webrtc.addIceCandidate(new this.wrtc.RTCIceCandidate(signal));
      }
    }
  }, {
    key: 'processMessage',
    value: function processMessage(msg) {
      var decompressed = _lz2.default.decode(Buffer.from(msg.data, 'base64'));
      var data = decompressed.toString('utf8');

      var message = JSON.parse(data);
      this.emit('message', message);
    }
  }, {
    key: 'send',
    value: function send(message) {
      if (this.self) return; // dont send messages to ourselves
      if (!this.connected()) {
        // don't send to unconnected partners.
        this.queue.push(message);
        return;
      }

      var buffer = new Buffer(JSON.stringify(message), 'utf8');
      var compressed = _lz2.default.encode(buffer);
      this.data_channel.send(compressed.toString('base64'));
      this.emit('sent', message);
    }
  }]);

  return Peer;
}(_events2.default);

exports.default = Peer;