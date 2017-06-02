'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _store = require('./ampl/store');

var _store2 = _interopRequireDefault(_store);

var _tesseract = require('tesseract');

var _tesseract2 = _interopRequireDefault(_tesseract);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var aMPL = {
  Store: _store2.default,
  Tesseract: _tesseract2.default
};

exports.default = aMPL;