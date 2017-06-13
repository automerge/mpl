let bonjour = require('bonjour')()
let express = require('express')
let bodyParser = require('body-parser')
let request = require('request')
let uuidv4 = require('uuid/v4');

// TODO: start()/stop()

function init(config) {
  let HANDLERS = { hello: () => {}, reply: () => {}, offer: () => {}, error: () => {}, connect: () => {}, disconnect: () => {} }

  let SESSION = config.session || uuidv4()
  let NAME = config.name || "unknown"
  let DOC_ID = config.doc_id;

  let PORT = 3000 + Math.floor(Math.random() * 1000);
  
  let noticedSessions = {}

  function prepareSignalServer() {
    var app = express();
    app.use(bodyParser.json());
    app.post('/', hearOffer);
    app.listen(PORT);
  }

  function initializeBonjour() {
    let browser = bonjour.find({ type: 'ampl' }, 
      (service) => {
        console.log("Detected a new service. (This should be once per service.)")
        console.log(service)
        let meta = service.txt
        if (meta.session == SESSION) {
          console.log("Detected our own session.")
          return
        }
        if (meta.docid != DOC_ID) {
          console.log("Overheard: "+meta.docid+" (listening for: " + DOC_ID+")")
          return
        }
        hearHello(service)
    })
    
    // text is encoded into a k/v object by bonjour
    // bonjour downcases keynames.
    let text = {session:SESSION, name: NAME, docid: DOC_ID}
    console.log("text is :", text)
    setTimeout( () => {
      bonjour.publish({ name: 'ampl-'+SESSION, type: 'ampl', port: PORT, txt: text })
    }, 2000)
  }

  // initiated by .start()
  function sendHello() {
    console.log("sendHello()")
    prepareSignalServer();
    initializeBonjour();
  }

  // initiated by comes from bonjour `find()`.
  function hearHello(service) {
    console.log("hearHello()")
    let meta = {name: service.txt.name, session: service.txt.session, action: 'hello'}
    HANDLERS['hello'](meta, undefined, (offer) => sendOffer(service, offer))
  }

  // initiated by hearHello()
  function sendOffer(service, offer) {
    console.log("sendOffer()", service, offer)
    let msg = {name: NAME, session: SESSION, action: 'offer'}
    msg.body = offer;

    let opts = {method: 'POST', 
      url: "http://"+service.host+":"+service.port+"/", 
      json: msg};
    console.log("Sending post request to peer server:", opts)
    request(opts,
        (error ,response, body) => {
          if (error) {
            // We should probably be smarter about this.
            console.log(error)
            return;
          }

          console.log("Reply received: ")
          console.log(body)
          hearReply(body)
    })
  }

  // express calls this in response to a post on "/"
  function hearOffer(req, res) {
    console.log("hearOffer:", req, res)
    let meta = {name: req.body.name, session: req.body.session, action: 'offer'}
    HANDLERS['offer'](meta, req.body.body, (reply) => {
      let msg = {name: NAME, session: SESSION, body: reply, action: 'reply'}
      sendReply(res, msg)
    })
  }

  // this gets sent over the wire by express.
  function sendReply(res, reply) {
    console.log("sendReply()", res, reply)
    res.set("Connection", "close");
    res.json(reply)
  }

  // request receives this in response to the above.
  function hearReply(reply) {
    console.log("hearReply()", reply)
    HANDLERS['reply'](reply, reply.body, null)
  }

  return {
    session: SESSION,
    name: NAME,
    on: (type,handler) => { HANDLERS[type] = handler },
    start: () => { sendHello() },
    stop: () => {
      HANDLERS['disconnect']()
    }
  }
}

module.exports = {
  init
}
