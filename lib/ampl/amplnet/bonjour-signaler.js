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
var express = require('express');
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
      /*this.sendGoodbye(); */this.emit('disconnect');
    } // XXX fix this: i haven't implemented unpublish

  }, {
    key: 'prepareSignalServer',
    value: function prepareSignalServer() {
      var _this2 = this;

      var app = express();
      app.use(bodyParser.json());
      app.post('/', function () {
        return _this2.hearOffer;
      });
      app.listen(this.PORT);
    }
  }, {
    key: 'initializeBonjour',
    value: function initializeBonjour() {
      var _this3 = this;

      var browser = bonjour.find({ type: 'ampl' }, function (service) {
        console.log("Detected a new service. (This should be once per service.)");
        console.log(service);
        var meta = service.txt;
        if (meta.session == _this3.SESSION) {
          console.log("Detected our own session.");
          return;
        }
        if (meta.docid != _this3.DOC_ID) {
          console.log("Overheard: " + meta.docid + " (listening for: " + _this3.DOC_ID + ")");
          return;
        }
        _this3.hearHello(service);
      }

      // text is encoded into a k/v object by bonjour
      // bonjour downcases keynames.
      );var text = { session: this.SESSION, name: this.NAME, docid: this.DOC_ID };
      console.log("text is :", text);
      setTimeout(function () {
        bonjour.publish({ name: 'ampl-' + _this3.SESSION, type: 'ampl', port: _this3.PORT, txt: text });
      }, 2000);
    }

    // initiated by .start()

  }, {
    key: 'sendHello',
    value: function sendHello() {
      console.log("sendHello()");
      this.prepareSignalServer();
      this.initializeBonjour();
    }

    // initiated by comes from bonjour `find()`.

  }, {
    key: 'hearHello',
    value: function hearHello(service) {
      var _this4 = this;

      console.log("hearHello()");
      var meta = { name: service.txt.name, session: service.txt.session, action: 'hello' };
      this.emit('hello', meta, undefined, function (offer) {
        return _this4.sendOffer(service, offer);
      });
    }

    // initiated by hearHello()

  }, {
    key: 'sendOffer',
    value: function sendOffer(service, offer) {
      var _this5 = this;

      console.log("sendOffer()", service, offer);
      var msg = { name: this.NAME, session: this.SESSION, action: 'offer' };
      msg.body = offer;

      var opts = { method: 'POST',
        url: "http://" + service.host + ":" + service.port + "/",
        json: msg };
      console.log("Sending post request to peer server:", opts);
      request(opts, function (error, response, body) {
        if (error) {
          // We should probably be smarter about this.
          console.log(error);
          return;
        }

        console.log("Reply received: ");
        console.log(body);
        _this5.hearReply(body);
      });
    }

    // express calls this in response to a post on "/"

  }, {
    key: 'hearOffer',
    value: function hearOffer(req, res) {
      var _this6 = this;

      console.log("hearOffer:", req, res);
      var meta = { name: req.body.name, session: req.body.session, action: 'offer' };
      this.emit('offer', meta, req.body.body, function (reply) {
        var msg = { name: _this6.NAME, session: _this6.SESSION, body: reply, action: 'reply' };
        _this6.sendReply(res, msg);
      });
    }

    // this gets sent over the wire by express.

  }, {
    key: 'sendReply',
    value: function sendReply(res, reply) {
      console.log("sendReply()", res, reply);
      res.json(reply);
    }

    // request receives this in response to the above.

  }, {
    key: 'hearReply',
    value: function hearReply(reply) {
      console.log("hearReply()", reply);
      this.emit('reply', reply, reply.body, null);
    }
  }]);

  return BonjourSignaller;
}(_events2.default);

exports.default = BonjourSignaller;