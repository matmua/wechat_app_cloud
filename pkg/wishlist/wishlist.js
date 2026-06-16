// pkg/wishlist/wishlist.js
const { getCoupleId, ensureCoupleId } = require('../../utils/couple');
const db = wx.cloud.database();
const COL = 'love_wishes';

function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}


function randomStr(len = 6) {
  return Math.random().toString(36).slice(2, 2 + len);
}

Page({
  data: {
    coupleId: '',
    activeTab: 'todo', // todo | done
    keyword: '',
    sortMode: 'priority', // priority | time
    sortModeText: '按优先级',

    todoList: [],
    doneList: [],
    filteredList: [],

    totalCount: 0,
    todoCount: 0,
    doneCount: 0,
    progressPercent: 0,

    showAdd: false,
    newTitle: '',
    newNote: '',
    newPriority: 1, // 2高 1中 0低

    // ✅ 新增：照片（临时本地路径）
    newPhotoTempPath: '',
    creating: false,

    priorityTextMap: {
      2: '想马上做',
      1: '正常',
      0: '不着急'
    }
  },

  onLoad() {
    // ✅ 保险：如果你用的是写死方案，这句会把 coupleId 写进缓存
    // 如果你不用写死而是首页生成一次，这句也不会生成新ID（取决于你 utils/couple.js 怎么写）
    ensureCoupleId();
  
    const coupleId = getCoupleId();
    if (!coupleId) {
      wx.showToast({ title: '请先从首页进入或先完成绑定', icon: 'none' });
      return;
    }
  
    this.setData({ coupleId });
    this.reloadAll();
  },
  

  onPullDownRefresh() {
    this.reloadAll().finally(() => wx.stopPullDownRefresh());
  },

  async reloadAll() {
    await Promise.all([this.loadTodo(), this.loadDone()]);
    this.updateStatsAndFilter();
  },

  async hydratePhotoUrls(list) {
    // 把 photoFileID 批量转成 temp url
    const fileIDs = Array.from(new Set(
      (list || []).map(x => x.photoFileID).filter(Boolean)
    ));
    if (!fileIDs.length) return list;

    const res = await wx.cloud.getTempFileURL({
      fileList: fileIDs.map(id => ({ fileID: id, maxAge: 24 * 60 * 60 }))
    });

    const map = {};
    (res.fileList || []).forEach(it => {
      if (it.fileID && it.tempFileURL) map[it.fileID] = it.tempFileURL;
    });

    return (list || []).map(x => ({
      ...x,
      photoUrl: x.photoFileID ? (map[x.photoFileID] || '') : ''
    }));
  },

  async loadTodo() {
    const { coupleId } = this.data;
    const res = await db.collection(COL)
      .where({ coupleId, status: 'todo' })
      .orderBy('priority', 'desc')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    let list = (res.data || []).map(x => ({
      ...x,
      doneAtStr: x.doneAt ? formatDate(x.doneAt) : '',
      photoUrl: ''
    }));

    list = await this.hydratePhotoUrls(list);
    this.setData({ todoList: list });
  },

  async loadDone() {
    const { coupleId } = this.data;
    const res = await db.collection(COL)
      .where({ coupleId, status: 'done' })
      .orderBy('doneAt', 'desc')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    let list = (res.data || []).map(x => ({
      ...x,
      doneAtStr: x.doneAt ? formatDate(x.doneAt) : '',
      photoUrl: ''
    }));

    list = await this.hydratePhotoUrls(list);
    this.setData({ doneList: list });
  },

  updateStatsAndFilter() {
    const { todoList, doneList } = this.data;
    const total = todoList.length + doneList.length;
    const done = doneList.length;
    const todo = todoList.length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    this.setData({
      totalCount: total,
      doneCount: done,
      todoCount: todo,
      progressPercent: percent
    });

    this.applyFilter();
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab }, () => this.applyFilter());
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value || '' }, () => this.applyFilter());
  },

  toggleSort() {
    const next = this.data.sortMode === 'priority' ? 'time' : 'priority';
    this.setData({
      sortMode: next,
      sortModeText: next === 'priority' ? '按优先级' : '按时间'
    }, () => this.applyFilter());
  },

  applyFilter() {
    const { activeTab, keyword, todoList, doneList, sortMode } = this.data;
    const src = activeTab === 'todo' ? [...todoList] : [...doneList];

    const kw = (keyword || '').trim().toLowerCase();
    let list = kw
      ? src.filter(it => (it.title || '').toLowerCase().includes(kw) || (it.note || '').toLowerCase().includes(kw))
      : src;

    if (sortMode === 'time') {
      list.sort((a, b) => {
        const ta = (a.doneAt || a.createdAt || 0);
        const tb = (b.doneAt || b.createdAt || 0);
        return tb - ta;
      });
    } else {
      list.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }

    this.setData({ filteredList: list });
  },

  openAdd() {
    this.setData({
      showAdd: true,
      newTitle: '',
      newNote: '',
      newPriority: 1,
      newPhotoTempPath: '',
      creating: false
    });
  },

  closeAdd() {
    if (this.data.creating) return;
    this.setData({ showAdd: false });
  },

  onNewTitle(e) {
    this.setData({ newTitle: e.detail.value || '' });
  },

  onNewNote(e) {
    this.setData({ newNote: e.detail.value || '' });
  },

  setPriority(e) {
    const p = Number(e.currentTarget.dataset.p);
    this.setData({ newPriority: p });
  },

  // ✅ 选择照片（单张，可选）
  async choosePhoto() {
    try {
      const res = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });
      const path = res.tempFilePaths?.[0] || '';
      if (!path) return;
      this.setData({ newPhotoTempPath: path });
    } catch (e) {
      // 用户取消不算错误
    }
  },

  removeNewPhoto() {
    if (this.data.creating) return;
    this.setData({ newPhotoTempPath: '' });
  },

  previewNewPhoto() {
    const { newPhotoTempPath } = this.data;
    if (!newPhotoTempPath) return;
    wx.previewImage({ urls: [newPhotoTempPath] });
  },

  async createWish() {
    if (this.data.creating) return;

    const { coupleId, newTitle, newNote, newPriority, newPhotoTempPath } = this.data;
    const title = (newTitle || '').trim();
    if (!title) {
      wx.showToast({ title: '标题不能为空', icon: 'none' });
      return;
    }

    this.setData({ creating: true });
    wx.showLoading({ title: '保存中...' });

    try {
      // 1) 如有照片：先上传云存储，拿 photoFileID
      let photoFileID = '';
      if (newPhotoTempPath) {
        const cloudPath = `wishes/${coupleId}/${Date.now()}_${randomStr(6)}.jpg`;
        const up = await wx.cloud.uploadFile({
          cloudPath,
          filePath: newPhotoTempPath
        });
        photoFileID = up.fileID || '';
      }

      // 2) 写数据库
      await db.collection(COL).add({
        data: {
          coupleId,
          title,
          note: (newNote || '').trim(),
          priority: newPriority,
          status: 'todo',
          createdAt: db.serverDate(),
          doneAt: null,
          photoFileID // ✅ 保存 fileID
        }
      });

      wx.hideLoading();
      wx.showToast({ title: '已添加', icon: 'success' });
      this.setData({ showAdd: false, creating: false, newPhotoTempPath: '' });

      await this.loadTodo();
      this.updateStatsAndFilter();
    } catch (e) {
      wx.hideLoading();
      console.log(e);
      wx.showToast({ title: '保存失败', icon: 'none' });
      this.setData({ creating: false });
    }
  },

  async toggleDone(e) {
    const id = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;

    wx.showLoading({ title: '处理中...' });
    try {
      if (status === 'done') {
        await db.collection(COL).doc(id).update({
          data: { status: 'todo', doneAt: null }
        });
      } else {
        await db.collection(COL).doc(id).update({
          data: { status: 'done', doneAt: db.serverDate() }
        });
      }

      wx.hideLoading();
      await this.reloadAll();
      wx.showToast({ title: status === 'done' ? '已撤销' : '已完成', icon: 'success' });
    } catch (e2) {
      wx.hideLoading();
      console.log(e2);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '删除心愿',
      content: '删除后不可恢复，确定删除吗？',
      confirmText: '删除',
      confirmColor: '#d33',
      success: async (r) => {
        if (!r.confirm) return;

        wx.showLoading({ title: '删除中...' });
        try {
          // 这里默认只删数据库记录（不删云存储图片）
          // 如果你希望“删除心愿同时删除图片”，我也可以给你加：wx.cloud.deleteFile
          await db.collection(COL).doc(id).remove();

          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          await this.reloadAll();
        } catch (err) {
          wx.hideLoading();
          console.log(err);
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    });
  }
});
