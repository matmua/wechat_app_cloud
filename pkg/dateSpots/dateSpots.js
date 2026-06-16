const LIKE_KEY = 'date_spots_big_likes_v1';
const DEFAULT_LIKES = [
  { title: '热乎乎的奶茶', type: '吃喝', detail: '少冰，甜度不要太高。' },
  { title: '毛绒小挂件', type: '礼物', detail: '小小的就够，可爱比贵更重要。' },
  { title: '晚上散步', type: '约会', detail: '不要太赶，慢慢走。' }
];

Page({
  data: {
    likes: [],
    title: '',
    detail: '',
    types: ['吃喝', '礼物', '约会', '习惯', '雷区'],
    typeIndex: 0,
    activeType: '全部',
    filteredLikes: []
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '大大喜欢' });
    const likes = wx.getStorageSync(LIKE_KEY) || DEFAULT_LIKES;
    this.setData({ likes }, () => this.refreshFilteredLikes());
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  onDetailInput(e) {
    this.setData({ detail: e.detail.value });
  },

  onTypeChange(e) {
    this.setData({ typeIndex: Number(e.detail.value || 0) });
  },

  setFilter(e) {
    this.setData({ activeType: e.currentTarget.dataset.type }, () => this.refreshFilteredLikes());
  },

  addLike() {
    const title = (this.data.title || '').trim();
    if (!title) {
      wx.showToast({ title: '先写一个喜欢', icon: 'none' });
      return;
    }
    const likes = [
      {
        title,
        detail: (this.data.detail || '').trim() || '先记下来，之后再补细节。',
        type: this.data.types[this.data.typeIndex]
      },
      ...this.data.likes
    ];
    wx.setStorageSync(LIKE_KEY, likes);
    this.setData({ likes, title: '', detail: '' }, () => this.refreshFilteredLikes());
  },

  deleteLike(e) {
    const index = Number(e.currentTarget.dataset.index || 0);
    const target = this.data.filteredLikes[index];
    const likes = this.data.likes.filter((item) => item !== target);
    wx.setStorageSync(LIKE_KEY, likes);
    this.setData({ likes }, () => this.refreshFilteredLikes());
  },

  resetLikes() {
    wx.setStorageSync(LIKE_KEY, DEFAULT_LIKES);
    this.setData({ likes: DEFAULT_LIKES, activeType: '全部' }, () => this.refreshFilteredLikes());
  },

  refreshFilteredLikes() {
    const filteredLikes = this.data.activeType === '全部'
      ? this.data.likes
      : this.data.likes.filter((item) => item.type === this.data.activeType);
    this.setData({ filteredLikes });
  },

  onShareAppMessage() {
    return {
      title: '爱木长诗 · 大大喜欢',
      path: '/pkg/dateSpots/dateSpots'
    };
  }
});
