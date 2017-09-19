let mpl = require('./lib/mpl')
let wrtc = require('wrtc')

let fieldName = (process.env.NAME || 'anonybot') + Math.floor(Math.random() * 1000)
mpl.default.config.name = fieldName // ugh
let docId = process.env.DOC_ID || "botcounter"

let store = new mpl.default.Store(
    (state, action) => {
      switch(action.type) {
        case "INCREMENT_COUNTER":
          return mpl.default.Automerge.change(state, "increment counter", (doc) => {
            doc[fieldName] = (state[fieldName] || 0) + 1
          })
        default:
          return state
      }
    }, new mpl.default.Network(wrtc))

store.dispatch({ type: "OPEN_DOCUMENT", docId: docId })

store.network.signaler.manualHello("192.168.0.110", "3952")

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
