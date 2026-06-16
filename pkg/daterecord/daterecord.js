const db = wx.cloud.database();
const COL = 'love_dates';
const { getCoupleId, getPageBinding, getErrorMessage } = require('../../utils/couple'); 
// 如果你的约会页面路径不是 pkg/daterecord/，自己把 ../../ 调整对


function ymd(d = new Date()) {
  const dt = new Date(d);
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${m}-${day}`;
}

function monthKey(dateStr) {
  return (dateStr || '').slice(0, 7);
}

function randStr(n = 6) {
  return Math.random().toString(36).slice(2, 2 + n);
}

function buildMonthDays(monthStr, eventCountMap, selectedDate) {
  const [y, m] = monthStr.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const firstW = first.getDay(); // 0-6
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = ymd();

  const arr = [];
  for (let i = 0; i < firstW; i++) arr.push({ blank: true, day: '', date: '' });

  for (let d = 1; d <= daysInMonth; d++) {
    const dd = String(d).padStart(2, '0');
    const date = `${y}-${String(m).padStart(2, '0')}-${dd}`;
    arr.push({
      blank: false,
      day: d,
      date,
      hasEvent: (eventCountMap[date] || 0) > 0,
      isToday: date === today,
      isSelected: selectedDate ? date === selectedDate : false
    });
  }
  return arr;
}

Page({
  data: {
    coupleId: '',
    bindingReady: false,
    bindingState: 'loading',
    bindingMessage: '正在读取绑定状态...',
    loadError: '',
    keyword: '',
    viewMode: 'timeline', // timeline | calendar

    rawList: [],
    filteredList: [],

    totalCount: 0,
    monthCount: 0,
    totalCost: 0,

    // 日历
    calMonth: monthKey(ymd()),
    calDays: [],
    selectedDate: '',

    // 弹窗
    showModal: false,
    saving: false,
    editingId: '',
    form: {
      title: '',
      date: '',
      locationName: '',
      locationAddr: '',
      latitude: null,
      longitude: null,
      cost: '',
      mood: 0,
      tags: [],
      note: '',
      photos: [] // [{kind:'old',fileID,preview},{kind:'new',filePath,preview}]
    },
    tagDraft: '',

    // 海报
    showPoster: false,
    posterPath: ''
  },

  async onLoad() {
    const ok = await this.ensureBinding();
    if (ok) await this.reload();
  },
  

  onPullDownRefresh() {
    this.ensureBinding()
      .then((ok) => ok ? this.reload() : null)
      .finally(() => wx.stopPullDownRefresh());
  },

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
          rawList: [],
          filteredList: [],
          totalCount: 0,
          monthCount: 0,
          totalCost: 0,
          calDays: []
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
      console.log('daterecord ensureBinding fail:', e);
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
    return (this.data.rawList || []).find(x => x._id === id);
  },

  setViewMode(e) {
    const m = e.currentTarget.dataset.m;
    this.setData({ viewMode: m }, () => this.applyFilter());
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value || '' }, () => this.applyFilter());
  },

  useTpl(e) {
    if (!this.hasCoupleOrToast()) return;
    const t = e.currentTarget.dataset.t || '';
    if (!t) return;
    this.openAdd();
    this.setData({ 'form.title': t });
  },

  async reload() {
    const { coupleId } = this.data;
    if (!coupleId) return;
    wx.showNavigationBarLoading?.();

    try {
      const res = await db.collection(COL)
        .where({ coupleId })
        .orderBy('dateTs', 'desc')
        .limit(300)
        .get();

      let list = (res.data || []).map(x => ({
        ...x,
        moodStars: new Array(Number(x.mood || 0)).fill(1),
        photoUrls: []
      }));

      list = await this.hydratePhotoUrls(list);
      list = list.map((it, idx) => ({ ...it, isLast: idx === list.length - 1 }));

      this.setData({ rawList: list, loadError: '' }, () => {
        this.updateStats();
        this.rebuildCalendar();
        this.applyFilter();
      });
    } catch (e) {
      console.log('daterecord reload fail:', e);
      this.setData({ loadError: getErrorMessage(e, '约会记录加载失败') });
      wx.showToast({ title: '约会记录加载失败', icon: 'none' });
    } finally {
      wx.hideNavigationBarLoading?.();
    }
  },

  updateStats() {
    const list = this.data.rawList || [];
    const totalCount = list.length;
    const mk = monthKey(ymd());
    const monthCount = list.filter(x => monthKey(x.date) === mk).length;
    const totalCost = list.reduce((s, x) => s + Number(x.cost || 0), 0);
    this.setData({ totalCount, monthCount, totalCost });
  },

  rebuildCalendar() {
    const eventCountMap = {};
    (this.data.rawList || []).forEach(it => {
      if (!it.date) return;
      eventCountMap[it.date] = (eventCountMap[it.date] || 0) + 1;
    });
    const calDays = buildMonthDays(this.data.calMonth, eventCountMap, this.data.selectedDate);
    this.setData({ calDays });
  },

  prevMonth() {
    const [y, m] = this.data.calMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    const next = monthKey(ymd(d));
    this.setData({ calMonth: next }, () => this.rebuildCalendar());
  },

  nextMonth() {
    const [y, m] = this.data.calMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    const next = monthKey(ymd(d));
    this.setData({ calMonth: next }, () => this.rebuildCalendar());
  },

  selectDay(e) {
    const blank = e.currentTarget.dataset.blank;
    const date = e.currentTarget.dataset.date;
    if (blank || !date) return;
    this.setData({ selectedDate: date }, () => {
      this.rebuildCalendar();
      this.applyFilter();
    });
  },

  clearSelectedDate() {
    this.setData({ selectedDate: '' }, () => {
      this.rebuildCalendar();
      this.applyFilter();
    });
  },

  applyFilter() {
    const { rawList, keyword, viewMode, selectedDate } = this.data;
    const kw = (keyword || '').trim().toLowerCase();
    let list = [...rawList];

    if (viewMode === 'calendar' && selectedDate) {
      list = list.filter(x => x.date === selectedDate);
    }

    if (kw) {
      list = list.filter(x => {
        const t = (x.title || '').toLowerCase();
        const loc = (x.locationName || '').toLowerCase();
        const note = (x.note || '').toLowerCase();
        const tags = (x.tags || []).join(' ').toLowerCase();
        return t.includes(kw) || loc.includes(kw) || note.includes(kw) || tags.includes(kw);
      });
    }

    list = list.map((it, idx) => ({ ...it, isLast: idx === list.length - 1 }));
    this.setData({ filteredList: list });
  },

  async hydratePhotoUrls(list) {
    const all = [];
    (list || []).forEach(it => {
      (it.photoFileIDs || []).forEach(fid => fid && all.push(fid));
    });
    const fileIDs = Array.from(new Set(all));
    if (!fileIDs.length) return list.map(it => ({ ...it, photoUrls: [] }));

    let res;
    try {
      res = await wx.cloud.getTempFileURL({
        fileList: fileIDs.map(id => ({ fileID: id, maxAge: 24 * 60 * 60 }))
      });
    } catch (e) {
      console.log('daterecord hydrate photo fail:', e);
      return list.map(it => ({ ...it, photoUrls: [] }));
    }
    const map = {};
    (res.fileList || []).forEach(x => {
      if (x.fileID && x.tempFileURL) map[x.fileID] = x.tempFileURL;
    });

    return list.map(it => ({
      ...it,
      photoUrls: (it.photoFileIDs || []).map(fid => map[fid]).filter(Boolean)
    }));
  },

  // ========= 新增/编辑 =========
  openAdd() {
    if (!this.hasCoupleOrToast()) return;
    this.setData({
      showModal: true,
      saving: false,
      editingId: '',
      tagDraft: '',
      form: {
        title: '',
        date: ymd(),
        locationName: '',
        locationAddr: '',
        latitude: null,
        longitude: null,
        cost: '',
        mood: 0,
        tags: [],
        note: '',
        photos: []
      }
    });
  },

  openEdit(e) {
    if (!this.hasCoupleOrToast()) return;
    const id = e.currentTarget.dataset.id;
    const item = (this.data.rawList || []).find(x => x._id === id);
    if (!item) return;
    if (item.coupleId !== this.data.coupleId) {
      wx.showToast({ title: '记录不属于当前情侣空间', icon: 'none' });
      return;
    }

    const photos = [];
    const fids = item.photoFileIDs || [];
    const urls = item.photoUrls || [];
    for (let i = 0; i < fids.length; i++) {
      photos.push({ kind: 'old', fileID: fids[i], preview: urls[i] || '' });
    }

    this.setData({
      showModal: true,
      saving: false,
      editingId: id,
      tagDraft: '',
      form: {
        title: item.title || '',
        date: item.date || ymd(),
        locationName: item.locationName || '',
        locationAddr: item.locationAddr || '',
        latitude: item.latitude ?? null,
        longitude: item.longitude ?? null,
        cost: item.cost || '',
        mood: Number(item.mood || 0),
        tags: item.tags || [],
        note: item.note || '',
        photos
      }
    });
  },

  closeModal() {
    if (this.data.saving) return;
    this.setData({ showModal: false });
  },

  onTitle(e) { this.setData({ 'form.title': e.detail.value || '' }); },
  onDate(e) {
    const v = e.detail.value;
    this.setData({ 'form.date': v });
  },
  onLocationName(e) { this.setData({ 'form.locationName': e.detail.value || '' }); },
  onCost(e) { this.setData({ 'form.cost': e.detail.value || '' }); },
  onNote(e) { this.setData({ 'form.note': e.detail.value || '' }); },

  setMood(e) {
    const v = Number(e.currentTarget.dataset.v || 0);
    this.setData({ 'form.mood': v });
  },

  onTagDraft(e) { this.setData({ tagDraft: e.detail.value || '' }); },
  addTag() {
    const t = (this.data.tagDraft || '').trim();
    if (!t) return;
    const tags = this.data.form.tags || [];
    if (tags.includes(t)) return wx.showToast({ title: '标签已存在', icon: 'none' });
    this.setData({ 'form.tags': [...tags, t], tagDraft: '' });
  },
  removeTag(e) {
    const t = e.currentTarget.dataset.t;
    const tags = (this.data.form.tags || []).filter(x => x !== t);
    this.setData({ 'form.tags': tags });
  },

  // 📍 地图选点
  async pickLocation() {
    try {
      const res = await wx.chooseLocation();
      // res.name / res.address / res.latitude / res.longitude
      this.setData({
        'form.locationName': res.name || '',
        'form.locationAddr': res.address || '',
        'form.latitude': res.latitude ?? null,
        'form.longitude': res.longitude ?? null
      });
    } catch (e) {
      // 取消/无权限
    }
  },

  // 照片
  async choosePhotos() {
    try {
      const remain = 3 - (this.data.form.photos.length || 0);
      if (remain <= 0) return;

      const res = await wx.chooseImage({
        count: remain,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });

      const add = (res.tempFilePaths || []).map(p => ({ kind: 'new', filePath: p, preview: p }));
      this.setData({ 'form.photos': [...this.data.form.photos, ...add].slice(0, 3) });
    } catch {}
  },

  removePicked(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const arr = [...(this.data.form.photos || [])];
    arr.splice(idx, 1);
    this.setData({ 'form.photos': arr });
  },

  previewPicked(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const urls = (this.data.form.photos || []).map(x => x.preview).filter(Boolean);
    if (!urls.length) return;
    wx.previewImage({ urls, current: urls[idx] });
  },

  async saveRecord() {
    if (this.data.saving) return;

    const { coupleId, editingId, form } = this.data;
    if (!coupleId) return this.hasCoupleOrToast();
    const title = (form.title || '').trim();
    const date = form.date;
    if (!title) return wx.showToast({ title: '标题不能为空', icon: 'none' });
    if (!date) return wx.showToast({ title: '请选择日期', icon: 'none' });

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });

    try {
      const photoFileIDs = [];

      // 旧图直接保留
      (form.photos || []).forEach(p => {
        if (p.kind === 'old' && p.fileID) photoFileIDs.push(p.fileID);
      });

      // 新图上传
      for (const p of (form.photos || [])) {
        if (p.kind !== 'new' || !p.filePath) continue;
        const cloudPath = `dates/${coupleId}/${date}_${Date.now()}_${randStr(6)}.jpg`;
        const up = await wx.cloud.uploadFile({ cloudPath, filePath: p.filePath });
        if (up.fileID) photoFileIDs.push(up.fileID);
      }

      const costNum = Number(form.cost || 0) || 0;
      const payload = {
        coupleId,
        title,
        date,
        dateTs: new Date(date).getTime(),
        locationName: (form.locationName || '').trim(),
        locationAddr: (form.locationAddr || '').trim(),
        latitude: form.latitude ?? null,
        longitude: form.longitude ?? null,
        cost: costNum,
        mood: Number(form.mood || 0),
        tags: form.tags || [],
        note: (form.note || '').trim(),
        photoFileIDs,
        updatedAt: db.serverDate()
      };

      if (editingId) {
        const item = this.findLocalItem(editingId);
        if (!item || item.coupleId !== coupleId) {
          throw new Error('记录不属于当前情侣空间');
        }
        await db.collection(COL).doc(editingId).update({ data: payload });
      } else {
        await db.collection(COL).add({ data: { ...payload, createdAt: db.serverDate() } });
      }

      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ showModal: false, saving: false });
      await this.reload();
    } catch (e) {
      console.log(e);
      wx.hideLoading();
      wx.showToast({ title: getErrorMessage(e, '保存失败'), icon: 'none' });
      this.setData({ saving: false });
    }
  },

  onDelete(e) {
    if (!this.hasCoupleOrToast()) return;
    const id = e.currentTarget.dataset.id;
    const item = this.findLocalItem(id);
    if (!item || item.coupleId !== this.data.coupleId) {
      wx.showToast({ title: '记录不属于当前情侣空间', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '删除约会记录',
      content: '删除后不可恢复，确定删除吗？',
      confirmText: '删除',
      confirmColor: '#d33',
      success: async (r) => {
        if (!r.confirm) return;
        wx.showLoading({ title: '删除中...' });
        try {
          await db.collection(COL).doc(id).remove();
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          await this.reload();
        } catch (err) {
          console.log(err);
          wx.hideLoading();
          wx.showToast({ title: getErrorMessage(err, '删除失败'), icon: 'none' });
        }
      }
    });
  },

  previewPhoto(e) {
    const id = e.currentTarget.dataset.id;
    const idx = Number(e.currentTarget.dataset.idx);
    const item = (this.data.filteredList || []).find(x => x._id === id);
    if (!item || !item.photoUrls || !item.photoUrls.length) return;
    wx.previewImage({ urls: item.photoUrls, current: item.photoUrls[idx] });
  },

  // ========= 票根海报 =========
  async makePoster(e) {
    if (!this.hasCoupleOrToast()) return;
    const id = e.currentTarget.dataset.id;
    const item = (this.data.rawList || []).find(x => x._id === id);
    if (!item) return;
    if (item.coupleId !== this.data.coupleId) {
      wx.showToast({ title: '记录不属于当前情侣空间', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '生成海报...' });
    try {
      const path = await this.drawPoster(item);
      wx.hideLoading();
      this.setData({ showPoster: true, posterPath: path });
    } catch (err) {
      console.log(err);
      wx.hideLoading();
      wx.showToast({ title: '海报生成失败', icon: 'none' });
    }
  },

  closePoster() {
    this.setData({ showPoster: false });
  },

  previewPoster() {
    if (!this.data.posterPath) return;
    wx.previewImage({ urls: [this.data.posterPath] });
  },

  async savePoster() {
    const p = this.data.posterPath;
    if (!p) return;

    try {
      await wx.saveImageToPhotosAlbum({ filePath: p });
      wx.showToast({ title: '已保存到相册', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '保存失败（可能未授权相册）', icon: 'none' });
    }
  },

  sharePoster() {
    const p = this.data.posterPath;
    if (!p) return;

    // showShareImageMenu 只支持本地/临时路径分享
    if (typeof wx.showShareImageMenu === 'function') {
      wx.showShareImageMenu({ path: p });
    } else {
      wx.showToast({ title: '当前版本不支持直接分享图片，请先保存相册再发给Ta', icon: 'none' });
    }
  },

  async drawPoster(item) {
    // 画布像素（px）
    const W = 750;
    const H = 1100;

    const ctx = wx.createCanvasContext('posterCanvas', this);

    // 背景渐变
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#fff6f9');
    g.addColorStop(1, '#ffffff');
    ctx.setFillStyle(g);
    ctx.fillRect(0, 0, W, H);

    // 标题
    ctx.setFillStyle('#222');
    ctx.setFontSize(40);
    ctx.fillText('约会票根', 40, 80);

    // 右上角小字
    ctx.setFillStyle('#ff4f7a');
    ctx.setFontSize(22);
    ctx.fillText('Love Ticket', W - 150, 80);

    // 分隔线
    ctx.setStrokeStyle('#f1d7df');
    ctx.setLineWidth(2);
    ctx.beginPath();
    ctx.moveTo(40, 110);
    ctx.lineTo(W - 40, 110);
    ctx.stroke();

    // 主信息
    const lineY = 170;
    ctx.setFillStyle('#333');
    ctx.setFontSize(32);
    ctx.fillText(item.title || '我们的约会', 40, lineY);

    ctx.setFillStyle('#666');
    ctx.setFontSize(26);
    ctx.fillText(`日期：${item.date || ''}`, 40, lineY + 60);
    ctx.fillText(`地点：${item.locationName || '（未填写）'}`, 40, lineY + 105);
    ctx.fillText(`花费：${Number(item.cost || 0)} 元`, 40, lineY + 150);

    // 心情
    const mood = Number(item.mood || 0);
    ctx.setFillStyle('#ff6f8e');
    ctx.setFontSize(26);
    ctx.fillText('心情：', 40, lineY + 195);
    ctx.setFontSize(28);
    ctx.fillText('❤'.repeat(mood) || '—', 115, lineY + 195);

    // 照片区域（如果有）
    const photoUrl = (item.photoUrls && item.photoUrls[0]) ? item.photoUrls[0] : '';
    const boxX = 40, boxY = 420, boxW = W - 80, boxH = 420;

    // 圆角矩形
    this.roundRect(ctx, boxX, boxY, boxW, boxH, 22);
    ctx.clip();

    if (photoUrl) {
      const local = await this.getLocalImage(photoUrl);
      if (local) ctx.drawImage(local, boxX, boxY, boxW, boxH);
      else {
        ctx.setFillStyle('#f7f8fb');
        ctx.fillRect(boxX, boxY, boxW, boxH);
      }
    } else {
      ctx.setFillStyle('#f7f8fb');
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.setFillStyle('#9aa0a6');
      ctx.setFontSize(26);
      ctx.fillText('这里可以放一张合照/票根/美食照片', boxX + 60, boxY + boxH / 2);
    }

    // 解除裁剪
    ctx.restore && ctx.restore();

    // 底部签名
    ctx.setFillStyle('#9aa0a6');
    ctx.setFontSize(22);
    ctx.fillText('— 爱木长诗 · 约会记录 —', 40, H - 70);

    ctx.draw();

    // 转图片
    await new Promise(r => setTimeout(r, 80));
    const res = await new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvasId: 'posterCanvas',
        width: W,
        height: H,
        destWidth: W,
        destHeight: H,
        success: resolve,
        fail: reject
      }, this);
    });

    return res.tempFilePath;
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.save && ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  async getLocalImage(url) {
    try {
      const info = await wx.getImageInfo({ src: url });
      return info.path;
    } catch {
      return '';
    }
  }
});
