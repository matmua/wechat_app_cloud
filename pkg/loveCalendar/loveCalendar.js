const {
  dateKey,
  dateLabel,
  initBoundPage,
  requireBound,
  loadList,
  addItem,
  removeItem,
  applyStorageNotice
} = require('../../utils/liteStore');

const COL = 'love_calendar_events';
const EVENT_TYPES = [
  { key: 'custom', label: '自定义', icon: '✨' },
  { key: 'memorial', label: '纪念日', icon: '⏳' },
  { key: 'date', label: '约会', icon: '🎟️' },
  { key: 'plan', label: '计划', icon: '✅' },
  { key: 'period', label: '提醒', icon: '🌙' }
];
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function pad(num) {
  return `${num}`.padStart(2, '0');
}

function monthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function addMonth(value, offset) {
  const [year, month] = value.split('-').map(Number);
  return monthKey(new Date(year, month - 1 + offset, 1));
}

function makeDate(year, monthIndex, day) {
  const date = new Date(year, monthIndex, day);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function emptyForm() {
  return {
    title: '',
    date: dateKey(),
    type: 'custom',
    note: ''
  };
}

function eventType(key) {
  return EVENT_TYPES.find(item => item.key === key) || EVENT_TYPES[0];
}

function normalizeEvents(list, source) {
  return (list || []).map((item) => {
    const type = item.type || source;
    const meta = eventType(type);
    return {
      ...item,
      source,
      type,
      typeLabel: meta.label,
      icon: meta.icon,
      date: item.date || item.periodStart || item.targetDate,
      title: item.title || item.name || meta.label,
      note: item.note || item.notes || '',
      removable: source === 'custom'
    };
  }).filter(item => !!item.date);
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
    weekdays: WEEKDAYS,
    eventTypes: EVENT_TYPES,
    typeIndex: 0,
    monthCursor: monthKey(new Date()),
    monthTitle: '',
    calendarDays: [],
    allEvents: [],
    selectedDate: dateKey(),
    selectedDateLabel: dateLabel(dateKey()),
    selectedEvents: [],
    form: emptyForm()
  },

  async onLoad() {
    const binding = await initBoundPage(this);
    this.buildCalendar();
    if (binding && binding.bindingReady) await this.loadEvents();
  },

  async onPullDownRefresh() {
    await this.loadEvents();
    wx.stopPullDownRefresh();
  },

  buildCalendar(events = this.data.allEvents) {
    const [year, month] = this.data.monthCursor.split('-').map(Number);
    const first = new Date(year, month - 1, 1);
    const firstWeek = first.getDay();
    const totalDays = new Date(year, month, 0).getDate();
    const prevDays = new Date(year, month - 1, 0).getDate();
    const days = [];
    const today = dateKey();

    for (let i = 0; i < 42; i += 1) {
      const offset = i - firstWeek + 1;
      let day = offset;
      let itemMonth = month - 1;
      let itemYear = year;
      let inMonth = true;
      if (offset <= 0) {
        day = prevDays + offset;
        itemMonth = month - 2;
        inMonth = false;
      } else if (offset > totalDays) {
        day = offset - totalDays;
        itemMonth = month;
        inMonth = false;
      }
      const date = makeDate(itemYear, itemMonth, day);
      const dayEvents = events.filter(event => event.date === date).slice(0, 4);
      days.push({
        date,
        day,
        inMonth,
        isToday: date === today,
        isSelected: date === this.data.selectedDate,
        events: dayEvents,
        eventDots: dayEvents.map(event => event.type)
      });
    }

    const selectedEvents = events.filter(event => event.date === this.data.selectedDate);
    this.setData({
      monthTitle: `${year}年${month}月`,
      calendarDays: days,
      selectedDateLabel: dateLabel(this.data.selectedDate),
      selectedEvents
    });
  },

  async loadEvents() {
    if (!this.data.bindingReady) return;
    this.setData({ loading: true });
    const results = await Promise.all([
      loadList(COL, this.data.coupleId, { limit: 100 }),
      loadList('date_plans', this.data.coupleId, { limit: 80 }),
      loadList('daily_plans', this.data.coupleId, { limit: 120 }),
      loadList('love_memorials', this.data.coupleId, { limit: 80 }),
      loadList('period_records', this.data.coupleId, { limit: 80 })
    ]);
    const custom = normalizeEvents(results[0].list, 'custom');
    const dates = normalizeEvents((results[1].list || []).map(item => ({ ...item, type: 'date' })), 'date');
    const plans = normalizeEvents((results[2].list || []).map(item => ({ ...item, type: 'plan' })), 'plan');
    const memorials = normalizeEvents((results[3].list || []).map(item => ({ ...item, type: 'memorial' })), 'memorial');
    const periods = normalizeEvents((results[4].list || []).map(item => ({
      ...item,
      date: item.periodStart,
      title: item.visibility === 'private' && item.creatorOpenid !== this.data.openid ? '关心提醒' : '经期提醒',
      type: 'period'
    })), 'period');
    const allEvents = [...custom, ...dates, ...plans, ...memorials, ...periods];
    const hasLocal = results.some(item => item.storage === 'local');
    const firstLocal = results.find(item => item.error);
    this.setData({ allEvents, loading: false });
    this.buildCalendar(allEvents);
    applyStorageNotice(this, hasLocal ? 'local' : 'cloud', firstLocal && firstLocal.error);
  },

  prevMonth() {
    this.setData({ monthCursor: addMonth(this.data.monthCursor, -1) }, () => this.buildCalendar());
  },

  nextMonth() {
    this.setData({ monthCursor: addMonth(this.data.monthCursor, 1) }, () => this.buildCalendar());
  },

  selectDay(e) {
    const date = e.currentTarget.dataset.date;
    this.setData({
      selectedDate: date,
      'form.date': date
    }, () => this.buildCalendar());
  },

  onTitleInput(e) {
    this.setData({ 'form.title': e.detail.value || '' });
  },

  onDateChange(e) {
    this.setData({
      'form.date': e.detail.value,
      selectedDate: e.detail.value
    }, () => this.buildCalendar());
  },

  onTypeChange(e) {
    const index = Number(e.detail.value || 0);
    this.setData({
      typeIndex: index,
      'form.type': EVENT_TYPES[index].key
    });
  },

  onNoteInput(e) {
    this.setData({ 'form.note': e.detail.value || '' });
  },

  async saveEvent() {
    if (!requireBound(this)) return;
    const form = this.data.form;
    const title = (form.title || '').trim();
    if (!title) return wx.showToast({ title: '写一个日历事件', icon: 'none' });
    this.setData({ saving: true });
    const res = await addItem(COL, this.data.coupleId, {
      date: form.date,
      type: form.type,
      title,
      relatedId: '',
      note: (form.note || '').trim(),
      creatorOpenid: this.data.openid
    });
    this.setData({ saving: false, form: emptyForm(), typeIndex: 0 });
    applyStorageNotice(this, res.storage, res.error);
    wx.showToast({ title: res.storage === 'cloud' ? '事件已加入月历' : '已先保存本地', icon: 'none' });
    await this.loadEvents();
  },

  deleteEvent(e) {
    if (!requireBound(this)) return;
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除自定义事件',
      content: '只会删除你在本页新增的事件。',
      success: async (res) => {
        if (!res.confirm) return;
        const result = await removeItem(COL, this.data.coupleId, id);
        applyStorageNotice(this, result.storage, result.error);
        await this.loadEvents();
      }
    });
  },

  goRoute(e) {
    const type = e.currentTarget.dataset.type;
    const map = {
      memorial: '/pkg/memorial/memorial',
      date: '/pkg/datePlan/datePlan',
      plan: '/pages/remembers/remembers',
      period: '/pkg/loveStory/loveStory',
      custom: ''
    };
    if (!map[type]) return;
    if (type === 'plan') wx.switchTab({ url: map[type] });
    else wx.navigateTo({ url: map[type] });
  },

  goBind() {
    wx.switchTab({ url: '/pages/remembers/remembers' });
  }
});
