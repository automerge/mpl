'use strict';

var bonjour = require('bonjour')();
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');

var UUID = function () {
  var self = {};
  var lut = [];for (var i = 0; i < 256; i++) {
    lut[i] = (i < 16 ? '0' : '') + i.toString(16);
  }
  self.generate = function () {
    var d0 = Math.random() * 0xffffffff | 0;
    var d1 = Math.random() * 0xffffffff | 0;
    var d2 = Math.random() * 0xffffffff | 0;
    var d3 = Math.random() * 0xffffffff | 0;
    return lut[d0 & 0xff] + lut[d0 >> 8 & 0xff] + lut[d0 >> 16 & 0xff] + lut[d0 >> 24 & 0xff] + '-' + lut[d1 & 0xff] + lut[d1 >> 8 & 0xff] + '-' + lut[d1 >> 16 & 0x0f | 0x40] + lut[d1 >> 24 & 0xff] + '-' + lut[d2 & 0x3f | 0x80] + lut[d2 >> 8 & 0xff] + '-' + lut[d2 >> 16 & 0xff] + lut[d2 >> 24 & 0xff] + lut[d3 & 0xff] + lut[d3 >> 8 & 0xff] + lut[d3 >> 16 & 0xff] + lut[d3 >> 24 & 0xff];
  };
  return self;
}();

// TODO: start()/stop()

function init(config) {
  var HANDLERS = { hello: function hello() {}, reply: function reply() {}, offer: function offer() {}, error: function error() {}, connect: function connect() {}, disconnect: function disconnect() {} };

  var SESSION = config.session || UUID.generate();
  var NAME = config.name || "unknown";
  var DOC_ID = config.doc_id;

  var PORT = 3000 + Math.floor(Math.random() * 1000);

  var noticedSessions = {};

  function prepareSignalServer() {
    var app = express();
    app.use(bodyParser.json());
    app.post('/', hearOffer);
    app.listen(PORT);
  }

  function initializeBonjour() {
    var browser = bonjour.find({ type: 'ampl' }, function (service) {
      console.log("Detected a new service. (This should be once per service.)");
      console.log(service);
      var meta = service.txt;
      if (meta.session == SESSION) {
        console.log("Detected our own session.");
        return;
      }
      if (meta.docid != DOC_ID) {
        console.log("Overheard: " + meta.docid + " (listening for: " + DOC_ID + ")");
        return;
      }
      hearHello(service);
    }

    // text is encoded into a k/v object by bonjour
    // bonjour downcases keynames.
    );var text = { session: SESSION, name: NAME, docid: DOC_ID };
    console.log("text is :", text);
    setTimeout(function () {
      bonjour.publish({ name: 'ampl-' + SESSION, type: 'ampl', port: PORT, txt: text });
    }, 2000);
  }

  // initiated by .start()
  function sendHello() {
    console.log("sendHello()");
    prepareSignalServer();
    initializeBonjour();
  }

  // initiated by comes from bonjour `find()`.
  function hearHello(service) {
    console.log("hearHello()");
    var meta = { name: service.txt.name, session: service.txt.session, action: 'hello' };
    HANDLERS['hello'](meta, undefined, function (offer) {
      return sendOffer(service, offer);
    });
  }

  // initiated by hearHello()
  function sendOffer(service, offer) {
    console.log("sendOffer()", service, offer);
    var msg = { name: NAME, session: SESSION, action: 'offer' };
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
      hearReply(body);
    });
  }

  // express calls this in response to a post on "/"
  function hearOffer(req, res) {
    console.log("hearOffer:", req, res);
    var meta = { name: req.body.name, session: req.body.session, action: 'offer' };
    HANDLERS['offer'](meta, req.body.body, function (reply) {
      var msg = { name: NAME, session: SESSION, body: reply, action: 'reply' };
      sendReply(res, msg);
    });
  }

  // this gets sent over the wire by express.
  function sendReply(res, reply) {
    console.log("sendReply()", res, reply);
    res.set("Connection", "close");
    res.json(reply);
  }

  // request receives this in response to the above.
  function hearReply(reply) {
    console.log("hearReply()", reply);
    HANDLERS['reply'](reply, reply.body, null);
  }

  return {
    session: SESSION,
    name: NAME,
    on: function on(type, handler) {
      HANDLERS[type] = handler;
    },
    start: function start() {
      sendHello();
    },
    stop: function stop() {
      HANDLERS['disconnect']();
    }
  };
}

module.exports = {
  init: init
};