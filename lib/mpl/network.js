'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _bonjourSignaler = require('./network/bonjour-signaler');

var _bonjourSignaler2 = _interopRequireDefault(_bonjourSignaler);

var _webrtcSignaler = require('./network/webrtc-signaler');

var _webrtcSignaler2 = _interopRequireDefault(_webrtcSignaler);

var _peerStats = require('./network/peer-stats');

var _peerStats2 = _interopRequireDefault(_peerStats);

var _peergroup = require('./network/peergroup');

var _peergroup2 = _interopRequireDefault(_peergroup);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Network = function (_EventEmitter) {
  _inherits(Network, _EventEmitter);

  function Network(docSet, wrtc) {
    _classCallCheck(this, Network);

    var _this = _possibleConstructorReturn(this, (Network.__proto__ || Object.getPrototypeOf(Network)).call(this));

    _this.peergroup = new _peergroup2.default(docSet, wrtc);

    _this.signaler = new _bonjourSignaler2.default(_this.peergroup);
    _this.webRTCSignaler = new _webrtcSignaler2.default(_this.peergroup);
    _this.peerStats = new _peerStats2.default(_this.peergroup);

    _this.connected = false;
    return _this;
  }

  _createClass(Network, [{
    key: 'connect',
    value: function connect(config) {
      var _this2 = this;

      if (this.connected) throw "network already connected - disconnect first";

      // allow connect without a config to use the previous connect's config.
      this.config = config || this.config;

      // we define "connect" and "disconnect" for ourselves as whether
      // we're connected to the signaller.
      this.signaler.on('connect', function () {
        _this2.peergroup.self().emit('connect');
      });
      this.signaler.on('disconnect', function () {
        _this2.peergroup.self().emit('disconnect');
      });

      var name = this.config.name || process.env.NAME;
      var peerId = this.config.peerId;
      if (!peerId) throw new Error("peerId required, not found in config");
      this.peergroup.join(peerId, name);

      this.signaler.start();
      this.connected = true;
    }
  }, {
    key: 'broadcastActiveDocId',
    value: function broadcastActiveDocId(docId) {
      this.webRTCSignaler.broadcastActiveDocId(docId);
    }
  }, {
    key: 'getPeerDocs',
    value: function getPeerDocs() {
      return this.webRTCSignaler.getPeerDocs();
    }
  }, {
    key: 'disconnect',
    value: function disconnect() {
      if (this.connected == false) throw "network already disconnected - connect first";
      console.log("NETWORK DISCONNECT");
      this.signaler.stop();
      this.peergroup.close();
      this.connected = false;
    }
  }]);

  return Network;
}(_events2.default);

exports.default = Network;