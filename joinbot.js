let ampl = require('./lib/ampl')
let wrtc = require('wrtc')

let store = new ampl.default.Store(
    (state, action) => {
      switch(action.type) {
        case "INCREMENT_COUNTER":
          return ampl.default.Tesseract.changeset(state, "increment counter", (doc) => {
            doc.counter = (state.counter || 0) + 1
            console.log("Incremented counter to", doc.counter)
          })
        default:
          return state
      }
    }, {network: {wrtc: wrtc}})

store.dispatch({ type: "OPEN_DOCUMENT", docId: "botcounter" })

store.network.signaler.hearHello(process.env.REMOTENAME, process.env.REMOTESESSION, process.env.REMOTEHOST, process.env.REMOTEPORT)

setInterval( () => store.dispatch({ type: "INCREMENT_COUNTER", docId: "botcounter" }), 5000)
store.getState()
