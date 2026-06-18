# 页面完成度与 UI 优化清单

## 1. 本次扫描结论

本次扫描了 `app.json`、`pages/`、`pkg/` 和 `components/`。当前小程序共注册 29 个页面，主包 3 个页面，`pkg` 分包 26 个页面；页面文件齐全，没有发现 `app.json` 注册但缺少 `.js/.json/.wxml/.wxss` 的页面。`components/` 当前没有可复用组件，本次没有新增大型组件或第三方 UI 库。

本阶段重点处理原先空页面和半成品工具页，将 20 个页面补成“最小可用版本”：有标题、说明、场景卡片、空状态、主要按钮、次要入口；需要情侣关系的页面会先读取绑定状态，未绑定时提示“请先绑定情侣关系”，不会写入业务数据。当前这些页面大多仍是占位或轻量草稿，不伪装成已完成云数据功能。

## 2. 页面完成度清单

| 页面路径 | 页面名称 | 当前状态 | 主要问题 | 本次是否修改 | 后续建议 |
| --- | --- | --- | --- | --- | --- |
| `pages/index/index` | 首页 | 已有首页入口和统计展示 | 首页样式和旧文案仍需统一；统计依赖云数据和绑定状态，需要真机复测 | 否 | 后续统一首页视觉，并检查未绑定时统计是否完全为空状态 |
| `pages/matters/matters` | 工具页 | 已有功能宫格入口 | 部分入口原名称不一致；搜索目前偏占位；卡片和按钮视觉不统一 | 是 | 后续让搜索真正过滤入口，并按“核心/占位”分组 |
| `pages/remembers/remembers` | 我们页 | 已有用户初始化、绑定状态、邀请码绑定、可选分享 | 仍有部分区块是占位内容；需要双人完整测试 | 否 | 后续真机测试生成邀请码、复制、输入、绑定成功/失败 |
| `pkg/wishlist/wishlist` | 心愿清单 | 已接入云数据，按 `coupleId` 读写 | 复杂表单和按钮样式仍有精修空间 | 否 | 后续真机验证新增、完成、删除、上传图片 |
| `pkg/daterecord/daterecord` | 约会记录 | 已接入云数据，按 `coupleId` 读写 | 日历、海报、图片上传链路较复杂，需集中测试 | 否 | 后续验证地图权限、日期筛选、海报保存 |
| `pkg/heartbeat/heartbeat` | 心动瞬间 | 已接入心动瞬间、纸条、心动银行、任务日志 | 页面较复杂，按钮和弹窗仍需二次 UI 精修 | 否 | 后续验证四类集合读写、语音/图片、未读纸条 |
| `pkg/photoalbum/photoalbum` | 甜蜜相册 | 已接入云数据和云存储 | 批量图片和临时链接失败场景需真机验证 | 否 | 后续验证上传、预览、删除、空状态 |
| `pkg/memorial/memorial` | 纪念日 | 已接入云数据 | 日期选择、提醒文案和样式还可优化 | 否 | 后续验证新增、编辑、删除、按日期排序 |
| `pkg/timeline/timeline` | 时光回顾 | 已聚合多个业务集合 | 依赖多个集合，失败场景较多 | 否 | 后续验证每个集合为空、权限失败、部分集合失败 |
| `pkg/weather/weather` | 天气提醒 | 最小可用占位 | 未接入真实天气接口；仅本地临时提醒 | 是 | 后续决定是否接入天气 API 或只作为生活提醒 |
| `pkg/datePlan/datePlan` | 约会规划 | 最小可用占位，需要绑定 | 暂不写数据库，长期计划仍应进入约会记录 | 是 | 后续可设计 `date_plans` 集合或合并到 `love_dates` |
| `pkg/giftSuggest/giftSuggest` | 礼物建议 | 最小可用占位 | 未接入心愿清单联动，只提供灵感卡片 | 是 | 后续可一键转入心愿清单 |
| `pkg/loveWords/loveWords` | 甜言小纸条 | 最小可用占位 | 未接入纸条集合，仅提供话术草稿 | 是 | 后续可跳转或合并到心动瞬间纸条 |
| `pkg/memorialDay/memorialDay` | 纪念日备忘 | 最小可用占位，需要绑定 | 与 `pkg/memorial/memorial` 功能重复 | 是 | 后续建议合并入口，避免两个纪念日页面分裂 |
| `pkg/photolove/photolove` | 照片故事 | 最小可用占位，需要绑定 | 与相册相关但暂不上传图片 | 是 | 后续可作为相册故事模板，或合并到相册详情 |
| `pkg/loveTest/loveTest` | 默契测试 | 最小可用占位 | 目前只有题目灵感和临时记录 | 是 | 后续补题库、双方作答和结果页 |
| `pkg/coupleTasks/coupleTasks` | 情侣任务 | 最小可用占位，需要绑定 | 与心动瞬间任务日志部分重复 | 是 | 后续决定是否独立任务页，或并入心动任务 |
| `pkg/loveCalendar/loveCalendar` | 恋爱日历 | 最小可用占位，需要绑定 | 未聚合纪念日、约会、任务数据 | 是 | 后续可作为聚合日历，只读展示多个集合 |
| `pkg/loveTips/loveTips` | 恋爱小贴士 | 最小可用占位 | 静态建议，不需要云数据 | 是 | 后续可做每日一条和收藏 |
| `pkg/moodDiary/moodDiary` | 小诗助手 | AI 接口待配置 | 保留 AI 助手定位，已预留 `aiChat` 云函数调用；真实 DeepSeek / OpenAI API 待后续配置 | 是 | 后续新增 `cloudfunctions/aiChat`，API key 只放云函数环境变量 |
| `pkg/chatTopics/chatTopics` | 聊天话题 | 最小可用占位 | 静态话题卡片，不需要绑定 | 是 | 后续可加随机抽题和收藏 |
| `pkg/dateSpots/dateSpots` | 约会地点 | 最小可用占位 | 未接入地图服务和地点库 | 是 | 后续可结合 `chooseLocation`，转入约会规划 |
| `pkg/loveGames/loveGames` | 情侣小游戏 | 最小可用占位 | 只有轻量互动入口 | 是 | 后续可补 1-2 个真正可玩的小游戏 |
| `pkg/relationshipAdvice/relationshipAdvice` | 关系建议 | 最小可用占位 | 静态建议，未形成记录闭环 | 是 | 后续可和心情日记、聊天话题联动 |
| `pkg/loveStory/loveStory` | 爱情故事 | 最小可用占位，需要绑定 | 暂未接入云数据；与时光回顾有重叠 | 是 | 后续可基于相册、约会、纪念日自动生成故事线 |
| `pkg/surpriseIdeas/surpriseIdeas` | 惊喜灵感 | 最小可用占位 | 未接入提醒、预算或心愿清单 | 是 | 后续可一键转入心愿或约会计划 |
| `pkg/coupleGoals/coupleGoals` | 恋爱目标 | 最小可用占位，需要绑定 | 与时光回顾目标统计可能重复 | 是 | 后续设计目标集合和进度记录 |
| `pkg/emotionAnalysis/emotionAnalysis` | 情绪分析 | 最小可用占位 | 目前不做真实分析，只给记录建议 | 是 | 后续先补心情数据，再考虑分析 |
| `pkg/moreServices/moreServices` | 更多服务 | 最小可用入口页 | 目前只是入口整理页 | 是 | 后续按完成度展示“可用/建设中” |

