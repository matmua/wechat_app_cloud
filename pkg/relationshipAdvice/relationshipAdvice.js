const { createStarterPage } = require('../../utils/starterPage');

Page(createStarterPage({
  pagePath: 'pkg/relationshipAdvice/relationshipAdvice',
  navTitle: '关系建议',
  title: '关系建议',
  subtitle: '当情绪上来时，先看一条能落地的沟通建议。',
  statusText: '占位功能',
  primaryText: '抽一条建议',
  secondaryText: '去恋爱小贴士',
  secondaryRoute: '/pkg/loveTips/loveTips',
  emptyTitle: '还没有建议',
  emptyText: '点击抽一条建议，先作为沟通前的小提醒。',
  note: '本页暂不做 AI 分析，也不会读取聊天内容。',
  sceneList: [
    { title: '表达需求', desc: '说清楚你希望发生什么。' },
    { title: '接住情绪', desc: '先理解，再解决。' },
    { title: '修复关系', desc: '争执后要有一个收尾动作。' },
    { title: '保持边界', desc: '亲密也需要舒服的空间。' }
  ],
  sampleItems: [
    { title: '沟通建议', desc: '把“你怎么总是”换成“我会有点难过，因为我需要”。' }
  ]
}));
