const { getPageBinding, getErrorMessage } = require('../../utils/couple');

const COLLECTION = 'partner_locations';

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

function hasCoordinatePair(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  return !Number.isNaN(lat) &&
    !Number.isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180;
}

function formatCoordinate(latitude, longitude) {
  if (!hasCoordinatePair(latitude, longitude)) return '';
  return `${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)}`;
}

Page({
  data: {
    bindingReady: false,
    bindingState: 'loading',
    bindingMessage: '正在确认绑定状态...',
    coupleId: '',
    openid: '',
    myCity: '',
    myLatitude: null,
    myLongitude: null,
    myUpdatedText: '',
    hasMyCoordinates: false,
    myCoordinateText: '',
    myWeather: null,
    partnerLocation: null,
    partnerWeather: null,
    cityInput: '',
    loading: false,
    saving: false,
    myConfigMissing: false,
    partnerConfigMissing: false,
    errorMessage: '',
    myWaitingText: '你还没有同步自己的位置',
    waitingText: '等待对方同步位置'
  },

  async onLoad() {
    wx.setNavigationBarTitle({ title: '天气卡片' });
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
        errorMessage: ''
      });
      if (binding.bindingReady) await this.loadWeather();
    } catch (e) {
      const message = getErrorMessage(e, '绑定状态读取失败');
      this.setData({ bindingReady: false, bindingState: 'error', bindingMessage: message, errorMessage: message });
      if (!silent) wx.showToast({ title: message, icon: 'none' });
    }
  },

  async loadWeather() {
    if (!this.data.coupleId || !this.data.openid) return;
    this.setData({
      loading: true,
      errorMessage: '',
      myConfigMissing: false,
      partnerConfigMissing: false
    });
    await Promise.all([
      this.loadMyLocation(),
      this.loadTargetWeather('self'),
      this.loadTargetWeather('partner')
    ]);
    this.setData({ loading: false });
  },

  async loadMyLocation() {
    const db = wx.cloud.database();
    try {
      const mine = await db.collection(COLLECTION)
        .where({ coupleId: this.data.coupleId, openid: this.data.openid })
        .limit(1)
        .get();
      const myLoc = mine.data?.[0] || null;
      this.setData({
        myCity: myLoc?.city || '',
        myLatitude: myLoc?.latitude ?? null,
        myLongitude: myLoc?.longitude ?? null,
        hasMyCoordinates: hasCoordinatePair(myLoc?.latitude, myLoc?.longitude),
        myCoordinateText: formatCoordinate(myLoc?.latitude, myLoc?.longitude),
        myUpdatedText: myLoc?.updatedAt ? formatTime(myLoc.updatedAt) : '',
        cityInput: myLoc?.city || this.data.cityInput
      });
    } catch (e) {
      this.setData({ errorMessage: getErrorMessage(e, '我的位置读取失败') });
    }
  },

  async loadTargetWeather(target = 'partner') {
    const isSelf = target === 'self';
    try {
      const res = await wx.cloud.callFunction({
        name: 'weather',
        data: {
          action: 'getWeather',
          target,
          coupleId: this.data.coupleId
        }
      });
      const result = res.result || {};
      if (!result.ok) {
        const message = result.message || '天气获取失败';
        this.setData(isSelf
          ? { myWeather: null, errorMessage: message }
          : { partnerWeather: null, partnerLocation: null, errorMessage: message });
        wx.showToast({ title: message, icon: 'none' });
        return;
      }
      if (!result.hasLocation) {
        this.setData(isSelf
          ? {
            myWeather: null,
            myWaitingText: result.message || '你还没有同步自己的位置'
          }
          : {
            partnerWeather: null,
            partnerLocation: null,
            waitingText: result.message || '等待对方同步位置'
          });
        return;
      }
      this.setData(isSelf
        ? {
          myWeather: result.weather || null,
          myConfigMissing: !!result.configMissing,
          myWaitingText: '你还没有同步自己的位置'
        }
        : {
          partnerLocation: result.partnerLocation || result.location || null,
          partnerWeather: result.weather || null,
          partnerConfigMissing: !!result.configMissing,
          waitingText: '等待对方同步位置'
        });
    } catch (e) {
      const message = getErrorMessage(e, '天气云函数调用失败');
      this.setData(isSelf
        ? { myWeather: null, errorMessage: message }
        : { partnerWeather: null, errorMessage: message });
      wx.showToast({ title: message, icon: 'none' });
    }
  },

  async loadPartnerWeather() {
    await this.loadTargetWeather('partner');
  },

  onCityInput(e) {
    this.setData({
      cityInput: e.detail.value,
      myLatitude: null,
      myLongitude: null,
      hasMyCoordinates: false,
      myCoordinateText: ''
    });
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
      fail: (err) => {
        this.handleLocationFail(err, '地图选点打不开，可以先用当前位置');
      }
    });
  },

  useCurrentLocation() {
    this.getCurrentLocationOnce()
      .then((res) => {
        this.setData({
          cityInput: this.data.cityInput || '当前位置',
          myLatitude: res.latitude,
          myLongitude: res.longitude,
          hasMyCoordinates: true,
          myCoordinateText: formatCoordinate(res.latitude, res.longitude)
        });
        wx.showToast({ title: '已获取当前位置', icon: 'none' });
      })
      .catch((err) => {
        this.handleLocationFail(err, '当前位置获取失败');
      });
  },

  getCurrentLocationOnce() {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        success: resolve,
        fail: reject
      });
    });
  },

  handleLocationFail(err, fallback) {
    const message = err?.errMsg || '';
    if (message.includes('auth deny') || message.includes('authorize') || message.includes('permission')) {
      wx.showModal({
        title: '需要位置权限',
        content: '请允许位置权限后再同步天气位置。',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) wx.openSetting();
        }
      });
      return;
    }
    wx.showToast({ title: fallback, icon: 'none' });
  },

  async saveMyLocation() {
    if (!this.data.bindingReady) {
      wx.showToast({ title: '请先绑定情侣关系', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    let city = (this.data.cityInput || '').trim();
    let latitude = this.data.myLatitude;
    let longitude = this.data.myLongitude;
    if (!hasCoordinatePair(latitude, longitude)) {
      try {
        wx.showToast({ title: '正在获取经纬度', icon: 'none' });
        const location = await this.getCurrentLocationOnce();
        latitude = location.latitude;
        longitude = location.longitude;
        city = city || '当前位置';
        this.setData({
          cityInput: city,
          myLatitude: latitude,
          myLongitude: longitude,
          hasMyCoordinates: true,
          myCoordinateText: formatCoordinate(latitude, longitude)
        });
      } catch (e) {
        this.handleLocationFail(e, '请先允许定位，或点“用当前位置”');
        this.setData({ saving: false });
        return;
      }
    }
    if (!city) city = '当前位置';

    const db = wx.cloud.database();
    const data = {
      coupleId: this.data.coupleId,
      openid: this.data.openid,
      city,
      latitude,
      longitude,
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
      await this.loadWeather();
    } catch (e) {
      const message = getErrorMessage(e, '位置同步失败');
      wx.showToast({ title: message, icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  retryWeather() {
    this.loadWeather();
  },

  onShareAppMessage() {
    return {
      title: '爱木长诗 · 天气卡片',
      path: '/pkg/weather/weather'
    };
  }
});
