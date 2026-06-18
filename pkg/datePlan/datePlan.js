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

const COL = 'date_plans';
const BUDGETS = ['随心小约会', '100 以内', '100-300', '300-600', '认真准备'];

function buildEmptyForm() {
  return {
    title: '',
    date: dateKey(),
    place: '',
    budget: BUDGETS[0],
    stepDraft: '',
    checklistDraft: '',
    steps: ['见面', '吃饭', '散步'],
    checklist: [
      { text: '提前确认时间', done: false },
      { text: '准备一点小惊喜', done: false }
    ]
  };
}

function decoratePlan(item) {
  const checklist = item.checklist || [];
  const doneCount = checklist.filter(task => task.done).length;
  const total = checklist.length;
  return {
    ...item,
    dateText: dateLabel(item.date),
    doneCount,
    total,
    progressText: total ? `${doneCount}/${total} 准备好` : '还没有准备清单',
    progressPercent: total ? Math.round((doneCount / total) * 100) : 0
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
    budgets: BUDGETS,
    budgetIndex: 0,
    form: buildEmptyForm(),
    plans: []
  },

  async onLoad() {
    await this.bootstrap();
  },

  async onPullDownRefresh() {
    await this.loadPlans();
    wx.stopPullDownRefresh();
  },

  async bootstrap() {
    const binding = await initBoundPage(this);
    if (binding && binding.bindingReady) await this.loadPlans();
  },

  async loadPlans() {
    if (!this.data.bindingReady) return;
    this.setData({ loading: true });
    const res = await loadList(COL, this.data.coupleId, { limit: 50 });
    this.setData({
      plans: (res.list || []).map(decoratePlan),
      loading: false
    });
    applyStorageNotice(this, res.storage, res.error);
  },

  onTitleInput(e) {
    this.setData({ 'form.title': e.detail.value || '' });
  },

  onPlaceInput(e) {
    this.setData({ 'form.place': e.detail.value || '' });
  },

  onDateChange(e) {
    this.setData({ 'form.date': e.detail.value });
  },

  onBudgetChange(e) {
    const index = Number(e.detail.value || 0);
    this.setData({
      budgetIndex: index,
      'form.budget': BUDGETS[index] || BUDGETS[0]
    });
  },

  onStepDraft(e) {
    this.setData({ 'form.stepDraft': e.detail.value || '' });
  },

  addStep() {
    const text = (this.data.form.stepDraft || '').trim();
    if (!text) return wx.showToast({ title: '写一个路线步骤', icon: 'none' });
    this.setData({
      'form.steps': [...this.data.form.steps, text],
      'form.stepDraft': ''
    });
  },

  removeStep(e) {
    const index = Number(e.currentTarget.dataset.index);
    const steps = this.data.form.steps.filter((_, i) => i !== index);
    this.setData({ 'form.steps': steps });
  },

  onChecklistDraft(e) {
    this.setData({ 'form.checklistDraft': e.detail.value || '' });
  },

  addChecklist() {
    const text = (this.data.form.checklistDraft || '').trim();
    if (!text) return wx.showToast({ title: '写一个准备事项', icon: 'none' });
    this.setData({
      'form.checklist': [...this.data.form.checklist, { text, done: false }],
      'form.checklistDraft': ''
    });
  },

  toggleFormChecklist(e) {
    const index = Number(e.currentTarget.dataset.index);
    const checklist = this.data.form.checklist.map((item, i) => (
      i === index ? { ...item, done: !item.done } : item
    ));
    this.setData({ 'form.checklist': checklist });
  },

  removeFormChecklist(e) {
    const index = Number(e.currentTarget.dataset.index);
    const checklist = this.data.form.checklist.filter((_, i) => i !== index);
    this.setData({ 'form.checklist': checklist });
  },

  async savePlan() {
    if (!requireBound(this)) return;
    const form = this.data.form;
    const title = (form.title || '').trim();
    if (!title) return wx.showToast({ title: '先给约会起个名字', icon: 'none' });
    if (!form.date) return wx.showToast({ title: '请选择约会日期', icon: 'none' });

    this.setData({ saving: true });
    const res = await addItem(COL, this.data.coupleId, {
      title,
      date: form.date,
      place: (form.place || '').trim(),
      budget: form.budget,
      steps: form.steps,
      checklist: form.checklist,
      status: 'planning',
      creatorOpenid: this.data.openid
    });
    this.setData({
      saving: false,
      form: buildEmptyForm(),
      budgetIndex: 0
    });
    applyStorageNotice(this, res.storage, res.error);
    wx.showToast({ title: res.storage === 'cloud' ? '路线已保存' : '已先保存本地', icon: 'none' });
    await this.loadPlans();
  },

  async togglePlanChecklist(e) {
    if (!requireBound(this)) return;
    const id = e.currentTarget.dataset.id;
    const index = Number(e.currentTarget.dataset.index);
    const plan = this.data.plans.find(item => item._id === id);
    if (!plan) return;
    const checklist = (plan.checklist || []).map((item, i) => (
      i === index ? { ...item, done: !item.done } : item
    ));
    const res = await updateItem(COL, this.data.coupleId, id, { checklist });
    applyStorageNotice(this, res.storage, res.error);
    await this.loadPlans();
  },

  async markDone(e) {
    if (!requireBound(this)) return;
    const id = e.currentTarget.dataset.id;
    const res = await updateItem(COL, this.data.coupleId, id, { status: 'done' });
    applyStorageNotice(this, res.storage, res.error);
    await this.loadPlans();
  },

  deletePlan(e) {
    if (!requireBound(this)) return;
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除约会计划',
      content: '这张路线卡会被删除，确定吗？',
      success: async (res) => {
        if (!res.confirm) return;
        const result = await removeItem(COL, this.data.coupleId, id);
        applyStorageNotice(this, result.storage, result.error);
        await this.loadPlans();
      }
    });
  },

  goBind() {
    wx.switchTab({ url: '/pages/remembers/remembers' });
  }
});
