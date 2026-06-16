// app.js
App({
  onLaunch() {
    wx.cloud.init({
      env: 'cloud1-4gmaqc42550b0950', // 粘贴控制台里的 env
      traceUser: true
    })
  }
})
