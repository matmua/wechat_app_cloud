const db = wx.cloud.database();
const { getPageBinding, getErrorMessage } = require('../../utils/couple');

const COL_COUPLE = 'couples';
const COL_WISH = 'love_wishes';
const COL_ALBUM = 'love_album';
const COL_DATES = 'love_dates';
const COL_MEM = 'love_memorials';
const COL_NOTES = 'heartbeat_notes'; // 你如果纸条集合名不同，改这里
const COL_GOALS = 'love_goals';

function pad2(n){ return n < 10 ? '0'+n : ''+n; }
function startOfToday(){
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0,0,0,0);
}
function ymdFromDate(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function parseAnyDate(v){
  if (!v) return null;
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate(), 0,0,0,0);
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return null;
    return new Date(+m[1], +m[2]-1, +m[3], 0,0,0,0);
  }
  return null;
}
function diffDays(a, b){
  return Math.round((b.getTime() - a.getTime()) / (1000*60*60*24));
}
// 你们的开始日期：优先从缓存/数据库取不到就用固定值（你可以改成你们真实日期）
function getStartDateFallback(){
  return new Date('2023-12-15T00:00:00');
}

const MILESTONES = [
  { d: 100, label: '百日' },
  { d: 365, label: '一年' },
  { d: 520, label: '我爱你' },
  { d: 730, label: '两年' },
  { d: 1000, label: '千日' }
];

const BOX_POOL = [
  { title: '给Ta一个 20 秒的抱抱', desc: '什么都不说，就抱住。' },
  { title: '夸夸Ta三句', desc: '具体一点：比如“你今天做事好靠谱”。' },
  { title: '安排一次散步约会', desc: '15 分钟也算，重点是一起。' },
  { title: '写一张小纸条', desc: '写一句“我想到你就开心”。' },
  { title: '一起点一份甜品', desc: '然后互喂一口（可选）。' },
  { title: '今晚不带手机聊天 10 分钟', desc: '只看对方的眼睛。' },
];

