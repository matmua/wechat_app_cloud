// utils/couple.js
const KEY = 'coupleId';
const OPENID_KEY = 'openid';

function getCoupleId() {
  return wx.getStorageSync(KEY) || '';
}

function setCoupleId(coupleId) {
  if (coupleId) wx.setStorageSync(KEY, coupleId);
  else wx.removeStorageSync(KEY);
}

// 兼容旧页面调用：不再生成或写死 coupleId，只读取当前缓存。
function ensureCoupleId() {
  return getCoupleId();
}

function normalizeError(err) {
  if (!err) return { code: 'UNKNOWN', message: '未知错误' };
  if (err.code || err.message) return err;
  return { code: 'UNKNOWN', message: String(err) };
}

async function callCouple(action, data = {}) {
  const res = await wx.cloud.callFunction({
    name: 'couple',
    data: { action, ...data }
  });

  const result = res && res.result;
  if (!result || result.ok !== true) {
    const error = normalizeError(result);
    const e = new Error(error.message || '云函数调用失败');
    e.code = error.code || 'CLOUD_FUNCTION_FAILED';
    e.detail = result;
    throw e;
  }

  if (result.openid) wx.setStorageSync(OPENID_KEY, result.openid);
  if (result.coupleId) setCoupleId(result.coupleId);
  if (result.hasCouple === false || result.coupleId === '') setCoupleId('');

  return result;
}

async function ensureUser() {
  return callCouple('ensureUser');
}

async function getBindingStatus() {
  return callCouple('getStatus');
}

function buildPageBinding(status) {
  const coupleId = status?.coupleId || '';
  const bound = !!status?.bound;
  const hasCouple = !!status?.hasCouple || !!coupleId;

  if (!coupleId || !hasCouple) {
    return {
      ...status,
      coupleId: '',
      openid: status?.openid || wx.getStorageSync(OPENID_KEY) || '',
      bindingReady: false,
      bindingState: 'unbound',
      bindingMessage: '请先在“我们”页绑定情侣关系'
    };
  }

  if (!bound) {
    return {
      ...status,
      coupleId,
      openid: status?.openid || wx.getStorageSync(OPENID_KEY) || '',
      bindingReady: false,
      bindingState: 'pending',
      bindingMessage: '情侣空间已创建，等待 Ta 接受邀请后再使用共享页面'
    };
  }

  return {
    ...status,
    coupleId,
    openid: status?.openid || wx.getStorageSync(OPENID_KEY) || '',
    bindingReady: true,
    bindingState: 'bound',
    bindingMessage: ''
  };
}

async function getPageBinding() {
  const status = await getBindingStatus();
  return buildPageBinding(status);
}

function getErrorMessage(err, fallback = '操作失败，请稍后再试') {
  if (!err) return fallback;
  return err.message || err.errMsg || fallback;
}

async function createInvite() {
  return callCouple('createInvite');
}

async function acceptInvite({ inviteId, token }) {
  return callCouple('acceptInvite', { inviteId, token });
}

module.exports = {
  KEY,
  OPENID_KEY,
  ensureCoupleId,
  getCoupleId,
  setCoupleId,
  ensureUser,
  getBindingStatus,
  buildPageBinding,
  getPageBinding,
  getErrorMessage,
  createInvite,
  acceptInvite
};
