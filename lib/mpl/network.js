'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _ipfs = require('ipfs');

var _ipfs2 = _interopRequireDefault(_ipfs);

var _ipfsPubsubRoom = require('ipfs-pubsub-room');

var _ipfsPubsubRoom2 = _interopRequireDefault(_ipfsPubsubRoom);

var _automerge = require('automerge');

var _automerge2 = _interopRequireDefault(_automerge);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Network = function (_EventEmitter) {
  _inherits(Network, _EventEmitter);

  // TODO: reimplement 
  //  - friendly user names
  //  - multiple document support
  function Network(docSet) {
    _classCallCheck(this, Network);

    var _this = _possibleConstructorReturn(this, (Network.__proto__ || Object.getPrototypeOf(Network)).call(this));

    var ipfs = new _ipfs2.default({
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

    _this.Peers = {};
    _this.peerMetadata = {};

    _this.selfInfo = null;
    _this.name = 'Unset Name';

    _this.ipfs = ipfs;

    _this.docSet = docSet;

    _this.connected = false;
    return _this;
  }

  _createClass(Network, [{
    key: 'connect',
    value: function connect() {
      var _this2 = this;

      if (this.connected) throw "network already connected - disconnect first";

      this.ipfs.once('ready', function () {
        return _this2.ipfs.id(function (err, info) {
          if (err) {
            throw err;
          }
          console.log('IPFS node ready with address ' + info.id);
          _this2.selfInfo = info;

          _this2.room = (0, _ipfsPubsubRoom2.default)(_this2.ipfs, 'ampl-experiment');
          _this2.room.on('peer joined', function (peer) {
            _this2.peerJoined(peer);
          });
          _this2.room.on('peer left', function (peer) {
            _this2.peerLeft(peer);
          });
          _this2.room.on('message', function (message) {
            _this2.message(message);
          });
        });
      });

      this.connected = true;
    }
  }, {
    key: 'peerJoined',
    value: function peerJoined(peer) {
      var _this3 = this;

      console.log('peer ' + peer + ' joined');
      if (peer == this.selfInfo.id) {
        return;
      }
      if (!this.Peers[peer]) {
        this.Peers[peer] = new _automerge2.default.Connection(this.docSet, function (msg) {
          console.log('Automerge.Connection> send to ' + peer + ':', msg);
          _this3.room.sendTo(peer, JSON.stringify(msg));
        });

        this.Peers[peer].open();
      }
      return this.Peers[peer];
    }
  }, {
    key: 'peerLeft',
    value: function peerLeft(peer) {
      console.log('peer ' + peer + ' left');
      delete this.Peers[peer];
    }
  }, {
    key: 'message',
    value: function message(_message) {
      console.log('Automerge.Connection> receive ' + _message.from + ': ' + _message.data.toString());
      var contents = JSON.parse(_message.data.toString());
      if (contents.metadata) {
        this.receivePeerMetadata();
      }
      // we'll send this message to automerge too, just in case there are clocks or deltas included with it
      this.Peers[_message.from].receiveMsg(contents);
    }
  }, {
    key: 'generatePeerMetadata',
    value: function generatePeerMetadata() {
      return { metadata: {
          name: this.name
          // xxx: todo: docid
        } };
    }
  }, {
    key: 'setName',
    value: function setName(name) {
      this.name = name;
    }
  }, {
    key: 'broadcastPeerMetadata',
    value: function broadcastPeerMetadata() {
      this.room.broadcast(JSON.stringify(this.generatePeerMetadata()));
    }
  }, {
    key: 'sendPeerMetadata',
    value: function sendPeerMetadata(peer) {
      this.room.sendTo(peer, JSON.stringify(this.generatePeerMetadata()));
    }
  }, {
    key: 'receivePeerMetadata',
    value: function receivePeerMetadata(message, contents) {
      console.log("Received a peer metadata update from ", message.from);
      // TODO: input validation...
      this.peerMetadata[message.from] = contents;
    }
  }, {
    key: 'broadcastActiveDocId',
    value: function broadcastActiveDocId(docId) {
      // todo: this.webRTCSignaler.broadcastActiveDocId(docId)
    }
  }, {
    key: 'getPeerDocs',
    value: function getPeerDocs() {
      // todo: return this.webRTCSignaler.getPeerDocs()
    }
  }, {
    key: 'disconnect',
    value: function disconnect() {
      if (this.connected == false) throw "network already disconnected - connect first";
      console.log("NETWORK DISCONNECT");
      this.ipfs.stop();
      this.connected = false;
    }
  }]);

  return Network;
}(_events2.default);

exports.default = Network;