Page({
  data: {
    openid: '',
    coupleId: '',
    bindingReady: false,
    bindingState: 'loading',
    bindingMessage: '正在读取绑定状态...',
    loadError: '',

    coupleTitle: '我们的仪表盘',
    daysTogether: 0,

    currentMilestone: 0,
    nextMilestone: 100,
    nextMilestoneLeft: 100,
    nextMilestoneLabel: '百日',
    milestoneProgress: 0,
    milestonesUI: [],

    bannerText: '',

    // 盲盒
    boxTitle: BOX_POOL[0].title,
    boxDesc: BOX_POOL[0].desc,

    // 待办聚合
    soonMemorial: null,
    pendingWishes: [],
    pendingWishCount: 0,
    unreadNotes: 0,

    // 成就统计
    stats: {
      wishDone: 0,
      dateCount: 0,
      photoCount: 0,
      noteCount: 0
    },

    // 共同目标
    goals: [],
    showGoalModal: false,
    goalForm: { title: '', desc: '' }
  },

  async onLoad() {
    const ok = await this.ensureBinding();
    if (ok) await this.refreshAll();
  },

  async onShow() {
    if (!this.data.coupleId) return;
    await this.refreshAll();
  },

  noop(){},

  async ensureBinding(){
    try {
      const binding = await getPageBinding();
      if (!binding.bindingReady) {
        this.setData({
          openid: binding.openid || '',
          coupleId: '',
          bindingReady: false,
          bindingState: binding.bindingState,
          bindingMessage: binding.bindingMessage,
          loadError: '',
          pendingWishes: [],
          pendingWishCount: 0,
          unreadNotes: 0,
          soonMemorial: null,
          goals: []
        });
        return false;
      }

      this.setData({
        openid: binding.openid || '',
        coupleId: binding.coupleId,
        bindingReady: true,
        bindingState: binding.bindingState,
        bindingMessage: binding.bindingMessage,
        loadError: ''
      });
      return true;
    } catch (e) {
      console.log('timeline ensureBinding fail:', e);
      this.setData({
        bindingReady: false,
        bindingState: 'error',
        bindingMessage: getErrorMessage(e, '绑定状态读取失败，请检查云函数'),
        loadError: ''
      });
      wx.showToast({ title: '绑定状态读取失败', icon: 'none' });
      return false;
    }
  },

  hasCoupleOrToast() {
    if (this.data.coupleId) return true;
    wx.showToast({ title: '请先绑定情侣关系', icon: 'none' });
    return false;
  },

  findGoal(id) {
    return (this.data.goals || []).find(x => x._id === id);
  },

  async refreshAll(){
    if (!this.data.coupleId) return;
    wx.showLoading({ title: '加载中...' });
    try{
      await Promise.all([
        this.loadCoupleAndDays(),
        this.loadTodos(),
        this.loadStats(),
        this.loadGoals()
      ]);
      this.makeBanner();
      this.setData({ loadError: '' });
    }catch(e){
      console.log(e);
      this.setData({ loadError: getErrorMessage(e, '仪表盘加载失败') });
      wx.showToast({ title: '仪表盘加载失败', icon: 'none' });
    }finally{
      wx.hideLoading();
    }
  },

  async loadCoupleAndDays(){
    const { coupleId } = this.data;
    if (!coupleId) return;
    const today = startOfToday();

    // 尝试从 remember_couples 取名字/开始日期（如果你未来要存 startDate，可直接用）
    let coupleTitle = '我们的仪表盘';
    let startDate = null;

    try{
      const doc = await db.collection(COL_COUPLE).doc(coupleId).get();
      const d = doc.data || {};
      const members = d.members || [];
      const a = members[0]?.displayName || '我';
      const b = members[1]?.displayName || 'Ta';
      coupleTitle = `${a} ❤ ${b}`;

      // 如果你以后在 couples 里加 startDate 字段（字符串或 Date），这里就能直接用
      startDate = parseAnyDate(d.startDate);
    }catch(e){
      // 没关系，fallback
    }

    if (!startDate) startDate = getStartDateFallback();

    const daysTogether = Math.max(0, diffDays(startDate, today));

    // 里程碑：当前与下一
    let currentMilestone = 0;
    let nextMilestone = MILESTONES[MILESTONES.length - 1].d;
    let nextLabel = MILESTONES[MILESTONES.length - 1].label;

    for (let i=0;i<MILESTONES.length;i++){
      if (daysTogether >= MILESTONES[i].d) currentMilestone = MILESTONES[i].d;
      if (daysTogether < MILESTONES[i].d){
        nextMilestone = MILESTONES[i].d;
        nextLabel = MILESTONES[i].label;
        break;
      }
    }

    const nextMilestoneLeft = Math.max(0, nextMilestone - daysTogether);
    const span = Math.max(1, nextMilestone - currentMilestone);
    const milestoneProgress = Math.min(100, Math.max(0, ((daysTogether - currentMilestone) / span) * 100));

    const milestonesUI = MILESTONES.map(m => ({
      d: m.d,
      label: m.label,
      unlocked: daysTogether >= m.d,
      left: Math.max(0, m.d - daysTogether)
    }));

    this.setData({
      coupleTitle,
      daysTogether,
      currentMilestone,
      nextMilestone,
      nextMilestoneLeft,
      nextMilestoneLabel: nextLabel,
      milestoneProgress,
      milestonesUI
    });
  },

  async loadTodos(){
    const { coupleId, openid } = this.data;
    if (!coupleId) return;
    const today = startOfToday();

    // 1) 7天内纪念日：取全部后本地计算 nextDays（与你纪念日页逻辑一致）
    let soonMemorial = null;
    try{
      const r = await db.collection(COL_MEM).where({ coupleId }).limit(200).get();
      const list = r.data || [];

      const mapped = list.map(it => {
        const base = parseAnyDate(it.date);
        if (!base) return null;

        const repeat = it.repeat || 'none';
        let nextDays = 0;

        if (repeat === 'yearly') {
          const y = today.getFullYear();
          const thisYear = new Date(y, base.getMonth(), base.getDate(), 0,0,0,0);
          const d0 = diffDays(today, thisYear);
          const nextDate = (d0 >= 0) ? thisYear : new Date(y+1, base.getMonth(), base.getDate(), 0,0,0,0);
          nextDays = Math.max(0, diffDays(today, nextDate));
        } else {
          nextDays = Math.max(0, diffDays(today, base));
        }

        return { _id: it._id, title: it.title || '纪念日', repeat, nextDays, date: it.date };
      }).filter(Boolean);

      const soon = mapped.filter(x => x.nextDays >= 0 && x.nextDays <= 7).sort((a,b)=>a.nextDays-b.nextDays);
      if (soon.length) {
        soonMemorial = {
          title: soon[0].title,
          nextDays: soon[0].nextDays,
          label: soon[0].nextDays === 0 ? '就是今天！' : '快要到了，提前准备一下吧～'
        };
      }
    }catch(e){
      console.log('memorial load fail', e);
    }

    // 2) 未完成心愿（最多3条）
    let pendingWishes = [];
    let pendingWishCount = 0;
    try{
      // 2) 未完成心愿（最多3条）
      try {
        const rr = await db.collection(COL_WISH)
          .where({ coupleId, status: 'todo' })
          .orderBy('priority', 'desc')
          .orderBy('createdAt', 'desc')
          .limit(3)
          .get();

        pendingWishes = (rr.data || []).map(x => ({ _id: x._id, title: x.title || '心愿' }));

        const cc = await db.collection(COL_WISH)
          .where({ coupleId, status: 'todo' })
          .count();

        pendingWishCount = cc.total || 0;
      } catch (e) {
        console.log('wish load fail', e);
      }
    }catch(e){
      console.log('wish load fail', e);
    }

    // 3) 未读纸条（如果你的 heartbeat_notes 支持 read/toOpenid）
    let unreadNotes = 0;
    try{
      if (openid) {
        const c = await db.collection(COL_NOTES).where({ coupleId, toOpenid: openid, read: false }).count();
        unreadNotes = c.total || 0;
      }
    }catch(e){
      // 如果你没有这些字段，这里会报错/为0——不影响页面使用
      unreadNotes = 0;
    }

    this.setData({ soonMemorial, pendingWishes, pendingWishCount, unreadNotes });
  },

  async loadStats(){
    const { coupleId } = this.data;
    if (!coupleId) return;

    // 成就统计：已结心愿 / 约会数 / 相册数 / 纸条总数
    const stats = { wishDone: 0, dateCount: 0, photoCount: 0, noteCount: 0 };

    try{
      const a = await db.collection(COL_WISH).where({ coupleId, status: 'done' }).count();
      stats.wishDone = a.total || 0;
    }catch(e){}

    try{
      const b = await db.collection(COL_DATES).where({ coupleId }).count();
      stats.dateCount = b.total || 0;
    }catch(e){}

    try{
      const c = await db.collection(COL_ALBUM).where({ coupleId }).count();
      stats.photoCount = c.total || 0;
    }catch(e){}

    try{
      const d = await db.collection(COL_NOTES).where({ coupleId }).count();
      stats.noteCount = d.total || 0;
    }catch(e){}

    this.setData({ stats });
  },

  async loadGoals(){
    const { coupleId } = this.data;
    if (!coupleId) return;
    try{
      const r = await db.collection(COL_GOALS).where({ coupleId }).orderBy('updatedAt', 'desc').limit(200).get();
      const goals = (r.data || []).map(x => ({
        _id: x._id,
        coupleId: x.coupleId,
        title: x.title || '目标',
        desc: x.desc || '',
        done: !!x.done
      }));
      this.setData({ goals });
    }catch(e){
      console.log('goals load fail', e);
      this.setData({ goals: [] });
    }
  },

  makeBanner(){
    const { soonMemorial, pendingWishCount, unreadNotes } = this.data;
    let text = '';
    if (soonMemorial) {
      text = soonMemorial.nextDays === 0
        ? `今天是「${soonMemorial.title}」！要不要一起拍张合照？`
        : `距离「${soonMemorial.title}」还有 ${soonMemorial.nextDays} 天，提前准备个小惊喜～`;
    } else if (unreadNotes > 0) {
      text = `你有 ${unreadNotes} 条未读小纸条，去看看Ta说了什么～`;
    } else if (pendingWishCount > 0) {
      text = `还有 ${pendingWishCount} 个心愿没完成：今天完成一个小目标？`;
    } else {
      text = `今天也要把爱存起来：写一张纸条 / 拍一张照片 / 记录一次约会。`;
    }
    this.setData({ bannerText: text });
  },

  // -------- 快捷跳转（按你项目实际路径改） --------
  goWish(){ wx.navigateTo({ url: '../../pkg/wishlist/wishlist' }); },
  goDates(){ wx.navigateTo({ url: '../../pkg/daterecord/daterecord' }); },
  goAlbum(){ wx.navigateTo({ url: '../../pkg/photoalbum/photoalbum' }); },
  goMemorial(){ wx.navigateTo({ url: '../../pkg/memorial/memorial' }); },
  goHeartbeat(){ wx.navigateTo({ url: '../../pkg/heartbeat/heartbeat' }); },

  // -------- 盲盒 --------
  rollBox(){
    const pick = BOX_POOL[Math.floor(Math.random() * BOX_POOL.length)];
    this.setData({ boxTitle: pick.title, boxDesc: pick.desc });
  },

  async saveBoxToGoal(){
    // 把盲盒内容写进共同目标
    const { coupleId, boxTitle } = this.data;
    if (!coupleId) return this.hasCoupleOrToast();

    wx.showLoading({ title: '保存中...' });
    try{
      await db.collection(COL_GOALS).add({
        data: {
          coupleId,
          title: boxTitle,
          desc: '来自今日盲盒 🎲',
          done: false,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
      wx.hideLoading();
      wx.showToast({ title: '已加入目标', icon: 'success' });
      await this.loadGoals();
    }catch(e){
      console.log(e);
      wx.hideLoading();
      wx.showToast({ title: getErrorMessage(e, '保存失败'), icon: 'none' });
    }
  },

  // -------- 共同目标 CRUD --------
  openAddGoal(){
    if (!this.hasCoupleOrToast()) return;
    this.setData({ showGoalModal: true, goalForm: { title: '', desc: '' } });
  },
  closeGoalModal(){
    this.setData({ showGoalModal: false });
  },
  onGoalTitle(e){ this.setData({ 'goalForm.title': e.detail.value }); },
  onGoalDesc(e){ this.setData({ 'goalForm.desc': e.detail.value }); },

  async saveGoal(){
    const { coupleId, goalForm } = this.data;
    if (!coupleId) return this.hasCoupleOrToast();
    const title = (goalForm.title || '').trim();
    const desc = (goalForm.desc || '').trim();
    if (!title) return wx.showToast({ title: '标题不能为空', icon: 'none' });

    wx.showLoading({ title: '保存中...' });
    try{
      await db.collection(COL_GOALS).add({
        data: {
          coupleId,
          title,
          desc,
          done: false,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
      wx.hideLoading();
      wx.showToast({ title: '已添加', icon: 'success' });
      this.setData({ showGoalModal: false });
      await this.loadGoals();
    }catch(e){
      console.log(e);
      wx.hideLoading();
      wx.showToast({ title: getErrorMessage(e, '添加失败'), icon: 'none' });
    }
  },

  async toggleGoal(e){
    if (!this.hasCoupleOrToast()) return;
    const id = e.currentTarget.dataset.id;
    const done = !!e.currentTarget.dataset.done;
    const item = this.findGoal(id);
    if (!item || item.coupleId !== this.data.coupleId) {
      wx.showToast({ title: '记录不属于当前情侣空间', icon: 'none' });
      return;
    }
    try{
      await db.collection(COL_GOALS).doc(id).update({
        data: { done: !done, updatedAt: db.serverDate() }
      });
      await this.loadGoals();
    }catch(err){
      console.log(err);
      wx.showToast({ title: getErrorMessage(err, '操作失败'), icon: 'none' });
    }
  },

  removeGoal(e){
    if (!this.hasCoupleOrToast()) return;
    const id = e.currentTarget.dataset.id;
    const item = this.findGoal(id);
    if (!item || item.coupleId !== this.data.coupleId) {
      wx.showToast({ title: '记录不属于当前情侣空间', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '删除目标',
      content: '确定删除这个共同目标吗？',
      success: async (r) => {
        if (!r.confirm) return;
        wx.showLoading({ title: '删除中...' });
        try{
          await db.collection(COL_GOALS).doc(id).remove();
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          await this.loadGoals();
        }catch(err){
          console.log(err);
          wx.hideLoading();
          wx.showToast({ title: getErrorMessage(err, '删除失败'), icon: 'none' });
        }
      }
    });
  }
});
