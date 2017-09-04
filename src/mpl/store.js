import Automerge from 'automerge'
import fs from 'fs'
import uuidv4 from 'uuid/v4'

import Network from './network'
import Config from './config'

export default class Store {
  constructor(reducer, network) {
    this.reducer   = reducer
    this.listeners = []
    this.state     = this.newDocument()
    this.docSet    = new Automerge.DocSet()
    this.docSet.setDoc(this.state.docId, this.state)

    this.docSet.registerHandler((docId, doc) => {
      if (docId === this.state.docId && doc !== this.state) {
        this.state = doc
        this.listeners.forEach((listener) => listener())
      }
    })

    this.network = network || new Network(this.docSet)
    this.network.connect({
      // we use our automerge session ID as the peer id,
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

    if (this.state.docId !== newState.docId) {
      this.network.broadcastActiveDocId(newState.docId)
    }

    this.state = newState
    this.docSet.setDoc(newState.docId, newState)
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
    if (action.file) return Automerge.load(action.file)

    if (action.docId) {
      let doc = this.docSet.getDoc(action.docId)
      if (doc) return doc

      return Automerge.changeset(Automerge.init(), { action: action }, (doc) => {
        doc.docId = action.docId
      })
    }
  }

  mergeDocument(state, action) {
    return Automerge.merge(state, Automerge.load(action.file))
  }

  newDocument(state, action) {
    return Automerge.changeset(Automerge.init(), "new document", (doc) => {
      doc.docId = uuidv4()
    })
  }

  removeAllListeners() {
    this.listeners = []
  }

  getPeerDocs() {
    return this.network.getPeerDocs()
  }
}
