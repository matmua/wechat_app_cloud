const { getPageBinding, getErrorMessage } = require('../../utils/couple');

const COLLECTION = 'period_records';
const VISIBILITY_OPTIONS = [
  { key: 'private', label: '仅自己', desc: '对方看不到这条记录' },
  { key: 'careOnly', label: '关心模式', desc: '对方只看到需要多关心' },
  { key: 'shared', label: '共享细节', desc: '对方可看日期和备注' }
];

function pad(n) {
  return `${n}`.padStart(2, '0');
}

function todayText() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(text) {
  const [year, month, day] = `${text}`.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(text, days) {
  const date = parseDate(text);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function daysBetween(from, to) {
  const a = parseDate(from).getTime();
  const b = parseDate(to).getTime();
  return Math.ceil((b - a) / 86400000);
}

function inRange(date, start, end) {
  return date >= start && date <= end;
}

Page({
  data: {
    bindingReady: false,
    bindingState: 'loading',
    bindingMessage: '正在确认绑定状态...',
    coupleId: '',
    openid: '',
    visibilityOptions: VISIBILITY_OPTIONS,
    monthCursor: '',
    monthTitle: '',
    calendarDays: [],
    myRecords: [],
    partnerCareRecords: [],
    partnerSharedRecords: [],
    periodStart: todayText(),
    periodEnd: todayText(),
    cycleLength: 28,
    periodLength: 5,
    notes: '',
    visibility: 'careOnly',
    prediction: null,
    loading: false,
    saving: false,
    errorMessage: ''
  },

  async onLoad() {
    wx.setNavigationBarTitle({ title: '经期记录' });
    const now = new Date();
    this.setData({ monthCursor: `${now.getFullYear()}-${pad(now.getMonth() + 1)}` });
    await this.refreshBinding();
  },

  async onShow() {
    await this.refreshBinding(true);
  },

  async onPullDownRefresh() {
    await this.refreshBinding(true);
    wx.stopPullDownRefresh();
  },

  async refreshBinding(silent = false) {
    try {
      const binding = await getPageBinding();
      this.setData({
        bindingReady: !!binding.bindingReady,
        bindingState: binding.bindingState,
        bindingMessage: binding.bindingMessage,
        coupleId: binding.coupleId || '',
        openid: binding.openid || '',
        errorMessage: ''
      });
      if (binding.bindingReady) await this.loadRecords();
    } catch (e) {
      const message = getErrorMessage(e, '绑定状态读取失败');
      this.setData({ bindingReady: false, bindingState: 'error', bindingMessage: message, errorMessage: message });
      if (!silent) wx.showToast({ title: message, icon: 'none' });
    }
  },

  async loadRecords() {
    if (!this.data.coupleId || !this.data.openid) return;
    this.setData({ loading: true, errorMessage: '' });
    const db = wx.cloud.database();
    const _ = db.command;
    try {
      const [mine, partnerCare, partnerShared] = await Promise.all([
        db.collection(COLLECTION)
          .where({ coupleId: this.data.coupleId, ownerOpenid: this.data.openid })
          .orderBy('periodStart', 'desc')
          .limit(24)
          .get(),
        db.collection(COLLECTION)
          .where({ coupleId: this.data.coupleId, ownerOpenid: _.neq(this.data.openid), visibility: 'careOnly' })
          .field({ ownerOpenid: true, visibility: true, updatedAt: true })
          .orderBy('updatedAt', 'desc')
          .limit(6)
          .get(),
        db.collection(COLLECTION)
          .where({ coupleId: this.data.coupleId, ownerOpenid: _.neq(this.data.openid), visibility: 'shared' })
          .orderBy('periodStart', 'desc')
          .limit(12)
          .get()
      ]);
      const myRecords = mine.data || [];
      const partnerCareRecords = partnerCare.data || [];
      const partnerSharedRecords = partnerShared.data || [];
      this.setData({
        myRecords,
        partnerCareRecords,
        partnerSharedRecords,
        prediction: this.buildPrediction(myRecords)
      }, () => this.buildCalendar());
    } catch (e) {
      const message = getErrorMessage(e, '经期记录读取失败');
      this.setData({ errorMessage: message });
      wx.showToast({ title: message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  buildPrediction(records) {
    if (!records.length) return null;
    const latest = records[0];
    const cycle = Number(latest.cycleLength || 28);
    const length = Number(latest.periodLength || 5);
    const nextStart = addDays(latest.periodStart, cycle);
    const nextEnd = addDays(nextStart, length - 1);
    const left = daysBetween(todayText(), nextStart);
    return {
      nextStart,
      nextEnd,
      left,
      text: left > 0 ? `预计还有 ${left} 天` : left === 0 ? '预计今天开始' : '预测日已过，请更新记录'
    };
  },

  buildCalendar() {
    const [year, month] = this.data.monthCursor.split('-').map(Number);
    const first = new Date(year, month - 1, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const days = [];
    const prediction = this.data.prediction;

    for (let i = 0; i < 42; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const date = formatDate(d);
      let mark = '';
      let markText = '';

      const own = this.data.myRecords.find((item) => inRange(date, item.periodStart, item.periodEnd));
      const shared = this.data.partnerSharedRecords.find((item) => inRange(date, item.periodStart, item.periodEnd));
      if (own) {
        mark = 'period';
        markText = '经期';
      } else if (prediction && inRange(date, prediction.nextStart, prediction.nextEnd)) {
        mark = 'predict';
        markText = '预测';
      } else if (shared) {
        mark = 'care';
        markText = '关心';
      }

      days.push({
        date,
        day: d.getDate(),
        muted: d.getMonth() !== month - 1,
        today: date === todayText(),
        mark,
        markText
      });
    }

    this.setData({
      calendarDays: days,
      monthTitle: `${year}年${month}月`
    });
  },

  prevMonth() {
    const [year, month] = this.data.monthCursor.split('-').map(Number);
    const date = new Date(year, month - 2, 1);
    this.setData({ monthCursor: `${date.getFullYear()}-${pad(date.getMonth() + 1)}` }, () => this.buildCalendar());
  },

  nextMonth() {
    const [year, month] = this.data.monthCursor.split('-').map(Number);
    const date = new Date(year, month, 1);
    this.setData({ monthCursor: `${date.getFullYear()}-${pad(date.getMonth() + 1)}` }, () => this.buildCalendar());
  },

  onStartChange(e) {
    this.setData({ periodStart: e.detail.value });
  },

  onEndChange(e) {
    this.setData({ periodEnd: e.detail.value });
  },

  onCycleInput(e) {
    this.setData({ cycleLength: e.detail.value });
  },

  onLengthInput(e) {
    this.setData({ periodLength: e.detail.value });
  },

  onNotesInput(e) {
    this.setData({ notes: e.detail.value });
  },

  setVisibility(e) {
    this.setData({ visibility: e.currentTarget.dataset.key });
  },

  async savePeriod() {
    if (!this.data.bindingReady) {
      wx.showToast({ title: '请先绑定情侣关系', icon: 'none' });
      return;
    }
    if (this.data.periodEnd < this.data.periodStart) {
      wx.showToast({ title: '结束日期不能早于开始日期', icon: 'none' });
      return;
    }
    const cycle = Number(this.data.cycleLength);
    const length = Number(this.data.periodLength);
    if (!cycle || !length || cycle < 15 || length < 1) {
      wx.showToast({ title: '请填写合理周期', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    const db = wx.cloud.database();
    try {
      await db.collection(COLLECTION).add({
        data: {
          coupleId: this.data.coupleId,
          ownerOpenid: this.data.openid,
          periodStart: this.data.periodStart,
          periodEnd: this.data.periodEnd,
          cycleLength: cycle,
          periodLength: length,
          notes: (this.data.notes || '').trim(),
          visibility: this.data.visibility,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
      this.setData({ notes: '', visibility: 'careOnly' });
      wx.showToast({ title: '已记录', icon: 'none' });
      await this.loadRecords();
    } catch (e) {
      const message = getErrorMessage(e, '保存失败');
      wx.showToast({ title: message, icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  goBind() {
    wx.switchTab({ url: '/pages/remembers/remembers' });
  },

  onShareAppMessage() {
    return {
      title: '爱木长诗 · 经期记录',
      path: '/pkg/loveStory/loveStory'
    };
  }
});
