const {
  initBoundPage,
  loadList,
  addItem,
  removeItem,
  readLocalList,
  writeLocalList,
  applyStorageNotice,
  nowIso
} = require('../../utils/liteStore');

const COL = 'service_feedback';
const DONE_FEATURES = [
  '情侣绑定 / 邀请码绑定',
  '心愿、相册、约会记录、纪念日',
  '树洞袜子、经期记录、天气卡片',
  '打发时间小游戏中心',
  '今日计划、今日心情、小诗助手入口'
];
const TEST_ITEMS = [
  '创建所有新增集合并检查权限',
  '双人绑定后测试同一 coupleId 读写',
  '小屏手机检查按钮和卡片是否溢出',
  '上传图片、天气云函数、AI 接口待配置提示',
  '确认私密内容没有误展示给对方'
];
const NEXT_FEATURES = [
  '敏感集合迁移到云函数过滤',
  '小诗助手接入 DeepSeek / OpenAI',
  '导出恋爱小册或年度回顾',
  '提醒订阅消息和更细的权限规则'
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
    doneFeatures: DONE_FEATURES,
    testItems: TEST_ITEMS,
    nextFeatures: NEXT_FEATURES,
    feedbackText: '',
    feedbackList: []
  },

  async onLoad() {
    const binding = await initBoundPage(this);
    if (binding && binding.bindingReady) await this.loadFeedback();
    else this.loadLocalFeedback();
  },

  async loadFeedback() {
    if (!this.data.bindingReady) return this.loadLocalFeedback();
    this.setData({ loading: true });
    const res = await loadList(COL, this.data.coupleId, { limit: 30 });
    this.setData({ feedbackList: res.list || [], loading: false });
    applyStorageNotice(this, res.storage, res.error);
  },

  loadLocalFeedback() {
    this.setData({
      loading: false,
      storageMode: 'local',
      feedbackList: readLocalList(COL, this.data.coupleId || 'local')
    });
  },

  onFeedbackInput(e) {
    this.setData({ feedbackText: e.detail.value || '' });
  },

  async saveFeedback() {
    const text = (this.data.feedbackText || '').trim();
    if (!text) return wx.showToast({ title: '写一句反馈或待办', icon: 'none' });
    this.setData({ saving: true });
    if (this.data.bindingReady) {
      const res = await addItem(COL, this.data.coupleId, {
        text,
        creatorOpenid: this.data.openid
      });
      this.setData({ saving: false, feedbackText: '' });
      applyStorageNotice(this, res.storage, res.error);
      await this.loadFeedback();
      return;
    }

    const key = this.data.coupleId || 'local';
    const list = readLocalList(COL, key);
    list.unshift({ _id: `local_${Date.now()}`, text, createdAt: nowIso() });
    writeLocalList(COL, key, list);
    this.setData({ saving: false, feedbackText: '', feedbackList: list, storageMode: 'local' });
    wx.showToast({ title: '已保存到本地', icon: 'none' });
  },

  deleteFeedback(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除反馈',
      content: '确认删除这条记录？',
      success: async (res) => {
        if (!res.confirm) return;
        if (this.data.bindingReady) {
          const result = await removeItem(COL, this.data.coupleId, id);
          applyStorageNotice(this, result.storage, result.error);
          await this.loadFeedback();
          return;
        }
        const key = this.data.coupleId || 'local';
        const list = readLocalList(COL, key).filter(item => item._id !== id);
        writeLocalList(COL, key, list);
        this.setData({ feedbackList: list });
      }
    });
  },

  openPage(e) {
    const route = e.currentTarget.dataset.route;
    if (!route) return;
    if (route.indexOf('/pages/') === 0) wx.switchTab({ url: route });
    else wx.navigateTo({ url: route });
  }
});
