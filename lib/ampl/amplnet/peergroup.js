'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _peer = require('./peer');

var _peer2 = _interopRequireDefault(_peer);

var _lz = require('lz4');

var _lz2 = _interopRequireDefault(_lz);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var PeerGroup = function (_EventEmitter) {
  _inherits(PeerGroup, _EventEmitter);

  function PeerGroup(options) {
    _classCallCheck(this, PeerGroup);

    // XXX cleanup this
    var _this = _possibleConstructorReturn(this, (PeerGroup.__proto__ || Object.getPrototypeOf(PeerGroup)).call(this));

    _this.options = options;

    _this.Signaler = undefined;
    _this.Peers = {};
    _this.Handshakes = {};
    _this.processSignal = _this.processSignal.bind(_this);
    return _this;
  }

  _createClass(PeerGroup, [{
    key: 'join',
    value: function join(signaler) {
      this.Signaler = signaler;
      signaler.on('hello', this.processSignal);
      signaler.on('offer', this.processSignal);
      signaler.on('reply', this.processSignal);
      signaler.on('error', function (message, e) {
        console.log("ERROR-MESSAGE", message);
        console.log("ERROR", e);
      });

      var me = new _peer2.default(this.options, signaler.session, signaler.name);
      this.Peers[me.id] = me;
      if (!me.self) this.initialize_peerconnection();
      this.emit("peer", me);

      signaler.on('connect', function () {
        me.emit('connect');
      });
      signaler.on('disconnect', function () {
        me.emit('disconnect');
      });
      signaler.start();
    }
  }, {
    key: 'close',
    value: function close() {
      if (this.Signaler) {
        this.Signaler.stop();
        this.Signaler = undefined;
        for (var id in this.Peers) {
          this.Peers[id].close();
        }
        this.Handshakes = {};
        this.removeAllListeners();
      }
    }

    // xxx and this

  }, {
    key: 'beginHandshake',
    value: function beginHandshake(id, name, handler) {
      delete this.Handshakes[id];
      var peer = new _peer2.default(this.options, id, name, handler);
      this.Peers[peer.id] = peer;
      if (!peer.self) this.initialize_peerconnection();
      this.emit("peer", peer);

      peer.establishDataChannel();
    }
  }, {
    key: 'processSignal',
    value: function processSignal(msg, signal, handler) {
      var _this2 = this;

      var id = msg.session;
      var name = msg.name;

      var callback = function callback() {};

      if (msg.action == "hello") {
        var begin = function begin() {
          _this2.beginHandshake(id, name, handler);
        };
        if (id in this.Peers) {
          this.Handshakes[id] = begin;
        } else {
          begin();
        }
        return;
      }

      var peer = void 0;
      if (this.Peers[id]) peer = this.Peers[id];else {
        peer = new _peer2.default(this.options, id, name, handler);
        this.Peers[id] = peer;
        if (!peer.self) peer.initialize_peerconnection();
        this.emit("peer", peer);
      }

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
        peer.webrtc.setRemoteDescription(new this.wrtc.RTCSessionDescription(signal), callback, function (e) {
          console.log("Error setRemoteDescription", e);
        });
      } else if (signal.candidate) {
        peer.webrtc.addIceCandidate(new this.wrtc.RTCIceCandidate(signal));
      }
    }
  }, {
    key: 'notice',
    value: function notice(peer, desc) {
      return function (event) {
        return console.log("notice:" + peer.id + ": " + desc, event);
      };
    }
  }]);

  return PeerGroup;
}(_events2.default);

exports.default = PeerGroup;