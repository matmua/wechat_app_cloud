const SNAKE_SIZE = 10;
const MINE_SIZE = 6;
const MINE_COUNT = 6;
const PLANE_W = 7;
const PLANE_H = 10;
const TETRIS_W = 8;
const TETRIS_H = 12;

const GAME_CARDS = [
  { key: 'snake', icon: 'S', title: '贪吃蛇', status: '可玩', desc: '方向键或滑动控制，吃到糖果就变长。' },
  { key: 'mine', icon: 'M', title: '扫雷', status: '可玩', desc: '翻开安全格，避开藏起来的雷。' },
  { key: 'plane', icon: 'P', title: '打飞机', status: '可玩', desc: '左右移动，发射糖果子弹。' },
  { key: 'tetris', icon: 'T', title: '俄罗斯方块', status: '可玩', desc: '移动、旋转、消行得分。' }
];

const TETRIS_SHAPES = [
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [-1, 0], [1, 0], [2, 0]],
  [[0, 0], [-1, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [0, 1], [-1, 1]],
  [[0, 0], [-1, 0], [0, 1], [1, 1]]
];

function xyToIndex(x, y, width) {
  return y * width + x;
}

function indexToXY(index, width) {
  return { x: index % width, y: Math.floor(index / width) };
}

function cloneGrid(grid) {
  return grid.map(row => row.slice());
}

