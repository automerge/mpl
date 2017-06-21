require("babel-register")

let ampl = require('../src/ampl')
let wrtc = require('wrtc')

require("dotenv").config()

console.log("config", ampl.config)
ampl.config.name = "ampltestbot"

let store = new ampl.Store((state, action) => {
  switch(action.type) {
    case "INCREMENT_COUNTER":
      return ampl.default.Tesseract.changeset(state, "increment counter", (doc) => {
        doc.counter = (state.counter || 0) + 1
      })
    default:
      return state
  }
}, new ampl.Network(wrtc))

store.dispatch({ type: "OPEN_DOCUMENT", docId: "botcounter-abcd" })
setInterval(() => {
  store.dispatch({ type: "INCREMENT_COUNTER" })
  console.log(store.getState().counter)
}, 100)
