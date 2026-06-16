const { createStarterPage } = require('../../utils/starterPage');

Page(createStarterPage({
  pagePath: 'pkg/emotionAnalysis/emotionAnalysis',
  navTitle: '情绪分析',
  title: '情绪分析',
  subtitle: '暂时不做 AI 分析，先提供情绪复盘的轻量框架。',
  statusText: '占位功能',
  primaryText: '生成复盘问题',
  secondaryText: '去心情日记',
  secondaryRoute: '/pkg/moodDiary/moodDiary',
  emptyTitle: '还没有复盘问题',
  emptyText: '点击生成一个问题，适合情绪平稳后再看。',
  note: '本页不会读取聊天或隐私内容；正式 AI 能力后续再评估。',
  sceneList: [
    { title: '我感受到什么', desc: '先命名情绪。' },
    { title: '我需要什么', desc: '把需求说具体。' },
    { title: '对方可能在意什么', desc: '试着换位，但不替对方下结论。' },
    { title: '下一步怎么做', desc: '只定一个可执行动作。' }
  ],
  sampleItems: [
    { title: '复盘问题', desc: '这次让我不舒服的点，是事情本身，还是我没有被理解？' }
  ]
}));
