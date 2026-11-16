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

    function write(key, value) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (error) {
          return false;
        }
      }
    
      function isTile(cell) {
        return Boolean(cell)
          && Number.isInteger(cell.id)
          && Number.isInteger(cell.value)
          && cell.value >= 2;
      }
    
      function isBoard(board) {
        if (!Array.isArray(board) || board.length !== 4) return false;
        return board.every(function (row) {
          return Array.isArray(row)
            && row.length === 4
            && row.every(function (cell) {
              return cell === null || isTile(cell);
            });
        });
      }
    
      function copyBoard(board) {
        return board.map(function (row) {
          return row.map(function (cell) {
            return cell ? { id: cell.id, value: cell.value } : null;
          });
        });
      }
    
      function maxId(board) {
        let max = 0;
        board.forEach(function (row) {
          row.forEach(function (cell) {
            if (cell && cell.id > max) max = cell.id;
          });
        });
        return max;
      }
    
      function loadState() {
        const data = read(STATE_KEY);
        if (!data || !isBoard(data.board) || !Number.isInteger(data.score) || data.score < 0) {
          return null;
        }
    
        const board = copyBoard(data.board);
        let nextId = Number.isInteger(data.nextId) ? data.nextId : 1;
        const highest = maxId(board);
        if (nextId <= highest) nextId = highest + 1;
    
        let undo = null;
        if (data.undo && isBoard(data.undo.board) && Number.isInteger(data.undo.score)) {
          const undoBoard = copyBoard(data.undo.board);
          let undoNext = Number.isInteger(data.undo.nextId) ? data.undo.nextId : maxId(undoBoard) + 1;
          if (undoNext <= maxId(undoBoard)) undoNext = maxId(undoBoard) + 1;
          undo = {
            board: undoBoard,
            score: data.undo.score,
            nextId: undoNext,
          };
        }
    
        return {
          board: board,
          score: data.score,
          nextId: nextId,
          over: Boolean(data.over),
          saved: Boolean(data.saved),
          undo: undo,
        };
      }
    
      function saveState(state) {
        return write(STATE_KEY, {
          board: state.board,
          score: state.score,
          nextId: state.nextId,
          over: state.over,
          saved: state.saved,
          undo: state.undo,
        });
      }
    
      function leaders() {
        const data = read(LEADERS_KEY);
        if (!Array.isArray(data)) return [];
        return data.filter(function (row) {
          return row
            && typeof row.name === 'string'
            && row.name.length > 0
            && Number.isFinite(row.score)
            && typeof row.date === 'string';
        }).slice(0, LIMIT);
      }
    
      function best() {
        return leaders().reduce(function (max, row) {
          return Math.max(max, row.score);
        }, 0);
      }
    
      function addScore(entry) {
        const name = String(entry.name || '').replace(/\s+/g, ' ').trim().slice(0, 20);
        if (!name || !Number.isFinite(entry.score)) return { ok: false, leaders: leaders() };
    
        const next = leaders().concat([{
          name: name,
          score: entry.score,
          date: entry.date || new Date().toISOString(),
        }]);
        next.sort(function (a, b) {
          if (b.score !== a.score) return b.score - a.score;
          return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
        });
        const top = next.slice(0, LIMIT);
        const ok = write(LEADERS_KEY, top);
        return { ok: ok, leaders: top };
      }
    
      return {
        loadState: loadState,
        saveState: saveState,
        leaders: leaders,
        best: best,
        addScore: addScore,
      };
});