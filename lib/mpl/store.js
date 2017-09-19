'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _automerge = require('automerge');

var _automerge2 = _interopRequireDefault(_automerge);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _v = require('uuid/v4');

var _v2 = _interopRequireDefault(_v);

var _network = require('./network');

var _network2 = _interopRequireDefault(_network);

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Store = function () {
  function Store(reducer, network) {
    var _this = this;

    _classCallCheck(this, Store);

    this.reducer = reducer;
    this.listeners = [];
    this.state = this.newDocument();
    this.docSet = new _automerge2.default.DocSet();
    this.docSet.setDoc(this.state.docId, this.state);

    this.docSet.registerHandler(function (docId, doc) {
      if (docId === _this.state.docId && doc !== _this.state) {
        _this.state = doc;
        _this.listeners.forEach(function (listener) {
          return listener();
        });
      }
    });

    this.network = network || new _network2.default(this.docSet);
    this.network.connect({
      // we use our automerge session ID as the peer id,
      // but we probably want to use the network ID for the document actorIds
      name: _config2.default.name,
      peerId: this.state._state.get("actorId")
    });
  }

  _createClass(Store, [{
    key: 'dispatch',
    value: function dispatch(action) {
      var state = this.state;
      var newState = void 0;

      switch (action.type) {
        case "NEW_DOCUMENT":
          newState = this.newDocument(state, action);
          break;
        case "OPEN_DOCUMENT":
          newState = this.openDocument(state, action);
          break;
        case "MERGE_DOCUMENT":
          newState = this.mergeDocument(state, action);
          break;
        case "FORK_DOCUMENT":
          newState = this.forkDocument(state, action);
          break;
        default:
          newState = this.reducer(state, action);
      }

      if (this.state.docId !== newState.docId) {
        this.network.broadcastActiveDocId(newState.docId);
      }

      this.state = newState;
      this.docSet.setDoc(newState.docId, newState);
      this.listeners.forEach(function (listener) {
        return listener();
      });
    }
  }, {
    key: 'subscribe',
    value: function subscribe(listener) {
      this.listeners.push(listener);
    }
  }, {
    key: 'getState',
    value: function getState() {
      return this.state;
    }
  }, {
    key: 'getHistory',
    value: function getHistory() {
      return _automerge2.default.getHistory(this.state);
    }
  }, {
    key: 'save',
    value: function save() {
      return _automerge2.default.save(this.getState());
    }
  }, {
    key: 'forkDocument',
    value: function forkDocument(state, action) {
      return _automerge2.default.change(state, { action: action }, function (doc) {
        doc.docId = (0, _v2.default)();
      });
    }
  }, {
    key: 'openDocument',
    value: function openDocument(state, action) {
      if (action.file) return _automerge2.default.load(action.file);

      if (action.docId) {
        var doc = this.docSet.getDoc(action.docId);
        if (doc) return doc;

        return _automerge2.default.change(_automerge2.default.init(), { action: action }, function (doc) {
          doc.docId = action.docId;
        });
      }
    }
  }, {
    key: 'mergeDocument',
    value: function mergeDocument(state, action) {
      return _automerge2.default.merge(state, _automerge2.default.load(action.file));
    }
  }, {
    key: 'newDocument',
    value: function newDocument(state, action) {
      return _automerge2.default.change(_automerge2.default.init(), "new document", function (doc) {
        doc.docId = (0, _v2.default)();
      });
    }
  }, {
    key: 'removeAllListeners',
    value: function removeAllListeners() {
      this.listeners = [];
    }
  }, {
    key: 'getPeerDocs',
    value: function getPeerDocs() {
      return this.network.getPeerDocs();
    }
  }]);

  return Store;
}();

exports.default = Store;