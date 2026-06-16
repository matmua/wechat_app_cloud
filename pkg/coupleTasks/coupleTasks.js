const { createStarterPage } = require('../../utils/starterPage');

Page(createStarterPage({
  pagePath: 'pkg/coupleTasks/coupleTasks',
  navTitle: '情侣任务',
  title: '情侣任务',
  subtitle: '把“今天做一点点”的小任务放在这里，正式任务先由心动页承接。',
  statusText: '入口整理',
  requiresCouple: true,
  primaryText: '加一个任务草稿',
  secondaryText: '去心动任务',
  secondaryRoute: '/pkg/heartbeat/heartbeat',
  emptyTitle: '还没有任务草稿',
  emptyText: '当前只做轻量草稿，真正打卡请使用心动页的任务 Tab。',
  note: '后续可以把情侣任务和心动金库做成统一任务系统。',
  sceneList: [
    { title: '每日一句', desc: '认真夸对方一句。' },
    { title: '一起整理', desc: '十分钟把一件小事做完。' },
    { title: '共同计划', desc: '为周末定一个小目标。' },
    { title: '复盘时刻', desc: '睡前说今天最开心的一件事。' }
  ],
  sampleItems: [
    { title: '今晚任务', desc: '不看手机聊十分钟，主题是“今天最想感谢你的事”。' }
  ]
}));
