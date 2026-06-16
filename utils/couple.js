// utils/couple.js
const KEY = 'coupleId';

// ✅ 方案A：写死（最稳）
const FIXED_COUPLE_ID = 'c_1c3d8gct77xu';

// 如果你不想写死，改成生成一次也行（可选）
// function genCoupleId() {
//   return 'c_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(2, 6);
// }

function ensureCoupleId() {
  // 写死：永远返回同一个，并同步到缓存
  wx.setStorageSync(KEY, FIXED_COUPLE_ID);
  return FIXED_COUPLE_ID;

  // 生成一次版本（可选）：
  // let id = wx.getStorageSync(KEY);
  // if (!id) {
  //   id = genCoupleId();
  //   wx.setStorageSync(KEY, id);
  // }
  // return id;
}

function getCoupleId() {
  return wx.getStorageSync(KEY) || '';
}

module.exports = { ensureCoupleId, getCoupleId, KEY };
