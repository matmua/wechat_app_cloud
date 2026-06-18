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

const COL = 'photo_stories';

function emptyForm() {
  return {
    title: '',
    storyText: '',
    date: dateKey(),
    place: '',
    images: []
  };
}

function decorate(item) {
  const fileIDs = item.fileIDs || [];
  return {
    ...item,
    dateText: dateLabel(item.date),
    cover: fileIDs[0] || '',
    countText: fileIDs.length ? `${fileIDs.length} 张照片` : '文字故事'
  };
}

function extFromPath(path) {
  const match = String(path || '').match(/\.(jpg|jpeg|png|webp|gif)$/i);
  return match ? match[1].toLowerCase() : 'jpg';
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
    uploading: false,
    storageMode: 'cloud',
    errorMessage: '',
    form: emptyForm(),
    stories: []
  },

  async onLoad() {
    const binding = await initBoundPage(this);
    if (binding && binding.bindingReady) await this.loadStories();
  },

  async onPullDownRefresh() {
    await this.loadStories();
    wx.stopPullDownRefresh();
  },

  async loadStories() {
    if (!this.data.bindingReady) return;
    this.setData({ loading: true });
    const res = await loadList(COL, this.data.coupleId, { limit: 60 });
    this.setData({
      stories: (res.list || []).map(decorate),
      loading: false
    });
    applyStorageNotice(this, res.storage, res.error);
  },

  onTitleInput(e) {
    this.setData({ 'form.title': e.detail.value || '' });
  },

  onStoryInput(e) {
    this.setData({ 'form.storyText': e.detail.value || '' });
  },

  onDateChange(e) {
    this.setData({ 'form.date': e.detail.value });
  },

  onPlaceInput(e) {
    this.setData({ 'form.place': e.detail.value || '' });
  },

  chooseImages() {
    if (!requireBound(this)) return;
    wx.chooseMedia({
      count: 6,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const picked = (res.tempFiles || []).map(file => ({
          tempFilePath: file.tempFilePath,
          size: file.size || 0
        }));
        this.setData({ 'form.images': [...this.data.form.images, ...picked].slice(0, 9) });
      },
      fail: () => wx.showToast({ title: '没有选中照片', icon: 'none' })
    });
  },

  removeImage(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ 'form.images': this.data.form.images.filter((_, i) => i !== index) });
  },

  async uploadImages(images) {
    const fileIDs = [];
    for (let i = 0; i < images.length; i += 1) {
      const path = images[i].tempFilePath;
      const ext = extFromPath(path);
      const cloudPath = `photo_stories/${this.data.coupleId}/${Date.now()}_${i}.${ext}`;
      const res = await wx.cloud.uploadFile({ cloudPath, filePath: path });
      fileIDs.push(res.fileID);
    }
    return fileIDs;
  },

  async saveStory() {
    if (!requireBound(this)) return;
    const form = this.data.form;
    const title = (form.title || '').trim();
    const storyText = (form.storyText || '').trim();
    if (!title) return wx.showToast({ title: '写一个故事标题', icon: 'none' });
    if (!storyText && !form.images.length) return wx.showToast({ title: '写点故事或选几张照片', icon: 'none' });

    this.setData({ saving: true, uploading: !!form.images.length });
    let fileIDs = [];
    try {
      fileIDs = await this.uploadImages(form.images);
    } catch (error) {
      this.setData({ saving: false, uploading: false });
      wx.showToast({ title: '照片上传失败，请稍后再试', icon: 'none' });
      return;
    }

    const res = await addItem(COL, this.data.coupleId, {
      title,
      fileIDs,
      storyText,
      date: form.date,
      place: (form.place || '').trim(),
      creatorOpenid: this.data.openid
    });
    this.setData({ saving: false, uploading: false, form: emptyForm() });
    applyStorageNotice(this, res.storage, res.error);
    wx.showToast({ title: res.storage === 'cloud' ? '故事已保存' : '已先保存本地', icon: 'none' });
    await this.loadStories();
  },

  previewStoryImage(e) {
    const current = e.currentTarget.dataset.src;
    const id = e.currentTarget.dataset.id;
    const story = this.data.stories.find(item => item._id === id);
    if (!story || !(story.fileIDs || []).length) return;
    wx.previewImage({ current, urls: story.fileIDs });
  },

  deleteStory(e) {
    if (!requireBound(this)) return;
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除照片故事',
      content: '故事卡会被删除，云存储图片不会自动清理。',
      success: async (res) => {
        if (!res.confirm) return;
        const result = await removeItem(COL, this.data.coupleId, id);
        applyStorageNotice(this, result.storage, result.error);
        await this.loadStories();
      }
    });
  },

  openAlbum() {
    wx.navigateTo({ url: '/pkg/photoalbum/photoalbum' });
  },

  goBind() {
    wx.switchTab({ url: '/pages/remembers/remembers' });
  }
});
