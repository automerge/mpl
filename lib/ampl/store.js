'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _tesseract = require('tesseract');

var _tesseract2 = _interopRequireDefault(_tesseract);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _uuid = require('./uuid');

var _uuid2 = _interopRequireDefault(_uuid);

var _amplnet = require('./amplnet');

var _amplnet2 = _interopRequireDefault(_amplnet);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Store = function (_EventEmitter) {
  _inherits(Store, _EventEmitter);

  function Store(reducer) {
    _classCallCheck(this, Store);

    var _this = _possibleConstructorReturn(this, (Store.__proto__ || Object.getPrototypeOf(Store)).call(this));

    _this.reducer = reducer;
    _this.state = _this.tesseractInit();
    _this.listeners = [];

    var network = new _amplnet2.default();
    network.connect({
      peerId: _this.state._state.get("_id"),
      docId: _this.state.docId,
      store: _this
    });

    _this.network = network;
    return _this;
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

      //    this.network.broadcast(newState, action.type)
      this.emit('change', action.type, newState);

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
    key: 'save',
    value: function save() {
      return _tesseract2.default.save(this.getState());
    }
  }, {
    key: 'openDocument',
    value: function openDocument(state, action) {
      var tesseract = void 0;

      if (action.file) tesseract = _tesseract2.default.load(action.file);else if (action.docId) {
        tesseract = _tesseract2.default.init();
        tesseract = _tesseract2.default.set(tesseract, "docId", action.docId);
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
      tesseract = _tesseract2.default.set(tesseract, "docId", (0, _uuid2.default)());

      return tesseract;
    }
  }]);

  return Store;
}(_events2.default);

exports.default = Store;