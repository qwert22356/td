# Screenshot API

一个基于Node.js和Playwright的网页截图API服务，支持与n8n等自动化工具集成。

## 功能特性

- ✨ 使用Playwright进行高质量网页截图
- 📁 自动保存截图到本地文件系统
- 🕒 文件名包含时间戳，方便回溯
- 🔗 返回文件下载链接
- 📋 支持列出所有截图文件
- 🛡️ 错误处理和安全文件名生成

## 安装和启动

```bash
# 安装依赖
npm install

# 安装Playwright浏览器
npx playwright install chromium

# 启动服务
npm start
```

服务将在 `http://localhost:3000` 启动。

## API 接口

### 1. 获取API文档
```
GET /
```

### 2. 网页截图
```
GET /screenshot?url=<target_url>
```

**参数：**
- `url`: 要截图的网页URL（必需）

**响应示例：**
```json
{
  "success": true,
  "message": "Screenshot captured successfully",
  "data": {
    "url": "https://www.baidu.com",
    "filename": "2024-01-20T10-30-45-123Z_www_baidu_com.png",
    "filepath": "/path/to/screenshots/2024-01-20T10-30-45-123Z_www_baidu_com.png",
    "fileSize": 245760,
    "timestamp": "2024-01-20T10:30:45.123Z",
    "downloadUrl": "/screenshot/download?filename=2024-01-20T10-30-45-123Z_www_baidu_com.png"
  }
}
```

### 3. 下载截图文件
```
GET /screenshot/download?filename=<filename>
```

**参数：**
- `filename`: 截图文件名（从截图接口返回）

### 4. 列出所有截图
```
GET /screenshot/list
```

**响应示例：**
```json
{
  "success": true,
  "count": 2,
  "files": [
    {
      "filename": "2024-01-20T10-30-45-123Z_www_baidu_com.png",
      "size": 245760,
      "created": "2024-01-20T10:30:45.123Z",
      "modified": "2024-01-20T10:30:45.123Z",
      "downloadUrl": "/screenshot/download?filename=2024-01-20T10-30-45-123Z_www_baidu_com.png"
    }
  ]
}
```

## 在n8n中使用

### HTTP Request节点配置：

1. **Method**: GET
2. **URL**: `http://your-server:3000/screenshot`
3. **Query Parameters**: 
   - `url`: `{{$json["target_url"]}}` (或直接输入URL)

### 使用示例：

```bash
# 截图百度首页
curl "http://localhost:3000/screenshot?url=https://www.baidu.com"

# 截图GitHub
curl "http://localhost:3000/screenshot?url=https://github.com"

# 列出所有截图
curl "http://localhost:3000/screenshot/list"

# 下载指定截图
curl "http://localhost:3000/screenshot/download?filename=xxx.png" -o screenshot.png
```

## 文件命名规则

截图文件按以下格式命名：
```
{ISO时间戳}_{清理后的URL}.png
```

例如：
- URL: `https://www.baidu.com`
- 文件名: `2024-01-20T10-30-45-123Z_www_baidu_com.png`

## 技术特性

- 全页面截图 (fullPage: true)
- 1920x1080 视窗大小
- 30秒超时时间
- 安全的文件名生成（移除特殊字符）
- 自动创建screenshots目录
- 优雅的错误处理

## Docker部署

```dockerfile
# 使用提供的Dockerfile
docker build -t screenshot-api .
docker run -p 3000:3000 -v $(pwd)/screenshots:/app/screenshots screenshot-api
```

## 注意事项

- 确保目标网站可以正常访问
- 某些网站可能有反爬虫机制
- 截图文件会持续累积，建议定期清理
- 生产环境建议添加认证和限流机制
