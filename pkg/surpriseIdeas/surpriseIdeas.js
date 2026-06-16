const { createStarterPage } = require('../../utils/starterPage');

Page(createStarterPage({
  pagePath: 'pkg/surpriseIdeas/surpriseIdeas',
  navTitle: '惊喜灵感',
  title: '惊喜灵感',
  subtitle: '不做复杂惊喜，先从小而具体的用心开始。',
  statusText: '占位功能',
  primaryText: '生成一个灵感',
  secondaryText: '去礼物建议',
  secondaryRoute: '/pkg/giftSuggest/giftSuggest',
  emptyTitle: '还没有惊喜灵感',
  emptyText: '点击生成一个小灵感，适合低预算、当天可执行。',
  note: '本页暂不保存，后续可和纪念日、礼物建议联动。',
  sceneList: [
    { title: '低预算', desc: '花费不高，但准备认真。' },
    { title: '当天可做', desc: '不用等快递。' },
    { title: '纪念日', desc: '提前安排一点仪式感。' },
    { title: '情绪修复', desc: '道歉和修复要具体。' }
  ],
  sampleItems: [
    { title: '小惊喜', desc: '把最近一张合照设成一张小卡，背面写三句具体喜欢。' }
  ]
}));
