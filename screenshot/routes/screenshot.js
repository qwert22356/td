const express = require('express');
const router = express.Router();
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 确保screenshots目录存在
const screenshotsDir = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// 生成安全的文件名（移除URL中的特殊字符）
function generateSafeFilename(url) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const cleanUrl = url
    .replace(/^https?:\/\//, '') // 移除协议
    .replace(/[^a-zA-Z0-9.-]/g, '_') // 替换特殊字符为下划线
    .substring(0, 100); // 限制长度
  
  return `${timestamp}_${cleanUrl}.png`;
}

router.get('/', async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).json({ 
      error: 'Missing ?url=', 
      usage: 'GET /screenshot?url=https://example.com' 
    });
  }

  let browser;
  try {
    // 启动浏览器
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    const page = await browser.newPage();
    
    // 设置视窗大小
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // 访问页面
    await page.goto(url, { 
      timeout: 30000, 
      waitUntil: 'networkidle' 
    });
    
    // 等待页面完全加载
    await page.waitForTimeout(2000);
    
    // 生成文件名
    const filename = generateSafeFilename(url);
    const filepath = path.join(screenshotsDir, filename);
    
    // 截图并保存到文件
    await page.screenshot({ 
      path: filepath,
      fullPage: true,
      type: 'png'
    });
    
    // 获取文件大小
    const stats = fs.statSync(filepath);
    
    // 返回成功响应
    res.json({
      success: true,
      message: 'Screenshot captured successfully',
      data: {
        url: url,
        filename: filename,
        filepath: filepath,
        fileSize: stats.size,
        timestamp: new Date().toISOString(),
        downloadUrl: `/screenshot/download?filename=${encodeURIComponent(filename)}`
      }
    });
    
  } catch (err) {
    console.error('Screenshot error:', err);
    res.status(500).json({ 
      error: 'Screenshot failed', 
      message: err.message,
      url: url
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// 新增：下载截图文件的路由
router.get('/download', (req, res) => {
  const filename = req.query.filename;
  if (!filename) {
    return res.status(400).json({ error: 'Missing ?filename=' });
  }
  
  const filepath = path.join(screenshotsDir, filename);
  
  // 检查文件是否存在
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  // 设置响应头并发送文件
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.sendFile(filepath);
});

// 新增：列出所有截图文件的路由
router.get('/list', (req, res) => {
  try {
    const files = fs.readdirSync(screenshotsDir)
      .filter(file => file.endsWith('.png'))
      .map(file => {
        const filepath = path.join(screenshotsDir, file);
        const stats = fs.statSync(filepath);
        return {
          filename: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          downloadUrl: `/screenshot/download?filename=${encodeURIComponent(file)}`
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created)); // 按创建时间降序排列
    
    res.json({
      success: true,
      count: files.length,
      files: files
    });
  } catch (err) {
    console.error('List files error:', err);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

module.exports = router;