## 3. 本次 UI 统一内容

- 新增 `utils/starterPage.js`，给占位页提供统一的绑定状态读取、按钮行为、空状态、临时草稿和跳转逻辑。
- 新增 `pkg/common/starter.wxss`，统一占位页的页面背景、标题卡片、场景卡片、空状态、按钮、绑定提示和说明文案。
- 统一 20 个占位页的按钮高度、圆角、文字大小、卡片间距和空状态风格。
- 优化 `pages/matters/matters` 的入口文案和基础样式，使工具页入口名称与真实页面更一致。
- 修正 `app.json` 顶部标题和选中颜色，让全局导航风格更一致。

## 4. 当前仍是占位的页面

以下页面已经能打开、能显示基础内容和交互，但暂未接入正式云数据库或完整业务逻辑：`weather`、`datePlan`、`giftSuggest`、`loveWords`、`memorialDay`、`photolove`、`loveTest`、`coupleTasks`、`loveCalendar`、`loveTips`、`moodDiary`、`chatTopics`、`dateSpots`、`loveGames`、`relationshipAdvice`、`loveStory`、`surpriseIdeas`、`coupleGoals`、`emotionAnalysis`、`moreServices`。

其中 `datePlan`、`memorialDay`、`photolove`、`coupleTasks`、`loveCalendar`、`loveStory`、`coupleGoals` 会先检查情侣绑定；未绑定时只显示提示，不允许记录临时草稿。`moodDiary` 当前作为小诗助手保留 AI 定位，不再按心情日记处理。

## 5. 后续建议

1. 先在微信开发者工具逐个打开 29 个页面，确认页面不白屏、按钮不挤压、未绑定页有明确提示。
2. 绑定后重点回归 `wishlist`、`daterecord`、`photoalbum`、`memorial`、`heartbeat`、`timeline` 这些真实云数据页面。
3. 对占位页按使用频率做取舍：重复功能建议合并，例如 `memorialDay` 合并到 `memorial`，`loveWords` 合并到心动纸条，`coupleTasks` 合并到心动任务。
4. 真正要长期保存的占位功能，再逐个设计集合和权限；不要一次性把所有占位页都接入数据库。
