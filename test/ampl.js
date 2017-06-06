import assert from 'assert'
import aMPL from '../src/ampl'
import dotenv from 'dotenv'

dotenv.config()

function createStore() {
  let store = new aMPL.Store((state, action) => {
    switch(action.type) {
      case "INCREMENT":
        return aMPL.Tesseract.set(state, "counter", (state.counter || 0) + 1)
      default:
        return state
    }
  })

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
      return aMPL.Tesseract.set(state, "foo", "bar")
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
    this.timeout(15000)

    let storeA = createStore()
    let storeB = createStore()
    let stores = [storeA, storeB]

    stores.forEach((store) => store.dispatch({type: "OPEN_DOCUMENT", docId: 1}))
    storeA.dispatch({ type: "INCREMENT" })

    setInterval(() => {
      assert.equal(1, storeB.getState().counter)
      done()
    }, 10000)
  })
})
