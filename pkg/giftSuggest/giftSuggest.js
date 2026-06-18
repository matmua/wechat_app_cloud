const {
  initBoundPage,
  requireBound,
  loadList,
  addItem,
  updateItem,
  removeItem,
  applyStorageNotice
} = require('../../utils/liteStore');

const COL = 'gift_ideas';
const SCENARIOS = ['全部', '生日', '纪念日', '节日', '道歉', '惊喜', '日常'];

function emptyForm() {
  return {
    title: '',
    scenario: '生日',
    budget: '',
    tagsText: '',
    note: ''
  };
}

function decorate(item) {
  return {
    ...item,
    tagList: item.tags || [],
    stateText: item.isGiven ? '已送出' : '准备中'
  };
}

Page({
  data: {
    bindingLoading: true,
    bindingReady: false,
    bindingState: 'loading',
    bindingMessage: '正在确认情侣关系...',
    coupleId: '',
    openid: '',
    loading: false,
    saving: false,
    storageMode: 'cloud',
    errorMessage: '',
    scenarios: SCENARIOS,
    activeScenario: '全部',
    scenarioIndex: 1,
    form: emptyForm(),
    gifts: [],
    filteredGifts: [],
    randomGift: null
  },

  async onLoad() {
    const binding = await initBoundPage(this);
    if (binding && binding.bindingReady) await this.loadGifts();
  },

  async onPullDownRefresh() {
    await this.loadGifts();
    wx.stopPullDownRefresh();
  },

  async loadGifts() {
    if (!this.data.bindingReady) return;
    this.setData({ loading: true });
    const res = await loadList(COL, this.data.coupleId, { limit: 80 });
    const gifts = (res.list || [])
      .map(decorate)
      .sort((a, b) => Number(!!b.isPinned) - Number(!!a.isPinned));
    this.setData({ gifts, loading: false });
    this.applyFilter();
    applyStorageNotice(this, res.storage, res.error);
  },

  selectScenario(e) {
    this.setData({ activeScenario: e.currentTarget.dataset.scenario }, () => this.applyFilter());
  },

  applyFilter() {
    const active = this.data.activeScenario;
    const filteredGifts = active === '全部'
      ? this.data.gifts
      : this.data.gifts.filter(item => item.scenario === active);
    this.setData({ filteredGifts });
  },

  onTitleInput(e) {
    this.setData({ 'form.title': e.detail.value || '' });
  },

  onBudgetInput(e) {
    this.setData({ 'form.budget': e.detail.value || '' });
  },

  onTagsInput(e) {
    this.setData({ 'form.tagsText': e.detail.value || '' });
  },

  onNoteInput(e) {
    this.setData({ 'form.note': e.detail.value || '' });
  },

  onScenarioChange(e) {
    const index = Number(e.detail.value || 1);
    const scenario = SCENARIOS[index] === '全部' ? '生日' : SCENARIOS[index];
    this.setData({ scenarioIndex: index, 'form.scenario': scenario });
  },

  async saveGift() {
    if (!requireBound(this)) return;
    const form = this.data.form;
    const title = (form.title || '').trim();
    if (!title) return wx.showToast({ title: '写一个礼物灵感', icon: 'none' });
    const tags = (form.tagsText || '')
      .split(/[,\s，、]+/)
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 6);
    this.setData({ saving: true });
    const res = await addItem(COL, this.data.coupleId, {
      title,
      scenario: form.scenario,
      budget: (form.budget || '').trim(),
      tags,
      note: (form.note || '').trim(),
      isGiven: false,
      isPinned: false,
      creatorOpenid: this.data.openid
    });
    this.setData({ saving: false, form: emptyForm(), scenarioIndex: 1 });
    applyStorageNotice(this, res.storage, res.error);
    wx.showToast({ title: res.storage === 'cloud' ? '已放进礼物盒' : '已先保存本地', icon: 'none' });
    await this.loadGifts();
  },

  randomPick() {
    const pool = this.data.filteredGifts.length ? this.data.filteredGifts : this.data.gifts;
    if (!pool.length) return wx.showToast({ title: '先添加几个礼物灵感', icon: 'none' });
    const gift = pool[Math.floor(Math.random() * pool.length)];
    this.setData({ randomGift: gift });
  },

  async toggleGiven(e) {
    if (!requireBound(this)) return;
    const id = e.currentTarget.dataset.id;
    const gift = this.data.gifts.find(item => item._id === id);
    if (!gift) return;
    const res = await updateItem(COL, this.data.coupleId, id, { isGiven: !gift.isGiven });
    applyStorageNotice(this, res.storage, res.error);
    await this.loadGifts();
  },

  async togglePinned(e) {
    if (!requireBound(this)) return;
    const id = e.currentTarget.dataset.id;
    const gift = this.data.gifts.find(item => item._id === id);
    if (!gift) return;
    const res = await updateItem(COL, this.data.coupleId, id, { isPinned: !gift.isPinned });
    applyStorageNotice(this, res.storage, res.error);
    await this.loadGifts();
  },

  deleteGift(e) {
    if (!requireBound(this)) return;
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除礼物灵感',
      content: '这个灵感会从心意仓库里移除。',
      success: async (res) => {
        if (!res.confirm) return;
        const result = await removeItem(COL, this.data.coupleId, id);
        applyStorageNotice(this, result.storage, result.error);
        await this.loadGifts();
      }
    });
  },

  goBind() {
    wx.switchTab({ url: '/pages/remembers/remembers' });
  }
});
