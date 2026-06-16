const { getPageBinding, getErrorMessage } = require('../../utils/couple');

const DEFAULT_GOALS = [
  { title: '一起完成一次短途旅行', progress: 20 },
  { title: '存一笔约会基金', progress: 35 },
  { title: '拍一组认真合照', progress: 10 }
];

Page({
  data: {
    bindingReady: false,
    bindingState: 'loading',
    bindingMessage: '正在确认绑定状态...',
    coupleId: '',
    goals: [],
    draft: '',
    activeIndex: 0
  },

  async onLoad() {
    wx.setNavigationBarTitle({ title: '恋爱目标' });
    await this.refreshBinding();
  },

  async onShow() {
    await this.refreshBinding(true);
  },

  async onPullDownRefresh() {
    await this.refreshBinding(true);
    wx.stopPullDownRefresh();
  },

  async refreshBinding(silent = false) {
    try {
      const binding = await getPageBinding();
      this.setData({
        bindingReady: !!binding.bindingReady,
        bindingState: binding.bindingState,
        bindingMessage: binding.bindingMessage,
        coupleId: binding.coupleId || ''
      });
      if (binding.bindingReady) this.loadGoals(binding.coupleId);
    } catch (e) {
      const message = getErrorMessage(e, '绑定状态读取失败');
      this.setData({ bindingReady: false, bindingState: 'error', bindingMessage: message });
      if (!silent) wx.showToast({ title: message, icon: 'none' });
    }
  },

  storageKey(coupleId = this.data.coupleId) {
    return `couple_goals_${coupleId}`;
  },

  loadGoals(coupleId) {
    const goals = wx.getStorageSync(this.storageKey(coupleId)) || DEFAULT_GOALS;
    this.setData({ goals });
  },

  onDraftInput(e) {
    this.setData({ draft: e.detail.value });
  },

  addGoal() {
    if (!this.data.bindingReady) {
      wx.showToast({ title: '请先绑定情侣关系', icon: 'none' });
      return;
    }
    const title = (this.data.draft || '').trim();
    if (!title) {
      wx.showToast({ title: '先写一个目标', icon: 'none' });
      return;
    }
    const goals = [{ title, progress: 0 }, ...this.data.goals];
    wx.setStorageSync(this.storageKey(), goals);
    this.setData({ goals, draft: '', activeIndex: 0 });
  },

  stepGoal(e) {
    const index = Number(e.currentTarget.dataset.index || 0);
    const goals = this.data.goals.map((item, idx) => (
      idx === index ? { ...item, progress: Math.min(100, item.progress + 10) } : item
    ));
    wx.setStorageSync(this.storageKey(), goals);
    this.setData({ goals, activeIndex: index });
  },

  deleteGoal(e) {
    const index = Number(e.currentTarget.dataset.index || 0);
    const goals = this.data.goals.filter((_, idx) => idx !== index);
    wx.setStorageSync(this.storageKey(), goals);
    this.setData({ goals, activeIndex: 0 });
  },

  goBind() {
    wx.switchTab({ url: '/pages/remembers/remembers' });
  },

  onShareAppMessage() {
    return {
      title: '爱木长诗 · 恋爱目标',
      path: '/pkg/coupleGoals/coupleGoals'
    };
  }
});
