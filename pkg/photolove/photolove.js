const { createStarterPage } = require('../../utils/starterPage');

Page(createStarterPage({
  pagePath: 'pkg/photolove/photolove',
  navTitle: '照片故事',
  title: '照片故事',
  subtitle: '给一张照片配一句当时的心情，先做成轻量故事卡。',
  statusText: '占位功能',
  requiresCouple: true,
  primaryText: '写一张故事卡',
  secondaryText: '去甜蜜相册',
  secondaryRoute: '/pkg/photoalbum/photoalbum',
  emptyTitle: '还没有照片故事',
  emptyText: '当前只生成本页草稿；长期照片请使用甜蜜相册。',
  note: '本页暂未上传图片，也不写入云数据库。',
  sceneList: [
    { title: '一张合照', desc: '写下拍照前后发生的事。' },
    { title: '一张票根', desc: '记录那天看的电影或展。' },
    { title: '一份晚餐', desc: '把味道和聊天都留住。' },
    { title: '一个背影', desc: '有些喜欢不用正面镜头。' }
  ],
  sampleItems: [
    { title: '照片旁白', desc: '这张照片最可爱的地方，是我们都笑得没顾上看镜头。' }
  ]
}));
