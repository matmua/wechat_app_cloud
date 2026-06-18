const {
  dateKey,
  initBoundPage,
  requireBound,
  loadList,
  addItem,
  updateItem,
  removeItem,
  applyStorageNotice,
  nowIso
} = require('../../utils/liteStore');

const COL = 'couple_tasks';
const TYPES = [
  { key: 'once', label: '一次性任务' },
  { key: 'streak', label: '连续打卡' }
];

function emptyForm() {
  return {
    title: '',
    type: 'once',
    targetCount: 1
  };
}

function decorate(item, openid) {
  const checkins = item.checkins || [];
  const currentCount = item.currentCount || checkins.length || 0;
  const targetCount = Number(item.targetCount || 1);
  const today = dateKey();
  const checkedToday = checkins.some(row => row.date === today && row.openid === openid);
  const participants = Array.from(new Set(checkins.map(row => row.openid).filter(Boolean)));
  const done = item.status === 'done' || currentCount >= targetCount;
  return {
    ...item,
    checkins,
    currentCount,
    targetCount,
    checkedToday,
    participantsCount: participants.length,
    done,
    progressPercent: Math.min(100, Math.round(currentCount / targetCount * 100)),
    typeText: item.type === 'streak' ? '连续打卡' : '一次性任务',
    badgeText: done ? '已解锁徽章' : `${currentCount}/${targetCount}`
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
    tasks: []
  },

  async onLoad() {
    const binding = await initBoundPage(this);
    if (binding && binding.bindingReady) await this.loadTasks();
  },

  async onPullDownRefresh() {
    await this.loadTasks();
    wx.stopPullDownRefresh();
  },

  async loadTasks() {
    if (!this.data.bindingReady) return;
    this.setData({ loading: true });
    const res = await loadList(COL, this.data.coupleId, { limit: 80 });
    this.setData({
      tasks: (res.list || []).map(item => decorate(item, this.data.openid)),
      loading: false
    });
    applyStorageNotice(this, res.storage, res.error);
  },

  onTitleInput(e) {
    this.setData({ 'form.title': e.detail.value || '' });
  },

  onTypeChange(e) {
    const index = Number(e.detail.value || 0);
    this.setData({
      typeIndex: index,
      'form.type': TYPES[index].key,
      'form.targetCount': TYPES[index].key === 'once' ? 1 : this.data.form.targetCount
    });
  },

  onTargetInput(e) {
    const value = Math.max(1, Math.min(99, Number(e.detail.value || 1)));
    this.setData({ 'form.targetCount': value });
  },

  async saveTask() {
    if (!requireBound(this)) return;
    const title = (this.data.form.title || '').trim();
    if (!title) return wx.showToast({ title: '写一个情侣任务', icon: 'none' });
    this.setData({ saving: true });
    const res = await addItem(COL, this.data.coupleId, {
      title,
      type: this.data.form.type,
      targetCount: Number(this.data.form.targetCount || 1),
      currentCount: 0,
      checkins: [],
      status: 'active',
      creatorOpenid: this.data.openid
    });
    this.setData({ saving: false, form: emptyForm(), typeIndex: 0 });
    applyStorageNotice(this, res.storage, res.error);
    wx.showToast({ title: res.storage === 'cloud' ? '任务已上墙' : '已先保存本地', icon: 'none' });
    await this.loadTasks();
  },

  async checkIn(e) {
    if (!requireBound(this)) return;
    const id = e.currentTarget.dataset.id;
    const task = this.data.tasks.find(item => item._id === id);
    if (!task) return;
    if (task.done) return wx.showToast({ title: '这个任务已经完成啦', icon: 'none' });
    if (task.type === 'streak' && task.checkedToday) {
      return wx.showToast({ title: '今天已经打过卡', icon: 'none' });
    }

    const checkins = [
      ...(task.checkins || []),
      { openid: this.data.openid, date: dateKey(), createdAt: nowIso() }
    ];
    const currentCount = task.type === 'once' ? task.targetCount : checkins.length;
    const status = currentCount >= task.targetCount ? 'done' : 'active';
    const res = await updateItem(COL, this.data.coupleId, id, { checkins, currentCount, status });
    applyStorageNotice(this, res.storage, res.error);
    wx.showToast({ title: status === 'done' ? '徽章解锁' : '打卡成功', icon: 'none' });
    await this.loadTasks();
  },

  async resetTask(e) {
    if (!requireBound(this)) return;
    const id = e.currentTarget.dataset.id;
    const res = await updateItem(COL, this.data.coupleId, id, {
      checkins: [],
      currentCount: 0,
      status: 'active'
    });
    applyStorageNotice(this, res.storage, res.error);
    await this.loadTasks();
  },

  deleteTask(e) {
    if (!requireBound(this)) return;
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除情侣任务',
      content: '这个任务和打卡记录会一起删除。',
      success: async (res) => {
        if (!res.confirm) return;
        const result = await removeItem(COL, this.data.coupleId, id);
        applyStorageNotice(this, result.storage, result.error);
        await this.loadTasks();
      }
    });
  },

  goBind() {
    wx.switchTab({ url: '/pages/remembers/remembers' });
  }
});
