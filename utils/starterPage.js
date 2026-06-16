const { getPageBinding, getErrorMessage } = require('./couple');

function navigateTo(url) {
  if (!url) return;
  if (url.startsWith('/pages/')) {
    wx.switchTab({ url });
    return;
  }
  wx.navigateTo({ url });
}

function createStarterPage(config) {
  const requiresCouple = !!config.requiresCouple;

  return {
    data: {
      title: config.title,
      navTitle: config.navTitle || config.title,
      eyebrow: config.eyebrow || '爱木长诗',
      subtitle: config.subtitle || '',
      statusText: config.statusText || '最小可用版本',
      primaryText: config.primaryText || '先记一条',
      secondaryText: config.secondaryText || '返回工具页',
      emptyTitle: config.emptyTitle || '这里还没有内容',
      emptyText: config.emptyText || '当前版本先提供轻量记录和入口，后续再接入云数据。',
      note: config.note || '本页暂未接入云数据库，当前内容只在本次打开时临时展示。',
      sceneList: config.sceneList || [],
      steps: config.steps || [],
      sampleItems: config.sampleItems || [],
      localItems: [],
      requiresCouple,
      bindingReady: !requiresCouple,
      bindingState: requiresCouple ? 'loading' : 'ready',
      bindingMessage: requiresCouple ? '正在读取绑定状态...' : '',
      loading: false,
      errorMessage: ''
    },

    async onLoad() {
      wx.setNavigationBarTitle({ title: config.navTitle || config.title });
      if (requiresCouple) await this.refreshBinding();
    },

    async onShow() {
      if (requiresCouple) await this.refreshBinding({ silent: true });
    },

    onPullDownRefresh() {
      this.refreshBinding({ silent: true }).finally(() => wx.stopPullDownRefresh());
    },

    async refreshBinding(options = {}) {
      if (!requiresCouple) return true;

      try {
        const binding = await getPageBinding();
        this.setData({
          bindingReady: !!binding.bindingReady,
          bindingState: binding.bindingState,
          bindingMessage: binding.bindingMessage,
          errorMessage: ''
        });
        return !!binding.bindingReady;
      } catch (e) {
        const message = getErrorMessage(e, '绑定状态读取失败');
        this.setData({
          bindingReady: false,
          bindingState: 'error',
          bindingMessage: message,
          errorMessage: message
        });
        if (!options.silent) wx.showToast({ title: message, icon: 'none' });
        return false;
      }
    },

    primaryTap() {
      if (requiresCouple && !this.data.bindingReady) {
        wx.showToast({ title: '请先绑定情侣关系', icon: 'none' });
        return;
      }

      if (config.primaryRoute) {
        navigateTo(config.primaryRoute);
        return;
      }

      const samples = this.data.sampleItems || [];
      const index = this.data.localItems.length % Math.max(samples.length, 1);
      const picked = samples[index] || {
        title: config.emptyTitle || '新的小记录',
        desc: config.emptyText || '后续会把这里接入正式数据。'
      };
      const item = {
        ...picked,
        _id: `${Date.now()}_${this.data.localItems.length}`
      };
      this.setData({ localItems: [item, ...this.data.localItems] });
      wx.showToast({ title: config.primaryToast || '已加入本页草稿', icon: 'none' });
    },

    secondaryTap() {
      if (config.secondaryRoute) {
        navigateTo(config.secondaryRoute);
        return;
      }
      wx.switchTab({ url: '/pages/matters/matters' });
    },

    clearLocalItems() {
      this.setData({ localItems: [] });
    },

    noop() {},

    goBind() {
      wx.switchTab({ url: '/pages/remembers/remembers' });
    },

    onShareAppMessage() {
      return {
        title: config.shareTitle || config.title,
        path: `/${config.pagePath || ''}`
      };
    }
  };
}

module.exports = { createStarterPage };
