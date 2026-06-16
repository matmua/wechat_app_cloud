const PLAN_KEY = 'chat_topics_tiny_plans_v1';
const DEFAULT_PLANS = [
  { title: '下次一起散步 20 分钟', type: '见面', done: false },
  { title: '选一家没吃过的小店', type: '吃饭', done: false },
  { title: '互相拍一张今天的照片', type: '日常', done: false }
];

Page({
  data: {
    plans: [],
    draft: '',
    types: ['日常', '见面', '吃饭', '礼物', '旅行'],
    typeIndex: 0
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '小小计划' });
    this.setData({ plans: wx.getStorageSync(PLAN_KEY) || DEFAULT_PLANS });
  },

  onDraftInput(e) {
    this.setData({ draft: e.detail.value });
  },

  onTypeChange(e) {
    this.setData({ typeIndex: Number(e.detail.value || 0) });
  },

  addPlan() {
    const title = (this.data.draft || '').trim();
    if (!title) {
      wx.showToast({ title: '先写一个小计划', icon: 'none' });
      return;
    }
    const next = [
      { title, type: this.data.types[this.data.typeIndex], done: false },
      ...this.data.plans
    ];
    wx.setStorageSync(PLAN_KEY, next);
    this.setData({ plans: next, draft: '' });
  },

  togglePlan(e) {
    const index = Number(e.currentTarget.dataset.index || 0);
    const plans = this.data.plans.map((item, idx) => idx === index ? { ...item, done: !item.done } : item);
    wx.setStorageSync(PLAN_KEY, plans);
    this.setData({ plans });
  },

  deletePlan(e) {
    const index = Number(e.currentTarget.dataset.index || 0);
    const plans = this.data.plans.filter((_, idx) => idx !== index);
    wx.setStorageSync(PLAN_KEY, plans);
    this.setData({ plans });
  },

  resetPlans() {
    wx.setStorageSync(PLAN_KEY, DEFAULT_PLANS);
    this.setData({ plans: DEFAULT_PLANS });
  },

  onShareAppMessage() {
    return {
      title: '爱木长诗 · 小小计划',
      path: '/pkg/chatTopics/chatTopics'
    };
  }
});
