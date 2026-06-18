const {
  dateKey,
  dateLabel,
  initBoundPage,
  requireBound,
  loadList,
  addItem,
  updateItem,
  removeItem,
  applyStorageNotice
} = require('../../utils/liteStore');

const COL = 'surprise_ideas';
const TYPES = ['小礼物', '一顿饭', '一封信', '一次约会', '远程陪伴', '其他'];

function emptyForm() {
  return {
    title: '',
    type: TYPES[0],
    plannedDate: dateKey(),
    note: '',
    hidden: true
  };
}

function decorate(item, openid) {
  const masked = !!item.hidden && item.creatorOpenid !== openid && !item.done;
  return {
    ...item,
    masked,
    dateText: dateLabel(item.plannedDate),
    displayTitle: masked ? '一个还没拆开的惊喜盲盒' : item.title,
    displayNote: masked ? 'Ta 先把它藏起来了，等准备好再打开。' : (item.note || '还没有补充说明。')
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
    types: TYPES,
    typeIndex: 0,
    form: emptyForm(),
    ideas: [],
    randomIdea: null
  },

  async onLoad() {
    const binding = await initBoundPage(this);
    if (binding && binding.bindingReady) await this.loadIdeas();
  },

  async onPullDownRefresh() {
    await this.loadIdeas();
    wx.stopPullDownRefresh();
  },

  async loadIdeas() {
    if (!this.data.bindingReady) return;
    this.setData({ loading: true });
    const res = await loadList(COL, this.data.coupleId, { limit: 80 });
    this.setData({
      ideas: (res.list || []).map(item => decorate(item, this.data.openid)),
      loading: false
    });
    applyStorageNotice(this, res.storage, res.error);
  },

  onTitleInput(e) {
    this.setData({ 'form.title': e.detail.value || '' });
  },

  onTypeChange(e) {
    const index = Number(e.detail.value || 0);
    this.setData({ typeIndex: index, 'form.type': TYPES[index] });
  },

  onDateChange(e) {
    this.setData({ 'form.plannedDate': e.detail.value });
  },

  onNoteInput(e) {
    this.setData({ 'form.note': e.detail.value || '' });
  },

  toggleHidden() {
    this.setData({ 'form.hidden': !this.data.form.hidden });
  },

  async saveIdea() {
    if (!requireBound(this)) return;
    const title = (this.data.form.title || '').trim();
    if (!title) return wx.showToast({ title: '写一个惊喜灵感', icon: 'none' });
    this.setData({ saving: true });
    const res = await addItem(COL, this.data.coupleId, {
      title,
      type: this.data.form.type,
      plannedDate: this.data.form.plannedDate,
      note: (this.data.form.note || '').trim(),
      hidden: !!this.data.form.hidden,
      done: false,
      creatorOpenid: this.data.openid
    });
    this.setData({ saving: false, form: emptyForm(), typeIndex: 0 });
    applyStorageNotice(this, res.storage, res.error);
    wx.showToast({ title: res.storage === 'cloud' ? '盲盒已收好' : '已先保存本地', icon: 'none' });
    await this.loadIdeas();
  },

  randomPick() {
    const pool = this.data.ideas.filter(item => !item.masked && !item.done);
    if (!pool.length) return wx.showToast({ title: '没有可抽的惊喜灵感', icon: 'none' });
    this.setData({ randomIdea: pool[Math.floor(Math.random() * pool.length)] });
  },

  async toggleIdeaHidden(e) {
    if (!requireBound(this)) return;
    const id = e.currentTarget.dataset.id;
    const idea = this.data.ideas.find(item => item._id === id);
    if (!idea || idea.creatorOpenid !== this.data.openid) {
      return wx.showToast({ title: '只能调整自己创建的惊喜', icon: 'none' });
    }
    const res = await updateItem(COL, this.data.coupleId, id, { hidden: !idea.hidden });
    applyStorageNotice(this, res.storage, res.error);
    await this.loadIdeas();
  },

  async toggleDone(e) {
    if (!requireBound(this)) return;
    const id = e.currentTarget.dataset.id;
    const idea = this.data.ideas.find(item => item._id === id);
    if (!idea || idea.masked) return;
    const res = await updateItem(COL, this.data.coupleId, id, { done: !idea.done });
    applyStorageNotice(this, res.storage, res.error);
    await this.loadIdeas();
  },

  deleteIdea(e) {
    if (!requireBound(this)) return;
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除惊喜灵感',
      content: '这只惊喜盲盒会被移除。',
      success: async (res) => {
        if (!res.confirm) return;
        const result = await removeItem(COL, this.data.coupleId, id);
        applyStorageNotice(this, result.storage, result.error);
        await this.loadIdeas();
      }
    });
  },

  openGift() {
    wx.navigateTo({ url: '/pkg/giftSuggest/giftSuggest' });
  },

  openDatePlan() {
    wx.navigateTo({ url: '/pkg/datePlan/datePlan' });
  },

  goBind() {
    wx.switchTab({ url: '/pages/remembers/remembers' });
  }
});
