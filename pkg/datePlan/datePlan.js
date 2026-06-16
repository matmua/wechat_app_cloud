const { createStarterPage } = require('../../utils/starterPage');

Page(createStarterPage({
  pagePath: 'pkg/datePlan/datePlan',
  navTitle: '约会规划',
  title: '约会规划',
  subtitle: '把想去的地方、预算和时间先排成一个温柔的小计划。',
  statusText: '最小可用版本',
  requiresCouple: true,
  primaryText: '加一条计划草稿',
  secondaryText: '去约会记录',
  secondaryRoute: '/pkg/daterecord/daterecord',
  emptyTitle: '还没有计划草稿',
  emptyText: '当前版本先做本页临时草稿，正式版本会写入情侣空间。',
  note: '本页暂未写入数据库；真正的约会记录请先使用“约会记录”页面。',
  sceneList: [
    { title: '半日安排', desc: '午饭、电影、散步三段式。' },
    { title: '预算提醒', desc: '先写一个大概花费，避免当天纠结。' },
    { title: '备选地点', desc: '下雨或排队时有第二方案。' },
    { title: '小惊喜', desc: '给对方留一个不剧透的小环节。' }
  ],
  steps: ['先写主题', '补时间和地点', '约会后转成正式记录'],
  sampleItems: [
    { title: '周末轻约会', desc: '下午看展，晚饭选一家不用排太久的小店。' },
    { title: '下雨备选', desc: '室内咖啡店加桌游，路程控制在 30 分钟内。' }
  ]
}));
