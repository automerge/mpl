## aMPL
a Magic Persistence Layer

## Guide

This guide will demonstrate how to create a basic counter app using Electron, React, and aMPL. First, start by creating a new Electron app using Electron Forge with the React template.

    $ electron-forge init demo --template=react
    
Now, install aMPL:

    $ npm install git+ssh://git@github.com/inkandswitch/ampl.git 

In src/app.jsx, initialize the aMPL store and add the counter and increment button to the view:

    import React from 'react';
    import aMPL from 'ampl'

    export default class App extends React.Component {
      constructor() {
        super()

        this.store = new aMPL.Store((state, action) => {
          switch(action.type) { case "INCREMENT_COUNTER":
              return aMPL.Tesseract.set(state, "counter", (state.counter || 0) + 1)
            default:
              return state
          }
        })

        // This forces the component to update on state changes
        this.store.subscribe(() => this.setState({}))
      }

      componentDidMount() {
        if(process.env.DOC_ID)
          this.store.dispatch({ type: "OPEN_DOCUMENT", docId: process.env.DOC_ID })
      }

      render() {
        return (<div>
          <h2>Counter: { this.store.getState().counter }</h2>
          <button
            onClick={ () => this.store.dispatch({type: "INCREMENT_COUNTER"}) } >
            Increment
          </button>
        </div>);
      }
    }

To start the app and test out synchronization, we pass a document ID in an environment variable. Both clients need the same document ID to connect to the same peer group:

    $ DOC_ID=1 npm start
    $ DOC_ID=1 npm start

On either client, try updating the counter and notice that it seamlessly syncs to the other client.
