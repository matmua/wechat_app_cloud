const { getPageBinding, getErrorMessage } = require('../../utils/couple');

const COLLECTION = 'sock_secrets';
const VISIBILITY_OPTIONS = [
  { key: 'public', label: '直接展示', desc: '保存后 Ta 可以看到' },
  { key: 'hidden', label: '先藏起来', desc: '只有自己能看' },
  { key: 'scheduled', label: '定时掉出', desc: '到时间后 Ta 才能看' }
];
const CONTENT_TYPES = [
  { key: 'text', label: '文字' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' }
];

function pad(n) {
  return `${n}`.padStart(2, '0');
}

function formatDateTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}.${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

Page({
  data: {
    bindingReady: false,
    bindingState: 'loading',
    bindingMessage: '正在确认绑定状态...',
    coupleId: '',
    openid: '',
    partnerOpenid: '',
    visibilityOptions: VISIBILITY_OPTIONS,
    contentTypes: CONTENT_TYPES,
    visibility: 'hidden',
    contentType: 'text',
    text: '',
    revealDate: '',
    revealTime: '20:00',
    mediaTempPath: '',
    mediaName: '',
    mediaSize: 0,
    records: [],
    loading: false,
    saving: false,
    errorMessage: ''
  },

  audio: null,

  async onLoad() {
    wx.setNavigationBarTitle({ title: '树洞袜子' });
    await this.refreshBinding();
  },

  async onShow() {
    await this.refreshBinding(true);
  },

  onUnload() {
    if (this.audio) this.audio.destroy();
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
        partnerOpenid: binding.partner?.openid || '',
        errorMessage: ''
      });
      if (binding.bindingReady) await this.loadSecrets();
    } catch (e) {
      const message = getErrorMessage(e, '绑定状态读取失败');
      this.setData({ bindingReady: false, bindingState: 'error', bindingMessage: message, errorMessage: message });
      if (!silent) wx.showToast({ title: message, icon: 'none' });
    }
  },

  async loadSecrets() {
    if (!this.data.coupleId || !this.data.openid) return;
    this.setData({ loading: true, errorMessage: '' });
    const db = wx.cloud.database();
    const _ = db.command;
    const now = new Date();

    try {
      const [mine, partnerPublic, partnerScheduled] = await Promise.all([
        db.collection(COLLECTION)
          .where({ coupleId: this.data.coupleId, ownerOpenid: this.data.openid })
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get(),
        db.collection(COLLECTION)
          .where({ coupleId: this.data.coupleId, ownerOpenid: _.neq(this.data.openid), visibility: 'public' })
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get(),
        db.collection(COLLECTION)
          .where({
            coupleId: this.data.coupleId,
            ownerOpenid: _.neq(this.data.openid),
            visibility: 'scheduled',
            revealAt: _.lte(now)
          })
          .orderBy('revealAt', 'desc')
          .limit(50)
          .get()
      ]);

      const merged = [...(mine.data || []), ...(partnerPublic.data || []), ...(partnerScheduled.data || [])]
        .sort((a, b) => {
          const at = new Date(a.createdAt || a.revealAt || 0).getTime();
          const bt = new Date(b.createdAt || b.revealAt || 0).getTime();
          return bt - at;
        });
      await this.hydrateRecords(merged);
    } catch (e) {
      const message = getErrorMessage(e, '树洞袜子读取失败');
      this.setData({ errorMessage: message });
      wx.showToast({ title: message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async hydrateRecords(list) {
    const fileIDs = [];
    list.forEach((item) => {
      (item.fileIDs || []).forEach((fileID) => fileIDs.push(fileID));
    });

    let urlMap = {};
    if (fileIDs.length) {
      try {
        const res = await wx.cloud.getTempFileURL({ fileList: fileIDs });
        (res.fileList || []).forEach((item) => {
          urlMap[item.fileID] = item.tempFileURL;
        });
      } catch (e) {
        console.log('sock secret temp url fail:', e);
      }
    }

    const records = list.map((item, index) => {
      const isMine = item.ownerOpenid === this.data.openid;
      const revealAt = item.revealAt ? new Date(item.revealAt) : null;
      const isScheduled = item.visibility === 'scheduled';
      const isRevealed = !isScheduled || (revealAt && revealAt.getTime() <= Date.now());
      return {
        ...item,
        sockColor: ['berry', 'mint', 'sun', 'night'][index % 4],
        isMine,
        isRevealed,
        revealText: revealAt ? formatDateTime(revealAt) : '',
        createdText: formatDateTime(item.createdAt),
        tempUrls: (item.fileIDs || []).map((fileID) => urlMap[fileID]).filter(Boolean),
        statusText: item.visibility === 'public'
          ? '已经掉出来'
          : item.visibility === 'hidden'
            ? '只藏给自己'
            : isRevealed
              ? '到点掉出来'
              : `等到 ${formatDateTime(revealAt)}`
      };
    });
    this.setData({ records });
  },

  setVisibility(e) {
    this.setData({ visibility: e.currentTarget.dataset.key });
  },

  setContentType(e) {
    this.setData({
      contentType: e.currentTarget.dataset.key,
      mediaTempPath: '',
      mediaName: '',
      mediaSize: 0
    });
  },

  onTextInput(e) {
    this.setData({ text: e.detail.value });
  },

  onRevealDate(e) {
    this.setData({ revealDate: e.detail.value });
  },

  onRevealTime(e) {
    this.setData({ revealTime: e.detail.value });
  },

  async chooseMediaFile() {
    const type = this.data.contentType;
    if (type === 'text') return;

    if (type === 'audio') {
      wx.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['mp3', 'm4a', 'wav', 'aac'],
        success: (res) => {
          const file = res.tempFiles?.[0];
          if (!file) return;
          this.setData({ mediaTempPath: file.path, mediaName: file.name || '一段声音', mediaSize: file.size || 0 });
        }
      });
      return;
    }

    wx.chooseMedia({
      count: 1,
      mediaType: [type],
      sourceType: ['album', 'camera'],
      maxDuration: 60,
      success: (res) => {
        const file = res.tempFiles?.[0];
        if (!file) return;
        this.setData({
          mediaTempPath: file.tempFilePath,
          mediaName: type === 'image' ? '一张图片' : '一段视频',
          mediaSize: file.size || 0
        });
      }
    });
  },

  removeMedia() {
    this.setData({ mediaTempPath: '', mediaName: '', mediaSize: 0 });
  },

  async saveSecret() {
    if (!this.data.bindingReady) {
      wx.showToast({ title: '请先绑定情侣关系', icon: 'none' });
      return;
    }
    const text = (this.data.text || '').trim();
    if (this.data.contentType === 'text' && !text) {
      wx.showToast({ title: '先写一句悄悄话', icon: 'none' });
      return;
    }
    if (this.data.contentType !== 'text' && !this.data.mediaTempPath) {
      wx.showToast({ title: '先选择媒体文件', icon: 'none' });
      return;
    }

    let revealAt = null;
    if (this.data.visibility === 'scheduled') {
      if (!this.data.revealDate || !this.data.revealTime) {
        wx.showToast({ title: '请选择公开时间', icon: 'none' });
        return;
      }
      revealAt = new Date(`${this.data.revealDate}T${this.data.revealTime}:00`);
      if (Number.isNaN(revealAt.getTime()) || revealAt.getTime() <= Date.now()) {
        wx.showToast({ title: '公开时间要晚于现在', icon: 'none' });
        return;
      }
    }

    this.setData({ saving: true });
    try {
      const fileIDs = [];
      if (this.data.contentType !== 'text') {
        const fileID = await this.uploadMediaFile();
        fileIDs.push(fileID);
      }

      const db = wx.cloud.database();
      await db.collection(COLLECTION).add({
        data: {
          coupleId: this.data.coupleId,
          ownerOpenid: this.data.openid,
          contentType: this.data.contentType,
          text,
          fileIDs,
          visibility: this.data.visibility,
          revealAt,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });

      this.setData({
        text: '',
        contentType: 'text',
        visibility: 'hidden',
        mediaTempPath: '',
        mediaName: '',
        mediaSize: 0
      });
      wx.showToast({ title: '已经塞进袜子里', icon: 'none' });
      await this.loadSecrets();
    } catch (e) {
      const message = getErrorMessage(e, '保存失败');
      wx.showToast({ title: message, icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  async uploadMediaFile() {
    const extMap = { image: 'jpg', video: 'mp4', audio: 'm4a' };
    const ext = extMap[this.data.contentType] || 'dat';
    const cloudPath = `sock_secrets/${this.data.coupleId}/${this.data.openid}/${Date.now()}.${ext}`;
    const res = await wx.cloud.uploadFile({
      cloudPath,
      filePath: this.data.mediaTempPath
    });
    return res.fileID;
  },

  previewMedia(e) {
    const url = e.currentTarget.dataset.url;
    const type = e.currentTarget.dataset.type;
    if (!url) return;
    if (type === 'image') {
      wx.previewImage({ urls: [url] });
      return;
    }
    if (type === 'video') {
      wx.previewMedia({ sources: [{ url, type: 'video' }] });
      return;
    }
    if (this.audio) this.audio.destroy();
    this.audio = wx.createInnerAudioContext();
    this.audio.src = url;
    this.audio.play();
  },

  onShareAppMessage() {
    return {
      title: '爱木长诗 · 树洞袜子',
      path: '/pkg/loveTest/loveTest'
    };
  }
});
