'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _peergroup = require('./peergroup');

var _peergroup2 = _interopRequireDefault(_peergroup);

var _tesseract = require('tesseract');

var _tesseract2 = _interopRequireDefault(_tesseract);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

    /* This should probably be a feature of Tesseract */

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

exports.default = DeltaRouter;