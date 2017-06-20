'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _peer2 = require('./peer');

var _peer3 = _interopRequireDefault(_peer2);

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

  function PeerGroup(name, session, wrtc) {
    _classCallCheck(this, PeerGroup);

    var _this = _possibleConstructorReturn(this, (PeerGroup.__proto__ || Object.getPrototypeOf(PeerGroup)).call(this));

    _this.wrtc = wrtc;
    _this.session = session;
    _this.name = name;

    _this.Peers = {};
    _this.Handshakes = {};
    _this.processSignal = _this.processSignal.bind(_this);
    return _this;
  }

  _createClass(PeerGroup, [{
    key: 'join',
    value: function join() {
      // add ourselves to the peers list with a do-nothing signaller
      this.me = this.getOrCreatePeer(this.session, this.name, undefined);
    }
  }, {
    key: 'close',
    value: function close() {
      for (var id in this.Peers) {
        this.Peers[id].close();
        delete this.Peers[id];
      }
      // throw away all cached handshakes
      this.Handshakes = {};
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
        // pvh moved this here from peer.js but doesn't understand it
        peer.on('closed', function () {
          delete _this2.Peers[peer.id];
          if (_this2.Handshakes[peer.id]) {
            _this2.Handshakes[peer.id]();
          }
        });
        this.Peers[id] = peer;
        this.emit("peer", peer);
      }
      return this.Peers[id];
    }
  }, {
    key: 'beginHandshake',
    value: function beginHandshake(id, name, handler) {
      delete this.Handshakes[id]; // we're moving now, so discard this handshake

      // this delete gives us the old semantics but i don't know why we do it
      delete this.Peers[id];
      var peer = this.getOrCreatePeer(id, name, handler);
      peer.establishDataChannel();
    }
  }, {
    key: 'processSignal',
    value: function processSignal(msg, signal, handler) {
      var _this3 = this;

      var id = msg.session;
      var name = msg.name;

      // FIXME - this could be cleaner 
      if (msg.action == "hello") {
        if (id in this.Peers) {
          // we save a handshake for later if we already know them
          this.Handshakes[id] = function () {
            _this3.beginHandshake(id, name, handler);
          };
        } else {
          this.beginHandshake(id, name, handler);
        }
      } else if (msg.action == "offer") {
        if (id in this.Peers) {
          this.Handshakes[id] = function () {
            var peer = _this3.getOrCreatePeer(id, name, handler);
            peer.handleSignal(signal);
          };
        } else {
          var peer = this.getOrCreatePeer(id, name, handler);
          peer.handleSignal(signal);
        }
      } else {
        var _peer = this.getOrCreatePeer(id, name, handler);
        _peer.handleSignal(signal);
      }
    }
  }]);

  return PeerGroup;
}(_events2.default);

exports.default = PeerGroup;