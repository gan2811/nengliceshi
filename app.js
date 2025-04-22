// app.js
const express = require('express');
const AV = require('leanengine');
const path = require('path'); // 引入 path 模块

const app = express();

// 设置静态文件目录
// 告诉 Express 从名为 'public' 的目录下提供静态文件 (html, css, js, images)
app.use(express.static(path.join(__dirname, 'public')));

// 使用 LeanEngine 中间件
app.use(AV.express());

// 可以添加一个简单的根路由用于健康检查或调试
app.get('/', (req, res) => {
  // 现在访问根路径 / 会自动查找 public/index.html
  // 如果 public/index.html 存在，这行代码通常不会被执行
  // 可以保留作为后备，或者如果 index.html 不存在时的默认响应
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Index.html not found or error serving file.');
    }
  });
});

// 如果你有其他 Express 路由，可以在这里定义

module.exports = app; 