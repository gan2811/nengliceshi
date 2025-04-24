// server.js
const AV = require('leanengine');

// 先确定要传递给 SDK 的 serverURL
const effectiveServerURL = process.env.LEANCLOUD_SERVER_URL_HTTP || process.env.LEANCLOUD_API_SERVER;

AV.init({
  appId: process.env.LEANCLOUD_APP_ID,
  appKey: process.env.LEANCLOUD_APP_KEY,
  masterKey: process.env.LEANCLOUD_APP_MASTER_KEY,
  serverURL: effectiveServerURL // 使用上面确定的 URL
});

// 修改日志记录逻辑，直接使用环境变量的值
if (process.env.LEANCLOUD_SERVER_URL_HTTP) {
    // 直接打印设置的 HTTP URL 环境变量的值
    console.log(`[Server] LeanCloud SDK Initialized using LOCAL HTTP server URL (for debugging): ${process.env.LEANCLOUD_SERVER_URL_HTTP}`);
} else if (process.env.LEANCLOUD_API_SERVER) {
     // 直接打印 API SERVER 环境变量的值
    console.log(`[Server] LeanCloud SDK Initialized using LEANCLOUD_API_SERVER: ${process.env.LEANCLOUD_API_SERVER}`);
} else {
     // 如果两者都未设置，说明使用的是 SDK 默认值
     console.log(`[Server] LeanCloud SDK Initialized using default server URL (likely HTTPS)`);
}

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