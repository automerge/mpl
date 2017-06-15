'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var bonjour = require('bonjour')();
var WebSocket = require('ws');
var bodyParser = require('body-parser');
var request = require('request');
var uuidv4 = require('uuid/v4');

var BonjourSignaller = function (_EventEmitter) {
  _inherits(BonjourSignaller, _EventEmitter);

  function BonjourSignaller(config) {
    _classCallCheck(this, BonjourSignaller);

    var _this = _possibleConstructorReturn(this, (BonjourSignaller.__proto__ || Object.getPrototypeOf(BonjourSignaller)).call(this));

    _this.SESSION = config.session || uuidv4();
    _this.NAME = config.name || "unknown";
    _this.DOC_ID = config.doc_id;

    _this.PORT = 3000 + Math.floor(Math.random() * 1000);

    // backwards compat: todo
    _this.session = _this.SESSION;
    _this.name = _this.NAME;
    return _this;
  }

  _createClass(BonjourSignaller, [{
    key: 'start',
    value: function start() {
      this.sendHello();this.emit('connect');
    }
  }, {
    key: 'stop',
    value: function stop() {
      this.sendGoodbye();this.emit('disconnect');
    } // XXX fix this: i haven't implemented unpublish

  }, {
    key: 'prepareSignalServer',
    value: function prepareSignalServer() {
      var _this2 = this;

      console.log("prepareSignalServer: listening on ", this.PORT);
      var wss = new WebSocket.Server({ port: this.PORT });

      wss.on('connection', function (ws) {
        ws.on('message', function (raw) {
          console.log('received: %s', raw);
          var signal = JSON.parse(raw);
          _this2.hearOffer(ws, signal);
        });
      });
    }
  }, {
    key: 'searchBonjour',
    value: function searchBonjour() {
      var _this3 = this;

      this.browser = bonjour.find({ type: 'ampl' }, function (service) {
        console.log("peerDiscovery(): ", service.host, ":", service.port);
        console.log("peerDiscovery(): ", service.txt);
        var meta = service.txt;
        if (meta.session == _this3.SESSION) {
          console.log("peerDiscovery(): Own session.");
          return;
        }
        if (meta.docid != _this3.DOC_ID) {
          console.log("peerDiscovery(): Wrong docid. (Saw: " + meta.docid + ", want: " + _this3.DOC_ID + ")");
          return;
        }
        _this3.hearHello(service.txt.name, service.txt.session, service.host, service.port);
      });
    }
  }, {
    key: 'publishBonjour',
    value: function publishBonjour() {
      // text is encoded into a k/v object by bonjour
      // bonjour downcases keynames.
      var text = { session: this.SESSION, name: this.NAME, docid: this.DOC_ID };
      var publish = { name: 'ampl-' + this.SESSION, type: 'ampl', port: this.PORT, txt: text };
      console.log("publishBonjour():", 'ampl-' + this.SESSION, "type:", 'ampl', "port:", this.PORT, "txt:", JSON.stringify(text).split('\n').join(' '));
      this.service = bonjour.publish(publish);
    }

    // initiated by .start()

  }, {
    key: 'sendHello',
    value: function sendHello() {
      var _this4 = this;

      console.log("sendHello()");
      this.prepareSignalServer();
      if (!process.env.BLOCKBONJOUR) {
        this.searchBonjour();
        setTimeout(function () {
          _this4.publishBonjour();
        }, 2000 // wait a couple seconds to reduce race conditions
        );
      }
    }
  }, {
    key: 'sendGoodbye',
    value: function sendGoodbye() {
      if (this.browser) this.browser.stop();
      if (this.service) this.service.stop();
    }

    // initiated by bonjour `find()`.

  }, {
    key: 'hearHello',
    value: function hearHello(name, session, host, port) {
      var _this5 = this;

      console.log("hearHello()");
      var meta = { name: name, session: session, action: 'hello' };
      this.emit('hello', meta, undefined, function (offer) {
        return _this5.sendOffer(host, port, offer);
      });
    }

    // initiated by hearHello()

  }, {
    key: 'sendOffer',
    value: function sendOffer(host, port, offer) {
      var _this6 = this;

      console.log("sendOffer():", host + ":" + port);
      var msg = { name: this.NAME, session: this.SESSION, action: 'offer' };
      msg.body = offer;

      // This is creating a pile of websockets but to do this right I need to 
      // queue up messages that arrive here until we have an 'open' websocket and then send them.
      var ws = new WebSocket("ws://" + host + ":" + port + "/");
      ws.on('open', function () {
        ws.send(JSON.stringify(msg));
      });

      ws.on('message', function (data) {
        _this6.hearReply(JSON.parse(data));
      });
    }

    // express calls this in response to a post on "/"

  }, {
    key: 'hearOffer',
    value: function hearOffer(ws, signal) {
      var _this7 = this;

      console.log("hearOffer: from", signal.name, "/", signal.session);
      var meta = { name: signal.name, session: signal.session, action: 'offer' };
      this.emit('offer', meta, signal.body, function (reply) {
        var msg = { name: _this7.NAME, session: _this7.SESSION, body: reply, action: 'reply' };
        _this7.sendReply(ws, msg);
      });
    }

    // this gets sent over the wire by express.

  }, {
    key: 'sendReply',
    value: function sendReply(ws, reply) {
      console.log("sendReply()");
      ws.send(JSON.stringify(reply));
    }

    // request receives this in response to the above.

  }, {
    key: 'hearReply',
    value: function hearReply(reply) {
      console.log("hearReply(): from", reply.name, "/", reply.session);
      this.emit('reply', reply, reply.body, null);
    }
  }]);

  return BonjourSignaller;
}(_events2.default);

exports.default = BonjourSignaller;