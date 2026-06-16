const db = wx.cloud.database();
const COL = 'love_album';
const { getCoupleId, getPageBinding, getErrorMessage } = require('../../utils/couple');


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

Page({
  data: {
    coupleId: '',
    bindingReady: false,
    bindingState: 'loading',
    bindingMessage: '正在读取绑定状态...',
    loadError: '',
    keyword: '',
    monthOptions: ['全部月份'],
    monthIndex: 0,
    onlyFav: false,

    rawList: [],
    filteredList: [],
    favoriteList: [],

    showUpload: false,
    uploading: false,
    tagDraft: '',
    form: {
      title: '',
      tags: [],
      desc: '',
      localPaths: []
    },

    showEdit: false,
    editing: false,
    editId: '',
    editTagDraft: '',
    editForm: { title: '', tags: [], desc: '' },

    showCard: false,
    cardItem: {},
    wfLeft: [],
    wfRight: [],

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
          favoriteList: [],
          wfLeft: [],
          wfRight: []
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
      console.log('photoalbum ensureBinding fail:', e);
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

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value || '' }, () => this.applyFilter());
  },

  onMonthChange(e) {
    this.setData({ monthIndex: Number(e.detail.value || 0) }, () => this.applyFilter());
  },

  showOnlyFav() {
    this.setData({ onlyFav: !this.data.onlyFav }, () => this.applyFilter());
  },

  async reload() {
    const { coupleId } = this.data;
    if (!coupleId) return;
    wx.showNavigationBarLoading?.();

    try {
      const res = await db.collection(COL)
        .where({ coupleId })
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get();

      let list = (res.data || []).map(x => ({
        ...x,
        tempUrls: []
      }));

      list = await this.hydrateTempUrls(list);

      // 月份选项
      const months = Array.from(new Set(list.map(x => monthKey(x.date)))).filter(Boolean);
      const monthOptions = ['全部月份', ...months];

      this.setData({ rawList: list, monthOptions, loadError: '' }, () => {
        this.buildFavorites();
        this.applyFilter();
      });
    } catch (e) {
      console.log('photoalbum reload fail:', e);
      this.setData({ loadError: getErrorMessage(e, '相册加载失败') });
      wx.showToast({ title: '相册加载失败', icon: 'none' });
    } finally {
      wx.hideNavigationBarLoading?.();
    }
  },

  async hydrateTempUrls(list) {
    const all = [];
    (list || []).forEach(it => (it.fileIDs || []).forEach(fid => fid && all.push(fid)));
    const fileIDs = Array.from(new Set(all));
    if (!fileIDs.length) return list.map(it => ({ ...it, tempUrls: [] }));

    let res;
    try {
      res = await wx.cloud.getTempFileURL({
        fileList: fileIDs.map(id => ({ fileID: id, maxAge: 24 * 60 * 60 }))
      });
    } catch (e) {
      console.log('album hydrate temp url fail:', e);
      return list.map(it => ({ ...it, tempUrls: [] }));
    }

    const map = {};
    (res.fileList || []).forEach(x => {
      if (x.fileID && x.tempFileURL) map[x.fileID] = x.tempFileURL;
    });

    return list.map(it => ({
      ...it,
      tempUrls: (it.fileIDs || []).map(fid => map[fid]).filter(Boolean)
    }));
  },

  buildFavorites() {
    const fav = (this.data.rawList || []).filter(x => x.isFav).slice(0, 12);
    this.setData({ favoriteList: fav });
  },

  applyFilter() {
    const { rawList, keyword, monthOptions, monthIndex, onlyFav } = this.data;
    const kw = (keyword || '').trim().toLowerCase();
    const month = monthOptions[monthIndex] || '全部月份';
  
    let list = [...rawList];
  
    if (onlyFav) list = list.filter(x => x.isFav);
    if (month !== '全部月份') list = list.filter(x => (x.date || '').slice(0, 7) === month);
  
    if (kw) {
      list = list.filter(x => {
        const t = (x.title || '').toLowerCase();
        const d = (x.desc || '').toLowerCase();
        const tags = (x.tags || []).join(' ').toLowerCase();
        return t.includes(kw) || d.includes(kw) || tags.includes(kw);
      });
    }
  
    // ✅ 分成两列（核心）
    const { left, right } = this.splitToWaterfall(list);
  
    this.setData({ filteredList: list, wfLeft: left, wfRight: right });
    this.buildFavorites();
  },
  
  splitToWaterfall(list) {
    // 用 coverRatio 估算高度，把“更长”的分到更短的一列，就很像小红书
    let hL = 0, hR = 0;
    const left = [], right = [];
  
    // 约估：卡片文字区高度（标题/日期/按钮等），可微调
    const meta = 160;
  
    // 估算列宽（不需要特别准）
    const sys = wx.getSystemInfoSync();
    const colW = (sys.windowWidth - 24 * 2 * (sys.windowWidth / 750) - 10) / 2; // 粗略
  
    for (const item of (list || [])) {
      const ratio = Number(item.coverRatio || 1.0); // width/height
      const imgH = colW / ratio;                    // 估算图片高度
      const cardH = imgH + meta;
  
      if (hL <= hR) {
        left.push(item);
        hL += cardH;
      } else {
        right.push(item);
        hR += cardH;
      }
    }
    return { left, right };
  },
  

  // ========== 上传 ==========
  openUpload() {
    if (!this.hasCoupleOrToast()) return;
    this.setData({
      showUpload: true,
      uploading: false,
      tagDraft: '',
      form: { title: '', tags: [], desc: '', localPaths: [] }
    });
  },
  closeUpload() {
    if (this.data.uploading) return;
    this.setData({ showUpload: false });
  },

  onTitle(e) { this.setData({ 'form.title': e.detail.value || '' }); },
  onDesc(e) { this.setData({ 'form.desc': e.detail.value || '' }); },

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

  async chooseImages() {
    try {
      const remain = 9 - (this.data.form.localPaths.length || 0);
      if (remain <= 0) return;

      const res = await wx.chooseImage({
        count: remain,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });

      const add = res.tempFilePaths || [];
      this.setData({ 'form.localPaths': [...this.data.form.localPaths, ...add].slice(0, 9) });
    } catch {}
  },

  removePicked(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const arr = [...(this.data.form.localPaths || [])];
    arr.splice(idx, 1);
    this.setData({ 'form.localPaths': arr });
  },

  previewPicked(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const urls = this.data.form.localPaths || [];
    if (!urls.length) return;
    wx.previewImage({ urls, current: urls[idx] });
  },

  async submitUpload() {
    if (this.data.uploading) return;

    const { coupleId, form } = this.data;
    if (!coupleId) return this.hasCoupleOrToast();
    if (!form.localPaths || !form.localPaths.length) {
      wx.showToast({ title: '请至少选择1张照片', icon: 'none' });
      return;
    }

    this.setData({ uploading: true });
    wx.showLoading({ title: '上传中...' });

    try {
      const fileIDs = [];
    
      // ✅ 1) 先定义 coverRatio（默认 1）
      let coverRatio = 1.0;
    
      // ✅ 2) 用第一张本地图片算比例（width/height）
      try {
        const info = await wx.getImageInfo({ src: form.localPaths[0] });
        if (info.width && info.height) coverRatio = info.width / info.height;
      } catch (e) {}
    
      // 3) 上传所有图片
      for (const p of form.localPaths) {
        const cloudPath = `album/${coupleId}/${Date.now()}_${randStr(6)}.jpg`;
        const up = await wx.cloud.uploadFile({ cloudPath, filePath: p });
        if (up.fileID) fileIDs.push(up.fileID);
      }
    
      // 4) 写入数据库（✅这里放 coverRatio 就不会报错了）
      await db.collection(COL).add({
        data: {
          coupleId,
          date: ymd(),
          title: (form.title || '').trim(),
          tags: form.tags || [],
          desc: (form.desc || '').trim(),
          isFav: false,
          fileIDs,
          coverRatio,               // ✅ 一定要在上面先定义
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });

      wx.hideLoading();
      wx.showToast({ title: '上传成功', icon: 'success' });
      this.setData({ showUpload: false, uploading: false });
      await this.reload();
    } catch (e) {
      console.log(e);
      wx.hideLoading();
      wx.showToast({ title: getErrorMessage(e, '上传失败'), icon: 'none' });
      this.setData({ uploading: false });
    }
  },

  // ========== 预览 ==========
  previewFromId(e) {
    const id = e.currentTarget.dataset.id;
    const item = (this.data.rawList || []).find(x => x._id === id);
    if (!item || !item.tempUrls || !item.tempUrls.length) return;
    wx.previewImage({ urls: item.tempUrls, current: item.tempUrls[0] });
  },

  // ========== 收藏 ==========
  async toggleFav(e) {
    if (!this.hasCoupleOrToast()) return;
    const id = e.currentTarget.dataset.id;
    const isFav = String(e.currentTarget.dataset.f) === 'true' || e.currentTarget.dataset.f === true;
    const item = this.findLocalItem(id);
    if (!item || item.coupleId !== this.data.coupleId) {
      wx.showToast({ title: '记录不属于当前情侣空间', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '更新中...' });
    try {
      await db.collection(COL).doc(id).update({
        data: { isFav: !isFav, updatedAt: db.serverDate() }
      });
      wx.hideLoading();
      wx.showToast({ title: !isFav ? '已收藏' : '已取消', icon: 'success' });
      await this.reload();
    } catch (err) {
      console.log(err);
      wx.hideLoading();
      wx.showToast({ title: getErrorMessage(err, '操作失败'), icon: 'none' });
    }
  },

  // ========== 删除 ==========
  delItem(e) {
    if (!this.hasCoupleOrToast()) return;
    const id = e.currentTarget.dataset.id;
    const item = this.findLocalItem(id);
    if (!item || item.coupleId !== this.data.coupleId) {
      wx.showToast({ title: '记录不属于当前情侣空间', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '删除照片记录',
      content: '仅删除相册记录（不会删云存储照片），确定删除吗？',
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

  // ========== 编辑 ==========
  editItem(e) {
    if (!this.hasCoupleOrToast()) return;
    const id = e.currentTarget.dataset.id;
    const item = (this.data.rawList || []).find(x => x._id === id);
    if (!item) return;
    if (item.coupleId !== this.data.coupleId) {
      wx.showToast({ title: '记录不属于当前情侣空间', icon: 'none' });
      return;
    }

    this.setData({
      showEdit: true,
      editing: false,
      editId: id,
      editTagDraft: '',
      editForm: {
        title: item.title || '',
        tags: item.tags || [],
        desc: item.desc || ''
      }
    });
  },

  closeEdit() {
    if (this.data.editing) return;
    this.setData({ showEdit: false });
  },

  onEditTitle(e) { this.setData({ 'editForm.title': e.detail.value || '' }); },
  onEditDesc(e) { this.setData({ 'editForm.desc': e.detail.value || '' }); },
  onEditTagDraft(e) { this.setData({ editTagDraft: e.detail.value || '' }); },

  addEditTag() {
    const t = (this.data.editTagDraft || '').trim();
    if (!t) return;
    const tags = this.data.editForm.tags || [];
    if (tags.includes(t)) return wx.showToast({ title: '标签已存在', icon: 'none' });
    this.setData({ 'editForm.tags': [...tags, t], editTagDraft: '' });
  },

  removeEditTag(e) {
    const t = e.currentTarget.dataset.t;
    const tags = (this.data.editForm.tags || []).filter(x => x !== t);
    this.setData({ 'editForm.tags': tags });
  },

  async submitEdit() {
    if (this.data.editing) return;
    this.setData({ editing: true });
    wx.showLoading({ title: '保存中...' });

    try {
      const { editId, editForm } = this.data;
      const item = this.findLocalItem(editId);
      if (!item || item.coupleId !== this.data.coupleId) {
        throw new Error('记录不属于当前情侣空间');
      }
      await db.collection(COL).doc(editId).update({
        data: {
          title: (editForm.title || '').trim(),
          tags: editForm.tags || [],
          desc: (editForm.desc || '').trim(),
          updatedAt: db.serverDate()
        }
      });
      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ showEdit: false, editing: false });
      await this.reload();
    } catch (e) {
      console.log(e);
      wx.hideLoading();
      wx.showToast({ title: getErrorMessage(e, '保存失败'), icon: 'none' });
      this.setData({ editing: false });
    }
  },

  // ========== 抽卡 ==========
  drawMemory() {
    if (!this.hasCoupleOrToast()) return;
    const list = this.data.filteredList.length ? this.data.filteredList : this.data.rawList;
    if (!list.length) {
      wx.showToast({ title: '还没有照片，先上传吧', icon: 'none' });
      return;
    }
    const i = Math.floor(Math.random() * list.length);
    this.setData({ cardItem: list[i], showCard: true });
  },

  closeCard() { this.setData({ showCard: false }); },
  previewCard() {
    const item = this.data.cardItem || {};
    if (!item.tempUrls || !item.tempUrls.length) return;
    wx.previewImage({ urls: item.tempUrls, current: item.tempUrls[0] });
  }
});