Page({
  data: {
    games: GAME_CARDS,
    activeGame: 'snake',
    touchStartX: 0,
    touchStartY: 0,

    snakeBoard: [],
    snake: [],
    snakeFood: 0,
    snakeDirection: 'right',
    snakeNextDirection: 'right',
    snakeScore: 0,
    snakeRunning: false,
    snakeGameOver: false,
    snakeMessage: '按开始，别撞墙。',

    mineBoard: [],
    mineRevealed: 0,
    mineStatus: '翻开第一格吧。',
    mineGameOver: false,
    mineWin: false,

    planeBoard: [],
    planeX: 3,
    planeBullets: [],
    planeEnemies: [],
    planeScore: 0,
    planeRunning: false,
    planeGameOver: false,
    planeMessage: '开始后，左右移动并发射。',

    tetrisBoard: [],
    tetrisGrid: [],
    tetrisPiece: null,
    tetrisScore: 0,
    tetrisRunning: false,
    tetrisGameOver: false,
    tetrisMessage: '开始后，方块会慢慢落下。'
  },

  snakeTimer: null,
  planeTimer: null,
  tetrisTimer: null,

  onLoad() {
    wx.setNavigationBarTitle({ title: '打发时间' });
    this.resetSnake();
    this.resetMine();
    this.resetPlane();
    this.resetTetris();
  },

  onUnload() {
    this.stopAllLoops();
  },

  chooseGame(e) {
    const key = e.currentTarget.dataset.key;
    this.stopAllLoops();
    this.setData({
      activeGame: key,
      snakeRunning: false,
      planeRunning: false,
      tetrisRunning: false
    });
  },

  stopAllLoops() {
    if (this.snakeTimer) clearInterval(this.snakeTimer);
    if (this.planeTimer) clearInterval(this.planeTimer);
    if (this.tetrisTimer) clearInterval(this.tetrisTimer);
    this.snakeTimer = null;
    this.planeTimer = null;
    this.tetrisTimer = null;
  },

  onTouchStart(e) {
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    this.setData({ touchStartX: touch.clientX, touchStartY: touch.clientY });
  },

  onTouchEnd(e) {
    if (this.data.activeGame !== 'snake') return;
    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - this.data.touchStartX;
    const dy = touch.clientY - this.data.touchStartY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    const dir = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');
    this.setSnakeDirection(dir);
  },

  // ===== Snake =====
  resetSnake() {
    if (this.snakeTimer) clearInterval(this.snakeTimer);
    this.snakeTimer = null;
    this.setData({
      snake: [xyToIndex(4, 5, SNAKE_SIZE), xyToIndex(3, 5, SNAKE_SIZE), xyToIndex(2, 5, SNAKE_SIZE)],
      snakeFood: xyToIndex(7, 5, SNAKE_SIZE),
      snakeDirection: 'right',
      snakeNextDirection: 'right',
      snakeScore: 0,
      snakeRunning: false,
      snakeGameOver: false,
      snakeMessage: '重新开始，慢一点也行。'
    }, () => this.rebuildSnakeBoard());
  },

  startSnake() {
    if (this.data.snakeGameOver) this.resetSnake();
    if (this.data.snakeRunning) return;
    this.setData({ snakeRunning: true, snakeMessage: '游戏中' });
    this.snakeTimer = setInterval(() => this.tickSnake(), 340);
  },

  pauseSnake() {
    if (this.snakeTimer) clearInterval(this.snakeTimer);
    this.snakeTimer = null;
    this.setData({ snakeRunning: false, snakeMessage: '暂停中' });
  },

  changeSnakeDirection(e) {
    this.setSnakeDirection(e.currentTarget.dataset.dir);
  },

  setSnakeDirection(dir) {
    const blocked = { up: 'down', down: 'up', left: 'right', right: 'left' };
    if (blocked[this.data.snakeDirection] === dir) return;
    this.setData({ snakeNextDirection: dir });
  },

  tickSnake() {
    const snake = [...this.data.snake];
    const head = indexToXY(snake[0], SNAKE_SIZE);
    const direction = this.data.snakeNextDirection;
    const delta = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 }
    }[direction];
    const next = { x: head.x + delta.x, y: head.y + delta.y };

    if (next.x < 0 || next.x >= SNAKE_SIZE || next.y < 0 || next.y >= SNAKE_SIZE) {
      this.finishSnake('撞到边界啦');
      return;
    }

    const nextIndex = xyToIndex(next.x, next.y, SNAKE_SIZE);
    const willEat = nextIndex === this.data.snakeFood;
    const collisionBody = willEat ? snake : snake.slice(0, -1);
    if (collisionBody.includes(nextIndex)) {
      this.finishSnake('撞到自己啦');
      return;
    }

    snake.unshift(nextIndex);
    let food = this.data.snakeFood;
    let score = this.data.snakeScore;
    if (willEat) {
      score += 1;
      food = this.nextSnakeFood(snake);
    } else {
      snake.pop();
    }
    this.setData({ snake, snakeFood: food, snakeScore: score, snakeDirection: direction }, () => this.rebuildSnakeBoard());
  },

  finishSnake(message) {
    if (this.snakeTimer) clearInterval(this.snakeTimer);
    this.snakeTimer = null;
    this.setData({ snakeRunning: false, snakeGameOver: true, snakeMessage: message });
  },

  nextSnakeFood(snake) {
    const empty = [];
    for (let i = 0; i < SNAKE_SIZE * SNAKE_SIZE; i += 1) {
      if (!snake.includes(i)) empty.push(i);
    }
    return empty[Math.floor(Math.random() * empty.length)] || 0;
  },

  rebuildSnakeBoard() {
    const board = [];
    for (let i = 0; i < SNAKE_SIZE * SNAKE_SIZE; i += 1) {
      let type = '';
      if (this.data.snake.includes(i)) type = 'snake';
      if (this.data.snake[0] === i) type = 'head';
      if (this.data.snakeFood === i) type = 'food';
      board.push({ index: i, type });
    }
    this.setData({ snakeBoard: board });
  },

  // ===== Minesweeper =====
  resetMine() {
    const mines = new Set();
    while (mines.size < MINE_COUNT) {
      mines.add(Math.floor(Math.random() * MINE_SIZE * MINE_SIZE));
    }
    const board = [];
    for (let i = 0; i < MINE_SIZE * MINE_SIZE; i += 1) {
      const { x, y } = indexToXY(i, MINE_SIZE);
      let count = 0;
      for (let yy = y - 1; yy <= y + 1; yy += 1) {
        for (let xx = x - 1; xx <= x + 1; xx += 1) {
          if (xx === x && yy === y) continue;
          if (xx < 0 || xx >= MINE_SIZE || yy < 0 || yy >= MINE_SIZE) continue;
          if (mines.has(xyToIndex(xx, yy, MINE_SIZE))) count += 1;
        }
      }
      board.push({ index: i, isMine: mines.has(i), count, revealed: false, text: '', type: '' });
    }
    this.setData({
      mineBoard: board,
      mineRevealed: 0,
      mineStatus: '翻开第一格吧。',
      mineGameOver: false,
      mineWin: false
    });
  },

  openMineCell(e) {
    if (this.data.mineGameOver || this.data.mineWin) return;
    const index = Number(e.currentTarget.dataset.index);
    const board = this.data.mineBoard.map(item => ({ ...item }));
    const cell = board[index];
    if (!cell || cell.revealed) return;

    if (cell.isMine) {
      board.forEach(item => {
        if (item.isMine) {
          item.revealed = true;
          item.text = '雷';
          item.type = 'mine';
        }
      });
      this.setData({ mineBoard: board, mineGameOver: true, mineStatus: '踩到雷啦，重新来一局。' });
      return;
    }

    const queue = [index];
    const visited = new Set();
    let revealed = this.data.mineRevealed;
    while (queue.length) {
      const current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);
      const item = board[current];
      if (!item || item.revealed || item.isMine) continue;
      item.revealed = true;
      item.text = item.count ? String(item.count) : '';
      item.type = item.count ? `n${item.count}` : 'empty';
      revealed += 1;
      if (item.count === 0) {
        const { x, y } = indexToXY(current, MINE_SIZE);
        for (let yy = y - 1; yy <= y + 1; yy += 1) {
          for (let xx = x - 1; xx <= x + 1; xx += 1) {
            if (xx < 0 || xx >= MINE_SIZE || yy < 0 || yy >= MINE_SIZE) continue;
            queue.push(xyToIndex(xx, yy, MINE_SIZE));
          }
        }
      }
    }

    const win = revealed >= MINE_SIZE * MINE_SIZE - MINE_COUNT;
    this.setData({
      mineBoard: board,
      mineRevealed: revealed,
      mineWin: win,
      mineStatus: win ? '安全格全翻开，胜利！' : `已翻开 ${revealed} 格`
    });
  },

  // ===== Plane =====
  resetPlane() {
    if (this.planeTimer) clearInterval(this.planeTimer);
    this.planeTimer = null;
    this.setData({
      planeX: 3,
      planeBullets: [],
      planeEnemies: [{ x: 2, y: 0 }, { x: 5, y: 2 }],
      planeScore: 0,
      planeRunning: false,
      planeGameOver: false,
      planeMessage: '重新起飞。'
    }, () => this.rebuildPlaneBoard());
  },

  startPlane() {
    if (this.data.planeGameOver) this.resetPlane();
    if (this.data.planeRunning) return;
    this.setData({ planeRunning: true, planeMessage: '飞行中' });
    this.planeTimer = setInterval(() => this.tickPlane(), 420);
  },

  pausePlane() {
    if (this.planeTimer) clearInterval(this.planeTimer);
    this.planeTimer = null;
    this.setData({ planeRunning: false, planeMessage: '暂停中' });
  },

  movePlaneLeft() {
    this.setData({ planeX: Math.max(0, this.data.planeX - 1) }, () => this.rebuildPlaneBoard());
  },

  movePlaneRight() {
    this.setData({ planeX: Math.min(PLANE_W - 1, this.data.planeX + 1) }, () => this.rebuildPlaneBoard());
  },

  shootPlane() {
    if (this.data.planeGameOver) return;
    const bullet = { x: this.data.planeX, y: PLANE_H - 2 };
    this.setData({ planeBullets: [bullet, ...this.data.planeBullets].slice(0, 5) }, () => this.rebuildPlaneBoard());
  },

  tickPlane() {
    let bullets = this.data.planeBullets.map(item => ({ x: item.x, y: item.y - 1 })).filter(item => item.y >= 0);
    let enemies = this.data.planeEnemies.map(item => ({ x: item.x, y: item.y + 1 }));
    let score = this.data.planeScore;

    const hitBullets = new Set();
    const hitEnemies = new Set();
    bullets.forEach((b, bi) => {
      enemies.forEach((en, ei) => {
        if (b.x === en.x && b.y === en.y) {
          hitBullets.add(bi);
          hitEnemies.add(ei);
        }
      });
    });
    if (hitEnemies.size) score += hitEnemies.size;
    bullets = bullets.filter((_, idx) => !hitBullets.has(idx));
    enemies = enemies.filter((_, idx) => !hitEnemies.has(idx));

    if (enemies.some(item => item.y >= PLANE_H - 1 && item.x === this.data.planeX)) {
      this.finishPlane('被敌机撞到啦');
      return;
    }
    if (enemies.some(item => item.y >= PLANE_H)) {
      this.finishPlane('敌机飞过去啦');
      return;
    }
    if (Math.random() < 0.65 && enemies.length < 6) {
      enemies.push({ x: Math.floor(Math.random() * PLANE_W), y: 0 });
    }

    this.setData({ planeBullets: bullets, planeEnemies: enemies, planeScore: score }, () => this.rebuildPlaneBoard());
  },

  finishPlane(message) {
    if (this.planeTimer) clearInterval(this.planeTimer);
    this.planeTimer = null;
    this.setData({ planeRunning: false, planeGameOver: true, planeMessage: message });
  },

  rebuildPlaneBoard() {
    const board = [];
    for (let y = 0; y < PLANE_H; y += 1) {
      for (let x = 0; x < PLANE_W; x += 1) {
        let type = '';
        if (this.data.planeEnemies.some(item => item.x === x && item.y === y)) type = 'enemy';
        if (this.data.planeBullets.some(item => item.x === x && item.y === y)) type = 'bullet';
        if (this.data.planeX === x && y === PLANE_H - 1) type = 'player';
        board.push({ index: xyToIndex(x, y, PLANE_W), type });
      }
    }
    this.setData({ planeBoard: board });
  },

  // ===== Tetris =====
  resetTetris() {
    if (this.tetrisTimer) clearInterval(this.tetrisTimer);
    this.tetrisTimer = null;
    const grid = Array.from({ length: TETRIS_H }, () => Array(TETRIS_W).fill(0));
    this.setData({
      tetrisGrid: grid,
      tetrisPiece: this.newTetrisPiece(),
      tetrisScore: 0,
      tetrisRunning: false,
      tetrisGameOver: false,
      tetrisMessage: '重新开局。'
    }, () => this.rebuildTetrisBoard());
  },

  startTetris() {
    if (this.data.tetrisGameOver) this.resetTetris();
    if (this.data.tetrisRunning) return;
    this.setData({ tetrisRunning: true, tetrisMessage: '下落中' });
    this.tetrisTimer = setInterval(() => this.tickTetris(), 520);
  },

  pauseTetris() {
    if (this.tetrisTimer) clearInterval(this.tetrisTimer);
    this.tetrisTimer = null;
    this.setData({ tetrisRunning: false, tetrisMessage: '暂停中' });
  },

  newTetrisPiece() {
    const shape = TETRIS_SHAPES[Math.floor(Math.random() * TETRIS_SHAPES.length)];
    return { shape, x: 3, y: 0 };
  },

  getPieceCells(piece = this.data.tetrisPiece) {
    if (!piece) return [];
    return piece.shape.map(([x, y]) => ({ x: piece.x + x, y: piece.y + y }));
  },

  isTetrisValid(cells, grid = this.data.tetrisGrid) {
    return cells.every(({ x, y }) => (
      x >= 0 && x < TETRIS_W && y >= 0 && y < TETRIS_H && !grid[y][x]
    ));
  },

  moveTetris(e) {
    const dx = Number(e.currentTarget.dataset.dx || 0);
    const piece = { ...this.data.tetrisPiece, x: this.data.tetrisPiece.x + dx };
    if (this.isTetrisValid(this.getPieceCells(piece))) {
      this.setData({ tetrisPiece: piece }, () => this.rebuildTetrisBoard());
    }
  },

  rotateTetris() {
    const piece = this.data.tetrisPiece;
    const rotated = {
      ...piece,
      shape: piece.shape.map(([x, y]) => [-y, x])
    };
    if (this.isTetrisValid(this.getPieceCells(rotated))) {
      this.setData({ tetrisPiece: rotated }, () => this.rebuildTetrisBoard());
    }
  },

  dropTetris() {
    this.tickTetris();
  },

  tickTetris() {
    const piece = { ...this.data.tetrisPiece, y: this.data.tetrisPiece.y + 1 };
    if (this.isTetrisValid(this.getPieceCells(piece))) {
      this.setData({ tetrisPiece: piece }, () => this.rebuildTetrisBoard());
      return;
    }
    this.lockTetrisPiece();
  },

  lockTetrisPiece() {
    let grid = cloneGrid(this.data.tetrisGrid);
    this.getPieceCells().forEach(({ x, y }) => {
      if (y >= 0 && y < TETRIS_H && x >= 0 && x < TETRIS_W) grid[y][x] = 1;
    });

    const keptRows = grid.filter(row => row.some(cell => !cell));
    const cleared = TETRIS_H - keptRows.length;
    while (keptRows.length < TETRIS_H) keptRows.unshift(Array(TETRIS_W).fill(0));
    grid = keptRows;

    const next = this.newTetrisPiece();
    if (!this.isTetrisValid(this.getPieceCells(next), grid)) {
      if (this.tetrisTimer) clearInterval(this.tetrisTimer);
      this.tetrisTimer = null;
      this.setData({
        tetrisGrid: grid,
        tetrisRunning: false,
        tetrisGameOver: true,
        tetrisMessage: '堆到顶啦，游戏结束。'
      }, () => this.rebuildTetrisBoard());
      return;
    }

    this.setData({
      tetrisGrid: grid,
      tetrisPiece: next,
      tetrisScore: this.data.tetrisScore + cleared * 10,
      tetrisMessage: cleared ? `消掉 ${cleared} 行` : '继续下落'
    }, () => this.rebuildTetrisBoard());
  },

  rebuildTetrisBoard() {
    const activeSet = new Set(this.getPieceCells().map(({ x, y }) => `${x},${y}`));
    const board = [];
    for (let y = 0; y < TETRIS_H; y += 1) {
      for (let x = 0; x < TETRIS_W; x += 1) {
        const active = activeSet.has(`${x},${y}`);
        const locked = this.data.tetrisGrid[y] && this.data.tetrisGrid[y][x];
        board.push({ index: xyToIndex(x, y, TETRIS_W), type: active ? 'active' : locked ? 'locked' : '' });
      }
    }
    this.setData({ tetrisBoard: board });
  },

  onShareAppMessage() {
    return {
      title: '爱木长诗 · 打发时间',
      path: '/pkg/loveGames/loveGames'
    };
  }
});
