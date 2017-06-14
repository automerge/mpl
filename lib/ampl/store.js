'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _tesseract = require('tesseract');

var _tesseract2 = _interopRequireDefault(_tesseract);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _v = require('uuid/v4');

var _v2 = _interopRequireDefault(_v);

var _amplnet = require('./amplnet');

var _amplnet2 = _interopRequireDefault(_amplnet);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Store = function () {
  function Store(reducer, options) {
    _classCallCheck(this, Store);

    this.reducer = reducer;
    this.state = this.tesseractInit();
    this.listeners = [];

    this.options = options || { network: {} };

    var network = new _amplnet2.default(this.options.network);
    network.connect({
      peerId: this.state._state.get("_id"),
      docId: this.state.docId,
      store: this
    });

    this.network = network;
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
        case "APPLY_DELTAS":
          newState = this.applyDeltas(state, action);
          break;
        default:
          newState = this.reducer(state, action);
      }

      this.state = newState;

      if (action.type === "NEW_DOCUMENT" || action.type === "OPEN_DOCUMENT") {
        if (this.network) this.network.disconnect();

        var network = new _amplnet2.default();
        network.connect({
          peerId: this.state._state.get("_id"),
          docId: this.state.docId,
          store: this
        });

        this.network = network;
      }

      this.network.broadcast(newState, action.type);
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
      return _tesseract2.default.getHistory(this.state);
    }
  }, {
    key: 'save',
    value: function save() {
      return _tesseract2.default.save(this.getState());
    }
  }, {
    key: 'forkDocument',
    value: function forkDocument(state, action) {
      return _tesseract2.default.changeset(state, "fork document", function (doc) {
        doc.docId = (0, _v2.default)();
      });
    }
  }, {
    key: 'openDocument',
    value: function openDocument(state, action) {
      var tesseract = void 0;

      if (action.file) tesseract = _tesseract2.default.load(action.file);else if (action.docId) {
        tesseract = _tesseract2.default.init();
        tesseract = _tesseract2.default.changeset(tesseract, "open document", function (doc) {
          doc.docId = action.docId;
        });
      }

      return tesseract;
    }
  }, {
    key: 'mergeDocument',
    value: function mergeDocument(state, action) {
      var otherTesseract = _tesseract2.default.load(action.file);
      return _tesseract2.default.merge(state, otherTesseract);
    }
  }, {
    key: 'applyDeltas',
    value: function applyDeltas(state, action) {
      return _tesseract2.default.applyDeltas(state, action.deltas);
    }
  }, {
    key: 'newDocument',
    value: function newDocument(state, action) {
      return this.tesseractInit();
    }
  }, {
    key: 'removeAllListeners',
    value: function removeAllListeners() {
      this.listeners = [];
    }
  }, {
    key: 'tesseractInit',
    value: function tesseractInit() {
      var tesseract = new _tesseract2.default.init();
      tesseract = _tesseract2.default.changeset(tesseract, "new document", function (doc) {
        doc.docId = (0, _v2.default)();
      });

      return tesseract;
    }
  }]);

  return Store;
}();

exports.default = Store;