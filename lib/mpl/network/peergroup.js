'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _peer = require('./peer');

var _peer2 = _interopRequireDefault(_peer);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _automerge = require('automerge');

var _automerge2 = _interopRequireDefault(_automerge);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var IPFS = require('ipfs');
var Room = require('ipfs-pubsub-room');

var PeerGroup = function (_EventEmitter) {
  _inherits(PeerGroup, _EventEmitter);

  function PeerGroup(docSet, wrtc) {
    _classCallCheck(this, PeerGroup);

    var _this = _possibleConstructorReturn(this, (PeerGroup.__proto__ || Object.getPrototypeOf(PeerGroup)).call(this));

    var ipfs = new IPFS({
      repo: 'ipfs/pubsub-demo/' + Math.random(),
      EXPERIMENTAL: {
        pubsub: true
      },
      config: {
        "Addresses": {
          "API": "",
          "Gateway": "",
          "Swarm": ["/ip4/0.0.0.0/tcp/0"] } }
    });

    _this.ipfs = ipfs;

    _this.docSet = docSet;
    _this.wrtc = wrtc;

    _this.Peers = {};
    _this.connections = {};
    _this.processSignal = _this.processSignal.bind(_this);
    return _this;
  }

  _createClass(PeerGroup, [{
    key: 'join',
    value: function join(session, name) {
      var _this2 = this;

      // add ourselves to the peers list with a do-nothing signaller
      // this has to happen after all the listeners register... which suggests
      // we have some kind of an antipattern going

      var room = void 0;

      ipfs.once('ready', function () {
        return ipfs.id(function (err, info) {
          if (err) {
            throw err;
          }
          console.log('IPFS node ready with address ' + info.id);

          room = Room(ipfs, 'ampl-experiment');

          room.on('peer joined', function (peer) {
            console.log('peer ' + peer + ' joined');
            _this2.Peers[peer] = peer;
          });
          room.on('peer left', function (peer) {
            console.log('peer ' + peer + ' left');
            delete _this2.Peers[peer];
          });

          // send and receive messages    
          room.on('peer joined', function (peer) {
            return room.sendTo(peer, 'Hello ' + peer + '!');
          });
          room.on('message', function (message) {
            return console.log('got message from ' + message.from + ': ' + message.data.toString());
          });
        });
      });

      this.room = room;

      ipfs.id().then(function (ipfsid) {
        _this2.me = _this2.getOrCreatePeer(ipfsid, ipfsid, undefined);
      });
    }
  }, {
    key: 'close',
    value: function close() {
      for (var id in this.Peers) {
        this.Peers[id].close();
        delete this.Peers[id];
      }
      ipfs.stop();
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
      var _this3 = this;

      if (!this.Peers[id]) {
        this.Peers[id] = peer;
        this.connections[id] = new _automerge2.default.Connection(this.docSet, function (msg) {
          console.log('send to ' + id + ':', msg);
          peer.send(msg);
        });

        peer.on('message', function (msg) {
          console.log('receive from ' + id + ':', msg);
          _this3.connections[id].receiveMsg(msg);
        });

        peer.on('closed', function () {
          _this3.connections[id].close();
          delete _this3.connections[id];
          delete _this3.Peers[id];
        });

        this.connections[id].open();
        this.emit("peer", peer);
      }

      return this.Peers[id];
    }
  }]);

  return PeerGroup;
}(_events2.default);

exports.default = PeerGroup;