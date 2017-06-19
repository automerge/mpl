'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); // this has a different and also crazy interface

var _bonjourSignaler = require('./amplnet/bonjour-signaler');

var _bonjourSignaler2 = _interopRequireDefault(_bonjourSignaler);

var _webrtcSignaler = require('./amplnet/webrtc-signaler');

var _webrtcSignaler2 = _interopRequireDefault(_webrtcSignaler);

var _peergroup = require('./amplnet/peergroup');

var _peergroup2 = _interopRequireDefault(_peergroup);

var _tesseract = require('tesseract');

var _tesseract2 = _interopRequireDefault(_tesseract);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DeltaRouter = function () {
  function DeltaRouter(peergroup, store) {
    var _this = this;

    _classCallCheck(this, DeltaRouter);

    this.peergroup = peergroup;
    this.store = store;

    this.clocks = {};
    this.seqs = {};

    this.peergroup.on('peer', function (peer) {
      _this.seqs[peer.id] = 0;

      peer.on('connect', function () {
        if (peer.self == false) {
          peer.send({ docId: _this.store.getState().docId, vectorClock: _tesseract2.default.getVClock(_this.store.getState()), seq: 0 });
        }
      });

      peer.on('message', function (m) {
        var store = _this.store;

        if (m.docId != _this.store.getState().docId) {
          return;
        }

        if (m.deltas && m.deltas.length > 0) {
          _this.store.dispatch({
            type: "APPLY_DELTAS",
            deltas: m.deltas
          });
        }

        if (m.vectorClock && (m.deltas || m.seq == _this.seqs[peer.id])) {
          // ignore acks for all but the last send
          _this.updatePeer(peer, _this.store.getState(), m.vectorClock);
        }
      });
    });
  }

  _createClass(DeltaRouter, [{
    key: 'broadcastState',
    value: function broadcastState(state, action) {
      var _this2 = this;

      var clock = _tesseract2.default.getVClock(state);
      this.clocks[this.peergroup.self().id] = clock;
      if (action == "APPLY_DELTAS") {
        this.peergroup.peers().forEach(function (peer) {
          try {
            // docId probably shouldn't be here, but here it is for now.
            peer.send({ docId: state.docId, vectorClock: clock });
            _this2.peerStats[peer.id].messagesSent += 1;
          } catch (e) {
            console.log("Error sending to [" + peer.id + "]:", e);
          }
        });
      } else {
        this.peergroup.peers().forEach(function (peer) {
          _this2.updatePeer(peer, state, _this2.clocks[peer.id]);
        });
      }
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
        // docId probably shouldn't be here, but here it is for now.
        peer.send({ docId: state.docId, deltas: deltas, seq: this.seqs[peer.id], vectorClock: myClock });
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
  }]);

  return DeltaRouter;
}();

var aMPLNet = function (_EventEmitter) {
  _inherits(aMPLNet, _EventEmitter);

  function aMPLNet(options) {
    _classCallCheck(this, aMPLNet);

    var _this3 = _possibleConstructorReturn(this, (aMPLNet.__proto__ || Object.getPrototypeOf(aMPLNet)).call(this));

    _this3.name = _config2.default.name || process.env.NAME;
    _this3.peergroup = new _peergroup2.default(options);
    _this3.connected = false;
    return _this3;
  }

  _createClass(aMPLNet, [{
    key: 'connect',
    value: function connect(config) {
      var _this4 = this;

      if (this.connected) throw "network already connected - disconnect first";
      this.config = config || this.config;
      this.peerStats = {};

      this.peer_id = this.config.peerId;
      this.store = this.config.store;

      this.connected = true;

      this.signaler = new _bonjourSignaler2.default({ name: this.name, session: this.peer_id });

      this.webRTCSignaler = new _webrtcSignaler2.default(this.peergroup);

      this.deltaRouter = new DeltaRouter(this.peergroup, this.store);

      this.peergroup.on('peer', function (peer) {
        console.log("ON PEER", peer.id, peer.self);

        _this4.peerStats[peer.id] = {
          connected: false,
          self: peer.self,
          name: peer.name,
          lastActivity: Date.now(),
          messagesSent: 0,
          messagesReceived: 0
        };
        _this4.emit('peer');

        peer.on('disconnect', function () {
          _this4.peerStats[peer.id].connected = false;
          _this4.emit('peer');
        });

        peer.on('closed', function () {
          delete _this4.peerStats[peer.id];
          _this4.emit('peer');
        });

        peer.on('connect', function () {
          _this4.peerStats[peer.id].connected = true;
          _this4.peerStats[peer.id].lastActivity = Date.now();
          _this4.emit('peer');
        });

        peer.on('message', function (m) {
          _this4.peerStats[peer.id].lastActivity = Date.now();
          _this4.peerStats[peer.id].messagesReceived += 1;
          _this4.emit('peer');
        });

        peer.on('sent', function (m) {
          _this4.peerStats[peer.id].messagesSent += 1;
          _this4.emit('peer');
        });
      });

      this.peergroup.join(this.signaler);
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