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
    
    this.documents = {}
    this.routers = {}
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
    this.documents[newState.docId] = newState

    if(!this.routers[this.state.docId]
        || action.type === "NEW_DOCUMENT"
        || action.type === "OPEN_DOCUMENT"
        || action.type === "FORK_DOCUMENT") {
          let docId = this.state.docId
          this.documents[docId] = this.state
          this.routers[docId] = new DeltaRouter(this.network.peergroup, 
            () => this.documents[docId], 
            (deltas) => {
              this.documents[docId] = this.applyDeltas(this.documents[docId], deltas)
              // only broadcast changes to redux for the document the user is looking at
              if (this.state.docId == docId) {// this.state.docId may change with each call
                this.state = this.documents[docId]
                this.listeners.forEach((listener) => listener())
              }
          })
    }

    this.network.peergroup.on('peer', (peer) => {
      peer.on('message', (m) => {
        if (!m.docId) {
          return
        }

        // whenever we see a docId we haven't seen before
        if (!this.documents[m.docId]) {
          console.log("New document detected:", m.docId)
          // initiate a tesseract
          this.documents[m.docId] = new Tesseract.init()
          // and give it a delta router
          this.routers[m.docId] = new DeltaRouter(this.network.peergroup, 
            () => this.documents[m.docId], 
            (deltas) => {
              this.documents[m.docId] = this.applyDeltas(this.documents[m.docId], deltas)
              // only broadcast changes to redux for the document the user is looking at
              if (this.state.docId == docId) {// this.state.docId may change with each call
                this.state = this.documents[docId]
                this.listeners.forEach((listener) => listener())
              }
          })
        }
      })
    })

    this.routers[this.state.docId].broadcastState()
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

  // XXX: this might lead to problems; which docId will we keep?
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

  tesseractInit() {
    let tesseract = new Tesseract.init()
    tesseract = Tesseract.changeset(tesseract, "new document", (doc) => {
      doc.docId = uuidv4() 
    })

    return tesseract
  }
}
