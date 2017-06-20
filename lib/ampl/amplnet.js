'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _bonjourSignaler = require('./amplnet/bonjour-signaler');

var _bonjourSignaler2 = _interopRequireDefault(_bonjourSignaler);

var _webrtcSignaler = require('./amplnet/webrtc-signaler');

var _webrtcSignaler2 = _interopRequireDefault(_webrtcSignaler);

var _peergroup = require('./amplnet/peergroup');

var _peergroup2 = _interopRequireDefault(_peergroup);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } // this has a different and also crazy interface

var aMPLNet = function (_EventEmitter) {
  _inherits(aMPLNet, _EventEmitter);

  function aMPLNet(options) {
    _classCallCheck(this, aMPLNet);

    // xxx NO REALLY, FIX ME.
    var _this = _possibleConstructorReturn(this, (aMPLNet.__proto__ || Object.getPrototypeOf(aMPLNet)).call(this));

    _this.options = options;
    _this.name = _config2.default.name || process.env.NAME;
    _this.connected = false;
    return _this;
  }

  _createClass(aMPLNet, [{
    key: 'connect',
    value: function connect(config) {
      var _this2 = this;

      if (this.connected) throw "network already connected - disconnect first";
      this.config = config || this.config;

      this.peergroup = new _peergroup2.default(this.name, this.config.peerId, this.options);

      this.peerStats = {};

      this.connected = true;

      this.signaler = new _bonjourSignaler2.default(this.peergroup, { name: this.name, session: this.config.peerId });
      this.webRTCSignaler = new _webrtcSignaler2.default(this.peergroup);

      this.peergroup.on('peer', function (peer) {
        console.log("ON PEER", peer.id, peer.self);

        _this2.peerStats[peer.id] = {
          connected: false,
          self: peer.self,
          name: peer.name,
          lastActivity: Date.now(),
          messagesSent: 0,
          messagesReceived: 0
        };
        _this2.emit('peer');

        peer.on('disconnect', function () {
          _this2.peerStats[peer.id].connected = false;
          _this2.emit('peer');
        });

        peer.on('closed', function () {
          delete _this2.peerStats[peer.id];
          _this2.emit('peer');
        });

        peer.on('connect', function () {
          _this2.peerStats[peer.id].connected = true;
          _this2.peerStats[peer.id].lastActivity = Date.now();
          _this2.emit('peer');
        });

        peer.on('message', function (m) {
          _this2.peerStats[peer.id].lastActivity = Date.now();
          _this2.peerStats[peer.id].messagesReceived += 1;
          _this2.emit('peer');
        });

        peer.on('sent', function (m) {
          _this2.peerStats[peer.id].messagesSent += 1;
          _this2.emit('peer');
        });
      }

      // we define "connect" and "disconnect" for ourselves as whether
      // we're connected to the signaller.
      );this.signaler.on('connect', function () {
        _this2.peergroup.self().emit('connect');
      });
      this.signaler.on('disconnect', function () {
        _this2.peergroup.self().emit('disconnect');
      });

      this.peergroup.join();
      this.signaler.start();
    }
  }, {
    key: 'disconnect',
    value: function disconnect() {
      if (this.connected == false) throw "network already disconnected - connect first";
      console.log("NETWORK DISCONNECT");
      this.peergroup.close();
      this.connected = false;
      this.emit('peer');
    }
  }]);

  return aMPLNet;
}(_events2.default);

exports.default = aMPLNet;