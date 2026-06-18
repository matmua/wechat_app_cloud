const GROUPS = [
  { key: 'today', name: '今日常用', desc: '今天最容易用上的小工具' },
  { key: 'memory', name: '记录回忆', desc: '把一起发生的事收好' },
  { key: 'fun', name: '趣味互动', desc: '无聊时一起玩一点' },
  { key: 'practical', name: '实用工具', desc: '天气、经期和提醒' },
  { key: 'ai', name: 'AI 助手', desc: '后续接入 DeepSeek / OpenAI' },
  { key: 'later', name: '后续功能', desc: '先留入口，慢慢补齐' }
];

const TOOLS = [
  { key: 'wishlist', group: 'today', icon: '🌠', name: '心愿清单', desc: '把想一起完成的事变成愿望卡', route: '/pkg/wishlist/wishlist', status: 'ready', tags: '心愿 愿望 想做 完成' },
  { key: 'food', group: 'today', icon: '🍜', name: '美食猜猜', desc: '饭点抽卡，今天就听它的吧', route: '/pkg/loveWords/loveWords', status: 'ready', tags: '美食 吃什么 抽卡 随机' },
  { key: 'weather', group: 'today', icon: '🌦️', name: '天气卡片', desc: '看看自己和 Ta 那里的天气', route: '/pkg/weather/weather', status: 'ready', tags: '天气 位置 自己 对方' },
  { key: 'assistant', group: 'today', icon: '✨', name: '小诗助手', desc: '恋爱 AI 助手，接口待配置', route: '/pkg/moodDiary/moodDiary', status: 'ready', tags: 'AI 小诗 DeepSeek OpenAI 情话 约会' },
  { key: 'plans', group: 'today', icon: '✅', name: '今日计划', desc: '回到我们页打勾今日小事', route: '/pages/remembers/remembers', status: 'ready', tabbar: true, tags: '计划 今日 打卡 我们页' },
  { key: 'memorial', group: 'today', icon: '⏳', name: '纪念日', desc: '倒计时和重要日提醒', route: '/pkg/memorial/memorial', status: 'ready', tags: '纪念日 倒计时 日期' },

  { key: 'album', group: 'memory', icon: '🖼️', name: '甜蜜相册', desc: '照片墙和回忆盒', route: '/pkg/photoalbum/photoalbum', status: 'ready', tags: '相册 照片 回忆' },
  { key: 'dateRecord', group: 'memory', icon: '🎟️', name: '约会记录', desc: '时间轴、地点和心情', route: '/pkg/daterecord/daterecord', status: 'ready', tags: '约会 记录 地点 照片' },
  { key: 'heartbeat', group: 'memory', icon: '💗', name: '心动瞬间', desc: '碎片、纸条、金库和任务', route: '/pkg/heartbeat/heartbeat', status: 'ready', tags: '心动 纸条 金库 任务' },
  { key: 'timeline', group: 'memory', icon: '📍', name: '恋爱仪表盘', desc: '里程碑、待办和共同目标', route: '/pkg/timeline/timeline', status: 'ready', tags: '仪表盘 里程碑 目标' },
  { key: 'photoStory', group: 'memory', icon: '🎞️', name: '照片故事', desc: '后续做成单张照片故事页', route: '/pkg/photolove/photolove', status: 'later', tags: '照片 故事' },
  { key: 'memorialNote', group: 'memory', icon: '📌', name: '纪念日备忘', desc: '轻量占位，后续合并纪念日', route: '/pkg/memorialDay/memorialDay', status: 'later', tags: '纪念日 备忘' },

  { key: 'sock', group: 'fun', icon: '🧦', name: '树洞袜子', desc: '藏起来或定时掉出的悄悄话', route: '/pkg/loveTest/loveTest', status: 'ready', tags: '树洞 袜子 悄悄话 定时' },
  { key: 'games', group: 'fun', icon: '🎮', name: '打发时间', desc: '贪吃蛇、扫雷、打飞机、俄罗斯方块', route: '/pkg/loveGames/loveGames', status: 'ready', tags: '游戏 贪吃蛇 扫雷 打飞机 俄罗斯方块' },
  { key: 'call', group: 'fun', icon: '📣', name: '呼叫对方', desc: '复制一条轻巧的呼叫文案', route: '/pkg/loveTips/loveTips', status: 'ready', tags: '呼叫 文案 复制' },
  { key: 'tinyPlan', group: 'fun', icon: '📝', name: '小小计划', desc: '本地便签式的小计划板', route: '/pkg/chatTopics/chatTopics', status: 'ready', tags: '计划 便签' },
  { key: 'likes', group: 'fun', icon: '🧡', name: '大大喜欢', desc: '记录 Ta 的偏好和小习惯', route: '/pkg/dateSpots/dateSpots', status: 'ready', tags: '喜欢 偏好 收藏' },
  { key: 'surprise', group: 'fun', icon: '🎁', name: '惊喜灵感', desc: '后续补成惊喜抽屉', route: '/pkg/surpriseIdeas/surpriseIdeas', status: 'later', tags: '惊喜 灵感' },

  { key: 'period', group: 'practical', icon: '🌙', name: '经期记录', desc: '月历和关心提醒', route: '/pkg/loveStory/loveStory', status: 'ready', tags: '经期 生理期 月历 关心' },
  { key: 'datePlan', group: 'practical', icon: '🗺️', name: '约会规划', desc: '后续做成路线规划器', route: '/pkg/datePlan/datePlan', status: 'later', tags: '约会 规划 路线' },
  { key: 'gift', group: 'practical', icon: '💝', name: '礼物建议', desc: '后续接小诗助手生成建议', route: '/pkg/giftSuggest/giftSuggest', status: 'later', tags: '礼物 建议' },
  { key: 'goals', group: 'practical', icon: '🏁', name: '恋爱目标', desc: '两个人一起推进的小目标', route: '/pkg/coupleGoals/coupleGoals', status: 'ready', tags: '目标 进度' },
  { key: 'calendar', group: 'practical', icon: '📅', name: '恋爱日历', desc: '后续整合计划和纪念日', route: '/pkg/loveCalendar/loveCalendar', status: 'later', tags: '日历 计划' },
  { key: 'tasks', group: 'practical', icon: '🏅', name: '情侣任务', desc: '后续和任务日志统一', route: '/pkg/coupleTasks/coupleTasks', status: 'later', tags: '任务 打卡' },

  { key: 'aiMain', group: 'ai', icon: '✨', name: '小诗助手', desc: '恋爱陪伴、情话、约会、礼物建议', route: '/pkg/moodDiary/moodDiary', status: 'ready', tags: 'AI 小诗 助手' },
  { key: 'relationship', group: 'ai', icon: '🫶', name: '关系建议', desc: '后续由 AI 辅助生成', route: '/pkg/relationshipAdvice/relationshipAdvice', status: 'later', tags: '关系 建议 AI' },
  { key: 'emotion', group: 'ai', icon: '🪞', name: '情绪分析', desc: '后续接 AI，不自动读取隐私', route: '/pkg/emotionAnalysis/emotionAnalysis', status: 'later', tags: '情绪 分析 AI' },

  { key: 'more', group: 'later', icon: '🧰', name: '更多服务', desc: '整理后续想法和测试事项', route: '/pkg/moreServices/moreServices', status: 'later', tags: '更多 服务 后续' },
  { key: 'future1', group: 'later', icon: '🎲', name: '随机约会', desc: '后续做成抽签式约会灵感', route: '/pkg/datePlan/datePlan', status: 'later', tags: '随机 约会' },
  { key: 'future2', group: 'later', icon: '📮', name: '未来信箱', desc: '后续和树洞袜子联动', route: '/pkg/loveTest/loveTest', status: 'later', tags: '未来 信箱 树洞' }
];

