var RtmClient = require('@slack/client').RtmClient;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;

var bot_token = process.env.SLACK_BOT_TOKEN || '';

let rtm;// = new RtmClient(bot_token);
let uuidv4 = require('uuid/v4');

function init(config) {
  let HANDLERS = { hello: () => {}, reply: () => {}, offer: () => {}, error: () => {}, connect: () => {}, disconnect: () => {} }
  let CHANNEL;
  let SESSION = config.session || uuidv4()
  let NAME = config.name || "unknown"
  let DOC_ID;
  let last_ts
  let onConnectHandler = () => {}
  let CONNECT_DISPATCH = (h) => {
    onConnectHandler = h
  }
  let opts = { retryConfig: { forever: true, maxTimeout: 30 * 1000 }};
  let connected = true
  let lastCon = 0

  rtm = new RtmClient(config.bot_token,opts);
  DOC_ID = config.doc_id

  // The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload
  rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
    if (connected) { // race condition
      onConnectHandler()
      HANDLERS['connect']()
      for (const c of rtmStartData.channels) {
        if (c.is_member && c.name ==='signals') { CHANNEL = c.id }
      }
      console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}`);
    }
  });

  // you need to wait for the client to fully connect before you can send messages
  rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
    if (connected) { // race condition
      let msg = JSON.stringify({ action: "hello", name:NAME, session:SESSION, doc_id:DOC_ID })
      rtm.sendMessage(msg, CHANNEL);
    }
  });

  rtm.on(CLIENT_EVENTS.RTM.WS_ERROR, function() {
    console.log("slack-signal: ws error")
  })

  rtm.on(CLIENT_EVENTS.RTM.WS_CLOSED, function() {
    console.log("slack-signal: ws closed")
  })

  rtm.on(CLIENT_EVENTS.RTM.WS_OPENED, function() {
    console.log("slack-signal: ws opened")
  })

  rtm.on(CLIENT_EVENTS.RTM.ATTEMPTING_RECONNECT, function() {
    console.log("slack-signal: attempting reconnect")
    HANDLERS['disconnect']()
  })

  //rtm.on(CLIENT_EVENTS.RTM.MESSAGE, function handleRtmMessage(message) {
  rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
    let ts = parseFloat(message.ts)
    if (last_ts && last_ts > ts) console.log("WARNING - TS OUT OF ORDER")
    try {
      let msg = JSON.parse(message.text)
      if (msg.session != SESSION) {
        if (msg.doc_id == DOC_ID) {
          if (lastCon != 0 && lastCon != msg.session) {
            console.log(`Got a message for ${msg.session} ignoring b/c I already heard from ${lastCon}`)
            return
          }
          if (msg.action == "hello") { // "hello" doesn't have a msg.body, so pass undefined
            setTimeout(() => {
              HANDLERS['hello'](msg, undefined, (reply) => {
                  let msgJSON = JSON.stringify({ action: "offer", name: NAME, session:SESSION, doc_id:DOC_ID, to:msg.session, body:reply})
                  rtm.sendMessage(msgJSON, CHANNEL);
              })
            },500)
          }
          if (msg.action == "offer" && msg.to == SESSION) {
            HANDLERS['offer'](msg, msg.body, (reply) => {
                let msgJSON = JSON.stringify({ action: "reply", name: NAME, session:SESSION, doc_id:DOC_ID, to:msg.session, body:reply})
                rtm.sendMessage(msgJSON, CHANNEL);
            })
          }
          if (msg.action == "reply" && msg.to == SESSION) {
            lastCon = msg.session
            HANDLERS['reply'](msg, msg.body)
          }
        }
      } else {
        console.log("Message was by me...")
      }
    } catch(e) {
      console.log("Was a non-json message - ignore")
      HANDLERS['error'](message,e)
    }
    last_ts = ts
  });
  return { 
    session: SESSION,
    name: NAME,
    on: (type,handler) => { HANDLERS[type] = handler },
    start: () => {
      connected = true
      rtm.start() },
    stop: () => {
      rtm.disconnect()
      connected = false
      HANDLERS['disconnect']()
    }
  }
}

module.exports = {
  init
}
