'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _store = require('./mpl/store');

var _store2 = _interopRequireDefault(_store);

var _network = require('./mpl/network');

var _network2 = _interopRequireDefault(_network);

var _automerge = require('automerge');

var _automerge2 = _interopRequireDefault(_automerge);

var _config = require('./mpl/config');

var _config2 = _interopRequireDefault(_config);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var MPL = {
  Store: _store2.default,
  Automerge: _automerge2.default,
  Network: _network2.default,
  config: _config2.default
};

exports.default = MPL;