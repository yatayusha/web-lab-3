(function () {
    'use strict';
  
    const MOVE_MS = 220;
    const POP_MS = 180;
    const DIRECTIONS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  
    const boardEl = document.getElementById('board');
    const gridEl = document.getElementById('grid');
    const tilesEl = document.getElementById('tiles');
    const scoreEl = document.getElementById('score');
    const bestEl = document.getElementById('best');
    const undoButton = document.getElementById('undo');
    const restartButton = document.getElementById('restart');
    const overlayRestartButton = document.getElementById('overlay-restart');
    const leadersButton = document.getElementById('open-leaders');
    const closeLeadersButton = document.getElementById('close-leaders');
    const leadersEl = document.getElementById('leaders');
    const leadersBody = document.getElementById('leaders-body');
    const overlayEl = document.getElementById('overlay');
    const messageEl = document.getElementById('overlay-message');
    const scoreLineEl = document.getElementById('overlay-score');
    const formEl = document.getElementById('save-form');
    const nameInput = document.getElementById('player-name');
    const saveErrorEl = document.getElementById('save-error');
    const dpadEl = document.getElementById('dpad');
    const storageNoteEl = document.getElementById('storage-note');
  
    const tileEls = new Map();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  
    let state = null;
    let busy = false;
    let leadersOpen = false;
    let renderToken = 0;
    let overlayWasOpen = false;
    let gesture = null;
  
    function tileClass(value) {
      const known = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192];
      return known.indexOf(value) === -1 ? 'super' : String(value);
    }
  
    function pointsWord(value) {
      const abs = Math.abs(value) % 100;
      const last = abs % 10;
      if (abs > 10 && abs < 20) return 'очков';
      if (last === 1) return 'очко';
      if (last >= 2 && last <= 4) return 'очка';
      return 'очков';
    }
  
    function formatDate(iso) {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  
    function metrics() {
      const styles = getComputedStyle(gridEl);
      const gap = parseFloat(styles.columnGap || styles.gap) || 12;
      const padLeft = parseFloat(styles.paddingLeft) || 0;
      const padTop = parseFloat(styles.paddingTop) || 0;
      const padRight = parseFloat(styles.paddingRight) || 0;
      const width = gridEl.clientWidth;
      const size = (width - padLeft - padRight - gap * 3) / 4;
      return { gap: gap, padLeft: padLeft, padTop: padTop, size: size };
    }
  
    function place(el, index, animate) {
      const box = metrics();
      if (!(box.size > 0)) return;
      const row = Math.floor(index / 4);
      const column = index % 4;
      const x = box.padLeft + column * (box.size + box.gap);
      const y = box.padTop + row * (box.size + box.gap);
      el.dataset.index = String(index);
      el.style.width = box.size + 'px';
      el.style.height = box.size + 'px';
      if (!animate) el.style.transition = 'none';
      el.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
      if (!animate) {
        void el.offsetWidth;
        el.style.transition = '';
      }
    }
  
    function paintTile(el, value, extraClass) {
      el.dataset.digits = String(String(value).length);
      el.className = 'tile tile--' + tileClass(value) + (extraClass ? ' ' + extraClass : '');
      el.querySelector('.tile__face').textContent = String(value);
    }
  
    function addTile(tile, index, isNew) {
      const el = document.createElement('div');
      const face = document.createElement('span');
      face.className = 'tile__face';
      el.appendChild(face);
      paintTile(el, tile.value, isNew ? 'tile--new' : '');
      tilesEl.appendChild(el);
      tileEls.set(tile.id, el);
      place(el, index, false);
      return el;
    }
  
    function buildGrid() {
      gridEl.replaceChildren();
      for (let index = 0; index < 16; index += 1) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        gridEl.appendChild(cell);
      }
    }
  
    function renderScore(gained) {
      scoreEl.textContent = String(state.score);
      const record = Math.max(state.score, Storage2048.best());
      bestEl.textContent = String(record);
      bestEl.parentElement.classList.toggle('is-live', state.score > 0 && state.score >= record);
      if (gained > 0) {
        const floater = document.createElement('span');
        floater.className = 'gain';
        floater.textContent = '+' + gained;
        scoreEl.parentElement.appendChild(floater);
        floater.addEventListener('animationend', function () {
          floater.remove();
        });
      }
    }
  
    function showSaveError(text) {
      saveErrorEl.hidden = !text;
      saveErrorEl.textContent = text || '';
    }
  
    function syncChrome() {
      const showOver = state.over && !busy;
      document.body.classList.toggle('is-blocked', showOver || leadersOpen);
      document.body.classList.toggle('is-modal', leadersOpen);
      undoButton.disabled = busy || state.over || !state.undo;
      leadersButton.setAttribute('aria-expanded', leadersOpen ? 'true' : 'false');
      overlayEl.hidden = !showOver;
  
      if (showOver) {
        scoreLineEl.textContent = state.score + ' ' + pointsWord(state.score);
        if (state.saved) {
          messageEl.textContent = 'Ваш рекорд сохранен';
          formEl.hidden = true;
        } else {
          messageEl.textContent = 'Ходов больше нет';
          formEl.hidden = false;
        }
        if (!overlayWasOpen && !state.saved) nameInput.focus();
      }
      overlayWasOpen = showOver;
    }
  
    function renderAll(options) {
      renderToken += 1;
      busy = false;
      tilesEl.replaceChildren();
      tileEls.clear();
      state.board.forEach(function (row, rowIndex) {
        row.forEach(function (cell, columnIndex) {
          if (cell) addTile(cell, rowIndex * 4 + columnIndex, Boolean(options && options.appear));
        });
      });
      renderScore(0);
      syncChrome();
    }
  
    function reposition() {
      if (busy) return;
      tileEls.forEach(function (el) {
        const index = Number(el.dataset.index);
        if (Number.isInteger(index)) place(el, index, false);
      });
    }
  
    function wait(ms) {
      return new Promise(function (resolve) {
        window.setTimeout(resolve, reduceMotion.matches ? 0 : ms);
      });
    }
  
    function animateMove(transitions, spawned, token) {
      transitions.forEach(function (transition) {
        const el = tileEls.get(transition.id);
        if (!el) return;
        el.style.zIndex = transition.absorbed ? '1' : '2';
        place(el, transition.toIndex, true);
      });
  
      return wait(MOVE_MS).then(function () {
        if (token !== renderToken) return;
        transitions.forEach(function (transition) {
          if (!transition.absorbed) return;
          const el = tileEls.get(transition.id);
          if (el) el.remove();
          tileEls.delete(transition.id);
        });
        transitions.forEach(function (transition) {
          if (transition.absorbed || !transition.merged) return;
          const el = tileEls.get(transition.id);
          if (el) paintTile(el, transition.value, 'tile--pop');
        });
        spawned.forEach(function (tile) {
          addTile(tile, tile.index, true);
        });
        return wait(POP_MS);
      });
    }
  
    function normalize(loaded) {
      const over = !Game2048.hasMoves(loaded.board);
      return {
        board: loaded.board,
        score: loaded.score,
        nextId: loaded.nextId,
        over: over,
        saved: over ? Boolean(loaded.saved) : false,
        undo: over ? null : loaded.undo,
      };
    }
  
    function persist() {
      const ok = Storage2048.saveState(state);
      storageNoteEl.hidden = ok;
      storageNoteEl.textContent = ok ? '' : 'Браузер не сохранил партию. Проверьте, что localStorage не заблокирован.';
      return ok;
    }
  
    function play(direction) {
      if (busy || leadersOpen || !state || state.over) return;
      if (['left', 'right', 'up', 'down'].indexOf(direction) === -1) return;
  
      const outcome = Game2048.applyMove(state, direction);
      if (!outcome.changed) return;
  
      state = outcome.state;
      persist();
      renderScore(outcome.gained);
      busy = true;
      syncChrome();
      const token = renderToken;
  
      animateMove(outcome.transitions, outcome.spawned, token).then(function () {
        if (token !== renderToken) return;
        busy = false;
        reposition();
        syncChrome();
      });
    }
  
    function restart() {
      state = Game2048.newGame();
      nameInput.value = '';
      showSaveError('');
      persist();
      renderAll({ appear: true });
    }
  
    function undoMove() {
      if (busy) return;
      const outcome = Game2048.undo(state);
      if (!outcome.changed) return;
      state = outcome.state;
      showSaveError('');
      persist();
      renderAll({ appear: false });
    }
  
    function renderLeaders() {
      const rows = Storage2048.leaders();
      leadersBody.replaceChildren();
      if (!rows.length) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.textContent = 'Пока пусто. Доиграйте партию до конца и запишите имя.';
        leadersBody.appendChild(empty);
        return;
      }
  
      const table = document.createElement('table');
      table.className = 'table';
      const head = document.createElement('thead');
      const headRow = document.createElement('tr');
      ['Имя', 'Очки', 'Дата'].forEach(function (label) {
        const cell = document.createElement('th');
        cell.scope = 'col';
        cell.textContent = label;
        headRow.appendChild(cell);
      });
      head.appendChild(headRow);
      table.appendChild(head);
  
      const body = document.createElement('tbody');
      rows.forEach(function (row) {
        const line = document.createElement('tr');
        const name = document.createElement('td');
        const points = document.createElement('td');
        const date = document.createElement('td');
        name.textContent = row.name;
        points.textContent = String(row.score);
        date.textContent = formatDate(row.date);
        date.title = 'Время по Москве';
        line.append(name, points, date);
        body.appendChild(line);
      });
      table.appendChild(body);
      leadersBody.appendChild(table);
    }
  
    function openLeaders() {
      leadersOpen = true;
      renderLeaders();
      leadersEl.hidden = false;
      syncChrome();
      closeLeadersButton.focus();
    }
  
    function closeLeaders() {
      leadersOpen = false;
      leadersEl.hidden = true;
      syncChrome();
      leadersButton.focus();
    }
  
    function saveScore(event) {
      event.preventDefault();
      if (!state.over || state.saved) return;
      const name = nameInput.value.replace(/\s+/g, ' ').trim().slice(0, 20);
      if (!name) {
        showSaveError('Введите имя.');
        nameInput.focus();
        return;
      }
  
      const result = Storage2048.addScore({
        name: name,
        score: state.score,
        date: new Date().toISOString(),
      });
      if (!result.ok) {
        showSaveError('Не удалось записать рекорд в localStorage.');
        return;
      }
  
      state.saved = true;
      showSaveError('');
      persist();
      renderScore(0);
      syncChrome();
    }
  
    function onKeyDown(event) {
      if (event.key === 'Escape' && leadersOpen) {
        event.preventDefault();
        closeLeaders();
        return;
      }
      const direction = DIRECTIONS[event.key];
      if (!direction) return;
      if (event.target.closest('input, textarea')) return;
      event.preventDefault();
      play(direction);
    }
  
    function bindInput() {
      document.addEventListener('keydown', onKeyDown);
      restartButton.addEventListener('click', restart);
      overlayRestartButton.addEventListener('click', restart);
      undoButton.addEventListener('click', undoMove);
      leadersButton.addEventListener('click', openLeaders);
      closeLeadersButton.addEventListener('click', closeLeaders);
      formEl.addEventListener('submit', saveScore);
      leadersEl.addEventListener('click', function (event) {
        if (event.target === leadersEl) closeLeaders();
      });
  
      dpadEl.addEventListener('click', function (event) {
        const button = event.target.closest('[data-dir]');
        if (button) play(button.dataset.dir);
      });
  
      boardEl.addEventListener('touchstart', function (event) {
        if (event.touches.length !== 1 || event.target.closest('.overlay')) {
          gesture = null;
          return;
        }
        const touch = event.touches[0];
        gesture = { x: touch.clientX, y: touch.clientY };
      }, { passive: true });
  
      boardEl.addEventListener('touchend', function (event) {
        if (!gesture || !event.changedTouches.length) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - gesture.x;
        const dy = touch.clientY - gesture.y;
        gesture = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
        if (Math.abs(dx) > Math.abs(dy)) play(dx > 0 ? 'right' : 'left');
        else play(dy > 0 ? 'down' : 'up');
      }, { passive: true });
  
      boardEl.addEventListener('touchcancel', function () {
        gesture = null;
      });
  
      window.addEventListener('resize', reposition);
      if (typeof ResizeObserver === 'function') {
        const observer = new ResizeObserver(reposition);
        observer.observe(boardEl);
      }
    }
  
    function init() {
      buildGrid();
      const saved = Storage2048.loadState();
      if (saved) state = normalize(saved);
      else state = Game2048.newGame();
      persist();
      renderAll({ appear: !saved });
      bindInput();
    }
  
    init();
  })();  