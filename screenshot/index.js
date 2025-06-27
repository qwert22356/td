const express = require('express');
const screenshotRouter = require('./routes/screenshot');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务（用于访问保存的截图）
app.use('/files', express.static(path.join(__dirname, 'screenshots')));

// 路由
app.use('/screenshot', screenshotRouter);

// 根路由 - API文档
app.get('/', (req, res) => {
  res.json({
    name: 'Screenshot API',
    version: '1.0.0',
    description: '使用Playwright进行网页截图的API服务',
    endpoints: {
      screenshot: {
        url: '/screenshot?url=<target_url>',
        method: 'GET',
        description: '对指定URL进行截图并保存到文件',
        example: '/screenshot?url=https://www.baidu.com'
      },
      download: {
        url: '/screenshot/download?filename=<filename>',
        method: 'GET', 
        description: '下载指定的截图文件'
      },
      list: {
        url: '/screenshot/list',
        method: 'GET',
        description: '列出所有已保存的截图文件'
      }
    },
    usage: '适合与n8n等自动化工具集成使用'
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message 
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `路由 ${req.originalUrl} 不存在` 
  });
});

app.listen(PORT, () => {
  console.log(`Screenshot服务运行在 http://localhost:${PORT}`);
  console.log(`API文档: http://localhost:${PORT}`);
  console.log(`截图示例: http://localhost:${PORT}/screenshot?url=https://www.baidu.com`);
});