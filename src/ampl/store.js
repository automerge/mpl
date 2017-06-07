import Tesseract from 'tesseract'
import fs from 'fs'
import uuid from './uuid'
import aMPLNet from './amplnet'

export default class Store {
  constructor(reducer) {
    this.reducer   = reducer
    this.state     = this.tesseractInit()
    this.listeners = []

    let network = new aMPLNet()
    network.connect({
      peerId: this.state._state.get("_id"),
      docId: this.state.docId,
      store: this
    })

    this.network = network
  }

  dispatch(action) {
    let state = this.state
    let changesets 

    switch(action.type) {
      case "NEW_DOCUMENT":
        changeset = this.newDocument(state, action)
        break;
      case "OPEN_DOCUMENT":
        changeset = this.openDocument(state, action)
        break;
      case "MERGE_DOCUMENT":
        changeset = this.mergeDocument(state, action)
        break;
      case "APPLY_DELTAS":
        changeset = action.deltas 
        break;
      default:
        changeset = Tesseract.changeset(state, (doc) => { this.reducer(doc, action) })
    }

    this.state = Tesseract.applyChangeset(this.state, newState)

    if(action.type === "NEW_DOCUMENT" || action.type === "OPEN_DOCUMENT") {
      if(this.network) this.network.disconnect()

      let network = new aMPLNet()
      network.connect({
        peerId: this.state._state.get("_id"),
        docId: this.state.docId,
        store: this
      })

      this.network = network
    }

    this.network.broadcast(newState, action.type)
    this.listeners.forEach((listener) => listener(changeset))
  }

  subscribe(listener) {
    this.listeners.push(listener)
  }

  getState() {
    return this.state
  }

  save() {
    return Tesseract.save(this.getState())
  }

  openDocument(state, action) {
    let tesseract

    if(action.file)
      tesseract = Tesseract.load(action.file)
    else if(action.docId) {
      tesseract = Tesseract.init()
      tesseract = Tesseract.changeset(tesseract, "open document", (doc) => {
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
      doc.docId = uuid() 
    })

    return tesseract
  }
}
