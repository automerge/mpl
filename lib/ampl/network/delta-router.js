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
  function DeltaRouter(peergroup, getTesseractCB, applyTesseractDeltasCB) {
    var _this = this;

    _classCallCheck(this, DeltaRouter);

    this.peergroup = peergroup;
    this.getTesseractCB = getTesseractCB;
    this.applyTesseractDeltasCB = applyTesseractDeltasCB;

    this.clocks = {};
    this.seqs = {};

    // on initialization, tell all our peers about our current vector clock 
    this.peergroup.peers().forEach(function (peer) {
      if (peer.self == false) {
        _this.sendVectorClock(peer);
      }
    }

    // listen for new peers
    );this.peergroup.on('peer', function (peer) {
      _this.seqs[peer.id] = 0;

      // send our clock to peers when we first connect so they
      // can catch us up on anything we missed.
      peer.on('connect', function () {
        if (peer.self == false) {
          _this.sendVectorClock(peer);
        }
      });

      peer.on('message', function (m) {
        var state = _this.getTesseractCB

        // right now we only care about a single docId
        ();if (m.docId != state.docId) {
          return;
        }

        // try and apply deltas we receive
        if (m.deltas && m.deltas.length > 0) {
          _this.applyTesseractDeltasCB(m.deltas);
        }

        // and if we get a vector clock, send the peer anything they're missing
        if (m.vectorClock && (m.deltas || m.seq == _this.seqs[peer.id])) {
          // ignore acks for all but the last send
          _this.clocks[peer.id] = m.vectorClock;
          _this.updatePeer(peer, state);
        }
      });
    });
  }

  _createClass(DeltaRouter, [{
    key: 'sendVectorClock',
    value: function sendVectorClock(peer) {
      // TODO: fold into an updatePeer call?
      // why SEQ always zero here?
      peer.send({ docId: this.getTesseractCB().docId, vectorClock: _tesseract2.default.getVClock(this.getTesseractCB()), seq: 0 });
    }

    // after each new local operation broadcast it to any peers that don't have it yet

  }, {
    key: 'broadcastState',
    value: function broadcastState(state) {
      var _this2 = this;

      var myClock = _tesseract2.default.getVClock(state);
      this.clocks[this.peergroup.self().id] = myClock;

      this.peergroup.peers().forEach(function (peer) {
        _this2.updatePeer(peer, state);
      });
    }
  }, {
    key: 'updatePeer',
    value: function updatePeer(peer, state) {
      if (peer == undefined) return;

      // docId probably shouldn't be here, but here it is for now.
      var myClock = _tesseract2.default.getVClock(state);
      var msg = { docId: state.docId, vectorClock: myClock };

      var theirClock = this.clocks[peer.id];
      if (theirClock) {
        var deltas = _tesseract2.default.getDeltasAfter(state, theirClock);
        if (deltas.length > 0) {
          // update their clock to assume they received all these updates 
          this.clocks[peer.id] = this.clockMax(myClock, theirClock);
          this.seqs[peer.id] += 1;

          msg.deltas = deltas;
          msg.seq = this.seqs[peer.id];
        }
      }
      peer.send(msg);
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