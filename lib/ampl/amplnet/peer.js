'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lz = require('lz4');

var _lz2 = _interopRequireDefault(_lz);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Peer = function () {
  function Peer(id, name, send_signal) {
    _classCallCheck(this, Peer);

    this.id = id;
    this.name = name;
    this.handlers = { connect: [], closed: [], disconnect: [], message: [] };
    this.self = send_signal == undefined;
    this.send_signal = send_signal;
  }

  _createClass(Peer, [{
    key: 'on',
    value: function on(type, handler) {
      this.handlers[type].push(handler);
    }
  }, {
    key: 'dispatch',
    value: function dispatch(type, arg) {
      this.handlers[type].forEach(function (h) {
        return h(arg);
      });
    }
  }, {
    key: 'close',
    value: function close() {
      try {
        this.webrtc.close();
      } catch (err) {
        // nope
      }
    }
  }, {
    key: 'send',
    value: function send(message) {
      if (this.self) return; // dont send messages to ourselves
      if (!("data_channel" in this)) return; // dont send messages to disconnected peers

      var buffer = new Buffer(JSON.stringify(message), 'utf8');
      var compressed = _lz2.default.encode(buffer);
      this.data_channel.send(compressed.toString('base64'));
    }
  }]);

  return Peer;
}();

exports.default = Peer;