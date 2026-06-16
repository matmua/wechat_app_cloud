// /utils/api.js
const LOCAL_DB_KEY = 'COUPLE_DB';
const MOCK_USERS = {
  userA: { name: '我(A)', avatarUrl: '/images/user_a.png' },
  userB: { name: 'Ta(B)', avatarUrl: '/images/user_b.png' },
};

function ensureLoginMock(options = {}) {
  const as = options.as || wx.getStorageSync('MOCK_AS') || 'userA';
  wx.setStorageSync('MOCK_AS', as);
  return Promise.resolve(as); // 当作 openid
}

function ensureCoupleId(options = {}) {
  let id = options.coupleId || wx.getStorageSync('coupleId');
  if (!id) {
    id = Date.now() + '_' + Math.floor(Math.random() * 100000);
    wx.setStorageSync('coupleId', id);
    initRoomIfNone(id, wx.getStorageSync('MOCK_AS') || 'userA');
  }
  return id;
}

function initRoomIfNone(coupleId, creatorOpenId) {
  const db = wx.getStorageSync(LOCAL_DB_KEY) || {};
  if (!db[coupleId]) {
    const creator = MOCK_USERS[creatorOpenId] || {};
    db[coupleId] = {
      members: [{
        openid: creatorOpenId,
        name: creator.name || '我',
        avatarUrl: creator.avatarUrl || '/images/avatar_placeholder.png'
      }]
    };
    wx.setStorageSync(LOCAL_DB_KEY, db);
  }
}

function getCoupleInfo({ coupleId }) {
  const db = wx.getStorageSync(LOCAL_DB_KEY) || {};
  const room = db[coupleId];
  if (!room) {
    initRoomIfNone(coupleId, wx.getStorageSync('MOCK_AS') || 'userA');
    return getCoupleInfo({ coupleId });
  }
  return Promise.resolve({ members: room.members || [] });
}

function mockBindPartnerAvatar({ coupleId, requesterOpenId }) {
  const db = wx.getStorageSync(LOCAL_DB_KEY) || {};
  const room = db[coupleId] || { members: [] };
  const partnerOpenId = requesterOpenId === 'userA' ? 'userB' : 'userA';
  const partnerInfo = MOCK_USERS[partnerOpenId] || {
    name: 'Ta',
    avatarUrl: '/images/user_b.png'
  };
  const idx = room.members.findIndex(m => m.openid === partnerOpenId);
  if (idx >= 0) {
    room.members[idx] = { ...room.members[idx], ...partnerInfo };
  } else {
    room.members.push({ openid: partnerOpenId, ...partnerInfo });
  }
  db[coupleId] = room;
  wx.setStorageSync(LOCAL_DB_KEY, db);
  return Promise.resolve(true);
}

module.exports = {
  ensureLoginMock,
  ensureCoupleId,
  getCoupleInfo,
  mockBindPartnerAvatar,
};
