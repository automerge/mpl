import Tesseract from 'tesseract'
import fs from 'fs'
import uuidv4 from 'uuid/v4'

import Network from './network'
import DeltaRouter from './network/delta-router'

export default class Store {
  constructor(reducer, network) {
    this.reducer   = reducer
    this.state     = this.tesseractInit()
    this.listeners = []

    this.network = network || new Network()
    this.network.connect({
      // we use our tesseract session ID as the peer id, 
      // but we probably want to use the network ID for the document actorIds
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
            () => this.getState(), 
            (deltas) => this.state = this.applyDeltas(deltas))
    }

    this.deltaRouter.broadcastState(newState)
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

  applyDeltas(state, action) {
    return Tesseract.applyDeltas(state, action.deltas)
  }

  newDocument(state, action) {
    return this.tesseractInit()
  }

  removeAllListeners() {
    this.listeners = []
  }

  tesseractInit() {
    let tesseract = new Tesseract.init()
    tesseract = Tesseract.changeset(tesseract, "new document", (doc) => {
      doc.docId = uuidv4() 
    })

    return tesseract
  }
}
