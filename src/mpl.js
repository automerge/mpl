import Store from './mpl/store'
import Network from './mpl/network'
import Automerge from 'automerge'
import config from './mpl/config'

const MPL = { 
  Store: Store,
  Automerge: Automerge,
  Network: Network,
  config: config
}

export default MPL
