(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
      module.exports = api;
    } else {
      root.Storage2048 = api;
    }
  })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
  
    const STATE_KEY = 'web2025-2048-state';
    const LEADERS_KEY = 'web2025-2048-leaders';
    const LIMIT = 10;

    function read(key) {
        try {
          const raw = localStorage.getItem(key);
          return raw ? JSON.parse(raw) : null;
        } catch (error) {
          return null;
        }
    }

});