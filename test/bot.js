require("babel-register")

let mpl = require('../src/mpl')
let wrtc = require('wrtc')

require("dotenv").config()

let store = new mpl.Store((state, action) => {
  switch(action.type) {
    case "INCREMENT_COUNTER":
      return mpl.default.Automerge.changeset(state, "increment counter", (doc) => {
        doc.counter = (state.counter || 0) + 1
      })
    default:
      return state
  }
}, new mpl.Network(wrtc))

store.dispatch({ type: "OPEN_DOCUMENT", docId: "botcounter-abcd" })
setInterval(() => {
  store.dispatch({ type: "INCREMENT_COUNTER" })
  console.log(store.getState().counter)
}, 100)
