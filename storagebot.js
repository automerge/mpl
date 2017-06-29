let mpl = require('./lib/mpl')
let wrtc = require('wrtc')
let uuidv4 = require('uuid/v4')

let botKeyName = (process.env.NAME || 'anonybot') + Math.floor(Math.random() * 1000)
let botSession = uuidv4() // never reuse sessions. never ever.

let network = new mpl.default.Network(wrtc)
network.connect({
    peerId: botSession
})

let peergroup = network.peergroup

let documents = {}

// i probably just want two-argument versions of these things rather than all these listeners? maybe?
peergroup.on('peer', (peer) => {
    peer.on('message', (m) => {
        if (m.docId) {
            if (!documents[m.docId]) {
                documents[m.docId] = Automerge.init() // ... figure this part out?
            }
        }
    })
})

store.dispatch({ type: "OPEN_DOCUMENT", docId: "botcounter" })

if (process.env.REMOTEHOST) {
  store.network.signaler.manualHello(process.env.REMOTEHOST, process.env.REMOTEPORT)
}

setInterval( () => store.dispatch({ type: "INCREMENT_COUNTER", docId: "botcounter" }), 5000)

store.network.peergroup.on('peer', (peer) => {
    console.log("New peer:", peer)
})

store.subscribe( () => {
    var state = store.getState()
    console.log("State changed: ", state)
})