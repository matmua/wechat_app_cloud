const FOOD_KEY = 'love_words_food_options_v1';
const HISTORY_KEY = 'love_words_food_history_v1';

const DEFAULT_FOODS = [
  { name: '热汤面', tag: '暖一点', note: '适合有点累的晚上，吃完就回家窝着。' },
  { name: '寿喜锅', tag: '慢慢吃', note: '一边煮一边聊天，今天不用赶时间。' },
  { name: '烤肉', tag: '有仪式感', note: '把第一块烤好的肉夹给对方。' },
  { name: '酸菜鱼', tag: '下饭', note: '点微辣，别逞强。' },
  { name: '小火锅', tag: '不纠结', note: '想吃什么就往里面放，适合选择困难。' },
  { name: '甜品下午茶', tag: '轻松局', note: '不饿也可以约，重点是一起坐一会儿。' },
  { name: '日料定食', tag: '清爽', note: '适合想吃得舒服一点的日子。' },
  { name: '夜市小吃', tag: '散步', note: '边走边吃，今天就随便快乐。' }
];

function formatTime(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${month}.${day} ${hour}:${minute}`;
}

Page({
  data: {
    foods: [],
    history: [],
    newFood: '',
    selectedFood: null,
    rollingFood: DEFAULT_FOODS[0],
    rolling: false,
    rollText: '今天就听它的吧',
    quickTags: ['面', '火锅', '烤肉', '甜品', '咖啡', '米饭']
  },

  onLoad() {
    const foods = wx.getStorageSync(FOOD_KEY) || DEFAULT_FOODS;
    const history = wx.getStorageSync(HISTORY_KEY) || [];
    this.setData({
      foods,
      history,
      rollingFood: foods[0] || DEFAULT_FOODS[0],
      selectedFood: history[0] || null
    });
  },

  onFoodInput(e) {
    this.setData({ newFood: e.detail.value });
  },

  addFood() {
    const name = (this.data.newFood || '').trim();
    if (!name) {
      wx.showToast({ title: '先写一个想吃的', icon: 'none' });
      return;
    }
    const exists = this.data.foods.some((item) => item.name === name);
    if (exists) {
      wx.showToast({ title: '菜单里已经有它啦', icon: 'none' });
      return;
    }
    const next = [
      { name, tag: '新加入', note: '这是你们刚刚加进菜单的小选择。' },
      ...this.data.foods
    ];
    wx.setStorageSync(FOOD_KEY, next);
    this.setData({ foods: next, newFood: '' });
  },

  addQuick(e) {
    const tag = e.currentTarget.dataset.tag;
    this.setData({ newFood: tag });
  },

  deleteFood(e) {
    const index = e.currentTarget.dataset.index;
    const next = this.data.foods.filter((_, idx) => idx !== index);
    wx.setStorageSync(FOOD_KEY, next);
    this.setData({ foods: next });
  },

  resetFoods() {
    wx.setStorageSync(FOOD_KEY, DEFAULT_FOODS);
    this.setData({
      foods: DEFAULT_FOODS,
      rollingFood: DEFAULT_FOODS[0],
      selectedFood: null
    });
  },

  drawFood() {
    if (this.data.rolling) return;
    if (!this.data.foods.length) {
      wx.showToast({ title: '菜单空啦，先加一个', icon: 'none' });
      return;
    }

    let count = 0;
    this.setData({ rolling: true, rollText: '抽卡中...' });
    const timer = setInterval(() => {
      const index = Math.floor(Math.random() * this.data.foods.length);
      this.setData({ rollingFood: this.data.foods[index] });
      count += 1;
      if (count >= 18) {
        clearInterval(timer);
        const picked = {
          ...this.data.rollingFood,
          pickedAt: formatTime(new Date())
        };
        const history = [picked, ...this.data.history].slice(0, 8);
        wx.setStorageSync(HISTORY_KEY, history);
        this.setData({
          rolling: false,
          rollText: '不许反悔哦',
          selectedFood: picked,
          history
        });
      }
    }, 70);
  },

  clearHistory() {
    wx.removeStorageSync(HISTORY_KEY);
    this.setData({ history: [], selectedFood: null, rollText: '今天就听它的吧' });
  },

  onShareAppMessage() {
    return {
      title: '今天吃什么？来爱木长诗抽一下',
      path: '/pkg/loveWords/loveWords'
    };
  }
});
