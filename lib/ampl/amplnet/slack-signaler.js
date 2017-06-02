'use strict';

var RtmClient = require('@slack/client').RtmClient;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;

var bot_token = process.env.SLACK_BOT_TOKEN || '';

var rtm = void 0; // = new RtmClient(bot_token);

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

function init(config) {
  var HANDLERS = { hello: function hello() {}, reply: function reply() {}, offer: function offer() {}, error: function error() {} };
  var CHANNEL = void 0;
  var SESSION = config.session || UUID.generate();
  var NAME = config.name || "unknown";
  var DOC_ID = void 0;
  var last_ts = void 0;
  var onConnectHandler = function onConnectHandler() {};
  var CONNECT_DISPATCH = function CONNECT_DISPATCH(h) {
    console.log("GET SLACK CONNECT HANDLER");
    onConnectHandler = h;
  };

  rtm = new RtmClient(config.bot_token);
  DOC_ID = config.doc_id;

  // The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload
  rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
    console.log("CALL SLACK CONNECT HANDLER");
    onConnectHandler();
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = rtmStartData.channels[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var c = _step.value;

        if (c.is_member && c.name === 'signals') {
          CHANNEL = c.id;
        }
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    console.log('Logged in as ' + rtmStartData.self.name + ' of team ' + rtmStartData.team.name);
  });

  // you need to wait for the client to fully connect before you can send messages
  rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
    var msg = JSON.stringify({ action: "hello", name: NAME, session: SESSION, doc_id: DOC_ID });
    rtm.sendMessage(msg, CHANNEL);
  });

  //rtm.on(CLIENT_EVENTS.RTM.MESSAGE, function handleRtmMessage(message) {
  rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
    var ts = parseFloat(message.ts);
    if (last_ts && last_ts > ts) console.log("WARNING - TS OUT OF ORDER");
    console.log('Message:', message);
    try {
      var msg = JSON.parse(message.text);
      if (msg.session != SESSION) {
        if (msg.doc_id == DOC_ID) {
          if (msg.action == "hello") {
            // "hello" doesn't have a msg.body, so pass undefined
            HANDLERS['hello'](msg, undefined, function (reply) {
              var msgJSON = JSON.stringify({ action: "offer", name: NAME, session: SESSION, doc_id: DOC_ID, to: msg.session, body: reply });
              rtm.sendMessage(msgJSON, CHANNEL);
            });
          }
          if (msg.action == "offer" && msg.to == SESSION) {
            HANDLERS['offer'](msg, msg.body, function (reply) {
              var msgJSON = JSON.stringify({ action: "reply", name: NAME, session: SESSION, doc_id: DOC_ID, to: msg.session, body: reply });
              rtm.sendMessage(msgJSON, CHANNEL);
            });
          }
          if (msg.action == "reply" && msg.to == SESSION) {
            HANDLERS['reply'](msg, msg.body);
          }
        } else {
          console.log("Message about a document other than the one we're managing - ignore");
        }
      } else {
        console.log("Message was by me...");
      }
    } catch (e) {
      console.log("Was a non-json message - ignore");
      HANDLERS['error'](message, e);
    }
    last_ts = ts;
    console.log("Done processing message");
  });
  return {
    on: function on(type, handler) {
      HANDLERS[type] = handler;
    },
    start: function start(handler) {
      rtm.start();
      if (handler) {
        console.log("SELF HANDLER");
        handler(SESSION, NAME, CONNECT_DISPATCH);
      }
    },
    stop: function stop() {
      rtm.disconnect();
    }
  };
}

module.exports = {
  init: init
};