let ampl = require('./lib/ampl')
let wrtc = require('wrtc')

let store = new ampl.default.Store(
    (state, action) => {
      switch(action.type) {
        case "INCREMENT_COUNTER":
          return ampl.default.Tesseract.changeset(state, "increment counter", (doc) => {
            doc.counter = (state.counter || 0) + 1
          })
        default:
          return state
      }
    },
    // for bots we need to pass in a network that has a node-friendly webrtc implementation.
    new ampl.default.Network({wrtc: wrtc}))

store.dispatch({ type: "OPEN_DOCUMENT", docId: "botcounter" })

//setInterval( () => store.dispatch({ type: "INCREMENT_COUNTER", docId: "botcounter" }), 5000)

store.subscribe( () => {
    var state = store.getState()
    console.log("State changed: ", state)
})