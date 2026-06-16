const db = wx.cloud.database();
const _ = db.command;
const { getCoupleId, getPageBinding, getErrorMessage } = require('../../utils/couple');

const COL = 'love_memorials';


function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function ymdFromDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

// ✅ 支持：'YYYY-MM-DD' 字符串 或 Date 对象
function parseAnyDate(v) {
  if (!v) return null;

  // 云数据库 Date 类型会直接返回 Date 对象
  if (v instanceof Date) return startOfDay(v);

  if (typeof v === 'string') {
    const s = v.trim();
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
  }

  return null;
}

function startOfToday() {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0, 0, 0, 0);
}
function diffDays(a, b) {
  // b - a
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

const TYPE_OPTIONS = [
  { key: 'anniversary', label: '恋爱纪念', icon: '💗' },
  { key: 'birthday', label: '生日', icon: '🎂' },
  { key: 'travel', label: '旅行', icon: '🧳' },
  { key: 'family', label: '家庭', icon: '🏠' },
  { key: 'custom', label: '其他', icon: '🎁' },
];

const COLOR_OPTIONS = [
  { key: 'pink', label: '粉色', bg: '#fff0f5' },
  { key: 'blue', label: '蓝色', bg: '#eef6ff' },
  { key: 'purple', label: '紫色', bg: '#f3efff' },
  { key: 'green', label: '绿色', bg: '#eefaf2' },
  { key: 'gray', label: '灰色', bg: '#f6f7f8' },
];

function enrichOne(item) {
  const today = startOfToday();
  const base = parseAnyDate(item.date);

  const typeObj = TYPE_OPTIONS.find(x => x.key === item.type) || TYPE_OPTIONS[0];
  const colorObj = COLOR_OPTIONS.find(x => x.key === item.color) || COLOR_OPTIONS[0];

  if (!base) {
    return {
      ...item,
      displayDate: String(item.date || ''),
      typeLabel: typeObj.label,
      typeIcon: typeObj.icon,
      colorBg: colorObj.bg,
      daysAbs: 0,     // ✅ 始终表示累计
      nextDays: 0     // ✅ 始终表示下一次/距离
    };
  }

  const repeat = item.repeat || 'none';

  // ✅ 1) 累计：只有当日期已发生，才累计；未发生则为 0
  const totalDays = Math.max(0, diffDays(base, today)); // today - base

  // ✅ 2) 下一次：yearly 算下一次发生；none 就算“距离该日”（未来>0，过去=0）
  let nextDays = 0;

  if (repeat === 'yearly') {
    const y = today.getFullYear();
    const thisYear = new Date(y, base.getMonth(), base.getDate(), 0, 0, 0, 0);
    const daysToThisYear = diffDays(today, thisYear); // thisYear - today

    const nextDate = (daysToThisYear >= 0)
      ? thisYear
      : new Date(y + 1, base.getMonth(), base.getDate(), 0, 0, 0, 0);

    nextDays = Math.max(0, diffDays(today, nextDate));
  } else {
    // 固定日期：未来就是距离该日；过去则 0
    nextDays = Math.max(0, diffDays(today, base));
  }

  return {
    ...item,
    displayDate: (typeof item.date === 'string') ? item.date : ymdFromDate(base),
    typeLabel: typeObj.label,
    typeIcon: typeObj.icon,
    colorBg: colorObj.bg,
    daysAbs: totalDays,   // ✅ 永远累计
    nextDays              // ✅ 永远下一次/距离
  };
}

function pickHero(list) {
  if (!list.length) return null;
  // 优先 pinned，然后 nextDays 最小
  const sorted = [...list].sort((a, b) => {
    const ap = a.pinned ? 1 : 0;
    const bp = b.pinned ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return a.nextDays - b.nextDays;
  });
  return sorted[0];
}

Page({
  data: {
    coupleId: '',
    bindingReady: false,
    bindingState: 'loading',
    bindingMessage: '正在读取绑定状态...',
    loadError: '',
    tab: 'all',

    allList: [],
    showList: [],
    hero: null,
    bannerText: '',

    showModal: false,
    editingId: '',

    typeOptions: TYPE_OPTIONS,
    colorOptions: COLOR_OPTIONS,

    form: {
      title: '',
      date: '',
      typeIndex: 0,
      colorIndex: 0,
      repeat: 'none',
      pinned: false
    }
  },

  async onLoad() {
    const ok = await this.ensureBinding();
    if (ok) await this.loadList();
  },
  

  async onShow() {
    if (!this.data.coupleId) return;
    await this.loadList();
  },

  noop() {},

  async ensureBinding() {
    try {
      const binding = await getPageBinding();
      if (!binding.bindingReady) {
        this.setData({
          coupleId: '',
          bindingReady: false,
          bindingState: binding.bindingState,
          bindingMessage: binding.bindingMessage,
          loadError: '',
          allList: [],
          showList: [],
          hero: null,
          bannerText: ''
        });
        return false;
      }

      this.setData({
        coupleId: binding.coupleId,
        bindingReady: true,
        bindingState: binding.bindingState,
        bindingMessage: binding.bindingMessage,
        loadError: ''
      });
      return true;
    } catch (e) {
      console.log('memorial ensureBinding fail:', e);
      const cached = getCoupleId();
      if (cached) {
        this.setData({
          coupleId: cached,
          bindingReady: true,
          bindingState: 'bound',
          bindingMessage: '绑定状态刷新失败，暂用本地缓存',
          loadError: ''
        });
        return true;
      }
      this.setData({
        coupleId: '',
        bindingReady: false,
        bindingState: 'error',
        bindingMessage: getErrorMessage(e, '绑定状态读取失败，请检查云函数'),
        loadError: ''
      });
      return false;
    }
  },

  hasCoupleOrToast() {
    if (this.data.coupleId) return true;
    wx.showToast({ title: '请先绑定情侣关系', icon: 'none' });
    return false;
  },

  findLocalItem(id) {
    return (this.data.allList || []).find(x => x._id === id);
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ tab });
    this.applyTab();
  },

  async loadList() {
    const { coupleId } = this.data;
    if (!coupleId) return;
    wx.showLoading({ title: '加载中...' });

    try {
      const r = await db.collection(COL)
        .where({ coupleId })
        .orderBy('updatedAt', 'desc')
        .limit(200)
        .get();

      const all = (r.data || []).map(enrichOne);

      // 列表排序：pinned 优先；再按 nextDays 小的在前；再按 updatedAt
      const sorted = [...all].sort((a, b) => {
        const ap = a.pinned ? 1 : 0;
        const bp = b.pinned ? 1 : 0;
        if (ap !== bp) return bp - ap;
        if (a.nextDays !== b.nextDays) return a.nextDays - b.nextDays;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });

      const hero = pickHero(sorted);
      const bannerText = this.makeBanner(sorted);

      this.setData({ allList: sorted, hero, bannerText, loadError: '' });
      this.applyTab();
    } catch (e) {
      console.log(e);
      this.setData({ loadError: getErrorMessage(e, '纪念日加载失败') });
      wx.showToast({ title: '纪念日加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  applyTab() {
    const { tab, allList } = this.data;
    if (tab === 'soon') {
      const soon = allList.filter(x => x.nextDays >= 0 && x.nextDays <= 30).sort((a, b) => a.nextDays - b.nextDays);
      this.setData({ showList: soon });
    } else {
      this.setData({ showList: allList });
    }
  },

  makeBanner(list) {
    // 30天内提醒：取 nextDays 最小的一个（<=30）
    const soon = list.filter(x => x.nextDays >= 0 && x.nextDays <= 30).sort((a, b) => a.nextDays - b.nextDays);
    if (!soon.length) return '';
    const it = soon[0];
    if (it.nextDays === 0) return `今天是「${it.title}」！记得给Ta一个拥抱💗`;
    return `距离「${it.title}」还有 ${it.nextDays} 天，要不要提前准备个小惊喜？`;
  },

  openCreate() {
    if (!this.hasCoupleOrToast()) return;
    const today = ymdFromDate(startOfToday());
    this.setData({
      showModal: true,
      editingId: '',
      form: {
        title: '',
        date: today,
        typeIndex: 0,
        colorIndex: 0,
        repeat: 'none',
        pinned: false
      }
    });
  },

  async openEdit(e) {
    if (!this.hasCoupleOrToast()) return;
    const id = e.currentTarget.dataset.id;
    const it = this.data.allList.find(x => x._id === id);
    if (!it) return;
    if (it.coupleId !== this.data.coupleId) {
      wx.showToast({ title: '记录不属于当前情侣空间', icon: 'none' });
      return;
    }

    const typeIndex = Math.max(0, TYPE_OPTIONS.findIndex(x => x.key === it.type));
    const colorIndex = Math.max(0, COLOR_OPTIONS.findIndex(x => x.key === it.color));

    this.setData({
      showModal: true,
      editingId: id,
      form: {
        title: it.title || '',
        date: it.date || '',
        typeIndex,
        colorIndex,
        repeat: it.repeat || 'none',
        pinned: !!it.pinned
      }
    });
  },

  closeModal() {
    this.setData({ showModal: false });
  },

  onTitle(e) { this.setData({ 'form.title': e.detail.value }); },
  onDate(e) { this.setData({ 'form.date': e.detail.value }); },
  onType(e) { this.setData({ 'form.typeIndex': Number(e.detail.value || 0) }); },
  onColor(e) { this.setData({ 'form.colorIndex': Number(e.detail.value || 0) }); },
  onRepeat(e) { this.setData({ 'form.repeat': e.detail.value ? 'yearly' : 'none' }); },
  onPinned(e) { this.setData({ 'form.pinned': !!e.detail.value }); },

  async saveOne() {
    const { coupleId, editingId, form } = this.data;
    if (!coupleId) return this.hasCoupleOrToast();

    const title = (form.title || '').trim();
    const date = form.date;

    if (!title) return wx.showToast({ title: '标题不能为空', icon: 'none' });
    if (!date) return wx.showToast({ title: '请选择日期', icon: 'none' });

    const type = TYPE_OPTIONS[form.typeIndex]?.key || 'anniversary';
    const color = COLOR_OPTIONS[form.colorIndex]?.key || 'pink';
    const repeat = form.repeat || 'none';
    const pinned = !!form.pinned;

    wx.showLoading({ title: '保存中...' });

    try {
      if (editingId) {
        const item = this.findLocalItem(editingId);
        if (!item || item.coupleId !== coupleId) {
          throw new Error('记录不属于当前情侣空间');
        }
        await db.collection(COL).doc(editingId).update({
          data: {
            title, date, type, color, repeat, pinned,
            updatedAt: db.serverDate()
          }
        });
      } else {
        await db.collection(COL).add({
          data: {
            coupleId,
            title, date, type, color, repeat, pinned,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        });
      }

      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ showModal: false });
      await this.loadList();
    } catch (e) {
      console.log(e);
      wx.hideLoading();
      wx.showToast({ title: getErrorMessage(e, '保存失败'), icon: 'none' });
    }
  },

  async removeOne(e) {
    if (!this.hasCoupleOrToast()) return;
    const id = e.currentTarget.dataset.id;
    const item = this.findLocalItem(id);
    if (!item || item.coupleId !== this.data.coupleId) {
      wx.showToast({ title: '记录不属于当前情侣空间', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '删除纪念日',
      content: '确定要删除吗？删除后无法恢复。',
      success: async (r) => {
        if (!r.confirm) return;
        wx.showLoading({ title: '删除中...' });
        try {
          await db.collection(COL).doc(id).remove();
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          await this.loadList();
        } catch (err) {
          console.log(err);
          wx.hideLoading();
          wx.showToast({ title: getErrorMessage(err, '删除失败'), icon: 'none' });
        }
      }
    });
  },

  async togglePin(e) {
    if (!this.hasCoupleOrToast()) return;
    const id = e.currentTarget.dataset.id;
    const pinned = !!e.currentTarget.dataset.pinned;
    const item = this.findLocalItem(id);
    if (!item || item.coupleId !== this.data.coupleId) {
      wx.showToast({ title: '记录不属于当前情侣空间', icon: 'none' });
      return;
    }

    try {
      await db.collection(COL).doc(id).update({
        data: { pinned: !pinned, updatedAt: db.serverDate() }
      });
      await this.loadList();
    } catch (err) {
      console.log(err);
      wx.showToast({ title: getErrorMessage(err, '操作失败'), icon: 'none' });
    }
  }
});
