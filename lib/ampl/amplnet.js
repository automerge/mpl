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
    _this.peergroup = new _peergroup2.default(options);
    _this.connected = false;
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

      this.peer_id = this.config.peerId;
      this.doc_id = this.config.docId;
      this.store = this.config.store;

      this.connected = true;

      if (this.doc_id) {
        if (process.env.SLACK_BOT_TOKEN) {
          this.signaler = _slackSignaler2.default.init({ doc_id: this.doc_id, name: this.name, bot_token: this.token, session: this.peer_id });
        } else {
          this.signaler = new _bonjourSignaler2.default({ doc_id: this.doc_id, name: this.name, session: this.peer_id });
        }

        this.peergroup.on('peer', function (peer, webrtc) {
          console.log("ON PEER", peer.id, peer.self);
          _this2.seqs[peer.id] = 0;
          if (peer.self == true) {
            _this2.SELF = peer;
          }
          _this2.peers[peer.id] = {
            connected: false,
            self: peer.self,
            name: peer.name,
            lastActivity: Date.now(),
            messagesSent: 0,
            messagesReceived: 0,
            webrtc: webrtc
          };
          _this2.emit('peer');

          peer.on('disconnect', function () {
            _this2.peers[peer.id].connected = false;
            _this2.broadcastKnownPeers();
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
            _this2.broadcastKnownPeers();
          });

          peer.on('message', function (m) {
            var store = _this2.store;

            _this2.routeSignal(peer, m);

            if (m.knownPeers) {
              //            this.peersOfPeers[peer.id] = m.knownPeers
              _this2.locatePeersThroughFriends(peer, m.knownPeers);
            }

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

        this.peergroup.join(this.signaler);
      } else {
        console.log("Network disabled");
        console.log("TRELLIS_DOC_ID:", this.doc_id);
      }
    }
  }, {
    key: 'routeSignal',
    value: function routeSignal(peer, m) {
      var _this3 = this;

      if (m.action) {
        if (m.to == this.SELF.id) {
          // its for me - process it
          this.peergroup.processSignal(m, m.body, function (reply) {
            if (m.action == "offer") {
              var replyMsg = {
                action: "reply",
                name: _this3.SELF.name,
                session: _this3.SELF.id,
                doc_id: _this3.doc_id,
                to: m.session,
                body: reply,
                webrtc: true
              };
              peer.send(replyMsg);
            }
          });
        } else {
          // its not for me - forward it on
          this.peergroup.peers().forEach(function (p) {
            if (p.id == m.to) {
              p.send(m);
            }
          });
        }
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
    key: 'locatePeersThroughFriends',
    value: function locatePeersThroughFriends(peer, knownPeers) {
      var _this4 = this;

      var ids = Object.keys(knownPeers);

      var _loop = function _loop(i) {
        var remotePeerId = ids[i];
        if (!(remotePeerId in _this4.peers) && knownPeers[remotePeerId].connected && remotePeerId < _this4.SELF.id) {
          // fake a hello message
          var msg = { action: "hello", session: ids[i], name: knownPeers[remotePeerId].name, webrtc: true
            // process the hello message to get the offer material
          };_this4.peergroup.processSignal(msg, undefined, function (offer) {
            // send the exact same offer through the system
            var offerMsg = { action: "offer", name: _this4.SELF.name, session: _this4.SELF.id, doc_id: _this4.doc_id, to: remotePeerId, body: offer, webrtc: true };
            peer.send(offerMsg);
          });
        }
      };

      for (var i in ids) {
        _loop(i);
      }
    }
  }, {
    key: 'broadcastKnownPeers',
    value: function broadcastKnownPeers() {
      var _this5 = this;

      this.peergroup.peers().forEach(function (peer) {
        console.log("Broadcasting known peers to " + peer.id, Object.keys(_this5.peers));
        peer.send({ knownPeers: _this5.peers });
      });
    }
  }, {
    key: 'broadcastState',
    value: function broadcastState(state, action) {
      var _this6 = this;

      var clock = _tesseract2.default.getVClock(state);
      this.clocks[this.SELF.id] = clock;
      if (action == "APPLY_DELTAS") {
        this.peergroup.peers().forEach(function (peer) {
          try {
            peer.send({ vectorClock: clock });
            _this6.peers[peer.id].messagesSent += 1;
          } catch (e) {
            console.log("Error sending to [" + peer.id + "]:", e);
          }
        });
      } else {
        this.peergroup.peers().forEach(function (peer) {
          _this6.updatePeer(peer, state, _this6.clocks[peer.id]);
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