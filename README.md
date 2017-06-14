# aMPL
a Magic Persistence Layer

- [Guide](#guide)
- [API](#api)
  * [Store](#store)
  * [Provided Actions](#provided-actions)
- [Development](#development)

## Guide

This guide will demonstrate how to create a basic counter app using Electron, React, and aMPL. First, start by creating a new Electron app using Electron Forge with the React template.

```bash
$ npm install -g electron-forge
$ electron-forge init demo --template=react
$ cd demo
```

Now, install aMPL:

```bash
$ npm install --save git+ssh://git@github.com/inkandswitch/ampl.git
```

In `src/app.jsx`, initialize the aMPL store and add the counter to the view:

```js
import React from 'react'
import aMPL from 'ampl'

export default class App extends React.Component {
  constructor() {
    super()

    // Configure our Slack signaler by setting
    // process.env.SLACK_BOT_TOKEN or ampl.config.slackBotToken
    aMPL.config.slackBotToken = "some token"

    this.store = new aMPL.Store((state, action) => {
      switch(action.type) {
        case "INCREMENT_COUNTER":
          return aMPL.Tesseract.changeset(state, "increment counter", (doc) => {
            doc.counter = (state.counter || 0) + 1
          })
        default:
          return state
      }
    })

    // Force App component to re-render when state changes
    this.store.subscribe(() => this.setState({}))
  }

  componentDidMount() {
    // Normally your app would get your document id via URL or from a file,
    // but here we will fix it to "1" so our clients join the same doc
    this.store.dispatch({ type: "OPEN_DOCUMENT", docId: "1" })
  }

  render() {
    return <div>
      <h2>Counter: { this.store.getState().counter }</h2>
      <button onClick={ () => this.store.dispatch({type: "INCREMENT_COUNTER"}) } >
        Increment
      </button>
    </div>
  }
}
```

In the code above, replace `some token` with the Slack token that you obtained by *TODO instructions*.

Start two clients and try incrementing the counter by clicking the button, and you should see the counters synchronize on both clients:

```bash
$ npm start & npm start
```

## API

### `Store`

The `Store` class is modeled off of [Redux](http://redux.js.org/) and follows the same basic pattern.

#### `new Store(reducer)`

Constructor that accepts a reducer function. When an action is dispatched to the store, it first checks against aMPL's provided reducer actions and then invokes your reducer if the action did not map to any of the provided ones.

#### `getState()`

Returns the current state object including all of your persisted data.

#### `getHistory()`

Returns the changeset history from the state.

**Ex:**

```js
store.getHistory()
=> [
  {
    "changeset": {
      "actor": "61d8b814-463c-4092-b71d-7137873840e4",
      "seq": 1,
      "deps": {},
      "message": "new document",
      "ops": [...]
    },
    "snapshot": {
      "cards": [...],
      "lists": [...],
      "docId": "saffron-guangzhou-85"
    }
  }
]
```

#### `dispatch(action)`

Sends an action through your reducer. You should only modify the state through `dispatch`. Note: dispatch is a synchronous function.

#### `subscribe(listener)`

Allows to register a listener callback. All listeners are invoked whenver there is a state change in the store, including inbound changes that come in through other peers over the network.

#### `save()`

Returns a JSON serialization of your store's state. This is useful for persisting your state to a file, which can then be opened later by dispatching a `"OPEN_DOCUMENT"` action.


### Provided Actions

`aMPL.Store` provides several built-in actions to create, open, and merge documents. All document management should go through your `aMPL.Store` instance so that aMPL can connect to the right peer group and broadcast state changes over the network.

#### `"NEW_DOCUMENT"`

Resets the store's state to a new document.

**Ex:**

```js
this.store.dispatch({
  type: "NEW_DOCUMENT"
})
```

#### `"OPEN_DOCUMENT"`

Opens a new document. Accepts a `docId` or `file` blob as parameters (i.e. the serialized output from `aMPL.Store#save()`. 

**Ex:**

```js
this.store.dispatch({
  type: "OPEN_DOCUMENT", docId: "1234-5678-9"
})
```

#### `"FORK_DOCUMENT"`

Creates a fork of the current document, copying all of its current data but creating a new docId.

**Ex:**

```js
this.store.dispatch({
  type: "FORK_DOCUMENT"
})
```

## Development

### Compiling

aMPL is configured via Babel to use ES2016 syntax. The source code is located in `src` and compiled code in `lib`. Make sure to compile and commit before creating a new release:

```bash
$ npm run compile
```

### Testing

To run tests:

```bash
$ npm run test
```

## Versions

When it's time to cut a release do the following:

1. Edit local package.json and set version number (eg. 0.0.5)
2. Make sure all code is compiled:

```bash
$ npm run compile
```

3. Create a commit, tag, and push:

```bash
$ git commit -a -m "v0.0.5"
$ git tag v0.0.5
$ git push --tags
```
