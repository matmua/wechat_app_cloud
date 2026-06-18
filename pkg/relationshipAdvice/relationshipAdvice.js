const {
  initBoundPage,
  requireBound,
  loadList,
  addItem,
  removeItem,
  applyStorageNotice
} = require('../../utils/liteStore');

const COL = 'relationship_advice_favorites';
const SCENARIOS = [
  {
    key: 'comfort',
    label: '想哄 Ta',
    icon: '🍯',
    text: '先承认 Ta 的感受，再给一个很具体的陪伴动作。',
    line: '我刚才想了想，你难过不是小题大做。我想先好好听你说，然后我们再一起想怎么办。'
  },
  {
    key: 'cold',
    label: '有点冷战',
    icon: '🧊',
    text: '先把语气降下来，发一条不争输赢的开场。',
    line: '我不想继续僵着，也不想赢你。我想等我们都缓一点，再把这件事说清楚。'
  },
  {
    key: 'thanks',
    label: '想感谢',
    icon: '🌷',
    text: '感谢要具体，说出 Ta 做了什么和你感受到什么。',
    line: '谢谢你今天愿意陪我处理这些小事，我有被认真放在心上的感觉。'
  },
  {
    key: 'sorry',
    label: '想道歉',
    icon: '🕯️',
    text: '不要只说“我错了”，补上你理解到的影响。',
    line: '我刚才那样说让你不舒服了，这是我的问题。我会先停下来听你说，而不是急着解释。'
  },
  {
    key: 'surprise',
    label: '制造惊喜',
    icon: '🎁',
    text: '惊喜不一定贵，重点是“我记得你的偏好”。',
    line: '今天路过时看到一个你会喜欢的小东西，就想把它带回给你。'
  },
  {
    key: 'chat',
    label: '不知道聊什么',
    icon: '💬',
    text: '从今天的小事开始，比硬找大话题更自然。',
    line: '今天有没有哪一瞬间让你觉得还不错？很小的也算。'
  }
];

Page({
  data: {
    bindingLoading: true,
    bindingReady: false,
    bindingState: 'loading',
    bindingMessage: '',
    coupleId: '',
    openid: '',
    loading: false,
    saving: false,
    storageMode: 'cloud',
    errorMessage: '',
    scenarios: SCENARIOS,
    activeKey: 'comfort',
    current: SCENARIOS[0],
    favorites: []
  },

  async onLoad() {
    const binding = await initBoundPage(this);
    if (binding && binding.bindingReady) await this.loadFavorites();
    else this.setData({ bindingLoading: false });
  },

  async loadFavorites() {
    if (!this.data.bindingReady) return;
    this.setData({ loading: true });
    const res = await loadList(COL, this.data.coupleId, { limit: 50 });
    this.setData({ favorites: res.list || [], loading: false });
    applyStorageNotice(this, res.storage, res.error);
  },

  selectScenario(e) {
    const key = e.currentTarget.dataset.key;
    const current = SCENARIOS.find(item => item.key === key) || SCENARIOS[0];
    this.setData({ activeKey: key, current });
  },

  randomAdvice() {
    const current = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    this.setData({ activeKey: current.key, current });
  },

  copyLine() {
    wx.setClipboardData({
      data: this.data.current.line,
      success: () => wx.showToast({ title: '话术已复制', icon: 'success' }),
      fail: () => wx.showToast({ title: '复制失败', icon: 'none' })
    });
  },

  async saveFavorite() {
    if (!requireBound(this)) return;
    const current = this.data.current;
    this.setData({ saving: true });
    const res = await addItem(COL, this.data.coupleId, {
      scenario: current.label,
      text: current.line,
      note: current.text,
      creatorOpenid: this.data.openid
    });
    this.setData({ saving: false });
    applyStorageNotice(this, res.storage, res.error);
    wx.showToast({ title: res.storage === 'cloud' ? '已收藏' : '已先保存本地', icon: 'none' });
    await this.loadFavorites();
  },

  deleteFavorite(e) {
    if (!requireBound(this)) return;
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除收藏',
      content: '这条建议会从收藏里移除。',
      success: async (res) => {
        if (!res.confirm) return;
        const result = await removeItem(COL, this.data.coupleId, id);
        applyStorageNotice(this, result.storage, result.error);
        await this.loadFavorites();
      }
    });
  },

  goAI() {
    wx.navigateTo({ url: '/pkg/moodDiary/moodDiary' });
  },

  goBind() {
    wx.switchTab({ url: '/pages/remembers/remembers' });
  }
});
