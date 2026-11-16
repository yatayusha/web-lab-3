(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
      module.exports = api;
    } else {
      root.Game2048 = api;
    }
  })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
  
    const SIZE = 4;
    const DIRECTIONS = ['left', 'right', 'up', 'down'];

  });