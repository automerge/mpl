let ampl = require('./lib/ampl')
let wrtc = require('wrtc')

let fieldName = (process.env.NAME || 'anonybot') + Math.floor(Math.random() * 1000)
            
let store = new ampl.default.Store(
    (state, action) => {
      switch(action.type) {
        case "INCREMENT_COUNTER":
          return ampl.default.Tesseract.changeset(state, "increment counter", (doc) => {
            doc[fieldName] = (state[fieldName] || 0) + 1
          })
        default:
          return state
      }
    }, new ampl.default.Network(wrtc))

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