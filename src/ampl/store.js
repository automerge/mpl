import Tesseract from 'tesseract'
import fs from 'fs'
import uuidv4 from 'uuid/v4'

import Network from './network'
import DeltaRouter from './network/delta-router'
import Config from './config'

function compose () {
  var fns = arguments;

  return function (result) {
    for (var i = fns.length - 1; i > -1; i--) {
      result = fns[i].call(this, result);
    }

    return result;
  };
}

export default class Store {
  constructor(reducer, network, middlewares) {
    this.reducer   = reducer
    this.state     = this.tesseractInit()
    this.listeners = []

    // Middleware
    if(middlewares && middlewares.length > 0) {
      let dispatch = this.dispatch
      let api   = { getState: this.getState.bind(this), dispatch: action => dispatch(action) }
      let chain = middlewares.map(middleware => middleware(api))
      this.dispatch = compose(...chain)(dispatch.bind(this))
    }

    this.network = network || new Network()
    this.network.connect({
      // we use our tesseract session ID as the peer id,
      // but we probably want to use the network ID for the document actorIds
      name: Config.name,
      peerId: this.state._state.get("actorId")
    })
  }

  dispatch(action) {
    let state = this.state
    let newState

    switch(action.type) {
      case "NEW_DOCUMENT":
        newState = this.newDocument(state, action)
        break;
      case "OPEN_DOCUMENT":
        newState = this.openDocument(state, action)
        break;
      case "MERGE_DOCUMENT":
        newState = this.mergeDocument(state, action)
        break;
      case "FORK_DOCUMENT":
        newState = this.forkDocument(state, action)
        break;
      default:
        newState = this.reducer(state, action)
    }

    this.state = newState

    if(!this.deltaRouter
        || action.type === "NEW_DOCUMENT"
        || action.type === "OPEN_DOCUMENT"
        || action.type === "FORK_DOCUMENT") {
          // the deltaRouter we have right now is per-document, so we need to reinitialize it for each new document.
          this.deltaRouter = new DeltaRouter(this.network.peergroup,
            // use this.state so this.getState() can be monkeypatched outside of aMPL
            () => this.state,
            (deltas) => {
              this.state = this.applyDeltas(this.state, deltas)
              this.listeners.forEach((listener) => listener())
            })
          this.network.broadcastActiveDocId(this.state.docId)
    }

    this.deltaRouter.broadcastState()
    this.listeners.forEach((listener) => listener())
  }

  subscribe(listener) {
    this.listeners.push(listener)
  }

  getState() {
    return this.state
  }

  getHistory() {
    return Tesseract.getHistory(this.state)
  }

  save() {
    return Tesseract.save(this.getState())
  }

  forkDocument(state, action) {
    return Tesseract.changeset(state, { action: action }, (doc) => {
      doc.docId = uuidv4()
    })
  }

  openDocument(state, action) {
    let tesseract

    if(action.file)
      tesseract = Tesseract.load(action.file)
    else if(action.docId) {
      tesseract = Tesseract.init()
      tesseract = Tesseract.changeset(tesseract, { action: action }, (doc) => {
        doc.docId = action.docId
      })
    }

    return tesseract
  }

  mergeDocument(state, action) {
    let otherTesseract = Tesseract.load(action.file)
    return Tesseract.merge(state, otherTesseract)
  }

  applyDeltas(state, deltas) {
    return Tesseract.applyDeltas(state, deltas)
  }

  newDocument(state, action) {
    return this.tesseractInit()
  }

  removeAllListeners() {
    this.listeners = []
  }

  getPeerDocs() {
    return this.network.getPeerDocs()
  }

  tesseractInit() {
    let tesseract = new Tesseract.init()
    tesseract = Tesseract.changeset(tesseract, "new document", (doc) => {
      doc.docId = uuidv4()
    })

    return tesseract
  }
}
