const { createStarterPage } = require('../../utils/starterPage');

Page(createStarterPage({
  pagePath: 'pkg/memorialDay/memorialDay',
  navTitle: '纪念日备忘',
  title: '纪念日备忘',
  subtitle: '这是纪念日功能的轻入口，正式增删改请使用已完成的纪念日页面。',
  statusText: '入口整理',
  requiresCouple: true,
  primaryText: '加一个备忘草稿',
  secondaryText: '打开纪念日',
  secondaryRoute: '/pkg/memorial/memorial',
  emptyTitle: '还没有备忘草稿',
  emptyText: '当前页面只做提醒入口，正式记录会放在“纪念日”页面。',
  note: '后续建议把这个页面合并到“纪念日”，避免两个入口重复。',
  sceneList: [
    { title: '重要日期', desc: '恋爱纪念、生日、第一次见面。' },
    { title: '提前提醒', desc: '重要日子前几天开始准备。' },
    { title: '礼物联动', desc: '后续和礼物建议打通。' },
    { title: '年度重复', desc: '每年自动算下一次。' }
  ],
  sampleItems: [
    { title: '提前一周准备', desc: '重要日子前七天开始想小惊喜。' }
  ]
}));
