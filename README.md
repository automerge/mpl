# aMPL
a Magic Persistence Layer

### Guide

   $ electron-forge init demo --template=react
   $ npm install git+ssh://git@github.com/inkandswitch/ampl.git 

In src/app.jsx:

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

Now start the app twice with:

    $ NAME=bob    DOC_ID=1 npm start
    $ NAME=loblaw DOC_ID=1 npm start

Updating the counter on either client should also sync to the other now.
