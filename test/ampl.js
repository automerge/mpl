import assert from 'assert'
import aMPL from '../src/ampl'
import dotenv from 'dotenv'
import wrtc from 'wrtc'
import childProcess from 'child_process'

dotenv.config()

function createStore(middleware) {
  let store = new aMPL.Store((state, action) => {
    switch(action.type) {
      case "INCREMENT":
        return aMPL.Tesseract.changeset(state, "INCREMENT", (doc) => {
          doc.counter = (state.counter || 0) + 1
        })
      default:
        return state
    }
  }, new aMPL.Network(wrtc), middleware)

  return store
}

describe("Middleware", function() {
  it("wraps the store's dispatch method", function() {
    let before, after 
    let setFlags = ({ getState, dispatch}) => {
      return next => action => {
          before = "success"
          let nextMiddleware = next(action)
          after = "success"
          return nextMiddleware
      }
    } 

    let store = createStore([ setFlags ])
    store.dispatch({ type: "INCREMENT" })

    assert.equal(before, "success") 
    assert.equal(after, "success") 
    assert.equal(store.getState().counter, 1)
  })
})

describe("Store", function() {
  it("initializes", function() {
    assert.doesNotThrow(() => {
      let store = createStore()
    })
  })

  it.skip("has a UUID", function() {
    let store = createStore()
    assert(store.getState.docId, "no docID set: XXX @choxi what should we actually test here?")
  })

  it("accepts a reducer", function() {
    let store = createStore()
    store.dispatch({ type: "INCREMENT" })

    assert.equal(1, store.getState().counter)
  })

  it("allows you to overwrite default reducer actions", function() {
    let store = createStore()
    store.newDocument = (state, action) => {
      return aMPL.Tesseract.changeset(state, (doc) => {
        doc.foo = "bar"
      })
    }

    store.dispatch({ type: "NEW_DOCUMENT" })

    assert.equal("bar", store.getState().foo)
  })

  it("allows you to fork documents", function() {
    let store = createStore()
    let originalDocId = store.getState().docId

    store.dispatch({ type: "INCREMENT" })
    store.dispatch({ type: "FORK_DOCUMENT" })

    assert.equal(store.getState().counter, 1)
    assert.notEqual(store.getState().docId, originalDocId)
    assert.notEqual(store.getState().docId, undefined)
  })

})

describe("getHistory()", function() {
  it("returns the store's changeset history", function() {
    let store = createStore()
    assert.equal(store.getHistory().length, 1)
    assert.equal(store.getHistory()[0].changeset.message, "new document")

    store.dispatch({ type: "INCREMENT" })
    assert.deepEqual(store.getHistory().length, 2)
    assert.equal(store.getHistory()[1].changeset.message, "INCREMENT")
  })

  it("returns the action data for forkDocument", function() {
    let store = createStore()
    store.dispatch({ type: "FORK_DOCUMENT" })
    assert.deepEqual(store.getHistory()[1].changeset.message.action.type, "FORK_DOCUMENT")
  })
})

describe.skip("Network", function() {
  it("synchronizes between two clients", function(done) {
    this.timeout(30000)

    childProcess.execFile("node", ["test/bot.js"], (error, stdout, stderr) => {
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
