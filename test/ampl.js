import assert from 'assert'
import aMPL from '../src/ampl'
import dotenv from 'dotenv'
import wrtc from 'wrtc'
import childProcess from 'child_process'

dotenv.config()

function createStore() {
  let store = new aMPL.Store((state, action) => {
    switch(action.type) {
      case "INCREMENT":
        return aMPL.Tesseract.changeset(state, (doc) => {
          doc.counter = (state.counter || 0) + 1
        })
      default:
        return state
    }
  }, { network: { wrtc: wrtc }})

  return store
}

describe("Store", function() {
  it("initializes", function() {
    assert.doesNotThrow(() => {
      let store = new aMPL.Store(() => {})
    })
  })

  it("accepts a reducer", function() {
    let store = createStore()
    store.dispatch({ type: "INCREMENT" })

    assert.equal(1, store.getState().counter)
  })

  it("allows you to overwrite default reducer actions", function() {
    let store = new aMPL.Store()
    store.newDocument = (state, action) => {
      return aMPL.Tesseract.changeset(state, (doc) => {
        doc.foo = "bar"
      })
    }

    store.dispatch({ type: "NEW_DOCUMENT" })

    assert.equal("bar", store.getState().foo)
  })
})

describe("Config", function() {
  it("sets a shared configuration", function() {
    aMPL.config.slackBotToken = "PVH's Token"

    let store =  new aMPL.Store()

    assert.equal(aMPL.config.slackBotToken, store.network.token)
  })
})

describe("Network", function() {
  it.skip("synchronizes between two clients", function(done) {
    this.timeout(30000)

    childProcess.execFile("node", ["./bot.js"], (error, stdout, stderr) => {
      console.log("error: ", error)
      console.log("Stdout", stdout)
      console.log("stderr", stderr)
    })

    let store = createStore()

    aMPL.config.name = "Test Store"
    store.dispatch({type: "OPEN_DOCUMENT", docId: "botcounter-abcd"})

    setTimeout(() => {
      let counter = store.getState().counter
      assert(counter && counter > 0)
      done()
    }, 5000)
  })
})
