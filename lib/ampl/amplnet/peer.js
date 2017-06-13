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
  function Peer(options, id, name, send_signal) {
    _classCallCheck(this, Peer);

    var _this = _possibleConstructorReturn(this, (Peer.__proto__ || Object.getPrototypeOf(Peer)).call(this));

    _this.id = id;
    _this.name = name;
    _this.self = send_signal == undefined;
    _this.send_signal = send_signal;

    // we're in electron/browser
    if (typeof window != 'undefined') {
      _this.wrtc = {
        RTCPeerConnection: RTCPeerConnection,
        RTCIceCandidate: RTCIceCandidate,
        RTCSessionDescription: RTCSessionDescription
      };
    }
    // byowebrtc
    else if (options && options.wrtc) {
        _this.wrtc = options.wrtc;
      }

    _this.WebRTCConfig = {
      'iceServers': [{ url: 'stun:stun.l.google.com:19302' }, { url: 'stun:stun1.l.google.com:19302' }, { url: 'stun:stun2.l.google.com:19302' }, { url: 'stun:stun3.l.google.com:19302' }, { url: 'stun:stun4.l.google.com:19302' }]
    };

    return _this;
  }

  _createClass(Peer, [{
    key: 'close',
    value: function close() {
      try {
        this.webrtc.close();
      } catch (err) {
        // nope
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
    key: 'establishDataChannel',
    value: function establishDataChannel() {
      var _this3 = this;

      var data = this.webrtc.createDataChannel("datachannel", { protocol: "tcp" });
      data.onmessage = this.process_message.bind(this);
      data.onclose = this.notice("data:onclose");
      data.onerror = this.notice("data:error");
      data.onopen = function (event) {
        _this3.data_channel = data;
        _this3.emit('connect');
      };

      this.webrtc.createOffer(function (desc) {
        _this3.webrtc.setLocalDescription(desc, function () {
          _this3.send_signal(desc);
        }, function (e) {
          return console.log("error on setLocalDescription", e);
        });
      }, function (e) {
        return console.log("error with createOffer", e);
      });
    }
  }, {
    key: 'initialize_peerconnection',
    value: function initialize_peerconnection() {
      var _this4 = this;

      var webrtc = new this.wrtc.RTCPeerConnection(this.WebRTCConfig);

      webrtc.onicecandidate = function (event) {
        if (event.candidate) {
          this.send_signal(event.candidate);
        }
      };

      webrtc.oniceconnectionstatechange = function (event) {
        if (webrtc.iceConnectionState == "disconnected") {
          this.emit('disconnect');
        }
        if (webrtc.iceConnectionState == "failed" || webrtc.iceConnectionState == "closed") {
          this.emit('closed'
          // XXX FIX THIS -> peergroup on('closed' should get these lines
          /* delete this.Peers[peer.id]
          if (this.Handshakes[peer.id]) {
            this.Handshakes[peer.id]()
          }*/
          );
        }
      };

      webrtc.onconnecting = this.notice("onconnecting");
      webrtc.onopen = this.notice("onopen");
      webrtc.onaddstream = this.notice("onaddstream");
      webrtc.onremovestream = this.notice("onremovestream");
      webrtc.ondatachannel = function (event) {
        _this4.data_channel = event.channel;
        _this4.data_channel.onmessage = _this4.process_message.bind(_this4);
        _this4.data_channel.onerror = function (e) {
          return _this4.notice("datachannel error", e);
        };
        _this4.data_channel.onclose = function () {
          return _this4.notice("datachannel closed");
        };
        _this4.data_channel.onopen = function () {
          return _this4.notice("datachannel opened");
        };
        _this4.emit('connect');
      };

      this.webrtc = webrtc;
    }
  }, {
    key: 'process_message',
    value: function process_message(msg) {
      var decompressed = _lz2.default.decode(Buffer.from(msg.data, 'base64'));
      var data = decompressed.toString('utf8');

      var message = JSON.parse(data);
      this.emit('message', message);
    }
  }, {
    key: 'send',
    value: function send(message) {
      if (this.self) return; // dont send messages to ourselves
      if (!("data_channel" in this)) return; // dont send messages to disconnected peers

      var buffer = new Buffer(JSON.stringify(message), 'utf8');
      var compressed = _lz2.default.encode(buffer);
      this.data_channel.send(compressed.toString('base64'));
    }
  }]);

  return Peer;
}(_events2.default);

exports.default = Peer;