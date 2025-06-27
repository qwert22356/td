# Crawl4AI 爬虫系统部署指南

## 系统架构

本项目使用 Crawl4AI 作为爬虫后端服务，通过 Docker 容器部署。

```
前端 React 应用 (localhost:5173)
     ↓ HTTP API 调用
Crawl4AI 服务 (localhost:11235)
     ↓ Docker 容器
Intel CPU 兼容镜像
```

## 部署步骤

### 1. 启动 Crawl4AI 服务

使用 Docker Compose (推荐):

```bash
# 在项目根目录执行
docker-compose up -d
```

或使用直接 Docker 命令:

```bash
# Intel CPU 架构
docker run -d \
  --name crawl4ai-server \
  -p 11235:11235 \
  -e CRAWL4AI_API_TOKEN=12345 \
  --shm-size=1g \
  --platform linux/amd64 \
  unclecode/crawl4ai:latest
```

### 2. 验证服务状态

检查容器运行状态:

```bash
docker ps | grep crawl4ai
```

测试健康检查:

```bash
curl http://localhost:11235/health
```

应该返回成功响应。

### 3. 启动前端应用

```bash
npm install
npm run dev
```

前端应用将运行在 http://localhost:5173

## 配置说明

### 环境变量

- `CRAWL4AI_API_TOKEN`: API 访问令牌，默认为 `12345`
- `OPENAI_API_KEY`: OpenAI API 密钥（可选，用于 LLM 功能）
- `ANTHROPIC_API_KEY`: Anthropic Claude API 密钥（可选）
- `GEMINI_API_TOKEN`: Google Gemini API 令牌（可选）

### 网络端口

- `11235`: Crawl4AI API 服务端口
- `5173`: 前端开发服务器端口

## 功能特性

### 爬虫功能
- 智能网页内容提取
- 支持 JavaScript 渲染
- 图片和链接资源提取
- 多层级深度爬取
- 自动错误处理和重试

### 数据分离存储
- 文本内容单独保存
- 图片资源分类管理
- 链接结构化存储
- 元数据完整记录

## 故障排除

### 常见问题

1. **容器启动失败**
   ```bash
   docker logs crawl4ai-server
   ```

2. **API 连接失败**
   - 检查端口 11235 是否被占用
   - 确认防火墙设置
   - 验证 API token 配置

3. **Intel CPU 兼容性**
   - 确保使用 `--platform linux/amd64` 参数
   - 对于 M1/M2 Mac，可能需要额外配置

### 性能优化

1. **内存配置**
   ```bash
   # 增加共享内存大小
   --shm-size=2g
   ```

2. **并发限制**
   - 调整请求间隔参数
   - 限制最大页面数量

3. **缓存策略**
   - 使用 bypass 模式获取最新内容
   - 考虑实现本地缓存机制

## 监控和日志

### 容器监控
```bash
# 查看资源使用情况
docker stats crawl4ai-server

# 查看日志
docker logs -f crawl4ai-server
```

### API 监控
- 健康检查端点: `/health`
- 服务状态通过前端界面实时显示

## 安全考虑

1. **API Token 管理**
   - 生产环境使用强密码
   - 定期轮换访问令牌

2. **网络安全**
   - 限制 API 访问来源
   - 使用 HTTPS（生产环境）

3. **资源限制**
   - 设置容器资源限制
   - 配置爬取频率限制

## 升级说明

### 更新 Crawl4AI 镜像
```bash
docker pull unclecode/crawl4ai:latest
docker-compose down
docker-compose up -d
```

### 数据备份
- 爬取结果可通过前端导出功能备份
- 配置文件建议版本控制管理

## 支持和帮助

- Crawl4AI 官方文档: https://github.com/unclecode/crawl4ai
- 问题反馈: 通过项目 Issue 提交
- 技术支持: 参考官方社区资源 