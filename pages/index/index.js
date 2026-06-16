// index.js
const db = wx.cloud.database();
const { ensureCoupleId } = require('../../utils/couple');

const COL_WISH = 'love_wishes';
const COL_ALBUM = 'love_album';
const COL_BANK = 'heartbeat_bank';

const CLOUD_PREFIX =
  'cloud://cloud1-4gmaqc42550b0950.636c-cloud1-4gmaqc42550b0950-1391881406/images/index/';

Page({
  data: {
    coupleId: '',
    daysCount: 0,

    // ✅ 这三个字段继续沿用你 wxml 里的名字
    dateCount: 0,       // 完成心愿数
    photoCount: 0,      // 照片数量（按图片张数）
    heartbeatCount: 0,  // 心动金库 points

    imageLoaded: false,
    img: {
      home: '',
      hamster: '',
      shiba: '',
      golden: '',
      psyduck: '',
      sheep: '',
      calico: '',
      lovedays: ''
    }
  },

  onLoad() {
    const coupleId = ensureCoupleId(); // ✅ 建议 ensureCoupleId 返回 coupleId
    this.setData({ coupleId });

    this.calculateDays();
    this.loadCloudImages();
  },

  onShow() {
    this.loadStatisticsFromDB();
  },

  // ====== 从数据库加载统计 ======
  async loadStatisticsFromDB() {
    const coupleId = this.data.coupleId || ensureCoupleId();
    if (!coupleId) return;

    wx.showNavigationBarLoading?.();

    try {
      // 1) 完成心愿数（wishlist 里是 status: 'done'）
      const wishDone = await db.collection(COL_WISH)
        .where({ coupleId, status: 'done' })
        .count();

      // 2) 照片数量：按“图片张数”统计（love_album 每条可能多张 fileIDs）
      const photoTotal = await this.countAlbumPhotos(coupleId);

      // 3) 心动金库 points（heartbeat_bank）
      const bankRes = await db.collection(COL_BANK)
        .where({ coupleId })
        .limit(1)
        .get();

      const bankPoints = Number(bankRes.data?.[0]?.points || 0);

      this.setData({
        dateCount: Number(wishDone.total || 0),
        photoCount: Number(photoTotal || 0),
        heartbeatCount: bankPoints
      });
    } catch (e) {
      console.log('loadStatisticsFromDB error:', e);
      // 不弹太多 toast，避免打扰；你要调试可以打开
      // wx.showToast({ title: '统计加载失败', icon: 'none' });
    } finally {
      wx.hideNavigationBarLoading?.();
    }
  },

  // ✅ 统计 love_album 里所有图片张数：sum(fileIDs.length)
  async countAlbumPhotos(coupleId) {
    let skip = 0;
    let total = 0;

    while (true) {
      const r = await db.collection(COL_ALBUM)
        .where({ coupleId })
        .field({ fileIDs: true })
        .skip(skip)
        .limit(100)
        .get();

      const list = r.data || [];
      if (!list.length) break;

      list.forEach(it => {
        total += (it.fileIDs || []).length;
      });

      skip += list.length;
      if (list.length < 100) break; // 最后一页
    }

    return total;
  },

  // ====== 计算恋爱天数（你原来的逻辑保留） ======
  calculateDays() {
    const startDate = new Date('2023-12-15');
    const today = new Date();
    const diffTime = Math.abs(today - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24) - 1);
    this.setData({ daysCount: diffDays });
  },

  // ====== 云图片加载（你原来的逻辑保留） ======
  loadCloudImages() {
    const files = {
      home: 'iceday.png',
      hamster: '仓鼠.svg',
      shiba: '柴犬.svg',
      golden: '金毛.svg',
      psyduck: '可达鸭.svg',
      sheep: '羊.svg',
      calico: '三花猫.svg',
      lovedays: 'lovedays.svg'
    };

    const fileList = Object.keys(files).map((k) => ({
      fileID: CLOUD_PREFIX + files[k],
      maxAge: 24 * 60 * 60
    }));

    wx.cloud.getTempFileURL({
      fileList,
      success: (res) => {
        const nextImg = { ...this.data.img };
        Object.keys(files).forEach((k, idx) => {
          nextImg[k] = res.fileList?.[idx]?.tempFileURL || '';
        });
        this.setData({ img: nextImg });
      },
      fail: (err) => {
        console.log('getTempFileURL 失败', err);
        wx.showToast({ title: '云图片加载失败', icon: 'none' });
      }
    });
  },

  // ====== 跳转（原样保留） ======
  goToWishList() { wx.navigateTo({ url: '../../pkg/wishlist/wishlist' }); },
  goToDateRecord() { wx.navigateTo({ url: '../../pkg/daterecord/daterecord' }); },
  goToHeartbeat() { wx.navigateTo({ url: '../../pkg/heartbeat/heartbeat' }); },
  goToPhotoAlbum() { wx.navigateTo({ url: '../../pkg/photoalbum/photoalbum' }); },
  goToMemorialDay() { wx.navigateTo({ url: '../../pkg/memorial/memorial' }); },
  goToTimeline() { wx.navigateTo({ url: '../../pkg/timeline/timeline' }); },

  imageLoad(e) { this.setData({ imageLoaded: true }); },
  imageError(e) {
    this.loadCloudImages();
    wx.showToast({ title: '图片加载失败', icon: 'none' });
  }
});
