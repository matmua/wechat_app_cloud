const { createStarterPage } = require('../../utils/starterPage');

Page(createStarterPage({
  pagePath: 'pkg/loveCalendar/loveCalendar',
  navTitle: '恋爱日历',
  title: '恋爱日历',
  subtitle: '未来会把约会、纪念日、心愿都聚在一个日历里。',
  statusText: '占位功能',
  requiresCouple: true,
  primaryText: '查看纪念日',
  primaryRoute: '/pkg/memorial/memorial',
  secondaryText: '去约会记录',
  secondaryRoute: '/pkg/daterecord/daterecord',
  emptyTitle: '日历聚合还在整理',
  emptyText: '当前先提供两个核心入口，后续再做统一月历。',
  note: '本页暂未接入聚合查询，不会读取或写入业务数据。',
  sceneList: [
    { title: '纪念日', desc: '重要日期和倒计时。' },
    { title: '约会记录', desc: '每一次见面都能回看。' },
    { title: '心愿安排', desc: '把想完成的事放进日期。' },
    { title: '月底回顾', desc: '看看这个月一起做了什么。' }
  ]
}));
