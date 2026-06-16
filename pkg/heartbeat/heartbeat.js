const db = wx.cloud.database();
const _ = db.command;
const { getCoupleId, ensureCoupleId } = require('../../utils/couple');

const COL_USERS = 'love_users';
const COL_MOMENTS = 'heartbeat_moments';
const COL_NOTES = 'heartbeat_notes';
const COL_BANK = 'heartbeat_bank';
const COL_TASKLOG = 'heartbeat_task_logs';

function ymd(d = new Date()) {
  const dt = new Date(d);
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${m}-${day}`;
}

function randStr(n = 6) {
  return Math.random().toString(36).slice(2, 2 + n);
}

function pickTask(tasks, seedStr) {
  // 简单 hash，让每天稳定（但可“换一个”）
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  return tasks[h % tasks.length];
}

Page({
  data: {
    tab: 'moments',

    openid: '',
    coupleId: '',
    partnerOpenid: '',

    bankPoints: 0,
    unreadCount: 0,

    moments: [],
    notes: [],

    // 任务
    today: ymd(),
    taskDone: false,
    todayTask: { id: 't0', text: '给Ta发一句夸夸', reward: 2 },
    taskNonce: 0,

    // 记录瞬间
    showMoment: false,
    saving: false,
    momentTypes: ['夸夸', '害羞', '被照顾', '笑疯', '想你', '拥抱', '惊喜'],
    momentTypeIndex: 0,
    momentForm: { title: '', content: '', hearts: 3, photoPath: '', voicePath: '' },
    recording: false,

    // 纸条
    showNote: false,
    noteTypes: ['文字', '图片', '语音'],
    noteTypeIndex: 0,
    noteForm: { title: '', text: '', photoPath: '', voicePath: '', secret: false },
    recordingNote: false,

    showNoteDetail: false,
    noteDetail: {},
    playingId: '',
    playingNote: false
  },

  // ====== 生命周期 ======
  async onLoad() {
    ensureCoupleId();               // ✅ 确保本地缓存里有“唯一 coupleId”（你写死/统一方案）
    const coupleId = getCoupleId(); // ✅ 只读，不再生成
  
    if (!coupleId) {
      wx.showToast({ title: 'coupleId 缺失，请从首页进入', icon: 'none' });
      return;
    }
  
    this.setData({ coupleId });
  
    await this.ensureOpenid();
    await this.upsertUser();
    await this.findPartner();
  
    await this.ensureBank();
    await this.refreshAll();
    await this.initTask();
  },  

  async onShow() {
    await this.refreshAll();
  },

  onPullDownRefresh() {
    this.refreshAll().finally(() => wx.stopPullDownRefresh());
  },

  setTab(e) {
    this.setData({ tab: e.currentTarget.dataset.t });
  },

  onNoteSecretChange(e) {
    this.setData({ 'noteForm.secret': !!e.detail.value });
  },  

  // ====== 登录 & 用户映射 ======
  async ensureOpenid() {
    try {
      const res = await wx.cloud.callFunction({ name: 'login' });
      const openid = res?.result?.openid || '';
      if (!openid) throw new Error('no openid');
      this.setData({ openid });
      wx.setStorageSync('openid', openid);
    } catch (e) {
      // 兜底：用本地缓存（开发期）
      let openid = wx.getStorageSync('openid');
      if (!openid) {
        openid = 'mock_' + randStr(8);
        wx.setStorageSync('openid', openid);
      }
      this.setData({ openid });
    }
  },

  async upsertUser() {
    const { openid, coupleId } = this.data;
    const r = await db.collection(COL_USERS).where({ openid }).limit(1).get();
    if (r.data && r.data.length) {
      await db.collection(COL_USERS).doc(r.data[0]._id).update({ data: { coupleId, updatedAt: db.serverDate() } });
    } else {
      await db.collection(COL_USERS).add({ data: { openid, coupleId, createdAt: db.serverDate(), updatedAt: db.serverDate() } });
    }
  },

  async findPartner() {
    const { openid, coupleId } = this.data;
    const r = await db.collection(COL_USERS)
      .where({ coupleId, openid: _.neq(openid) })
      .limit(1)
      .get();
    const partnerOpenid = (r.data && r.data[0] && r.data[0].openid) ? r.data[0].openid : '';
    this.setData({ partnerOpenid });
  },

  // ====== 金库 ======
  async ensureBank() {
    const { coupleId } = this.data;
    const r = await db.collection(COL_BANK).where({ coupleId }).limit(1).get();
    if (r.data && r.data.length) {
      this.setData({ bankId: r.data[0]._id, bankPoints: Number(r.data[0].points || 0) });
    } else {
      const add = await db.collection(COL_BANK).add({
        data: { coupleId, points: 0, createdAt: db.serverDate(), updatedAt: db.serverDate() }
      });
      this.setData({ bankId: add._id, bankPoints: 0 });
    }
  },

  async incBank(delta) {
    const { bankId } = this.data;
    if (!bankId) return;
    await db.collection(COL_BANK).doc(bankId).update({
      data: { points: _.inc(delta), updatedAt: db.serverDate() }
    });
    // 重新拉一次
    const r = await db.collection(COL_BANK).doc(bankId).get();
    this.setData({ bankPoints: Number(r.data.points || 0) });
  },

  // ====== 全量刷新 ======
  async refreshAll() {
    await Promise.all([
      this.loadMoments(),
      this.loadNotes(),
      this.loadUnreadCount(),
      this.ensureBank(),
      this.findPartner()
    ]);
  },

  async unlockNote(e) {
    const id = e?.currentTarget?.dataset?.id || this.data.noteDetail?._id;
    if (!id) return;
  
    const { openid } = this.data;
  
    wx.showLoading({ title: '解锁中...' });
    try {
      await db.collection(COL_NOTES).doc(id).update({
        data: {
          revealedTo: _.addToSet(openid),
          read: true,
          updatedAt: db.serverDate()
        }
      });
  
      wx.hideLoading();
      wx.showToast({ title: '已解锁', icon: 'success' });
  
      // 重新加载，确保 UI 立刻显示内容
      await this.loadNotes();
      await this.loadUnreadCount();
  
      const it = (this.data.notes || []).find(x => x._id === id);
      if (it) this.setData({ noteDetail: it });
    } catch (err) {
      console.log(err);
      wx.hideLoading();
      wx.showToast({ title: '解锁失败', icon: 'none' });
    }
  },
  
  // ====== 心动瞬间 ======
  openMomentModal() {
    this.setData({
      showMoment: true,
      saving: false,
      momentTypeIndex: 0,
      momentForm: { title: '', content: '', hearts: 3, photoPath: '', voicePath: '' }
    });
  },
  closeMomentModal() {
    if (this.data.saving) return;
    this.setData({ showMoment: false });
  },
  onMomentTitle(e) { this.setData({ 'momentForm.title': e.detail.value || '' }); },
  onMomentContent(e) { this.setData({ 'momentForm.content': e.detail.value || '' }); },
  onMomentTypeChange(e) { this.setData({ momentTypeIndex: Number(e.detail.value || 0) }); },
  setMomentHearts(e) { this.setData({ 'momentForm.hearts': Number(e.currentTarget.dataset.v || 3) }); },

  async chooseMomentPhoto() {
    try {
      const res = await wx.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] });
      const p = res.tempFilePaths?.[0] || '';
      if (p) this.setData({ 'momentForm.photoPath': p });
    } catch {}
  },
  removeMomentPhoto() { this.setData({ 'momentForm.photoPath': '' }); },

  // 录音（瞬间）
  toggleRecord() {
    if (this.data.recording) return this.stopRecordMoment();
    return this.startRecordMoment();
  },
  startRecordMoment() {
    const rm = wx.getRecorderManager();
    this._rmMoment = rm;
    rm.onStop((res) => {
      this.setData({ recording: false, 'momentForm.voicePath': res.tempFilePath || '' });
    });
    rm.start({ format: 'mp3', duration: 60000 });
    this.setData({ recording: true });
  },
  stopRecordMoment() {
    if (this._rmMoment) this._rmMoment.stop();
  },

  async saveMoment() {
    if (this.data.saving) return;
    const { coupleId, openid, momentForm, momentTypes, momentTypeIndex } = this.data;
    const title = (momentForm.title || '').trim();
    if (!title) return wx.showToast({ title: '标题不能为空', icon: 'none' });

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });

    try {
      let photoFileID = '';
      let voiceFileID = '';

      if (momentForm.photoPath) {
        const cloudPath = `heartbeat/moments/${coupleId}/${Date.now()}_${randStr(6)}.jpg`;
        const up = await wx.cloud.uploadFile({ cloudPath, filePath: momentForm.photoPath });
        photoFileID = up.fileID || '';
      }
      if (momentForm.voicePath) {
        const cloudPath = `heartbeat/moments/${coupleId}/${Date.now()}_${randStr(6)}.mp3`;
        const up = await wx.cloud.uploadFile({ cloudPath, filePath: momentForm.voicePath });
        voiceFileID = up.fileID || '';
      }

      await db.collection(COL_MOMENTS).add({
        data: {
          coupleId,
          openid,
          date: ymd(),
          type: momentTypes[momentTypeIndex] || '心动',
          title,
          content: (momentForm.content || '').trim(),
          hearts: Number(momentForm.hearts || 3),
          isFav: false,
          photoFileID,
          voiceFileID,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });

      // 金库 +1
      await this.incBank(1);

      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ showMoment: false, saving: false });
      await this.loadMoments();
    } catch (e) {
      console.log(e);
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
      this.setData({ saving: false });
    }
  },

  async loadMoments() {
    const { coupleId } = this.data;
    const r = await db.collection(COL_MOMENTS)
      .where({ coupleId })
      .orderBy('createdAt', 'desc')
      .limit(80)
      .get();

    let list = (r.data || []).map(x => ({
      ...x,
      heartsArr: new Array(Number(x.hearts || 0)).fill(1),
      photoUrl: '',
      voiceUrl: ''
    }));

    list = await this.hydrateFileUrls(list, ['photoFileID', 'voiceFileID']);
    // 映射到 photoUrl/voiceUrl
    list = list.map(it => ({
      ...it,
      photoUrl: it._urlMap?.[it.photoFileID] || '',
      voiceUrl: it._urlMap?.[it.voiceFileID] || ''
    }));

    this.setData({ moments: list });
  },

  async toggleMomentFav(e) {
    const id = e.currentTarget.dataset.id;
    const isFav = e.currentTarget.dataset.f === true || String(e.currentTarget.dataset.f) === 'true';
    wx.showLoading({ title: '更新中...' });
    try {
      await db.collection(COL_MOMENTS).doc(id).update({ data: { isFav: !isFav, updatedAt: db.serverDate() } });
      wx.hideLoading();
      wx.showToast({ title: !isFav ? '已收藏' : '已取消', icon: 'success' });
      await this.loadMoments();
    } catch (err) {
      console.log(err);
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  deleteMoment(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除心动瞬间',
      content: '删除后不可恢复，确定删除吗？',
      confirmText: '删除',
      confirmColor: '#d33',
      success: async (r) => {
        if (!r.confirm) return;
        wx.showLoading({ title: '删除中...' });
        try {
          await db.collection(COL_MOMENTS).doc(id).remove();
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          await this.loadMoments();
        } catch (err) {
          console.log(err);
          wx.hideLoading();
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    });
  },

  previewMomentPhoto(e) {
    const id = e.currentTarget.dataset.id;
    const it = (this.data.moments || []).find(x => x._id === id);
    if (!it || !it.photoUrl) return;
    wx.previewImage({ urls: [it.photoUrl], current: it.photoUrl });
  },

  playMomentVoice(e) {
    const id = e.currentTarget.dataset.id;
    const it = (this.data.moments || []).find(x => x._id === id);
    if (!it || !it.voiceUrl) return;
    this.playAudio(it.voiceUrl, id);
  },

  // ====== 盲盒抽卡 ======
  drawBlindBox() {
    const list = this.data.moments || [];
    if (!list.length) return wx.showToast({ title: '还没有瞬间，先记录一条吧', icon: 'none' });
    const i = Math.floor(Math.random() * list.length);
    const it = list[i];
    wx.showModal({
      title: '🎁 盲盒抽到：' + (it.title || '心动瞬间'),
      content: (it.content || '（没有文字也很甜）') + `\n\n类型：${it.type}  心动值：${it.hearts}❤`,
      confirmText: it.photoUrl ? '看照片' : '知道啦',
      success: (r) => {
        if (r.confirm && it.photoUrl) wx.previewImage({ urls: [it.photoUrl] });
      }
    });
  },

  // ====== 小纸条 ======
  openNoteModal() {
    this.setData({
      showNote: true,
      saving: false,
      noteTypeIndex: 0,
      noteForm: { title: '', text: '', photoPath: '', voicePath: '', secret: false },
    });
  },
  closeNoteModal() {
    if (this.data.saving) return;
    this.setData({ showNote: false });
  },
  onNoteTypeChange(e) { this.setData({ noteTypeIndex: Number(e.detail.value || 0) }); },
  onNoteTitle(e) { this.setData({ 'noteForm.title': e.detail.value || '' }); },
  onNoteText(e) { this.setData({ 'noteForm.text': e.detail.value || '' }); },

  async chooseNotePhoto() {
    try {
      const res = await wx.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] });
      const p = res.tempFilePaths?.[0] || '';
      if (p) this.setData({ 'noteForm.photoPath': p });
    } catch {}
  },
  removeNotePhoto() { this.setData({ 'noteForm.photoPath': '' }); },

  toggleRecordNote() {
    if (this.data.recordingNote) return this.stopRecordNote();
    return this.startRecordNote();
  },
  startRecordNote() {
    const rm = wx.getRecorderManager();
    this._rmNote = rm;
    rm.onStop((res) => {
      this.setData({ recordingNote: false, 'noteForm.voicePath': res.tempFilePath || '' });
    });
    rm.start({ format: 'mp3', duration: 60000 });
    this.setData({ recordingNote: true });
  },
  stopRecordNote() {
    if (this._rmNote) this._rmNote.stop();
  },

  async sendNote() {
    if (this.data.saving) return;

    const { coupleId, openid, partnerOpenid, noteTypes, noteTypeIndex, noteForm } = this.data;
    const noteType = noteTypes[noteTypeIndex];
    const secret = !!noteForm.secret;
    if (secret && !partnerOpenid) {
      wx.hideLoading?.();
      return wx.showToast({ title: '私密纸条需要先识别到Ta（Ta先打开一次小程序）', icon: 'none' });
    }

    if (noteType === '文字' && !(noteForm.text || '').trim()) {
      return wx.showToast({ title: '文字内容不能为空', icon: 'none' });
    }
    if (noteType === '图片' && !noteForm.photoPath) {
      return wx.showToast({ title: '请选择一张图片', icon: 'none' });
    }
    if (noteType === '语音' && !noteForm.voicePath) {
      return wx.showToast({ title: '请先录一段语音', icon: 'none' });
    }

    this.setData({ saving: true });
    wx.showLoading({ title: '发送中...' });

    try {
      let photoFileID = '';
      let voiceFileID = '';
      let text = '';

      if (noteType === '文字') text = (noteForm.text || '').trim();
      if (noteType === '图片') {
        const cloudPath = `heartbeat/notes/${coupleId}/${Date.now()}_${randStr(6)}.jpg`;
        const up = await wx.cloud.uploadFile({ cloudPath, filePath: noteForm.photoPath });
        photoFileID = up.fileID || '';
      }
      if (noteType === '语音') {
        const cloudPath = `heartbeat/notes/${coupleId}/${Date.now()}_${randStr(6)}.mp3`;
        const up = await wx.cloud.uploadFile({ cloudPath, filePath: noteForm.voicePath });
        voiceFileID = up.fileID || '';
      }

      await db.collection(COL_NOTES).add({
        data: {
          coupleId,
          fromOpenid: openid,
          isSecret: secret,
          revealedTo: secret ? [openid] : [],
          toOpenid: partnerOpenid || '', // 若暂时拿不到Ta，就先留空（当“情侣空间”）
          noteType,
          title: (noteForm.title || '').trim(),
          text,
          photoFileID,
          voiceFileID,
          read: false,
          date: ymd(),
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });

      // 金库 +1
      await this.incBank(1);

      wx.hideLoading();
      wx.showToast({ title: '已发送', icon: 'success' });
      this.setData({ showNote: false, saving: false });
      await this.loadNotes();
      await this.loadUnreadCount();
    } catch (e) {
      console.log(e);
      wx.hideLoading();
      wx.showToast({ title: '发送失败', icon: 'none' });
      this.setData({ saving: false });
    }
  },

  async loadNotes() {
    const { coupleId, openid } = this.data;
  
    // ✅ 显示：我收到的 + 我发出的 + (toOpenid为空时的公共纸条)
    const r = await db.collection(COL_NOTES)
      .where(
        _.and([
          { coupleId },
          _.or([
            { toOpenid: openid },
            { fromOpenid: openid },
            { toOpenid: '' }
          ])
        ])
      )
      .orderBy('createdAt', 'desc')
      .limit(80)
      .get();
  
    let list = (r.data || []).map(x => ({ ...x, photoUrl: '', voiceUrl: '' }));
  
    list = await this.hydrateFileUrls(list, ['photoFileID', 'voiceFileID']);
    const me = openid;
    list = list.map(it => {
      const revealed = (it.revealedTo || []).includes(me);
      const isMine = it.fromOpenid === me;
      const lockedForMe = !!it.isSecret && !revealed && !isMine; // 只对“收件人”锁
    
      return {
        ...it,
        photoUrl: it._urlMap?.[it.photoFileID] || '',
        voiceUrl: it._urlMap?.[it.voiceFileID] || '',
        direction: isMine ? '我 → Ta' : 'Ta → 我',
        lockedForMe
      };
    });
    
  
    this.setData({ notes: list });
  },
  
  async loadUnreadCount() {
    const { coupleId, openid } = this.data;
  
    // ✅ 未读只统计“发给我”的纸条
    const r = await db.collection(COL_NOTES)
      .where({ coupleId, toOpenid: openid, read: false })
      .count();
  
    this.setData({ unreadCount: Number(r.total || 0) });
  },
  

  async openNoteDetail(e) {
    const id = e.currentTarget.dataset.id;
    const it = (this.data.notes || []).find(x => x._id === id);
    if (!it) return;

    this.setData({ showNoteDetail: true, noteDetail: it });

    // 若是发给我的未读，打开就标为已读
    if (!it.lockedForMe && it.toOpenid === this.data.openid && it.read === false) {
      await db.collection(COL_NOTES).doc(id).update({ data: { read: true, updatedAt: db.serverDate() } });
      await this.loadNotes();
      await this.loadUnreadCount();
    }    
  },
  closeNoteDetail() { this.setData({ showNoteDetail: false, noteDetail: {}, playingNote: false }); },
  previewNotePhoto() {
    const it = this.data.noteDetail;
    if (!it || !it.photoUrl) return;
    wx.previewImage({ urls: [it.photoUrl], current: it.photoUrl });
  },
  playNoteVoice() {
    const it = this.data.noteDetail;
    if (!it || !it.voiceUrl) return;
    this.playAudio(it.voiceUrl, '__note__');
    this.setData({ playingNote: true });
  },

  // ====== 今日任务 ======
  async initTask() {
    const tasks = [
      { id: 't1', text: '给Ta发一句夸夸（认真一点）', reward: 2 },
      { id: 't2', text: '分享今天最想念Ta的瞬间', reward: 2 },
      { id: 't3', text: '问Ta一个问题：今天你最开心的事是什么？', reward: 2 },
      { id: 't4', text: '给Ta发一张你今天看到的“像Ta”的东西', reward: 2 },
      { id: 't5', text: '写一句“谢谢你”，然后发纸条给Ta', reward: 2 },
      { id: 't6', text: '记录一个“心动瞬间”（哪怕很小）', reward: 2 }
    ];
    const seed = this.data.today + this.data.coupleId + String(this.data.taskNonce || 0);
    const todayTask = pickTask(tasks, seed);
    this.setData({ todayTask });
    await this.checkTaskDone();
  },

  async checkTaskDone() {
    const { coupleId, openid, todayTask, today } = this.data;
    const r = await db.collection(COL_TASKLOG)
      .where({ coupleId, openid, date: today, taskId: todayTask.id })
      .limit(1)
      .get();
    this.setData({ taskDone: !!(r.data && r.data.length) });
  },

  async completeTask() {
    if (this.data.taskDone) return;
    const { coupleId, openid, todayTask, today } = this.data;
    wx.showLoading({ title: '打卡中...' });
    try {
      await db.collection(COL_TASKLOG).add({
        data: { coupleId, openid, date: today, taskId: todayTask.id, createdAt: db.serverDate() }
      });
      await this.incBank(Number(todayTask.reward || 2));
      wx.hideLoading();
      wx.showToast({ title: '完成啦！', icon: 'success' });
      this.setData({ taskDone: true });
    } catch (e) {
      console.log(e);
      wx.hideLoading();
      wx.showToast({ title: '打卡失败', icon: 'none' });
    }
  },

  refreshTask() {
    // “换一个”：用 taskNonce 改 seed
    this.setData({ taskNonce: (this.data.taskNonce || 0) + 1 }, () => this.initTask());
  },

  // ====== 工具：文件ID -> 临时URL ======
  async hydrateFileUrls(list, fields) {
    const ids = [];
    (list || []).forEach(it => {
      fields.forEach(f => it[f] && ids.push(it[f]));
    });
    const fileIDs = Array.from(new Set(ids));
    if (!fileIDs.length) return (list || []).map(it => ({ ...it, _urlMap: {} }));

    const res = await wx.cloud.getTempFileURL({
      fileList: fileIDs.map(id => ({ fileID: id, maxAge: 24 * 60 * 60 }))
    });

    const map = {};
    (res.fileList || []).forEach(x => {
      if (x.fileID && x.tempFileURL) map[x.fileID] = x.tempFileURL;
    });

    return (list || []).map(it => ({ ...it, _urlMap: map }));
  },

  // ====== 音频播放 ======
  playAudio(url, playingId) {
    try {
      if (this._audio) {
        this._audio.stop();
        this._audio.destroy();
      }
      const audio = wx.createInnerAudioContext();
      this._audio = audio;
      audio.src = url;
      audio.autoplay = true;
      this.setData({ playingId });

      audio.onEnded(() => this.setData({ playingId: '' , playingNote:false }));
      audio.onStop(() => this.setData({ playingId: '' , playingNote:false }));
      audio.onError(() => {
        wx.showToast({ title: '播放失败', icon: 'none' });
        this.setData({ playingId: '' , playingNote:false });
      });
    } catch (e) {
      wx.showToast({ title: '播放失败', icon: 'none' });
      this.setData({ playingId: '' , playingNote:false });
    }
  }
});
