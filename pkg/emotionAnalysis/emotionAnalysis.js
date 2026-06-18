const {
  dateKey,
  initBoundPage,
  requireBound,
  loadList,
  addItem,
  applyStorageNotice
} = require('../../utils/liteStore');

const COL = 'emotion_records';
const MOODS = [
  { key: 'happy', label: '开心', emoji: '☀️', score: 5 },
  { key: 'calm', label: '平静', emoji: '🌿', score: 4 },
  { key: 'miss', label: '想念', emoji: '🌙', score: 3 },
  { key: 'tired', label: '疲惫', emoji: '☁️', score: 2 },
  { key: 'sad', label: '低落', emoji: '🌧️', score: 1 }
];
const TAGS = ['被照顾', '有点累', '想见面', '需要拥抱', '想独处', '很安心', '小争执', '值得记录'];

function buildTagOptions(selected) {
  return TAGS.map(text => ({ text, active: selected.includes(text) }));
}

function recentDateKeys(count) {
  const result = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    result.push(dateKey(date));
  }
  return result;
}

function decorateTrend(records) {
  return recentDateKeys(7).map((date) => {
    const dayRecords = records.filter(item => item.date === date);
    const score = dayRecords.length
      ? Math.round(dayRecords.reduce((sum, item) => sum + Number(item.score || 3), 0) / dayRecords.length)
      : 0;
    return {
      date,
      day: date.slice(5),
      score,
      height: score ? 24 + score * 18 : 18,
      label: score ? `${score}` : '-'
    };
  });
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
    moods: MOODS,
    tagOptions: buildTagOptions([]),
    selectedMoodKey: 'calm',
    selectedTags: [],
    reason: '',
    score: 4,
    today: dateKey(),
    records: [],
    trend: decorateTrend([]),
    suggestion: '先记录，不急着分析。情绪稳定后再回看，会更容易说清楚自己需要什么。'
  },

  async onLoad() {
    const binding = await initBoundPage(this);
    if (binding && binding.bindingReady) await this.loadRecords();
  },

  async onPullDownRefresh() {
    await this.loadRecords();
    wx.stopPullDownRefresh();
  },

  async loadRecords() {
    if (!this.data.bindingReady) return;
    this.setData({ loading: true });
    const res = await loadList(COL, this.data.coupleId, { limit: 100 });
    const records = res.list || [];
    this.setData({
      records,
      trend: decorateTrend(records),
      loading: false
    });
    applyStorageNotice(this, res.storage, res.error);
  },

  selectMood(e) {
    const key = e.currentTarget.dataset.key;
    const mood = MOODS.find(item => item.key === key) || MOODS[1];
    this.setData({
      selectedMoodKey: key,
      score: mood.score,
      suggestion: mood.score <= 2
        ? '今天可以先少做判断，多一点休息和被照顾。'
        : mood.score >= 5
          ? '把这份开心记下来，之后也许能复刻。'
          : '状态不需要被评价，先把原因写清楚就够了。'
    });
  },

  toggleTag(e) {
    const tag = e.currentTarget.dataset.tag;
    const selected = this.data.selectedTags.includes(tag)
      ? this.data.selectedTags.filter(item => item !== tag)
      : [...this.data.selectedTags, tag].slice(0, 5);
    this.setData({ selectedTags: selected, tagOptions: buildTagOptions(selected) });
  },

  onReasonInput(e) {
    this.setData({ reason: e.detail.value || '' });
  },

  onScoreChange(e) {
    this.setData({ score: Number(e.detail.value || 3) });
  },

  async saveRecord() {
    if (!requireBound(this)) return;
    const mood = MOODS.find(item => item.key === this.data.selectedMoodKey) || MOODS[1];
    this.setData({ saving: true });
    const res = await addItem(COL, this.data.coupleId, {
      mood: mood.label,
      moodKey: mood.key,
      emoji: mood.emoji,
      tags: this.data.selectedTags,
      reason: (this.data.reason || '').trim(),
      score: Number(this.data.score || mood.score),
      creatorOpenid: this.data.openid,
      date: this.data.today
    });
    this.setData({ saving: false, reason: '', selectedTags: [], tagOptions: buildTagOptions([]) });
    applyStorageNotice(this, res.storage, res.error);
    wx.showToast({ title: res.storage === 'cloud' ? '情绪已记录' : '已先保存本地', icon: 'none' });
    await this.loadRecords();
  },

  goAI() {
    wx.navigateTo({ url: '/pkg/moodDiary/moodDiary' });
  },

  goBind() {
    wx.switchTab({ url: '/pages/remembers/remembers' });
  }
});
