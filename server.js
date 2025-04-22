// server.js
const AV = require('leanengine');

// 初始化 LeanEngine - 仅依赖环境变量
AV.init({
  appId: process.env.LEANCLOUD_APP_ID,
  appKey: process.env.LEANCLOUD_APP_KEY,
  masterKey: process.env.LEANCLOUD_APP_MASTER_KEY
});

// 显式加载 cloud/main.js 文件，确保其中的云函数被定义
require('./cloud/main.js');

const app = require('./app'); // 加载 Express app

// 端口号由环境变量 PORT 指定
const PORT = parseInt(process.env.LEANCLOUD_APP_PORT || process.env.PORT || 3000);

// 启动应用
app.listen(PORT, function (err) {
  if (err) {
    return console.error('Failed to start server:', err);
  }
  console.log('Node app is running on port:', PORT);

  // 注册全局未捕获异常处理器
  process.on('uncaughtException', function(err) {
    console.error('Caught exception:', err.stack);
  });
  process.on('unhandledRejection', function(reason, p) {
    console.error('Unhandled Rejection at: Promise ', p, ' reason: ', reason.stack);
  });
}); 