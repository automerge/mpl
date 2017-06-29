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

var _deltaRouter = require('./network/delta-router');

var _deltaRouter2 = _interopRequireDefault(_deltaRouter);

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Store = function () {
  function Store(reducer, network) {
    var _this = this;

    _classCallCheck(this, Store);

    this.reducer = reducer;
    this.state = this.automergeInit();
    this.listeners = [];

    this.network = network || new _network2.default();
    this.network.connect({
      // we use our automerge session ID as the peer id,
      // but we probably want to use the network ID for the document actorIds
      name: _config2.default.name,
      peerId: this.state._state.get("actorId")
    }

    // the deltaRouter we have right now is per-document, so we need to reinitialize it for each new document.
    );this.deltaRouter = new _deltaRouter2.default(this.network.peergroup,
    // use this.state so this.getState() can be monkeypatched outside of Automesh
    function () {
      return _this.state;
    }, function (deltas) {
      _this.state = _this.applyDeltas(_this.state, deltas);
      _this.listeners.forEach(function (listener) {
        return listener();
      });
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

      this.state = newState;

      if (!this.deltaRouter || action.type === "NEW_DOCUMENT" || action.type === "OPEN_DOCUMENT" || action.type === "FORK_DOCUMENT") {
        this.network.broadcastActiveDocId(this.state.docId);
        if (this.deltaRouter) this.deltaRouter.broadcastVectorClock();
      }

      this.deltaRouter.broadcastState();
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
      return _automerge2.default.changeset(state, { action: action }, function (doc) {
        doc.docId = (0, _v2.default)();
      });
    }
  }, {
    key: 'openDocument',
    value: function openDocument(state, action) {
      var automerge = void 0;

      if (action.file) automerge = _automerge2.default.load(action.file);else if (action.docId) {
        automerge = _automerge2.default.init();
        automerge = _automerge2.default.changeset(automerge, { action: action }, function (doc) {
          doc.docId = action.docId;
        });
      }

      return automerge;
    }
  }, {
    key: 'mergeDocument',
    value: function mergeDocument(state, action) {
      var otherAutomerge = _automerge2.default.load(action.file);
      return _automerge2.default.merge(state, otherAutomerge);
    }
  }, {
    key: 'applyDeltas',
    value: function applyDeltas(state, deltas) {
      return _automerge2.default.applyDeltas(state, deltas);
    }
  }, {
    key: 'newDocument',
    value: function newDocument(state, action) {
      return this.automergeInit();
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
  }, {
    key: 'automergeInit',
    value: function automergeInit() {
      var automerge = new _automerge2.default.init();
      automerge = _automerge2.default.changeset(automerge, "new document", function (doc) {
        doc.docId = (0, _v2.default)();
      });

      return automerge;
    }
  }]);

  return Store;
}();

exports.default = Store;