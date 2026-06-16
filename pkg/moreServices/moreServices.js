const { createStarterPage } = require('../../utils/starterPage');

Page(createStarterPage({
  pagePath: 'pkg/moreServices/moreServices',
  navTitle: '更多服务',
  title: '更多服务',
  subtitle: '把暂时未完成的功能集中放在这里，避免工具页点进去是空白。',
  statusText: '入口总览',
  primaryText: '返回工具页',
  primaryRoute: '/pages/matters/matters',
  secondaryText: '去首页',
  secondaryRoute: '/pages/index/index',
  note: '这里是服务总览页，后续功能成熟后再逐个开放。',
  sceneList: [
    { title: '待补功能', desc: '天气、礼物、地点、小游戏。' },
    { title: '已可使用', desc: '心愿、相册、约会、纪念日、心动页。' },
    { title: '需要测试', desc: '绑定、邀请码、情侣数据隔离。' },
    { title: '以后再做', desc: 'AI 分析、导出纪念册、长期成就。' }
  ]
}));
