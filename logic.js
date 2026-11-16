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

        let moved = false;
        for (let index = 0; index < SIZE; index += 1) {
        const before = source[index];
        const after = row[index];
        const beforeId = before ? before.id : null;
        const afterId = after ? after.id : null;
        const beforeValue = before ? before.value : null;
        const afterValue = after ? after.value : null;
        if (beforeId !== afterId || beforeValue !== afterValue) moved = true;
        }

        return { row: row, score: score, moved: moved, transitions: transitions };
    }

    function move(board, direction) {

        if (DIRECTIONS.indexOf(direction) === -1) {
          throw new Error('Неизвестное направление: ' + direction);
        }
    
        const horizontal = direction === 'left' || direction === 'right';
        const reverse = direction === 'right' || direction === 'down';
        const next = emptyBoard();
        const transitions = [];
        let score = 0;
        let moved = false;
    
        for (let major = 0; major < SIZE; major += 1) {
          const line = [];
          for (let minor = 0; minor < SIZE; minor += 1) {
            line.push(horizontal ? board[major][minor] : board[minor][major]);
          }
          if (reverse) line.reverse();
    
          const slid = slideLine(line);
          const placed = reverse ? slid.row.slice().reverse() : slid.row;
          score += slid.score;
          if (slid.moved) moved = true;
    
          for (let minor = 0; minor < SIZE; minor += 1) {
            if (horizontal) next[major][minor] = placed[minor];
            else next[minor][major] = placed[minor];
          }
    
          slid.transitions.forEach(function (transition) {
            const fromMinor = reverse ? SIZE - 1 - transition.from : transition.from;
            const toMinor = reverse ? SIZE - 1 - transition.to : transition.to;
            transitions.push({

              id: transition.id,
              fromIndex: horizontal ? major * SIZE + fromMinor : fromMinor * SIZE + major,
              toIndex: horizontal ? major * SIZE + toMinor : toMinor * SIZE + major,
              value: transition.value,
              merged: transition.merged,
              absorbed: transition.absorbed,

            });
          });
        }
    
        return { board: next, score: score, moved: moved, transitions: transitions };
    }

    function hasMoves(board) {
        return DIRECTIONS.some(function (direction) {
          return move(board, direction).moved;
        });
    }

    function pickIndex(length, random) {
        if (length <= 1) return 0;
        const index = Math.floor(random() * length);
        if (index < 0) return 0;
        if (index >= length) return length - 1;
        return index;
    }

    function spawn(board, nextId, count, random) {
        const rng = random || Math.random;
        const next = cloneBoard(board);
        const spawned = [];
        let id = nextId;
        const amount = Math.max(0, count);
    
        for (let step = 0; step < amount; step += 1) {
            const cells = emptyCells(next);
            if (!cells.length) break;
            const cell = cells[pickIndex(cells.length, rng)];
            const value = rng() < 0.9 ? 2 : 4;
            next[cell.row][cell.column] = { id: id, value: value };
            spawned.push({ id: id, value: value, index: cell.index });
            id += 1;
        }
    
        return { board: next, nextId: id, spawned: spawned };
    }

    function newGame(random) {
        const rng = random || Math.random;
        const count = Math.min(3, Math.max(1, 1 + Math.floor(rng() * 3)));
        const spawned = spawn(emptyBoard(), 1, count, rng);
        return {
            board: spawned.board,
            score: 0,
            nextId: spawned.nextId,
            over: false,
            saved: false,
            undo: null,
        };
    }

    function applyMove(state, direction, random) {
        if (state.over) return { state: state, changed: false };
        const result = move(state.board, direction);
        if (!result.moved) return { state: state, changed: false };
    
        const rng = random || Math.random;
        const undo = {
            board: cloneBoard(state.board),
            score: state.score,
            nextId: state.nextId,
        };
        const count = rng() < 0.5 ? 1 : 2;
        const spawned = spawn(result.board, state.nextId, count, rng);
        const over = !hasMoves(spawned.board);
    
        return {
          changed: true,
          gained: result.score,
          transitions: result.transitions,
          spawned: spawned.spawned,
          state: {
            board: spawned.board,
            score: state.score + result.score,
            nextId: spawned.nextId,
            over: over,
            saved: false,
            undo: over ? null : undo,
          },
        };
    }

    function undo(state) {
        if (state.over || !state.undo) return { state: state, changed: false };
        return {
          changed: true,
          state: {
            board: cloneBoard(state.undo.board),
            score: state.undo.score,
            nextId: state.undo.nextId,
            over: false,
            saved: false,
            undo: null,
          },
        };
    }

    function tileCount(board) {
        return emptyCells(board).length === SIZE * SIZE
          ? 0
          : SIZE * SIZE - emptyCells(board).length;
    }

    return {
        SIZE: SIZE,
        DIRECTIONS: DIRECTIONS,
        emptyBoard: emptyBoard,
        cloneBoard: cloneBoard,
        slideLine: slideLine,
        move: move,
        hasMoves: hasMoves,
        spawn: spawn,
        newGame: newGame,
        applyMove: applyMove,
        undo: undo,
        tileCount: tileCount,
        emptyCells: emptyCells,
    };

  });