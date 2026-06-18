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

const COL = 'memorial_preparations';

function emptyForm() {
  return {
    title: '',
    targetDate: dateKey(),
    todoDraft: '',
    todoList: [
      { text: '确认当天安排', done: false },
      { text: '准备一句想说的话', done: false }
    ],
    giftPlan: '',
    messageDraft: ''
  };
}

function decorate(item) {
  const todoList = item.todoList || [];
  const doneCount = todoList.filter(task => task.done).length;
  return {
    ...item,
    targetDateText: dateLabel(item.targetDate),
    doneCount,
    todoTotal: todoList.length,
    progressText: todoList.length ? `${doneCount}/${todoList.length} 已准备` : '还没有准备事项',
    progressPercent: todoList.length ? Math.round(doneCount / todoList.length * 100) : 0
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
    form: emptyForm(),
    preparations: []
  },

  async onLoad() {
    const binding = await initBoundPage(this);
    if (binding && binding.bindingReady) await this.loadPreparations();
  },

  async onPullDownRefresh() {
    await this.loadPreparations();
    wx.stopPullDownRefresh();
  },

  async loadPreparations() {
    if (!this.data.bindingReady) return;
    this.setData({ loading: true });
    const res = await loadList(COL, this.data.coupleId, { orderBy: 'targetDate', direction: 'asc', limit: 60 });
    this.setData({
      preparations: (res.list || []).map(decorate),
      loading: false
    });
    applyStorageNotice(this, res.storage, res.error);
  },

  onTitleInput(e) {
    this.setData({ 'form.title': e.detail.value || '' });
  },

  onDateChange(e) {
    this.setData({ 'form.targetDate': e.detail.value });
  },

  onGiftInput(e) {
    this.setData({ 'form.giftPlan': e.detail.value || '' });
  },

  onMessageInput(e) {
    this.setData({ 'form.messageDraft': e.detail.value || '' });
  },

  onTodoDraft(e) {
    this.setData({ 'form.todoDraft': e.detail.value || '' });
  },

  addTodo() {
    const text = (this.data.form.todoDraft || '').trim();
    if (!text) return wx.showToast({ title: '写一个准备事项', icon: 'none' });
    this.setData({
      'form.todoList': [...this.data.form.todoList, { text, done: false }],
      'form.todoDraft': ''
    });
  },

  toggleFormTodo(e) {
    const index = Number(e.currentTarget.dataset.index);
    const todoList = this.data.form.todoList.map((item, i) => (
      i === index ? { ...item, done: !item.done } : item
    ));
    this.setData({ 'form.todoList': todoList });
  },

  removeFormTodo(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ 'form.todoList': this.data.form.todoList.filter((_, i) => i !== index) });
  },

  async savePreparation() {
    if (!requireBound(this)) return;
    const form = this.data.form;
    const title = (form.title || '').trim();
    if (!title) return wx.showToast({ title: '写一个纪念日主题', icon: 'none' });
    this.setData({ saving: true });
    const res = await addItem(COL, this.data.coupleId, {
      memorialId: '',
      title,
      targetDate: form.targetDate,
      todoList: form.todoList,
      giftPlan: (form.giftPlan || '').trim(),
      messageDraft: (form.messageDraft || '').trim(),
      done: false,
      creatorOpenid: this.data.openid
    });
    this.setData({ saving: false, form: emptyForm() });
    applyStorageNotice(this, res.storage, res.error);
    wx.showToast({ title: res.storage === 'cloud' ? '信封已保存' : '已先保存本地', icon: 'none' });
    await this.loadPreparations();
  },

  async toggleTodo(e) {
    if (!requireBound(this)) return;
    const id = e.currentTarget.dataset.id;
    const index = Number(e.currentTarget.dataset.index);
    const prep = this.data.preparations.find(item => item._id === id);
    if (!prep) return;
    const todoList = (prep.todoList || []).map((item, i) => (
      i === index ? { ...item, done: !item.done } : item
    ));
    const res = await updateItem(COL, this.data.coupleId, id, { todoList });
    applyStorageNotice(this, res.storage, res.error);
    await this.loadPreparations();
  },

  async toggleDone(e) {
    if (!requireBound(this)) return;
    const id = e.currentTarget.dataset.id;
    const prep = this.data.preparations.find(item => item._id === id);
    if (!prep) return;
    const res = await updateItem(COL, this.data.coupleId, id, { done: !prep.done });
    applyStorageNotice(this, res.storage, res.error);
    await this.loadPreparations();
  },

  deletePreparation(e) {
    if (!requireBound(this)) return;
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除准备信封',
      content: '确认删除这份纪念日准备吗？',
      success: async (res) => {
        if (!res.confirm) return;
        const result = await removeItem(COL, this.data.coupleId, id);
        applyStorageNotice(this, result.storage, result.error);
        await this.loadPreparations();
      }
    });
  },

  openMemorial() {
    wx.navigateTo({ url: '/pkg/memorial/memorial' });
  },

  goBind() {
    wx.switchTab({ url: '/pages/remembers/remembers' });
  }
});
