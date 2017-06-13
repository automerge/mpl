'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lz = require('lz4');

var _lz2 = _interopRequireDefault(_lz);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Peer = function (_EventEmitter) {
  _inherits(Peer, _EventEmitter);

  function Peer(id, name, send_signal) {
    _classCallCheck(this, Peer);

    var _this = _possibleConstructorReturn(this, (Peer.__proto__ || Object.getPrototypeOf(Peer)).call(this));

    _this.id = id;
    _this.name = name;
    _this.self = send_signal == undefined;
    _this.send_signal = send_signal;
    return _this;
  }

  _createClass(Peer, [{
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
}(_events2.default);

exports.default = Peer;