const CALLS = [
  { title: '想你信号', text: '我现在有点想你，可以来陪我说两句话吗？', level: '轻轻呼叫' },
  { title: '抱抱信号', text: '今天需要一个抱抱，不用讲道理的那种。', level: '认真呼叫' },
  { title: '报备信号', text: '我到这里啦，看到一个东西突然想发给你。', level: '日常呼叫' },
  { title: '哄哄信号', text: '我有一点点不开心，你可以哄我一下吗？', level: '需要回应' },
  { title: '约会信号', text: '这周想和你见面，哪一天可以留给我？', level: '计划呼叫' }
];

Page({
  data: {
    calls: CALLS,
    active: CALLS[0],
    signal: 42
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '呼叫对方' });
  },

  switchCall(e) {
    const index = Number(e.currentTarget.dataset.index || 0);
    const active = this.data.calls[index] || CALLS[0];
    this.setData({ active, signal: 58 + index * 8 });
  },

  randomCall() {
    const index = Math.floor(Math.random() * this.data.calls.length);
    this.switchCall({ currentTarget: { dataset: { index } } });
  },

  copyCall() {
    wx.setClipboardData({
      data: this.data.active.text,
      success: () => wx.showToast({ title: '已复制呼叫文案', icon: 'none' })
    });
  },

  onShareAppMessage() {
    return {
      title: '爱木长诗呼叫台',
      path: '/pkg/loveTips/loveTips'
    };
  }
});
