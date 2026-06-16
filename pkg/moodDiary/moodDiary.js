const MOODS = [
  { key: 'happy', label: '开心', color: 'pink', reply: '把这份开心告诉 Ta，具体到一件小事，会比一句“我很开心”更甜。' },
  { key: 'tired', label: '累了', color: 'blue', reply: '今天先别解决所有问题，给自己和 Ta 都留一点安静时间。' },
  { key: 'miss', label: '想念', color: 'rose', reply: '可以发一句很短的话：“刚刚想到你了。”不用铺垫。' },
  { key: 'angry', label: '委屈', color: 'amber', reply: '先说事实和感受，少用“你总是”。把需要讲清楚就好。' },
  { key: 'calm', label: '平静', color: 'green', reply: '适合一起做个小计划，把稳定的日子也认真记下来。' }
];

Page({
  data: {
    moods: MOODS,
    active: MOODS[0],
    sentence: '',
    saved: []
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: 'AI助手' });
  },

  chooseMood(e) {
    const key = e.currentTarget.dataset.key;
    const active = MOODS.find((item) => item.key === key) || MOODS[0];
    this.setData({ active });
  },

  onSentenceInput(e) {
    this.setData({ sentence: e.detail.value });
  },

  saveReflection() {
    const text = (this.data.sentence || '').trim();
    const saved = [{
      mood: this.data.active.label,
      text: text || '今天先不写很多，只记录这个状态。',
      reply: this.data.active.reply
    }, ...this.data.saved].slice(0, 4);
    this.setData({ saved, sentence: '' });
  },

  copyReply() {
    wx.setClipboardData({
      data: this.data.active.reply,
      success: () => wx.showToast({ title: '已复制建议', icon: 'none' })
    });
  },

  onShareAppMessage() {
    return {
      title: '爱木长诗 · AI助手',
      path: '/pkg/moodDiary/moodDiary'
    };
  }
});
