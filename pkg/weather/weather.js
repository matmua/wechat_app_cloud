const { getPageBinding, getErrorMessage } = require('../../utils/couple');

const COLLECTION = 'partner_locations';
const WEATHER_POOL = [
  { condition: '多云', temp: 18, feels: '有点凉', tip: '她那里有点冷，记得提醒她加衣服。' },
  { condition: '晴', temp: 25, feels: '刚刚好', tip: '天气不错，可以问问她今天有没有看到好看的云。' },
  { condition: '小雨', temp: 16, feels: '湿冷', tip: '提醒她带伞，鞋子也别穿太容易湿的。' },
  { condition: '阴', temp: 21, feels: '适合散步', tip: '如果她心情也阴天，就多陪她说两句。' }
];

function formatTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${month}.${day} ${hour}:${minute}`;
}

function mockWeather(city = '') {
  const seed = Array.from(city).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return WEATHER_POOL[seed % WEATHER_POOL.length];
}

Page({
  data: {
    bindingReady: false,
    bindingState: 'loading',
    bindingMessage: '正在确认绑定状态...',
    coupleId: '',
    openid: '',
    partnerOpenid: '',
    myCity: '',
    myLatitude: null,
    myLongitude: null,
    myUpdatedText: '',
    partnerLocation: null,
    partnerWeather: null,
    cityInput: '',
    loading: false,
    saving: false,
    errorMessage: '',
    waitingText: '等待对方同步位置'
  },

  async onLoad() {
    wx.setNavigationBarTitle({ title: '对方天气' });
    await this.refreshBinding();
  },

  async onShow() {
    await this.refreshBinding(true);
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
      if (binding.bindingReady) await this.loadLocations();
    } catch (e) {
      const message = getErrorMessage(e, '绑定状态读取失败');
      this.setData({ bindingReady: false, bindingState: 'error', bindingMessage: message, errorMessage: message });
      if (!silent) wx.showToast({ title: message, icon: 'none' });
    }
  },

  async loadLocations() {
    if (!this.data.coupleId || !this.data.openid) return;
    this.setData({ loading: true, errorMessage: '' });
    const db = wx.cloud.database();
    try {
      const mine = await db.collection(COLLECTION)
        .where({ coupleId: this.data.coupleId, openid: this.data.openid })
        .limit(1)
        .get();
      const myLoc = mine.data?.[0] || null;

      let partnerLoc = null;
      if (this.data.partnerOpenid) {
        const partner = await db.collection(COLLECTION)
          .where({ coupleId: this.data.coupleId, openid: this.data.partnerOpenid })
          .limit(1)
          .get();
        partnerLoc = partner.data?.[0] || null;
      }

      this.setData({
        myCity: myLoc?.city || '',
        myLatitude: myLoc?.latitude ?? null,
        myLongitude: myLoc?.longitude ?? null,
        myUpdatedText: myLoc?.updatedAt ? formatTime(myLoc.updatedAt) : '',
        partnerLocation: partnerLoc,
        partnerWeather: partnerLoc ? {
          ...mockWeather(partnerLoc.city),
          city: partnerLoc.city,
          updatedText: formatTime(partnerLoc.updatedAt)
        } : null,
        cityInput: myLoc?.city || ''
      });
    } catch (e) {
      const message = getErrorMessage(e, '天气位置读取失败');
      this.setData({ errorMessage: message });
      wx.showToast({ title: message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onCityInput(e) {
    this.setData({ cityInput: e.detail.value });
  },

  chooseMyLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          cityInput: res.name || res.address || '我所在的位置',
          myLatitude: res.latitude,
          myLongitude: res.longitude
        });
      },
      fail: () => {
        wx.showToast({ title: '没有选择位置，可手动填写城市', icon: 'none' });
      }
    });
  },

  async saveMyLocation() {
    if (!this.data.bindingReady) {
      wx.showToast({ title: '请先绑定情侣关系', icon: 'none' });
      return;
    }
    const city = (this.data.cityInput || '').trim();
    if (!city) {
      wx.showToast({ title: '请先填写城市', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    const db = wx.cloud.database();
    const data = {
      coupleId: this.data.coupleId,
      openid: this.data.openid,
      city,
      latitude: this.data.myLatitude,
      longitude: this.data.myLongitude,
      updatedAt: db.serverDate()
    };

    try {
      const exists = await db.collection(COLLECTION)
        .where({ coupleId: this.data.coupleId, openid: this.data.openid })
        .limit(1)
        .get();
      if (exists.data?.[0]?._id) {
        await db.collection(COLLECTION).doc(exists.data[0]._id).update({ data });
      } else {
        await db.collection(COLLECTION).add({ data });
      }
      wx.showToast({ title: '已同步给 Ta', icon: 'none' });
      await this.loadLocations();
    } catch (e) {
      const message = getErrorMessage(e, '位置同步失败');
      wx.showToast({ title: message, icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  onShareAppMessage() {
    return {
      title: '爱木长诗 · 对方天气',
      path: '/pkg/weather/weather'
    };
  }
});
