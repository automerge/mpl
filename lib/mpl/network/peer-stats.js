'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var PeerStats = function (_EventEmitter) {
  _inherits(PeerStats, _EventEmitter);

  function PeerStats(peergroup) {
    _classCallCheck(this, PeerStats);

    var _this = _possibleConstructorReturn(this, (PeerStats.__proto__ || Object.getPrototypeOf(PeerStats)).call(this));

    _this.peergroup = peergroup;
    _this.peerStats = {};
    _this.peergroup.on('peer', function (peer) {
      console.log("ON PEER", peer.id, peer.self);

      _this.peerStats[peer.id] = {
        connected: peer.self,
        self: peer.self,
        name: peer.name,
        lastActivity: Date.now(),
        messagesSent: 0,
        messagesReceived: 0
      };

      _this.emit('peer');

      peer.on('disconnect', function () {
        _this.peerStats[peer.id].connected = peer.self;
        _this.emit('peer');
      });

      peer.on('closed', function () {
        delete _this.peerStats[peer.id];
        _this.emit('peer');
      });

      peer.on('connect', function () {
        _this.peerStats[peer.id].connected = true;
        _this.peerStats[peer.id].lastActivity = Date.now();
        _this.emit('peer');
      });

      peer.on('rename', function (name) {
        // this is only used for self
        _this.peerStats[peer.id].name = name;
        _this.emit('peer');
      });

      peer.on('message', function (m) {
        if (m.name) {
          // this comes in off the network
          _this.peerStats[peer.id].name = m.name;
        }
        if (m.docId) {
          _this.peerStats[peer.id].docId = m.docId;
        }
        if (m.docTitle) {
          _this.peerStats[peer.id].docTitle = m.docTitle;
        }

        _this.peerStats[peer.id].lastActivity = Date.now();
        _this.peerStats[peer.id].messagesReceived += 1;
        _this.emit('peer');
      });

      peer.on('sent', function (m) {
        _this.peerStats[peer.id].messagesSent += 1;
        _this.emit('peer');
      });
    });
    return _this;
  }

  _createClass(PeerStats, [{
    key: 'getStats',
    value: function getStats() {
      return this.peerStats;
    }
  }]);

  return PeerStats;
}(_events2.default);

exports.default = PeerStats;