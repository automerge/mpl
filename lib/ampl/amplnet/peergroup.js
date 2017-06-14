'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _peer = require('./peer');

var _peer2 = _interopRequireDefault(_peer);

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

  function PeerGroup(options) {
    _classCallCheck(this, PeerGroup);

    // XXX cleanup this
    var _this = _possibleConstructorReturn(this, (PeerGroup.__proto__ || Object.getPrototypeOf(PeerGroup)).call(this));

    _this.options = options;

    _this.Signaler = undefined;
    _this.Peers = {};
    _this.Handshakes = {};
    _this.processSignal = _this.processSignal.bind(_this);
    return _this;
  }

  _createClass(PeerGroup, [{
    key: 'join',
    value: function join(signaler) {
      this.Signaler = signaler;
      signaler.on('hello', this.processSignal);
      signaler.on('offer', this.processSignal);
      signaler.on('reply', this.processSignal);
      signaler.on('error', function (message, e) {
        console.log("SIGNALER ERROR-MESSAGE", message);
        console.log("ERROR", e);
      }

      // add ourselves to the peers list with a do-nothing signaller
      );var me = this.getOrCreatePeer(signaler.session, signaler.name, undefined

      // we define "connect" and "disconnect" for ourselves as whether
      // we're connected to the signaller.
      );signaler.on('connect', function () {
        me.emit('connect');
      });
      signaler.on('disconnect', function () {
        me.emit('disconnect');
      }

      // notify the signaller we're ready to connect.
      );signaler.start();
    }
  }, {
    key: 'close',
    value: function close() {
      if (this.Signaler) {
        this.Signaler.stop();
        this.Signaler = undefined;
        for (var id in this.Peers) {
          this.Peers[id].close();
        }
        // throw away all cached handshakes
        this.Handshakes = {};
        this.removeAllListeners();
      }
    }
  }, {
    key: 'peers',
    value: function peers() {
      var _this2 = this;

      var values = [];

      Object.keys(this.Peers).forEach(function (key) {
        values.push(_this2.Peers[key]);
      });

      return values;
    }
  }, {
    key: 'getOrCreatePeer',
    value: function getOrCreatePeer(id, name, handler) {
      var _this3 = this;

      if (!this.Peers[id]) {
        var peer = new _peer2.default(this.options, id, name, handler);
        // pvh moved this here from peer.js but doesn't understand it
        peer.on('closed', function () {
          delete _this3.Peers[peer.id];
          if (_this3.Handshakes[peer.id]) {
            _this3.Handshakes[peer.id]();
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
      var _this4 = this;

      var id = msg.session;
      var name = msg.name;

      if (msg.action == "hello") {
        if (id in this.Peers) {
          // we save a handshake for later if we already know them
          this.Handshakes[id] = function () {
            _this4.beginHandshake(id, name, handler);
          };
        } else {
          this.beginHandshake(id, name, handler);
        }
      } else {
        var peer = this.getOrCreatePeer(id, name, handler);
        peer.handleSignal(signal);
      }
    }
  }]);

  return PeerGroup;
}(_events2.default);

exports.default = PeerGroup;