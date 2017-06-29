import Automerge from 'automerge'
import fs from 'fs'
import uuidv4 from 'uuid/v4'

import Network from './network'
import DeltaRouter from './network/delta-router'
import Config from './config'

export default class Store {
  constructor(reducer, network) {
    this.reducer   = reducer
    this.state     = this.automergeInit()
    this.listeners = []

    this.network = network || new Network()
    this.network.connect({
      // we use our automerge session ID as the peer id,
      // but we probably want to use the network ID for the document actorIds
      name: Config.name,
      peerId: this.state._state.get("actorId")
    })
    
    // the deltaRouter we have right now is per-document, so we need to reinitialize it for each new document.
    this.deltaRouter = new DeltaRouter(this.network.peergroup,
      // use this.state so this.getState() can be monkeypatched outside of Automesh
      () => this.state,
      (deltas) => {
        this.state = this.applyDeltas(this.state, deltas)
        this.listeners.forEach((listener) => listener())
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
          this.network.broadcastActiveDocId(this.state.docId)
      if(this.deltaRouter) this.deltaRouter.broadcastVectorClock()
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
    return Automerge.getHistory(this.state)
  }

  save() {
    return Automerge.save(this.getState())
  }

  forkDocument(state, action) {
    return Automerge.changeset(state, { action: action }, (doc) => {
      doc.docId = uuidv4()
    })
  }

  openDocument(state, action) {
    let automerge

    if(action.file)
      automerge = Automerge.load(action.file)
    else if(action.docId) {
      automerge = Automerge.init()
      automerge = Automerge.changeset(automerge, { action: action }, (doc) => {
        doc.docId = action.docId
      })
    }

    return automerge
  }

  mergeDocument(state, action) {
    let otherAutomerge = Automerge.load(action.file)
    return Automerge.merge(state, otherAutomerge)
  }

  applyDeltas(state, deltas) {
    return Automerge.applyDeltas(state, deltas)
  }

  newDocument(state, action) {
    return this.automergeInit()
  }

  removeAllListeners() {
    this.listeners = []
  }

  getPeerDocs() {
    return this.network.getPeerDocs()
  }

  automergeInit() {
    let automerge = new Automerge.init()
    automerge = Automerge.changeset(automerge, "new document", (doc) => {
      doc.docId = uuidv4()
    })

    return automerge
  }
}
