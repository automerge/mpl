let bonjour = require('bonjour')()
let WebSocket = require('ws');
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
    const wss = new WebSocket.Server({ port: this.PORT });

    wss.on('connection', (ws) => {
      ws.on('message', (raw) => {
        console.log('received: %s', raw);
        var signal = JSON.parse(raw)
        this.hearOffer(ws, signal);
      });
    });
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

    let ws;
    if (!ws) {
      ws = new WebSocket("ws://"+service.host+":"+service.port+"/");
    }

    ws.on('open', () => {
      ws.send(JSON.stringify(msg));
    });

    ws.on('message', (data) => {
      console.log("Reply received: ")
      console.log(data);
      this.hearReply(JSON.parse(data))
    });
  }

  // express calls this in response to a post on "/"
  hearOffer(ws, signal) {
    console.log("hearOffer:", ws, signal)
    let meta = {name: signal.name, session: signal.session, action: 'offer'}
    this.emit('offer', meta, signal.body, (reply) => {
      let msg = {name: this.NAME, session: this.SESSION, body: reply, action: 'reply'}
      this.sendReply(ws, msg)
    })
  }

  // this gets sent over the wire by express.
  sendReply(ws, reply) {
    console.log("sendReply()", ws, reply)
    ws.send(JSON.stringify(reply))
  }

  // request receives this in response to the above.
  hearReply(reply) {
    console.log("hearReply()", reply)
    this.emit('reply', reply, reply.body, null)
  }
}
