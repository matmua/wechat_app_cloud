const { createStarterPage } = require('../../utils/starterPage');

Page(createStarterPage({
  pagePath: 'pkg/giftSuggest/giftSuggest',
  navTitle: '礼物建议',
  title: '礼物建议',
  subtitle: '先按场景收集灵感，后续再做预算、纪念日和偏好联动。',
  statusText: '占位功能',
  primaryText: '生成礼物灵感',
  secondaryText: '去心愿清单',
  secondaryRoute: '/pkg/wishlist/wishlist',
  emptyTitle: '还没有礼物灵感',
  emptyText: '点击生成一条灵感，适合先做选题，不会写入数据库。',
  note: '本页暂未接入云数据；想长期保存请添加到“心愿清单”。',
  sceneList: [
    { title: '实用型', desc: '日常会用、不会闲置。' },
    { title: '纪念型', desc: '和你们的共同回忆有关。' },
    { title: '体验型', desc: '一顿饭、一次展、一次旅行。' },
    { title: '小预算', desc: '不贵，但能看出认真。' }
  ],
  sampleItems: [
    { title: '照片小卡套装', desc: '挑 6 张照片，写每张背后的片刻。' },
    { title: '一起完成的体验券', desc: '比如一次手作、一场展览、一顿认真挑的晚饭。' }
  ]
}));
