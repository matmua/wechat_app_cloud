const { getPageBinding, getErrorMessage } = require('./couple');

function nowIso() {
  return new Date().toISOString();
}

function pad(num) {
  return `${num}`.padStart(2, '0');
}

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${date.getMonth() + 1}月${date.getDate()}日 星期${weekdays[date.getDay()]}`;
}

function localKey(collection, coupleId) {
  return `${collection}_${coupleId || 'unbound'}`;
}

function readLocalList(collection, coupleId) {
  return wx.getStorageSync(localKey(collection, coupleId)) || [];
}

function writeLocalList(collection, coupleId, list) {
  wx.setStorageSync(localKey(collection, coupleId), list || []);
}

function makeLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isLocalId(id) {
  return String(id || '').startsWith('local_');
}

function matchesWhere(item, where = {}) {
  return Object.keys(where).every((key) => {
    if (where[key] === undefined || where[key] === null || where[key] === '') return true;
    return item[key] === where[key];
  });
}

function sortList(list, field = 'updatedAt', direction = 'desc') {
  const factor = direction === 'asc' ? 1 : -1;
  return (list || []).slice().sort((a, b) => {
    const av = a[field] || '';
    const bv = b[field] || '';
    return String(av).localeCompare(String(bv)) * factor;
  });
}

async function loadList(collection, coupleId, options = {}) {
  const where = { ...(options.where || {}) };
  if (coupleId) where.coupleId = coupleId;
  const orderBy = options.orderBy || 'updatedAt';
  const direction = options.direction || 'desc';
  const limit = options.limit || 100;

  try {
    let query = wx.cloud.database().collection(collection).where(where);
    if (orderBy) query = query.orderBy(orderBy, direction);
    const res = await query.limit(limit).get();
    return { list: res.data || [], storage: 'cloud' };
  } catch (error) {
    const list = sortList(
      readLocalList(collection, coupleId).filter(item => matchesWhere(item, where)),
      orderBy,
      direction
    ).slice(0, limit);
    return { list, storage: 'local', error };
  }
}

async function addItem(collection, coupleId, data) {
  const payload = {
    ...data,
    coupleId,
    createdAt: data.createdAt || nowIso(),
    updatedAt: nowIso()
  };

  try {
    const res = await wx.cloud.database().collection(collection).add({ data: payload });
    return { item: { ...payload, _id: res._id }, storage: 'cloud' };
  } catch (error) {
    const list = readLocalList(collection, coupleId);
    const item = { ...payload, _id: makeLocalId() };
    list.unshift(item);
    writeLocalList(collection, coupleId, list);
    return { item, storage: 'local', error };
  }
}

async function updateItem(collection, coupleId, id, patch) {
  const payload = { ...patch, updatedAt: nowIso() };
  if (!id) throw new Error('缺少记录 ID');

  if (!isLocalId(id)) {
    try {
      await wx.cloud.database().collection(collection).doc(id).update({ data: payload });
      return { storage: 'cloud' };
    } catch (error) {
      const list = readLocalList(collection, coupleId);
      const index = list.findIndex(item => item._id === id);
      if (index >= 0) {
        list[index] = { ...list[index], ...payload };
        writeLocalList(collection, coupleId, list);
      }
      return { storage: 'local', error };
    }
  }

  const list = readLocalList(collection, coupleId);
  const index = list.findIndex(item => item._id === id);
  if (index >= 0) {
    list[index] = { ...list[index], ...payload };
    writeLocalList(collection, coupleId, list);
  }
  return { storage: 'local' };
}

async function removeItem(collection, coupleId, id) {
  if (!id) throw new Error('缺少记录 ID');

  if (!isLocalId(id)) {
    try {
      await wx.cloud.database().collection(collection).doc(id).remove();
      return { storage: 'cloud' };
    } catch (error) {
      const list = readLocalList(collection, coupleId).filter(item => item._id !== id);
      writeLocalList(collection, coupleId, list);
      return { storage: 'local', error };
    }
  }

  const list = readLocalList(collection, coupleId).filter(item => item._id !== id);
  writeLocalList(collection, coupleId, list);
  return { storage: 'local' };
}

function applyStorageNotice(page, storage, error) {
  if (storage === 'local') {
    page.setData({
      storageMode: 'local',
      errorMessage: error ? '云端暂不可用，已先切到本地测试数据' : page.data.errorMessage
    });
    return;
  }
  page.setData({ storageMode: 'cloud', errorMessage: '' });
}

async function initBoundPage(page) {
  page.setData({ bindingLoading: true, errorMessage: '' });
  try {
    const binding = await getPageBinding();
    page.setData({
      bindingLoading: false,
      bindingReady: binding.bindingReady,
      bindingState: binding.bindingState,
      bindingMessage: binding.bindingMessage,
      coupleId: binding.coupleId || '',
      openid: binding.openid || ''
    });
    return binding;
  } catch (error) {
    page.setData({
      bindingLoading: false,
      bindingReady: false,
      bindingState: 'error',
      bindingMessage: getErrorMessage(error, '绑定状态读取失败'),
      errorMessage: getErrorMessage(error, '绑定状态读取失败')
    });
    return null;
  }
}

function requireBound(page) {
  if (page.data.bindingReady && page.data.coupleId) return true;
  wx.showToast({ title: '请先绑定情侣关系', icon: 'none' });
  return false;
}

module.exports = {
  nowIso,
  dateKey,
  dateLabel,
  readLocalList,
  writeLocalList,
  isLocalId,
  loadList,
  addItem,
  updateItem,
  removeItem,
  applyStorageNotice,
  initBoundPage,
  requireBound
};
