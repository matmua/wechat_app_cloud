const QUICK_PROMPTS = [
  {
    key: 'comfort',
    title: '哄 Ta 开心',
    desc: '给一点温柔又不油腻的安慰',
    prompt: '今天 Ta 有点不开心，请帮我写一段自然、真诚、不油腻的安慰话。'
  },
  {
    key: 'loveWords',
    title: '一句情话',
    desc: '短一点，像日常消息',
    prompt: '帮我写一句适合发给恋人的日常情话，短一点，真诚一点。'
  },
  {
    key: 'datePlan',
    title: '约会计划',
    desc: '按时间安排轻松路线',
    prompt: '请帮我生成一个轻松、不赶路、适合情侣的一日约会计划。'
  },
  {
    key: 'gift',
    title: '礼物建议',
    desc: '按预算和场景发散',
    prompt: '请给我 5 个适合送给恋人的礼物建议，并说明适合什么场景。'
  },
  {
    key: 'sock',
    title: '树洞润色',
    desc: '把悄悄话写得更柔软',
    prompt: '我想写一段暂时藏起来的树洞悄悄话，请帮我润色得真诚、温柔、克制。'
  },
  {
    key: 'period',
    title: '经期关心',
    desc: '提醒我怎么照顾 Ta',
    prompt: '请给我一些经期日常关心建议，语气温柔，不要像医学诊断。'
  },
  {
    key: 'food',
    title: '今天吃什么',
    desc: '解决饭点纠结',
    prompt: '我们今天不知道吃什么，请给几个适合情侣一起吃的轻松选择。'
  }
];

const STARTER_MESSAGES = [
  {
    role: 'assistant',
    text: '我是爱木长诗里的小诗助手。后续接入 DeepSeek / OpenAI 后，我可以帮你写情话、出约会计划、润色树洞悄悄话，也可以给一点日常关心建议。现在如果 aiChat 云函数还没配置，我会提示你接口待配置。'
  }
];

function buildPendingReply(scene) {
  const sceneName = QUICK_PROMPTS.find(item => item.key === scene)?.title || '恋爱问题';
  return `AI 接口还在等待配置。后续请新增 cloudfunctions/aiChat，并把 DeepSeek / OpenAI API key 放到云函数环境变量里。配置完成后，我会根据「${sceneName}」这个场景生成真正的回复，前端不会保存或暴露 API key。`;
}

Page({
  data: {
    quickPrompts: QUICK_PROMPTS,
    activeScene: 'comfort',
    messages: STARTER_MESSAGES,
    inputText: '',
    loading: false,
    configState: 'pending',
    configText: 'AI 接口待配置：前端已预留 aiChat 云函数调用，API key 未来只放云函数环境变量。'
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '小诗助手' });
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value || '' });
  },

  useQuickPrompt(e) {
    const key = e.currentTarget.dataset.key;
    const item = QUICK_PROMPTS.find(prompt => prompt.key === key);
    if (!item) return;
    this.setData({
      activeScene: key,
      inputText: item.prompt
    });
  },

  async sendMessage() {
    const text = (this.data.inputText || '').trim();
    if (!text) {
      wx.showToast({ title: '先写一句想问小诗的内容', icon: 'none' });
      return;
    }
    if (this.data.loading) return;

    const nextMessages = [
      ...this.data.messages,
      { role: 'user', text }
    ];
    this.setData({ messages: nextMessages, inputText: '', loading: true });

    try {
      const reply = await this.callAiChat(text);
      this.setData({
        messages: [
          ...nextMessages,
          { role: 'assistant', text: reply.text, pendingConfig: !!reply.pendingConfig }
        ],
        configState: reply.pendingConfig ? 'pending' : 'ready',
        configText: reply.pendingConfig
          ? 'AI 接口待配置：请部署 aiChat 云函数并设置环境变量。'
          : 'AI 接口已返回内容。'
      });
    } catch (e) {
      const fallback = buildPendingReply(this.data.activeScene);
      this.setData({
        messages: [
          ...nextMessages,
          { role: 'assistant', text: fallback, pendingConfig: true }
        ],
        configState: 'pending',
        configText: '暂时没有拿到 aiChat 回复，请检查云函数是否部署。'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async callAiChat(message) {
    const recentMessages = this.data.messages.slice(-8).map(item => ({
      role: item.role,
      text: item.text
    }));

    try {
      const res = await wx.cloud.callFunction({
        name: 'aiChat',
        data: {
          action: 'chat',
          scene: this.data.activeScene,
          message,
          messages: recentMessages
        }
      });
      const result = res.result || {};
      if (result.ok && result.reply) {
        return { text: result.reply, pendingConfig: false };
      }
      return {
        text: result.message || buildPendingReply(this.data.activeScene),
        pendingConfig: true
      };
    } catch (e) {
      return {
        text: buildPendingReply(this.data.activeScene),
        pendingConfig: true
      };
    }
  },

  clearChat() {
    this.setData({
      messages: STARTER_MESSAGES,
      inputText: '',
      activeScene: 'comfort'
    });
  },

  copyMessage(e) {
    const index = Number(e.currentTarget.dataset.index);
    const msg = this.data.messages[index];
    if (!msg?.text) return;
    wx.setClipboardData({
      data: msg.text,
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    });
  },

  onShareAppMessage() {
    return {
      title: '爱木长诗 · 小诗助手',
      path: '/pkg/moodDiary/moodDiary'
    };
  }
});
