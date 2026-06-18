const {
  getBindingStatus,
  createInvite,
  acceptInvite
} = require('../../utils/couple');

const db = wx.cloud.database();
const COL_PROFILE = 'remember_couples';
const COL_DAILY_PLANS = 'daily_plans';
const COL_DAILY_MOODS = 'daily_moods';
const PAGE_PATH = '/pages/remembers/remembers';

const AVATAR_FILEID = {
  guo: 'cloud://cloud1-4gmaqc42550b0950.636c-cloud1-4gmaqc42550b0950-1391881406/images/remember/小郭.svg',
  luan: 'cloud://cloud1-4gmaqc42550b0950.636c-cloud1-4gmaqc42550b0950-1391881406/images/remember/小栾.svg'
};

const MOODS = [
  { key: 'sunny', emoji: '☀️', label: '晴朗' },
  { key: 'soft', emoji: '🍃', label: '平静' },
  { key: 'miss', emoji: '🌙', label: '想念' },
  { key: 'tired', emoji: '☁️', label: '有点累' },
  { key: 'sweet', emoji: '🍓', label: '甜甜的' }
];

function pad(n) {
  return `${n}`.padStart(2, '0');
}

function getDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getDateLabel(date = new Date()) {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${date.getMonth() + 1}月${date.getDate()}日 星期${weekdays[date.getDay()]}`;
}

function formatShortTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildInvitePath(inviteId, token) {
  const query = [
    `inviteId=${encodeURIComponent(inviteId)}`,
    `token=${encodeURIComponent(token)}`
  ].join('&');
  return `${PAGE_PATH}?${query}`;
}

function buildInviteCode(inviteId, token) {
  return `${inviteId}:${token}`;
}

function parseInviteCode(value) {
  const text = (value || '').trim();
  if (!text) return { error: '请输入邀请码' };

  let inviteId = '';
  let token = '';

  if (text.includes('inviteId=')) {
    const query = text.includes('?') ? text.split('?').pop() : text;
    query.split('&').forEach((part) => {
      const [rawKey, rawValue = ''] = part.split('=');
      const key = decodeURIComponent(rawKey || '');
      const val = decodeURIComponent(rawValue || '');
      if (key === 'inviteId') inviteId = val;
      if (key === 'token') token = val;
    });
  } else {
    const parts = text.split(/[:|#\s,，]+/).filter(Boolean);
    inviteId = parts[0] || '';
    token = parts[1] || '';
  }

  if (!inviteId || !token) {
    return { error: '邀请码不完整，请复制完整的邀请码' };
  }

  return { inviteId, token };
}

function groupPlansByDate(list) {
  const map = {};
  list.forEach((item) => {
    const date = item.date || '未知日期';
    if (!map[date]) {
      map[date] = {
        date,
        label: date === getDateKey() ? '今天' : date,
        total: 0,
        done: 0,
        undone: 0,
        items: []
      };
    }
    map[date].total += 1;
    if (item.done) map[date].done += 1;
    else map[date].undone += 1;
    map[date].items.push(item);
  });
  return Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 7)
    .map(key => map[key]);
}

function localKey(name, coupleId) {
  return `${name}_${coupleId || 'unbound'}`;
}

function readLocalList(name, coupleId) {
  return wx.getStorageSync(localKey(name, coupleId)) || [];
}

function writeLocalList(name, coupleId, list) {
  wx.setStorageSync(localKey(name, coupleId), list);
}

function isLocalId(id) {
  return String(id || '').startsWith('local_');
}

Page({
  data: {
    openid: '',
    coupleId: '',
    partnerOpenid: '',

    selfName: '我',
    selfAvatarUrl: '',
    partnerName: '',
    partnerAvatarUrl: '',

    bindingLoading: false,
    bindingState: 'unknown',
    bindingMessage: '',
    invitePath: '',
    inviteId: '',
    invitationId: '',
    inviteToken: '',
    inviteCode: '',
    showInviteInput: false,
    inviteInput: '',
    inviteSubmitting: false,

    todayDate: getDateKey(),
    todayLabel: getDateLabel(),
    planInput: '',
    dailyPlans: [],
    planHistory: [],
    showPlanHistory: false,
    planTotalCount: 0,
    planDoneCount: 0,
    planProgressPercent: 0,
    planProgressText: '今天还没有计划',
    planLoading: false,
    dailyPlanStorage: 'cloud',
    dailyMoodStorage: 'cloud',
    storageNotice: '',

    moods: MOODS,
    selectedMoodKey: '',
    moodNote: '',
    dailyWord: '',
    myMood: null,
    partnerMood: null,
    moodSaving: false
  },

  async onLoad(options = {}) {
    this.setData({
      bindingLoading: true,
      bindingMessage: '正在读取绑定状态...',
      todayDate: getDateKey(),
      todayLabel: getDateLabel()
    });

    try {
      let status;
      if (options.inviteId && options.token) {
        status = await acceptInvite({
          inviteId: options.inviteId,
          token: options.token
        });
        wx.showToast({ title: '绑定成功', icon: 'success' });
      } else {
        status = await getBindingStatus();
      }
      await this.applyBindingStatus(status);
    } catch (e) {
      this.setData({
        bindingState: 'error',
        bindingMessage: e.message || '绑定状态读取失败，请检查云函数是否已上传'
      });
      wx.showToast({ title: '绑定状态读取失败', icon: 'none' });
    } finally {
      this.setData({ bindingLoading: false });
      this.updateShareMenu();
    }
  },

  async onShow() {
    if (this.data.bindingLoading) return;
    try {
      const status = await getBindingStatus();
      await this.applyBindingStatus(status, { silent: true });
    } catch (e) {
      this.setData({ bindingMessage: '绑定状态刷新失败，可以稍后下拉重试' });
    }
  },

  async applyBindingStatus(status, options = {}) {
    const openid = status?.openid || '';
    const coupleId = status?.coupleId || '';
    const bound = !!status?.bound;
    const hasCouple = !!status?.hasCouple;
    const partner = status?.partner || null;

    let bindingState = 'unbound';
    let bindingMessage = '还没有绑定情侣关系，可以生成邀请码，或输入 Ta 发来的邀请码。';
    if (hasCouple && !bound) {
      bindingState = 'pending';
      bindingMessage = '情侣空间已创建，等待 Ta 输入邀请码完成绑定。';
    }
    if (bound) {
      bindingState = 'bound';
      bindingMessage = '已完成情侣绑定。';
    }

    const nextData = {
      openid,
      coupleId,
      partnerOpenid: partner?.openid || '',
      bindingState,
      bindingMessage,
      partnerName: partner?.displayName || this.data.partnerName
    };

    if (bound) {
      Object.assign(nextData, {
        invitePath: '',
        inviteId: '',
        invitationId: '',
        inviteToken: '',
        inviteCode: '',
        showInviteInput: false,
        inviteInput: ''
      });
    }

    this.setData(nextData);

    if (coupleId) {
      await this.ensureProfileDoc();
      await this.refreshProfile();
    } else {
      this.clearProfileAndDaily();
    }

    if (bound) await this.loadDailyModules();
    else this.clearDailyModules();

    this.updateShareMenu();
    if (!options.silent && bindingMessage) {
      wx.showToast({ title: bindingMessage, icon: 'none' });
    }
  },

  isBound() {
    return this.data.bindingState === 'bound' && !!this.data.coupleId;
  },

  requireBound() {
    if (this.isBound()) return true;
    wx.showToast({ title: '请先绑定情侣关系', icon: 'none' });
    return false;
  },

  clearProfileAndDaily() {
    this.setData({
      selfName: '我',
      selfAvatarUrl: '',
      partnerName: '',
      partnerAvatarUrl: '',
      invitePath: '',
      inviteId: '',
      invitationId: '',
      inviteToken: '',
      inviteCode: ''
    });
    this.clearDailyModules();
  },

  clearDailyModules() {
    this.setData({
      dailyPlans: [],
      planHistory: [],
      planTotalCount: 0,
      planDoneCount: 0,
      planProgressPercent: 0,
      planProgressText: '绑定后就能记录今天的小计划',
      dailyPlanStorage: 'cloud',
      dailyMoodStorage: 'cloud',
      storageNotice: '',
      myMood: null,
      partnerMood: null,
      selectedMoodKey: '',
      moodNote: '',
      dailyWord: ''
    });
  },

  async ensureProfileDoc() {
    const { coupleId } = this.data;
    if (!coupleId) return;
    try {
      await db.collection(COL_PROFILE).doc(coupleId).get();
    } catch (e) {
      await db.collection(COL_PROFILE).doc(coupleId).set({
        data: {
          guoOpenid: '',
          luanOpenid: '',
          guoWechatNick: '',
          luanWechatNick: '',
          nameForGuo: '',
          nameForLuan: '',
          guoAvatarFileID: AVATAR_FILEID.guo,
          luanAvatarFileID: AVATAR_FILEID.luan,
          updatedAt: db.serverDate()
        }
      });
    }
  },

  async refreshProfile() {
    const { coupleId, openid } = this.data;
    if (!coupleId || !openid) return;

    const doc = await db.collection(COL_PROFILE).doc(coupleId).get();
    const d = doc.data || {};
    const myRole = d.guoOpenid === openid ? 'guo' : d.luanOpenid === openid ? 'luan' : '';
    if (!myRole) return;

    const partnerRole = myRole === 'guo' ? 'luan' : 'guo';
    const myAvatarFileID = (myRole === 'guo' ? d.guoAvatarFileID : d.luanAvatarFileID) || AVATAR_FILEID[myRole];
    const partnerAvatarFileID = (partnerRole === 'guo' ? d.guoAvatarFileID : d.luanAvatarFileID) || AVATAR_FILEID[partnerRole];

    let myUrl = '';
    let partnerUrl = '';
    try {
      const urlRes = await wx.cloud.getTempFileURL({
        fileList: [
          { fileID: myAvatarFileID, maxAge: 24 * 60 * 60 },
          { fileID: partnerAvatarFileID, maxAge: 24 * 60 * 60 }
        ]
      });
      const ts = Date.now();
      myUrl = (urlRes.fileList?.[0]?.tempFileURL || '') + `?t=${ts}`;
      partnerUrl = (urlRes.fileList?.[1]?.tempFileURL || '') + `?t=${ts}`;
    } catch (e) {
      myUrl = '';
      partnerUrl = '';
    }

    const myWechat = myRole === 'guo' ? d.guoWechatNick : d.luanWechatNick;
    const partnerWechat = partnerRole === 'guo' ? d.guoWechatNick : d.luanWechatNick;
    const nameForMe = myRole === 'guo' ? d.nameForGuo : d.nameForLuan;
    const nameForPartner = partnerRole === 'guo' ? d.nameForGuo : d.nameForLuan;

    this.setData({
      selfName: nameForMe || myWechat || '我',
      selfAvatarUrl: myUrl,
      partnerName: nameForPartner || partnerWechat || (partnerRole === 'guo' ? '小郭' : '小栾'),
      partnerAvatarUrl: partnerUrl
    });
  },

  async changeMyAvatar() {
    if (!this.data.coupleId || !this.data.openid) return;
    const { coupleId, openid } = this.data;
    const doc = await db.collection(COL_PROFILE).doc(coupleId).get();
    const d = doc.data || {};
    const myRole = d.guoOpenid === openid ? 'guo' : d.luanOpenid === openid ? 'luan' : '';
    if (!myRole) return wx.showToast({ title: '还没有识别到你的身份', icon: 'none' });

    try {
      const pick = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });
      const filePath = pick.tempFilePaths?.[0];
      if (!filePath) return;

      wx.showLoading({ title: '上传头像...' });
      const cloudPath = `remember/avatar/${coupleId}/${myRole}.jpg`;
      const up = await wx.cloud.uploadFile({ cloudPath, filePath });
      const field = myRole === 'guo' ? 'guoAvatarFileID' : 'luanAvatarFileID';

      await db.collection(COL_PROFILE).doc(coupleId).update({
        data: {
          [field]: up.fileID,
          updatedAt: db.serverDate()
        }
      });
      wx.hideLoading();
      wx.showToast({ title: '头像已更新', icon: 'success' });
      await this.refreshProfile();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
  },

  onMe() {
    wx.showActionSheet({
      itemList: ['同步微信昵称', '更换我的头像'],
      success: async (res) => {
        if (res.tapIndex === 0) await this.syncWechatNick();
        if (res.tapIndex === 1) await this.changeMyAvatar();
      }
    });
  },

  syncWechatNick() {
    const { coupleId, openid } = this.data;
    if (!coupleId || !openid) return;

    wx.getUserProfile({
      desc: '用于显示情侣昵称',
      success: async (res) => {
        const nick = res?.userInfo?.nickName || '';
        if (!nick) return;

        const doc = await db.collection(COL_PROFILE).doc(coupleId).get();
        const d = doc.data || {};
        const myRole = d.guoOpenid === openid ? 'guo' : d.luanOpenid === openid ? 'luan' : '';
        if (!myRole) return;

        const data = { updatedAt: db.serverDate() };
        if (myRole === 'guo') data.guoWechatNick = nick;
        else data.luanWechatNick = nick;

        await db.collection(COL_PROFILE).doc(coupleId).update({ data });
        wx.showToast({ title: '已同步昵称', icon: 'success' });
        await this.refreshProfile();
      },
      fail: () => wx.showToast({ title: '未授权，无法读取昵称', icon: 'none' })
    });
  },

  async onEditPartnerName() {
    const { coupleId, openid } = this.data;
    if (!coupleId || !openid) return;
    const doc = await db.collection(COL_PROFILE).doc(coupleId).get();
    const d = doc.data || {};
    const myRole = d.guoOpenid === openid ? 'guo' : d.luanOpenid === openid ? 'luan' : '';
    if (!myRole) return;

    const field = myRole === 'guo' ? 'nameForLuan' : 'nameForGuo';
    wx.showModal({
      title: '修改 Ta 的昵称',
      editable: true,
      placeholderText: '输入新的昵称',
      success: async (r) => {
        if (!r.confirm) return;
        const newName = (r.content || '').trim();
        if (!newName) return wx.showToast({ title: '昵称不能为空', icon: 'none' });
        await db.collection(COL_PROFILE).doc(coupleId).update({
          data: { [field]: newName, updatedAt: db.serverDate() }
        });
        wx.showToast({ title: '已更新', icon: 'success' });
        await this.refreshProfile();
      }
    });
  },

  async loadDailyModules() {
    await Promise.all([
      this.loadDailyPlans(),
      this.loadDailyMoods()
    ]);
  },

  async loadDailyPlans() {
    if (!this.isBound()) return;
    this.setData({ planLoading: true });
    const { coupleId, todayDate } = this.data;
    try {
      const [todayRes, historyRes] = await Promise.all([
        db.collection(COL_DAILY_PLANS)
          .where({ coupleId, date: todayDate })
          .orderBy('createdAt', 'asc')
          .limit(60)
          .get(),
        db.collection(COL_DAILY_PLANS)
          .where({ coupleId })
          .orderBy('date', 'desc')
          .limit(120)
          .get()
      ]);

      const dailyPlans = (todayRes.data || []).map(item => ({
        ...item,
        createdText: formatShortTime(item.createdAt),
        doneText: item.doneAt ? formatShortTime(item.doneAt) : ''
      }));
      this.applyPlanState(dailyPlans, historyRes.data || [], 'cloud', '');
    } catch (e) {
      this.loadLocalPlans('云端计划不可用，已切到本地');
    } finally {
      this.setData({ planLoading: false });
    }
  },

  applyPlanState(todayList, historyList, storage, notice) {
    const dailyPlans = (todayList || []).map(item => ({
      ...item,
      createdText: item.createdText || formatShortTime(item.createdAt),
      doneText: item.doneText || (item.doneAt ? formatShortTime(item.doneAt) : '')
    }));
    const done = dailyPlans.filter(item => item.done).length;
    const total = dailyPlans.length;
    this.setData({
      dailyPlans,
      planHistory: groupPlansByDate(historyList || []),
      planTotalCount: total,
      planDoneCount: done,
      planProgressPercent: total ? Math.round(done * 100 / total) : 0,
      planProgressText: total ? `今天完成了 ${done}/${total} 件小事` : '今天还没有计划，写一件小事就好',
      dailyPlanStorage: storage,
      storageNotice: notice || ''
    });
  },

  loadLocalPlans(notice = '') {
    const all = readLocalList(COL_DAILY_PLANS, this.data.coupleId);
    const todayPlans = all.filter(item => item.date === this.data.todayDate);
    this.applyPlanState(todayPlans, all, 'local', notice);
  },

  onPlanInput(e) {
    this.setData({ planInput: e.detail.value || '' });
  },

  async addDailyPlan() {
    if (!this.requireBound()) return;
    const title = (this.data.planInput || '').trim();
    if (!title) {
      wx.showToast({ title: '先写一件今天的小事', icon: 'none' });
      return;
    }

    try {
      await db.collection(COL_DAILY_PLANS).add({
        data: {
          coupleId: this.data.coupleId,
          date: this.data.todayDate,
          title,
          done: false,
          creatorOpenid: this.data.openid,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate(),
          doneAt: null
        }
      });
      this.setData({ planInput: '' });
      wx.showToast({ title: '已加入今日计划', icon: 'success' });
      await this.loadDailyPlans();
    } catch (e) {
      const all = readLocalList(COL_DAILY_PLANS, this.data.coupleId);
      all.unshift({
        _id: `local_${Date.now()}`,
        coupleId: this.data.coupleId,
        date: this.data.todayDate,
        title,
        done: false,
        creatorOpenid: this.data.openid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        doneAt: null
      });
      writeLocalList(COL_DAILY_PLANS, this.data.coupleId, all);
      this.setData({ planInput: '' });
      this.loadLocalPlans('云端保存失败，已先保存到本地');
      wx.showToast({ title: '已先保存到本地', icon: 'none' });
    }
  },

  async toggleDailyPlan(e) {
    if (!this.requireBound()) return;
    const id = e.currentTarget.dataset.id;
    const item = this.data.dailyPlans.find(plan => plan._id === id);
    if (!item) return;
    const nextDone = !item.done;
    if (this.data.dailyPlanStorage === 'local' || isLocalId(id)) {
      const all = readLocalList(COL_DAILY_PLANS, this.data.coupleId).map(plan => (
        plan._id === id
          ? { ...plan, done: nextDone, doneAt: nextDone ? new Date().toISOString() : null, updatedAt: new Date().toISOString() }
          : plan
      ));
      writeLocalList(COL_DAILY_PLANS, this.data.coupleId, all);
      this.loadLocalPlans(this.data.storageNotice);
      return;
    }
    try {
      await db.collection(COL_DAILY_PLANS).doc(id).update({
        data: {
          done: nextDone,
          doneAt: nextDone ? db.serverDate() : null,
          updatedAt: db.serverDate()
        }
      });
      await this.loadDailyPlans();
    } catch (e) {
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  async deleteDailyPlan(e) {
    if (!this.requireBound()) return;
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除这条计划？',
      content: '只会删除今天这条小计划。',
      success: async (res) => {
        if (!res.confirm) return;
        if (this.data.dailyPlanStorage === 'local' || isLocalId(id)) {
          const all = readLocalList(COL_DAILY_PLANS, this.data.coupleId).filter(plan => plan._id !== id);
          writeLocalList(COL_DAILY_PLANS, this.data.coupleId, all);
          this.loadLocalPlans(this.data.storageNotice);
          return;
        }
        try {
          await db.collection(COL_DAILY_PLANS).doc(id).remove();
          await this.loadDailyPlans();
        } catch (e) {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    });
  },

  togglePlanHistory() {
    this.setData({ showPlanHistory: !this.data.showPlanHistory });
  },

  async loadDailyMoods() {
    if (!this.isBound()) return;
    const { coupleId, todayDate, openid } = this.data;
    try {
      const res = await db.collection(COL_DAILY_MOODS)
        .where({ coupleId, date: todayDate })
        .limit(20)
        .get();
      const list = res.data || [];
      const myMood = list.find(item => item.creatorOpenid === openid) || null;
      const partnerMood = list.find(item => item.creatorOpenid !== openid) || null;
      this.setData({
        myMood,
        partnerMood,
        dailyMoodStorage: 'cloud',
        selectedMoodKey: myMood?.moodKey || this.data.selectedMoodKey,
        moodNote: myMood?.note || '',
        dailyWord: myMood?.dailyWord || ''
      });
    } catch (e) {
      this.loadLocalMoods('云端心情不可用，已切到本地');
    }
  },

  loadLocalMoods(notice = '') {
    const list = readLocalList(COL_DAILY_MOODS, this.data.coupleId)
      .filter(item => item.date === this.data.todayDate);
    const myMood = list.find(item => item.creatorOpenid === this.data.openid) || null;
    const partnerMood = list.find(item => item.creatorOpenid !== this.data.openid) || null;
    this.setData({
      myMood,
      partnerMood,
      dailyMoodStorage: 'local',
      storageNotice: notice || this.data.storageNotice,
      selectedMoodKey: myMood?.moodKey || this.data.selectedMoodKey,
      moodNote: myMood?.note || '',
      dailyWord: myMood?.dailyWord || ''
    });
  },

  selectMood(e) {
    this.setData({ selectedMoodKey: e.currentTarget.dataset.key });
  },

  onMoodNoteInput(e) {
    this.setData({ moodNote: e.detail.value || '' });
  },

  onDailyWordInput(e) {
    this.setData({ dailyWord: e.detail.value || '' });
  },

  async saveDailyMood() {
    if (!this.requireBound()) return;
    const mood = MOODS.find(item => item.key === this.data.selectedMoodKey);
    const note = (this.data.moodNote || '').trim();
    const dailyWord = (this.data.dailyWord || '').trim();
    if (!mood && !note && !dailyWord) {
      wx.showToast({ title: '选个心情或写一句话吧', icon: 'none' });
      return;
    }

    this.setData({ moodSaving: true });
    try {
      const data = {
        coupleId: this.data.coupleId,
        date: this.data.todayDate,
        creatorOpenid: this.data.openid,
        moodKey: mood?.key || '',
        moodEmoji: mood?.emoji || '',
        moodLabel: mood?.label || '',
        note,
        dailyWord,
        updatedAt: db.serverDate()
      };
      if (this.data.dailyMoodStorage === 'cloud' && this.data.myMood?._id && !isLocalId(this.data.myMood._id)) {
        await db.collection(COL_DAILY_MOODS).doc(this.data.myMood._id).update({ data });
      } else {
        await db.collection(COL_DAILY_MOODS).add({
          data: {
            ...data,
            createdAt: db.serverDate()
          }
        });
      }
      wx.showToast({ title: '今日心情已保存', icon: 'success' });
      await this.loadDailyMoods();
    } catch (e) {
      const all = readLocalList(COL_DAILY_MOODS, this.data.coupleId);
      const index = all.findIndex(item => item.date === this.data.todayDate && item.creatorOpenid === this.data.openid);
      const localData = {
        _id: index >= 0 ? all[index]._id : `local_${Date.now()}`,
        ...data,
        updatedAt: new Date().toISOString(),
        createdAt: index >= 0 ? all[index].createdAt : new Date().toISOString()
      };
      if (index >= 0) all[index] = localData;
      else all.unshift(localData);
      writeLocalList(COL_DAILY_MOODS, this.data.coupleId, all);
      this.loadLocalMoods('云端心情保存失败，已先保存到本地');
      wx.showToast({ title: '已先保存到本地', icon: 'none' });
    } finally {
      this.setData({ moodSaving: false });
    }
  },

  async onInviteOrEditPartner() {
    if (this.data.bindingState === 'bound') {
      return wx.showToast({ title: '你们已经绑定啦', icon: 'none' });
    }

    wx.showLoading({ title: '生成邀请...' });
    try {
      const invite = await createInvite();
      const path = buildInvitePath(invite.inviteId, invite.token);
      const inviteCode = buildInviteCode(invite.inviteId, invite.token);
      this.setData({
        openid: invite.openid || this.data.openid,
        coupleId: invite.coupleId || this.data.coupleId,
        invitePath: path,
        inviteId: invite.inviteId,
        invitationId: invite.inviteId,
        inviteToken: invite.token,
        inviteCode,
        bindingState: invite.bound ? 'bound' : 'pending',
        bindingMessage: invite.bound ? '已完成情侣绑定。' : '邀请码已生成，复制后发给 Ta 即可绑定。'
      });
      this.updateShareMenu();
      wx.hideLoading();
      wx.showToast({ title: '邀请码已生成', icon: 'success' });
      if (invite.coupleId) {
        await this.ensureProfileDoc();
        await this.refreshProfile();
      }
    } catch (e) {
      wx.hideLoading();
      this.setData({
        bindingState: 'error',
        bindingMessage: e.message || '邀请生成失败'
      });
      wx.showToast({ title: e.message || '邀请生成失败', icon: 'none' });
    }
  },

  copyInviteCode() {
    if (!this.data.inviteCode) {
      return wx.showToast({ title: '请先生成邀请码', icon: 'none' });
    }
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => wx.showToast({ title: '邀请码已复制', icon: 'success' }),
      fail: () => wx.showToast({ title: '复制失败，请手动复制', icon: 'none' })
    });
  },

  openInviteInput() {
    if (this.data.bindingState === 'bound') {
      return wx.showToast({ title: '你们已经绑定啦', icon: 'none' });
    }
    this.setData({
      showInviteInput: true,
      inviteInput: '',
      inviteSubmitting: false
    });
  },

  closeInviteInput() {
    if (this.data.inviteSubmitting) return;
    this.setData({ showInviteInput: false, inviteInput: '' });
  },

  onInviteInput(e) {
    this.setData({ inviteInput: e.detail.value || '' });
  },

  async confirmInviteBind() {
    if (this.data.bindingState === 'bound') {
      return wx.showToast({ title: '你们已经绑定啦', icon: 'none' });
    }
    if (this.data.inviteSubmitting) return;

    const parsed = parseInviteCode(this.data.inviteInput);
    if (parsed.error) {
      return wx.showToast({ title: parsed.error, icon: 'none' });
    }

    this.setData({ inviteSubmitting: true });
    wx.showLoading({ title: '绑定中...' });
    try {
      const status = await acceptInvite({
        inviteId: parsed.inviteId,
        token: parsed.token
      });
      wx.hideLoading();
      wx.showToast({ title: '绑定成功', icon: 'success' });
      this.setData({
        showInviteInput: false,
        inviteInput: '',
        inviteSubmitting: false
      });
      await this.applyBindingStatus(status);
    } catch (e) {
      wx.hideLoading();
      const message = e.message || '绑定失败，请检查邀请码是否正确';
      this.setData({
        bindingState: 'error',
        bindingMessage: message,
        inviteSubmitting: false
      });
      wx.showToast({ title: message, icon: 'none' });
    }
  },

  hasInviteToShare() {
    return !!(this.data.inviteId && this.data.inviteToken && this.data.invitePath);
  },

  updateShareMenu() {
    if (this.hasInviteToShare() && this.data.bindingState !== 'bound') {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage']
      });
      return;
    }
    wx.hideShareMenu({ menus: ['shareAppMessage'] });
  },

  onShareInviteTap() {
    if (!this.hasInviteToShare()) {
      wx.showToast({ title: '请先生成邀请', icon: 'none' });
    }
  },

  onShareAppMessage() {
    if (!this.hasInviteToShare()) {
      wx.showToast({ title: '请先生成邀请', icon: 'none' });
      return {
        title: '邀请你加入我们的情侣空间',
        path: PAGE_PATH
      };
    }
    return {
      title: '邀请你加入我们的情侣空间',
      path: this.data.invitePath
    };
  },

  noop() {},

  onMoreMoments() {
    wx.navigateTo({ url: '../../pkg/timeline/timeline' });
  },

  handleRecordMood() {
    wx.navigateTo({ url: '../../pkg/heartbeat/heartbeat' });
  },

  onQuick(e) {
    const type = e.currentTarget.dataset.type;
    const map = {
      plan: '',
      mood: '',
      weather: '../../pkg/weather/weather',
      memorial: '../../pkg/memorial/memorial',
      sock: '../../pkg/loveTest/loveTest',
      date: '../../pkg/daterecord/daterecord',
      food: '../../pkg/loveWords/loveWords',
      ai: '../../pkg/moodDiary/moodDiary',
      album: '../../pkg/photoalbum/photoalbum',
      letter: '../../pkg/heartbeat/heartbeat',
      more: '/pages/matters/matters'
    };
    const url = map[type];
    if (type === 'plan') {
      wx.showToast({ title: '就在这里写今日计划', icon: 'none' });
      return;
    }
    if (type === 'mood') {
      wx.showToast({ title: '就在这里记录今日心情', icon: 'none' });
      return;
    }
    if (!url) return;
    if (type === 'more') return wx.switchTab({ url });
    wx.navigateTo({ url });
  },

  onFab() {
    wx.navigateTo({ url: '../../pkg/heartbeat/heartbeat' });
  }
});
