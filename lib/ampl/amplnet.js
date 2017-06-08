'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _slackSignaler = require('./amplnet/slack-signaler');

var _slackSignaler2 = _interopRequireDefault(_slackSignaler);

var _bonjourSignaler = require('./amplnet/bonjour-signaler');

var _bonjourSignaler2 = _interopRequireDefault(_bonjourSignaler);

var _peergroup = require('./amplnet/peergroup');

var _peergroup2 = _interopRequireDefault(_peergroup);

var _tesseract = require('tesseract');

var _tesseract2 = _interopRequireDefault(_tesseract);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var aMPLNet = function (_EventEmitter) {
  _inherits(aMPLNet, _EventEmitter);

  function aMPLNet(options) {
    _classCallCheck(this, aMPLNet);

    var _this = _possibleConstructorReturn(this, (aMPLNet.__proto__ || Object.getPrototypeOf(aMPLNet)).call(this));

    _this.token = _config2.default.slackBotToken || process.env.SLACK_BOT_TOKEN;
    _this.name = _config2.default.name || process.env.NAME;
    _this.peergroup = new _peergroup2.default();
    _this.connected = false;

    if (options) {
      if (options.wrtc) {
        _this.peergroup.setWRTC(options.wrtc);
      }
    }

    return _this;
  }

  _createClass(aMPLNet, [{
    key: 'connect',
    value: function connect(config) {
      var _this2 = this;

      if (this.connected) throw "network already connected - disconnect first";
      this.config = config || this.config;
      this.peers = {};
      this.clocks = {};
      this.seqs = {};
      this.PEERS = [];

      this.peer_id = this.config.peerId;
      this.doc_id = this.config.docId;
      this.store = this.config.store;

      this.connected = true;

      if (this.doc_id) {
        var bot = void 0;
        if (process.env.SLACK_BOT_TOKEN) {
          bot = _slackSignaler2.default.init({ doc_id: this.doc_id, name: this.name, bot_token: this.token, session: this.peer_id });
        } else {
          bot = _bonjourSignaler2.default.init({ doc_id: this.doc_id, name: this.name, session: this.peer_id });
        }

        this.peergroup.on('peer', function (peer) {
          _this2.PEERS.push(peer);
          _this2.seqs[peer.id] = 0;
          if (peer.self == true) {
            _this2.SELF = peer;
          }
          _this2.peers[peer.id] = {
            connected: false,
            name: peer.name,
            lastActivity: Date.now(),
            messagesSent: 0,
            messagesReceived: 0
          };
          _this2.emit('peer');

          peer.on('disconnect', function () {
            _this2.PEERS.splice(_this2.PEERS.indexOf(peer));
            _this2.peers[peer.id].connected = false;
            _this2.emit('peer');
          });

          peer.on('closed', function () {
            delete _this2.peers[peer.id];
            _this2.emit('peer');
          });

          peer.on('connect', function () {
            _this2.peers[peer.id].connected = true;
            _this2.peers[peer.id].lastActivity = Date.now();
            _this2.peers[peer.id].messagesSent += 1;
            _this2.emit('peer');
            if (peer.self == false) {
              peer.send({ vectorClock: _tesseract2.default.getVClock(_this2.store.getState()), seq: 0 });
            }
          });

          peer.on('message', function (m) {
            var store = _this2.store;

            if (m.deltas && m.deltas.length > 0) {
              _this2.store.dispatch({
                type: "APPLY_DELTAS",
                deltas: m.deltas
              });
            }

            if (m.vectorClock && (m.deltas || m.seq == _this2.seqs[peer.id])) {
              // ignore acks for all but the last send
              _this2.updatePeer(peer, _this2.store.getState(), m.vectorClock);
            }
            _this2.peers[peer.id].lastActivity = Date.now();
            _this2.peers[peer.id].messagesReceived += 1;
            _this2.emit('peer');
          });
        });

        this.peergroup.join(bot);
      } else {
        console.log("Network disabled");
        console.log("TRELLIS_DOC_ID:", this.doc_id);
      }
    }
  }, {
    key: 'clockMax',
    value: function clockMax(clock1, clock2) {
      var maxclock = {};
      var keys = Object.keys(clock1).concat(Object.keys(clock2));

      for (var i in keys) {
        var key = keys[i];
        maxclock[key] = Math.max(clock1[key] || 0, clock2[key] || 0);
      }

      return maxclock;
    }
  }, {
    key: 'broadcast',
    value: function broadcast(state, action) {
      var _this3 = this;

      var clock = _tesseract2.default.getVClock(state);
      this.clocks[this.SELF.id] = clock;
      if (action == "APPLY_DELTAS") {
        this.PEERS.forEach(function (peer) {
          peer.send({ vectorClock: clock });
          _this3.peers[peer.id].messagesSent += 1;
        });
      } else {
        this.PEERS.forEach(function (peer) {
          _this3.updatePeer(peer, state, _this3.clocks[peer.id]);
        });
      }
      this.emit('peer');
    }
  }, {
    key: 'updatePeer',
    value: function updatePeer(peer, state, clock) {
      if (peer == undefined) return;
      if (clock == undefined) return;
      var myClock = _tesseract2.default.getVClock(state);
      this.clocks[peer.id] = this.clockMax(myClock, clock);
      this.seqs[peer.id] += 1;
      var deltas = _tesseract2.default.getDeltasAfter(state, clock);
      if (deltas.length > 0) {
        peer.send({ deltas: deltas, seq: this.seqs[peer.id], vectorClock: myClock });
        this.peers[peer.id].messagesSent += 1;
      }
    }
  }, {
    key: 'disconnect',
    value: function disconnect() {
      if (this.connected == false) throw "network already disconnected - connect first";
      console.log("NETWORK DISCONNECT");
      delete this.store;
      this.peergroup.close();
      this.connected = false;
      this.emit('peer');
    }
  }]);

  return aMPLNet;
}(_events2.default);

exports.default = aMPLNet;