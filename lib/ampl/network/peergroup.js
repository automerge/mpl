'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _peer2 = require('./peer');

var _peer3 = _interopRequireDefault(_peer2);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var PeerGroup = function (_EventEmitter) {
  _inherits(PeerGroup, _EventEmitter);

  function PeerGroup(wrtc) {
    _classCallCheck(this, PeerGroup);

    var _this = _possibleConstructorReturn(this, (PeerGroup.__proto__ || Object.getPrototypeOf(PeerGroup)).call(this));

    _this.wrtc = wrtc;

    _this.Peers = {};
    _this.processSignal = _this.processSignal.bind(_this);
    return _this;
  }

  _createClass(PeerGroup, [{
    key: 'join',
    value: function join(session, name) {
      // add ourselves to the peers list with a do-nothing signaller
      // this has to happen after all the listeners register... which suggests
      // we have some kind of an antipattern going
      this.me = this.getOrCreatePeer(session, name, undefined);
    }
  }, {
    key: 'close',
    value: function close() {
      for (var id in this.Peers) {
        this.Peers[id].close();
        delete this.Peers[id];
      }
      this.removeAllListeners();
    }
  }, {
    key: 'peers',
    value: function peers() {
      return Object.values(this.Peers);
    }
  }, {
    key: 'self',
    value: function self() {
      return this.me;
    }
  }, {
    key: 'getOrCreatePeer',
    value: function getOrCreatePeer(id, name, handler) {
      var _this2 = this;

      if (!this.Peers[id]) {
        var peer = new _peer3.default(id, name, handler, this.wrtc);
        peer.on('closed', function () {
          delete _this2.Peers[peer.id];
        });
        this.Peers[id] = peer;
        this.emit("peer", peer);
      }
      return this.Peers[id];
    }
  }, {
    key: 'processSignal',
    value: function processSignal(msg, signal, handler) {
      var id = msg.session;
      if (!id) throw "Tried to process a signal that had no peer ID";
      var name = msg.name;
      if (!name) throw "Tried to process a signal that had no name";

      if (msg.action == "hello") {
        delete this.Peers[id];
        var peer = this.getOrCreatePeer(id, name, handler);
        peer.establishDataChannel();
      } else if (msg.action == "offer" || msg.action == "reply") {
        var _peer = this.Peers[id];
        if (!_peer) throw "Received an offer or a reply for a peer we don't have registered.";

        _peer.handleSignal(signal);
      } else {
        console.log("UNRECOGNIZED SIGNAL:", signal);
      }
    }
  }]);

  return PeerGroup;
}(_events2.default);

exports.default = PeerGroup;