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

    function emptyBoard() {
        return Array.from({ length: SIZE }, function () {
          return Array(SIZE).fill(null);
        });
      }
    
    function cloneBoard(board) {
        return board.map(function (row) {
          return row.map(function (cell) {
            return cell ? { id: cell.id, value: cell.value } : null;
          });
        });
    }
    
    function emptyCells(board) {
        const cells = [];
        for (let row = 0; row < SIZE; row += 1) {
          for (let column = 0; column < SIZE; column += 1) {
            if (!board[row][column]) {
              cells.push({ row: row, column: column, index: row * SIZE + column });
            }
          }
        }
        return cells;
    }
    
    function slideLine(line) {
        const source = line.map(function (cell) {
          return cell ? { id: cell.id, value: cell.value } : null;
    });
    
        let work = [];
        source.forEach(function (cell, index) {
          if (cell) {
            work.push({
              id: cell.id,
              value: cell.value,
              from: index,
              merged: false,
              ghosts: [],
            });
          }
        });
    
        let score = 0;
        let changed = true;
        while (changed) {
          changed = false;
          const next = [];
          let index = 0;
          while (index < work.length) {
            const current = work[index];
            const neighbour = work[index + 1];
            if (neighbour && current.value === neighbour.value) {
              const value = current.value * 2;
              score += value;
              next.push({
                id: current.id,
                value: value,
                from: current.from,
                merged: true,
                ghosts: current.ghosts.concat(
                  [{ id: neighbour.id, from: neighbour.from, value: neighbour.value }],
                  neighbour.ghosts
                ),
              });
              index += 2;
              changed = true;
            } else {
              next.push(current);
              index += 1;
            }
          }
          work = next;
        }
        
        const row = Array(SIZE).fill(null);
        const transitions = [];
        work.forEach(function (item, to) {
        row[to] = { id: item.id, value: item.value };
        transitions.push({
        id: item.id,
        from: item.from,
        to: to,
        value: item.value,
        merged: item.merged,
        absorbed: false,
        });

        item.ghosts.forEach(function (ghost) {
        transitions.push({
          id: ghost.id,
          from: ghost.from,
          to: to,
          value: ghost.value,
          merged: false,
          absorbed: true,
        });
        });
    });
    }

  });