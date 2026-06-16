// pages/matters/matters.js
const CLOUD_PREFIX =
  'cloud://cloud1-4gmaqc42550b0950.636c-cloud1-4gmaqc42550b0950-1391881406/images/matters/';

Page({
  data: {
    selectedLocation: '上海市',
    currentDate: '',
    weatherDesc: '晴朗',

    // ✅ 所有图标统一放这里：wxml 用 img.xxx
    img: {
      search: '',

      plan: '',
      mood: '',
      food: '',
      game: '',
      goal: '',

      socks: '',
      task: '',
      calendar: '',
      balloon: '',
      assistant: '',

      bear: '',
      doll: '',
      play: '',
      album: '',
      sound: '',

      period: '',
      placeholder: '',

      weather: '' // 天气卡片右侧的图
    }
  },

  onLoad: function () {
    this.setCurrentDate();
    this.getWeatherInfo();
    this.loadCloudImages(); // ✅ 新增：加载云端图片URL
  },

  // ✅ 新增：批量把 fileID 转 https URL
  loadCloudImages: function () {
    // key -> 文件名（文件名和你本地一致就行）
    const files = {
      search: '搜索.svg',

      plan: '规划.svg',
      mood: '心情日记.svg',
      food: '圣诞晚餐.svg',
      game: '互动.svg',
      goal: '圣诞果.svg',

      socks: '圣诞袜子.svg',
      task: '任务.svg',
      calendar: '日历.svg',
      balloon: '圣诞气球.svg',
      assistant: '助手.svg',

      bear: '圣诞小熊.svg',
      doll: '圣诞玩偶.svg',
      play: '游戏.svg',
      album: '相册.svg',
      sound: '声音.svg',

      period: '经期2.svg',
      placeholder: 'home.png', // 你 wxml 里“等待开发/更多服务”那几个用的
      weather: '彩虹转多云.svg'
    };

    const fileList = Object.keys(files).map((k) => ({
      fileID: CLOUD_PREFIX + files[k],
      maxAge: 24 * 60 * 60
    }));

    wx.cloud.getTempFileURL({
      fileList,
      success: (res) => {
        const nextImg = { ...this.data.img };
        Object.keys(files).forEach((k, idx) => {
          nextImg[k] = res.fileList?.[idx]?.tempFileURL || '';
        });
        this.setData({ img: nextImg });
      },
      fail: (err) => {
        console.log('getTempFileURL 失败', err);
        wx.showToast({ title: '云图片加载失败', icon: 'none' });
      }
    });
  },

  // 设置当前日期
  setCurrentDate: function () {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekday = weekdays[now.getDay()];
    const hours = now.getHours();

    let timeDesc = '';
    if (hours >= 6 && hours < 12) {
      timeDesc = '早上';
    } else if (hours >= 12 && hours < 18) {
      timeDesc = '下午';
    } else {
      timeDesc = '晚上';
    }

    this.setData({
      currentDate: `${month}月${date}日 星期${weekday} ${timeDesc}`
    });
  },

  // 获取天气信息 (模拟)
  getWeatherInfo: function () {
    const weatherOptions = ['晴朗', '多云', '微风', '温暖'];
    const randomWeather = weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
    this.setData({
      weatherDesc: randomWeather
    });
  },

  // 地点选择
  onLocationChange: function (e) {
    const locations = ['上海市浦东新区', '上海市黄浦区', '上海市静安区', '北京市朝阳区'];
    this.setData({
      selectedLocation: locations[e.detail.value] || locations[0]
    });
  },

  // 搜索功能
  onSearch: function (e) {
    const searchValue = e.detail.value;
    console.log('搜索内容:', searchValue);
  },

  // 查看详细天气
  checkWeatherDetail: function () {
    wx.navigateTo({
      url: '../../pkg/weather/weather'
    });
  },

  // 约会规划
  goToDatePlan: function () {
    wx.navigateTo({
      url: '../../pkg/datePlan/datePlan'
    });
  },

  // 礼物推荐
  goToGiftSuggest: function () {
    wx.navigateTo({
      url: '../../pkg/giftSuggest/giftSuggest'
    });
  },

  // 情话大全
  goToLoveWords: function () {
    wx.navigateTo({
      url: '../../pkg/loveWords/loveWords'
    });
  },

  // 纪念日
  goToMemorialDay: function () {
    wx.navigateTo({
      url: '../../pkg/memorialDay/memorialDay'
    });
  },

  // 情侣相册
  goToPhotoAlbum: function () {
    wx.navigateTo({
      url: '../../pkg/photoalbum/photoalbum'
    });
  },

  // 爱情测试
  goToLoveTest: function () {
    wx.navigateTo({
      url: '../../pkg/loveTest/loveTest'
    });
  },

  // 情侣任务
  goToCoupleTasks: function () {
    wx.navigateTo({
      url: '../../pkg/coupleTasks/coupleTasks'
    });
  },

  // 恋爱日历
  goToLoveCalendar: function () {
    wx.navigateTo({
      url: '../../pkg/loveCalendar/loveCalendar'
    });
  },

  // 恋爱技巧
  goToLoveTips: function () {
    wx.navigateTo({
      url: '../../pkg/loveTips/loveTips'
    });
  },

  // 心情日记
  goToMoodDiary: function () {
    wx.navigateTo({
      url: '../../pkg/moodDiary/moodDiary'
    });
  },

  // 聊天话题
  goToChatTopics: function () {
    wx.navigateTo({
      url: '../../pkg/chatTopics/chatTopics'
    });
  },

  // 约会地点
  goToDateSpots: function () {
    wx.navigateTo({
      url: '../../pkg/dateSpots/dateSpots'
    });
  },

  // 情侣游戏
  goToLoveGames: function () {
    wx.navigateTo({
      url: '../../pkg/loveGames/loveGames'
    });
  },

  // 感情建议
  goToRelationshipAdvice: function () {
    wx.navigateTo({
      url: '../../pkg/relationshipAdvice/relationshipAdvice'
    });
  },

  // 心愿清单
  goToWishList: function () {
    wx.navigateTo({
      url: '../../pkg/wishlist/wishlist'
    });
  },

  // 爱情故事
  goToLoveStory: function () {
    wx.navigateTo({
      url: '../../pkg/loveStory/loveStory'
    });
  },

  // 惊喜创意
  goToSurpriseIdeas: function () {
    wx.navigateTo({
      url: '../../pkg/surpriseIdeas/surpriseIdeas'
    });
  },

  // 恋爱目标
  goToCoupleGoals: function () {
    wx.navigateTo({
      url: '../../pkg/coupleGoals/coupleGoals'
    });
  },

  // 情感分析
  goToEmotionAnalysis: function () {
    wx.navigateTo({
      url: '../../pkg/emotionAnalysis/emotionAnalysis'
    });
  },

  // 更多服务
  goToMoreServices: function () {
    wx.navigateTo({
      url: '../../pkg/moreServices/moreServices'
    });
  }
});
