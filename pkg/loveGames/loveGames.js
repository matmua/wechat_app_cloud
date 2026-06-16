const SIZE = 10;
const GAME_CARDS = [
  { key: 'snake', title: '贪吃蛇', status: '可玩', desc: '方向键控制，吃到糖果就变长。' },
  { key: 'mine', title: '扫雷', status: '即将开放', desc: '先占一个卡带位，后续补棋盘。' },
  { key: 'plane', title: '打飞机', status: '即将开放', desc: '轻量弹幕小游戏，后续再做。' },
  { key: 'tetris', title: '俄罗斯方块', status: '即将开放', desc: '需要更完整的下落逻辑。' }
];

function xyToIndex(x, y) {
  return y * SIZE + x;
}

function indexToXY(index) {
  return { x: index % SIZE, y: Math.floor(index / SIZE) };
}

Page({
  data: {
    games: GAME_CARDS,
    activeGame: 'snake',
    board: [],
    snake: [xyToIndex(4, 5), xyToIndex(3, 5), xyToIndex(2, 5)],
    food: xyToIndex(7, 5),
    direction: 'right',
    nextDirection: 'right',
    score: 0,
    running: false,
    gameOver: false,
    message: '按开始，别撞墙。'
  },

  timer: null,

  onLoad() {
    wx.setNavigationBarTitle({ title: '打发时间' });
    this.rebuildBoard();
  },

  onUnload() {
    this.stopLoop();
  },

  chooseGame(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeGame: key });
    if (key !== 'snake') {
      wx.showToast({ title: '这个卡带还没插好', icon: 'none' });
    }
  },

  startGame() {
    if (this.data.activeGame !== 'snake') return;
    if (this.data.gameOver) this.resetGame();
    if (this.data.running) return;
    this.setData({ running: true, message: '游戏中' });
    this.timer = setInterval(() => this.tick(), 360);
  },

  pauseGame() {
    this.stopLoop();
    this.setData({ message: '暂停中' });
  },

  resetGame() {
    this.stopLoop();
    this.setData({
      snake: [xyToIndex(4, 5), xyToIndex(3, 5), xyToIndex(2, 5)],
      food: xyToIndex(7, 5),
      direction: 'right',
      nextDirection: 'right',
      score: 0,
      running: false,
      gameOver: false,
      message: '重新开始，慢一点也行。'
    }, () => this.rebuildBoard());
  },

  stopLoop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.data.running) this.setData({ running: false });
  },

  changeDirection(e) {
    const dir = e.currentTarget.dataset.dir;
    const current = this.data.direction;
    const blocked = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left'
    };
    if (blocked[current] === dir) return;
    this.setData({ nextDirection: dir });
  },

  tick() {
    const snake = [...this.data.snake];
    const head = indexToXY(snake[0]);
    const direction = this.data.nextDirection;
    const delta = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 }
    }[direction];
    const next = { x: head.x + delta.x, y: head.y + delta.y };

    if (next.x < 0 || next.x >= SIZE || next.y < 0 || next.y >= SIZE) {
      this.finishGame('撞到边界啦');
      return;
    }

    const nextIndex = xyToIndex(next.x, next.y);
    const willEat = nextIndex === this.data.food;
    const bodyForCollision = willEat ? snake : snake.slice(0, -1);
    if (bodyForCollision.includes(nextIndex)) {
      this.finishGame('撞到自己啦');
      return;
    }

    snake.unshift(nextIndex);
    let food = this.data.food;
    let score = this.data.score;
    if (willEat) {
      score += 1;
      food = this.nextFood(snake);
    } else {
      snake.pop();
    }

    this.setData({ snake, food, score, direction }, () => this.rebuildBoard());
  },

  finishGame(message) {
    this.stopLoop();
    this.setData({ gameOver: true, message });
  },

  nextFood(snake) {
    const empty = [];
    for (let i = 0; i < SIZE * SIZE; i += 1) {
      if (!snake.includes(i)) empty.push(i);
    }
    if (!empty.length) return -1;
    return empty[Math.floor(Math.random() * empty.length)];
  },

  rebuildBoard() {
    const board = [];
    for (let i = 0; i < SIZE * SIZE; i += 1) {
      let type = '';
      if (this.data.snake.includes(i)) type = 'snake';
      if (this.data.snake[0] === i) type = 'head';
      if (this.data.food === i) type = 'food';
      board.push({ index: i, type });
    }
    this.setData({ board });
  },

  onShareAppMessage() {
    return {
      title: '爱木长诗 · 打发时间',
      path: '/pkg/loveGames/loveGames'
    };
  }
});
