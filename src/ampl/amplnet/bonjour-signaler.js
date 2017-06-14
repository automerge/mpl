let bonjour = require('bonjour')()
let express = require('express')
let bodyParser = require('body-parser')
let request = require('request')
let uuidv4 = require('uuid/v4');

import EventEmitter from 'events'
export default class BonjourSignaller extends EventEmitter {
  constructor(config) {
    super()

    this.SESSION = config.session || uuidv4()
    this.NAME = config.name || "unknown"
    this.DOC_ID = config.doc_id;

    this.PORT = 3000 + Math.floor(Math.random() * 1000);

    // backwards compat: todo
    this.session = this.SESSION
    this.name = this.NAME
  }

  start() { this.sendHello(); this.emit('connect') }
  stop() { /*this.sendGoodbye(); */ this.emit('disconnect') } // XXX fix this: i haven't implemented unpublish

  prepareSignalServer() {
    var app = express();
    app.use(bodyParser.json());
    app.post('/', () => this.hearOffer);
    app.listen(this.PORT);
  }

  initializeBonjour() {
    let browser = bonjour.find({ type: 'ampl' }, 
      (service) => {
        console.log("Detected a new service. (This should be once per service.)")
        console.log(service)
        let meta = service.txt
        if (meta.session == this.SESSION) {
          console.log("Detected our own session.")
          return
        }
        if (meta.docid != this.DOC_ID) {
          console.log("Overheard: "+meta.docid+" (listening for: " + this.DOC_ID+")")
          return
        }
        this.hearHello(service)
    })
    
    // text is encoded into a k/v object by bonjour
    // bonjour downcases keynames.
    let text = {session: this.SESSION, name: this.NAME, docid:this.DOC_ID}
    console.log("text is :", text)
    setTimeout( () => {
      bonjour.publish({ name: 'ampl-'+ this.SESSION, type: 'ampl', port: this.PORT, txt: text })
    }, 2000)
  }

  // initiated by .start()
  sendHello() {
    console.log("sendHello()")
    this.prepareSignalServer();
    this.initializeBonjour();
  }

  // initiated by comes from bonjour `find()`.
  hearHello(service) {
    console.log("hearHello()")
    let meta = {name: service.txt.name, session: service.txt.session, action: 'hello'}
    this.emit('hello', meta, undefined, (offer) => this.sendOffer(service, offer))
  }

  // initiated by hearHello()
  sendOffer(service, offer) {
    console.log("sendOffer()", service, offer)
    let msg = {name: this.NAME, session: this.SESSION, action: 'offer'}
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
          this.hearReply(body)
    })
  }

  // express calls this in response to a post on "/"
  hearOffer(req, res) {
    console.log("hearOffer:", req, res)
    let meta = {name: req.body.name, session: req.body.session, action: 'offer'}
    this.emit('offer', meta, req.body.body, (reply) => {
      let msg = {name: this.NAME, session: this.SESSION, body: reply, action: 'reply'}
      this.sendReply(res, msg)
    })
  }

  // this gets sent over the wire by express.
  sendReply(res, reply) {
    console.log("sendReply()", res, reply)
    res.json(reply)
  }

  // request receives this in response to the above.
  hearReply(reply) {
    console.log("hearReply()", reply)
    this.emit('reply', reply, reply.body, null)
  }
}
