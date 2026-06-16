const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const COL_USERS = 'users';
const COL_COUPLES = 'couples';
const COL_INVITATIONS = 'invitations';
const COL_LEGACY_COUPLES = 'remember_couples';

const DEFAULT_AVATAR_FILEID = {
  guo: 'cloud://cloud1-4gmaqc42550b0950.636c-cloud1-4gmaqc42550b0950-1391881406/images/remember/小郭.svg',
  luan: 'cloud://cloud1-4gmaqc42550b0950.636c-cloud1-4gmaqc42550b0950-1391881406/images/remember/小栾.svg'
};

function ok(data = {}) {
  return { ok: true, ...data };
}

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

function randomToken() {
  return crypto.randomBytes(18).toString('hex');
}

function sanitizeString(value, maxLen = 64) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

async function getUser(openid) {
  try {
    const res = await db.collection(COL_USERS).doc(openid).get();
    return res.data || null;
  } catch (e) {
    return null;
  }
}

async function ensureUser(openid) {
  const existed = await getUser(openid);
  if (existed) {
    await db.collection(COL_USERS).doc(openid).update({
      data: {
        lastLoginAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    return { ...existed, openid };
  }

  const user = {
    openid,
    currentCoupleId: '',
    nickName: '',
    avatarFileID: '',
    createdAt: db.serverDate(),
    updatedAt: db.serverDate(),
    lastLoginAt: db.serverDate()
  };

  await db.collection(COL_USERS).doc(openid).set({ data: user });
  return { openid, currentCoupleId: '' };
}

async function getCouple(coupleId) {
  if (!coupleId) return null;
  try {
    const res = await db.collection(COL_COUPLES).doc(coupleId).get();
    return res.data ? { _id: coupleId, ...res.data } : null;
  } catch (e) {
    return null;
  }
}

function buildStatus(openid, user, couple) {
  if (!couple) {
    return ok({
      openid,
      hasCouple: false,
      bound: false,
      coupleId: '',
      role: '',
      members: [],
      partner: null
    });
  }

  const members = couple.members || [];
  const me = members.find(item => item.openid === openid) || null;
  const partner = members.find(item => item.openid !== openid) || null;

  return ok({
    openid,
    hasCouple: true,
    bound: members.length >= 2,
    coupleId: couple._id,
    role: me ? me.role : '',
    members,
    partner,
    couple: {
      _id: couple._id,
      status: couple.status || '',
      startDate: couple.startDate || '',
      createdBy: couple.createdBy || ''
    },
    user: {
      openid,
      currentCoupleId: user.currentCoupleId || ''
    }
  });
}

async function getStatus(openid) {
  const user = await ensureUser(openid);
  if (!user.currentCoupleId) return buildStatus(openid, user, null);

  const couple = await getCouple(user.currentCoupleId);
  if (!couple) {
    await db.collection(COL_USERS).doc(openid).update({
      data: { currentCoupleId: '', updatedAt: db.serverDate() }
    });
    return buildStatus(openid, { ...user, currentCoupleId: '' }, null);
  }

  const inCouple = (couple.members || []).some(item => item.openid === openid);
  if (!inCouple) {
    await db.collection(COL_USERS).doc(openid).update({
      data: { currentCoupleId: '', updatedAt: db.serverDate() }
    });
    return buildStatus(openid, { ...user, currentCoupleId: '' }, null);
  }

  return buildStatus(openid, user, couple);
}

async function createLegacyCoupleDoc(coupleId, openid) {
  try {
    await db.collection(COL_LEGACY_COUPLES).doc(coupleId).get();
  } catch (e) {
    await db.collection(COL_LEGACY_COUPLES).doc(coupleId).set({
      data: {
        guoOpenid: openid,
        luanOpenid: '',
        guoWechatNick: '',
        luanWechatNick: '',
        nameForGuo: '',
        nameForLuan: '',
        guoAvatarFileID: DEFAULT_AVATAR_FILEID.guo,
        luanAvatarFileID: DEFAULT_AVATAR_FILEID.luan,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
  }
}

async function ensureCoupleForInvite(openid) {
  const user = await ensureUser(openid);
  if (user.currentCoupleId) {
    const couple = await getCouple(user.currentCoupleId);
    if (couple) {
      const members = couple.members || [];
      if (!members.some(item => item.openid === openid)) {
        return { error: fail('COUPLE_STATE_INVALID', '当前用户绑定状态不一致，请联系开发者处理') };
      }
      if (members.length >= 2) {
        return { error: fail('COUPLE_ALREADY_FULL', '你们已经完成绑定，无需再次邀请') };
      }
      return { user, couple };
    }

    await db.collection(COL_USERS).doc(openid).update({
      data: { currentCoupleId: '', updatedAt: db.serverDate() }
    });
  }

  const member = {
    openid,
    role: 'guo',
    displayName: '我',
    avatarFileID: '',
    joinedAt: new Date()
  };

  const add = await db.collection(COL_COUPLES).add({
    data: {
      members: [member],
      status: 'pending',
      startDate: '',
      createdBy: openid,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });

  const coupleId = add._id;
  await db.collection(COL_USERS).doc(openid).update({
    data: { currentCoupleId: coupleId, updatedAt: db.serverDate() }
  });
  await createLegacyCoupleDoc(coupleId, openid);

  const couple = await getCouple(coupleId);
  return { user: { ...user, currentCoupleId: coupleId }, couple };
}

async function createInvite(openid) {
  const ensured = await ensureCoupleForInvite(openid);
  if (ensured.error) return ensured.error;

  const { couple } = ensured;
  const token = randomToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invite = await db.collection(COL_INVITATIONS).add({
    data: {
      coupleId: couple._id,
      inviterOpenid: openid,
      inviteeOpenid: '',
      tokenHash: sha256(token),
      status: 'pending',
      expiresAt,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
      acceptedAt: null
    }
  });

  return ok({
    openid,
    coupleId: couple._id,
    inviteId: invite._id,
    token,
    hasCouple: true,
    bound: (couple.members || []).length >= 2,
    members: couple.members || []
  });
}

async function syncLegacyInvitee(coupleId, openid) {
  try {
    await db.collection(COL_LEGACY_COUPLES).doc(coupleId).update({
      data: {
        luanOpenid: openid,
        updatedAt: db.serverDate()
      }
    });
  } catch (e) {
    await db.collection(COL_LEGACY_COUPLES).doc(coupleId).set({
      data: {
        guoOpenid: '',
        luanOpenid: openid,
        guoWechatNick: '',
        luanWechatNick: '',
        nameForGuo: '',
        nameForLuan: '',
        guoAvatarFileID: DEFAULT_AVATAR_FILEID.guo,
        luanAvatarFileID: DEFAULT_AVATAR_FILEID.luan,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
  }
}

async function acceptInvite(openid, event) {
  const inviteId = sanitizeString(event.inviteId, 128);
  const token = sanitizeString(event.token, 128);
  if (!inviteId || !token) return fail('INVALID_PARAMS', '邀请参数缺失');

  const user = await ensureUser(openid);
  let invite;
  try {
    const inviteRes = await db.collection(COL_INVITATIONS).doc(inviteId).get();
    invite = inviteRes.data;
  } catch (e) {
    return fail('INVITE_NOT_FOUND', '邀请不存在或已失效');
  }

  if (!invite || invite.status !== 'pending') {
    return fail('INVITE_INVALID', '邀请已被使用或已失效');
  }
  if (invite.tokenHash !== sha256(token)) {
    return fail('INVITE_TOKEN_INVALID', '邀请校验失败');
  }
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    await db.collection(COL_INVITATIONS).doc(inviteId).update({
      data: { status: 'expired', updatedAt: db.serverDate() }
    });
    return fail('INVITE_EXPIRED', '邀请已过期，请让对方重新分享');
  }
  if (invite.inviterOpenid === openid) {
    return fail('CANNOT_ACCEPT_SELF', '不能接受自己发出的邀请');
  }

  if (user.currentCoupleId && user.currentCoupleId !== invite.coupleId) {
    return fail('USER_ALREADY_BOUND', '当前微信已经绑定了其他情侣空间');
  }

  const couple = await getCouple(invite.coupleId);
  if (!couple) return fail('COUPLE_NOT_FOUND', '情侣空间不存在');

  const members = couple.members || [];
  if (members.some(item => item.openid === openid)) {
    return buildStatus(openid, { ...user, currentCoupleId: couple._id }, couple);
  }
  if (members.length >= 2) {
    return fail('COUPLE_ALREADY_FULL', '这个情侣空间已经完成绑定');
  }

  const member = {
    openid,
    role: 'luan',
    displayName: 'Ta',
    avatarFileID: '',
    joinedAt: new Date()
  };

  await db.collection(COL_COUPLES).doc(couple._id).update({
    data: {
      members: _.addToSet(member),
      status: 'active',
      updatedAt: db.serverDate()
    }
  });
  await db.collection(COL_USERS).doc(openid).update({
    data: { currentCoupleId: couple._id, updatedAt: db.serverDate() }
  });
  await db.collection(COL_INVITATIONS).doc(inviteId).update({
    data: {
      status: 'accepted',
      inviteeOpenid: openid,
      acceptedAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
  await syncLegacyInvitee(couple._id, openid);

  const nextCouple = await getCouple(couple._id);
  return buildStatus(openid, { ...user, currentCoupleId: couple._id }, nextCouple);
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return fail('NO_OPENID', '无法获取当前用户 openid');

  const action = sanitizeString(event.action, 32);
  if (!action) return fail('INVALID_ACTION', '缺少 action 参数');

  try {
    if (action === 'ensureUser') {
      const user = await ensureUser(openid);
      return ok({
        openid,
        user: {
          openid,
          currentCoupleId: user.currentCoupleId || ''
        },
        coupleId: user.currentCoupleId || '',
        hasCouple: !!user.currentCoupleId,
        bound: false
      });
    }
    if (action === 'getStatus') return getStatus(openid);
    if (action === 'createInvite') return createInvite(openid);
    if (action === 'acceptInvite') return acceptInvite(openid, event);

    return fail('UNKNOWN_ACTION', `未知 action: ${action}`);
  } catch (e) {
    console.error('couple cloud function error:', e);
    return fail('INTERNAL_ERROR', e.message || '云函数执行失败');
  }
};