function chunk(list, size) {
  const pages = [];
  for (let i = 0; i < list.length; i += size) pages.push(list.slice(i, i + size));
  return pages.length ? pages : [[]];
}

Page({
  data: {
    selectedLocation: '爱木工具箱',
    currentDate: '',
    weatherDesc: '等 Ta 同步天气',
    groups: GROUPS,
    activeGroupKey: 'today',
    activeGroupIndex: 0,
    searchValue: '',
    searchMode: false,
    toolPages: [],
    pageDots: [],
    activeToolPage: 0,
    resultText: '',
    emptyText: ''
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '工具箱' });
    this.setCurrentDate();
    this.getWeatherInfo();
    this.rebuildToolPages();
  },

  setCurrentDate() {
    const now = new Date();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const hour = now.getHours();
    const timeDesc = hour < 11 ? '早上' : hour < 18 ? '下午' : '晚上';
    this.setData({
      currentDate: `${now.getMonth() + 1}月${now.getDate()}日 星期${weekdays[now.getDay()]} ${timeDesc}`
    });
  },

  getWeatherInfo() {
    const tips = ['看看 Ta 那里的风', '给 Ta 带伞提醒', '同步自己的位置', '远方天气卡片'];
    this.setData({ weatherDesc: tips[Math.floor(Math.random() * tips.length)] });
  },

  selectGroup(e) {
    const key = e.currentTarget.dataset.key;
    const index = GROUPS.findIndex(item => item.key === key);
    if (index < 0) return;
    this.setData({
      activeGroupKey: key,
      activeGroupIndex: index,
      searchValue: '',
      searchMode: false,
      activeToolPage: 0
    }, () => this.rebuildToolPages());
  },

  onGroupSwiperChange(e) {
    const index = e.detail.current || 0;
    const group = GROUPS[index] || GROUPS[0];
    this.setData({
      activeGroupIndex: index,
      activeGroupKey: group.key,
      searchValue: '',
      searchMode: false,
      activeToolPage: 0
    }, () => this.rebuildToolPages());
  },

  onToolPageChange(e) {
    this.setData({ activeToolPage: e.detail.current || 0 });
  },

  onSearchInput(e) {
    this.setData({
      searchValue: e.detail.value || '',
      searchMode: !!(e.detail.value || '').trim(),
      activeToolPage: 0
    }, () => this.rebuildToolPages());
  },

  onSearch(e) {
    this.setData({
      searchValue: e.detail.value || this.data.searchValue,
      searchMode: !!(e.detail.value || this.data.searchValue || '').trim(),
      activeToolPage: 0
    }, () => this.rebuildToolPages());
  },

  clearSearch() {
    this.setData({
      searchValue: '',
      searchMode: false,
      activeToolPage: 0
    }, () => this.rebuildToolPages());
  },

  rebuildToolPages() {
    const keyword = (this.data.searchValue || '').trim().toLowerCase();
    const list = keyword
      ? TOOLS.filter(item => `${item.name} ${item.desc} ${item.tags}`.toLowerCase().includes(keyword))
      : TOOLS.filter(item => item.group === this.data.activeGroupKey);
    const pages = chunk(list, 6);
    this.setData({
      toolPages: pages,
      pageDots: pages.map((_, index) => index),
      resultText: keyword ? `找到 ${list.length} 个相关工具` : (GROUPS[this.data.activeGroupIndex]?.desc || ''),
      emptyText: keyword ? '没找到这个工具，换个关键词试试' : '这一组工具还在路上'
    });
  },

  openTool(e) {
    const route = e.currentTarget.dataset.route;
    const tabbar = e.currentTarget.dataset.tabbar;
    if (!route) return;
    if (tabbar) {
      wx.switchTab({ url: route });
      return;
    }
    wx.navigateTo({ url: route });
  },

  checkWeatherDetail() {
    wx.navigateTo({ url: '../../pkg/weather/weather' });
  }
});
