// pages/couple/remembers.js
const { getCoupleId, ensureCoupleId } = require('../../utils/couple');

const db = wx.cloud.database();
const COL = 'remember_couples';

const AVATAR_FILEID = {
  guo: 'cloud://cloud1-4gmaqc42550b0950.636c-cloud1-4gmaqc42550b0950-1391881406/images/remember/小郭.svg',
  luan: 'cloud://cloud1-4gmaqc42550b0950.636c-cloud1-4gmaqc42550b0950-1391881406/images/remember/小栾.svg',
};

function genCoupleId() {
  return 'c_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(2, 6);
}

Page({
  data: {
    openid: '',
    coupleId: '',

    selfName: '我',
    selfAvatarUrl: '',
    partnerName: '',
    partnerAvatarUrl: ''
  },

  async onLoad(options) {
    const loginRes = await wx.cloud.callFunction({ name: 'login' });
    const openid = loginRes?.result?.openid || '';
  
    // ✅ 优先：分享链接参数 > 本地缓存（由首页 ensure 过）> 最后兜底 ensure（写死方案不会变）
    let coupleId = options.coupleId || getCoupleId();
    if (!coupleId) coupleId = ensureCoupleId();
  
    this.setData({ openid, coupleId });
  
    await this.ensureDoc();
    await this.bindRoleIfNeeded(options);
    await this.refresh();
  },
  
  

  async onShow() {
    if (this.data.coupleId) await this.refresh();
  },

  async ensureDoc() {
    const { coupleId } = this.data;
    try {
      await db.collection(COL).doc(coupleId).get();
    } catch {
      await db.collection(COL).doc(coupleId).set({
        data: {
          guoOpenid: '',
          luanOpenid: '',
          guoWechatNick: '',
          luanWechatNick: '',
          nameForGuo: '',
          nameForLuan: '',
          // ✅ 新增：头像 fileID（默认用你给的两张 SVG）
          guoAvatarFileID: AVATAR_FILEID.guo,
          luanAvatarFileID: AVATAR_FILEID.luan,
          updatedAt: db.serverDate()
        }
      });
    }
  },  

  async changeMyAvatar() {
    const { coupleId, openid } = this.data;
  
    const doc = await db.collection(COL).doc(coupleId).get();
    const d = doc.data || {};
    const myRole = (d.guoOpenid === openid) ? 'guo' : (d.luanOpenid === openid ? 'luan' : '');
    if (!myRole) return wx.showToast({ title: '尚未绑定身份', icon: 'none' });
  
    try {
      const pick = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });
      const filePath = pick.tempFilePaths?.[0];
      if (!filePath) return;
  
      wx.showLoading({ title: '上传头像...' });
  
      // ✅ 用固定 cloudPath：同一个人再次上传会覆盖（更省空间 & 永远最新）
      const cloudPath = `remember/avatar/${coupleId}/${myRole}.jpg`;
      const up = await wx.cloud.uploadFile({ cloudPath, filePath });
  
      const field = (myRole === 'guo') ? 'guoAvatarFileID' : 'luanAvatarFileID';
  
      await db.collection(COL).doc(coupleId).update({
        data: {
          [field]: up.fileID,
          updatedAt: db.serverDate()
        }
      });
  
      wx.hideLoading();
      wx.showToast({ title: '头像已更新', icon: 'success' });
  
      await this.refresh();
    } catch (e) {
      console.log('changeMyAvatar error:', e);
      wx.hideLoading();
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
  },
  

  // 绑定身份：默认你是小郭；分享给她时强制 role=luan
  async bindRoleIfNeeded(options) {
    const { coupleId, openid } = this.data;
    const doc = await db.collection(COL).doc(coupleId).get();
    const d = doc.data || {};

    if (d.guoOpenid === openid || d.luanOpenid === openid) return;

    const role = options.role; // 'guo' or 'luan'
    if (role === 'luan') {
      if (d.luanOpenid && d.luanOpenid !== openid) {
        wx.showToast({ title: '小栾身份已被绑定', icon: 'none' });
        return;
      }
      await db.collection(COL).doc(coupleId).update({
        data: { luanOpenid: openid, updatedAt: db.serverDate() }
      });
      return;
    }

    // 默认：先绑定小郭
    if (!d.guoOpenid) {
      await db.collection(COL).doc(coupleId).update({
        data: { guoOpenid: openid, updatedAt: db.serverDate() }
      });
      return;
    }

    // 如果小郭已经有人了（极少），再绑定小栾
    if (!d.luanOpenid) {
      await db.collection(COL).doc(coupleId).update({
        data: { luanOpenid: openid, updatedAt: db.serverDate() }
      });
      return;
    }
  },

  // 每次打开自动刷新：最新头像（覆盖同名文件即可更新）+ 最新昵称
  async refresh() {
    const { coupleId, openid } = this.data;
  
    const doc = await db.collection(COL).doc(coupleId).get();
    const d = doc.data || {};
  
    const myRole =
      d.guoOpenid === openid ? 'guo' :
      d.luanOpenid === openid ? 'luan' : '';
  
    if (!myRole) return;
  
    const partnerRole = myRole === 'guo' ? 'luan' : 'guo';
  
    // ✅ 从数据库读头像 fileID（没有就用默认）
    const myAvatarFileID =
      (myRole === 'guo' ? d.guoAvatarFileID : d.luanAvatarFileID) || AVATAR_FILEID[myRole];
  
    const partnerAvatarFileID =
      (partnerRole === 'guo' ? d.guoAvatarFileID : d.luanAvatarFileID) || AVATAR_FILEID[partnerRole];
  
    // ✅ 取临时链接 + 时间戳破缓存（让换头像立刻生效）
    const urlRes = await wx.cloud.getTempFileURL({
      fileList: [
        { fileID: myAvatarFileID, maxAge: 24 * 60 * 60 },
        { fileID: partnerAvatarFileID, maxAge: 24 * 60 * 60 },
      ],
    });
  
    const ts = Date.now();
    const myUrl = (urlRes.fileList?.[0]?.tempFileURL || '') + `?t=${ts}`;
    const partnerUrl = (urlRes.fileList?.[1]?.tempFileURL || '') + `?t=${ts}`;
  
    // 昵称规则
    const myWechat = myRole === 'guo' ? d.guoWechatNick : d.luanWechatNick;
    const partnerWechat = partnerRole === 'guo' ? d.guoWechatNick : d.luanWechatNick;
  
    const nameForMe = myRole === 'guo' ? d.nameForGuo : d.nameForLuan;
    const nameForPartner = partnerRole === 'guo' ? d.nameForGuo : d.nameForLuan;
  
    this.setData({
      selfName: nameForMe || myWechat || '我',
      selfAvatarUrl: myUrl,
      partnerName: nameForPartner || partnerWechat || (partnerRole === 'guo' ? '小郭' : '小栾'),
      partnerAvatarUrl: partnerUrl,
    });
  },
  

  // 点左侧头像：同步“我的微信昵称”（需要用户点击授权，无法静默）
  onMe() {
    wx.showActionSheet({
      itemList: ['同步微信昵称', '更换我的头像'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          await this.syncWechatNick();
        } else if (res.tapIndex === 1) {
          await this.changeMyAvatar();
        }
      }
    });
  },
  syncWechatNick() {
    const { coupleId, openid } = this.data;
  
    wx.getUserProfile({
      desc: '用于显示情侣昵称',
      success: async (res) => {
        const nick = res?.userInfo?.nickName || '';
        if (!nick) return;
  
        const doc = await db.collection(COL).doc(coupleId).get();
        const d = doc.data || {};
        const myRole = (d.guoOpenid === openid) ? 'guo' : (d.luanOpenid === openid ? 'luan' : '');
        if (!myRole) return;
  
        const data = { updatedAt: db.serverDate() };
        if (myRole === 'guo') data.guoWechatNick = nick;
        else data.luanWechatNick = nick;
  
        await db.collection(COL).doc(coupleId).update({ data });
        wx.showToast({ title: '已同步微信昵称', icon: 'success' });
        await this.refresh();
      },
      fail: () => wx.showToast({ title: '未授权，无法读取昵称', icon: 'none' })
    });
  },
  

  // 点右侧昵称：修改“对方昵称”（自己不能改自己）
  async onEditPartnerName() {
    const { coupleId, openid } = this.data;
    const doc = await db.collection(COL).doc(coupleId).get();
    const d = doc.data || {};

    const myRole = (d.guoOpenid === openid) ? 'guo' : (d.luanOpenid === openid ? 'luan' : '');
    if (!myRole) return;

    const field = (myRole === 'guo') ? 'nameForLuan' : 'nameForGuo';

    wx.showModal({
      title: '修改Ta的昵称',
      editable: true,
      placeholderText: '输入新的昵称',
      success: async (r) => {
        if (!r.confirm) return;
        const newName = (r.content || '').trim();
        if (!newName) return wx.showToast({ title: '昵称不能为空', icon: 'none' });

        await db.collection(COL).doc(coupleId).update({
          data: { [field]: newName, updatedAt: db.serverDate() }
        });
        wx.showToast({ title: '已更新', icon: 'success' });
        await this.refresh();
      }
    });
  },

  onInviteOrEditPartner() {
    wx.showShareMenu({ withShareTicket: true });
    wx.showToast({ title: '点右上角·分享给Ta进入绑定', icon: 'none' });
  },

  onShareAppMessage() {
    const { coupleId } = this.data;
    return {
      title: 'remembers 绑定',
      // ✅ 强制她绑定成小栾
      path: `/pages/couple/index?coupleId=${coupleId}&role=luan`
    };
  }
});
