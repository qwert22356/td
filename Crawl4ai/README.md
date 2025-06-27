# Crawl4AI Docker 服务

基于 [Crawl4AI](https://github.com/unclecode/crawl4ai) 的智能网页爬虫服务，通过 Docker 容器提供高性能的网页内容提取和智能导航功能。

## 🚀 快速开始

### 使用 Docker Compose（推荐）

```bash
# 启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 停止服务
docker-compose down
```

### 使用 Docker 命令

```bash
# 启动 Crawl4AI 服务
docker run -d \
  --name crawl4ai-server \
  -p 11235:11235 \
  -e CRAWL4AI_API_TOKEN=12345 \
  -e OPENAI_API_KEY=${OPENAI_API_KEY:-} \
  -e ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-} \
  -e GEMINI_API_TOKEN=${GEMINI_API_TOKEN:-} \
  -e CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173 \
  -e CORS_ALLOW_CREDENTIALS=true \
  -v /dev/shm:/dev/shm \
  --shm-size=1g \
  --restart=unless-stopped \
  --platform=linux/amd64 \
  unclecode/crawl4ai:latest
```

## 📋 服务配置

### Docker Compose 配置

```yaml
version: '3.8'

services:
  crawl4ai:
    image: unclecode/crawl4ai:latest
    container_name: crawl4ai-server
    ports:
      - "11235:11235"
    environment:
      - CRAWL4AI_API_TOKEN=12345
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
      - GEMINI_API_TOKEN=${GEMINI_API_TOKEN:-}
      - CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173
      - CORS_ALLOW_CREDENTIALS=true
    volumes:
      - /dev/shm:/dev/shm
    shm_size: '1gb'
    restart: unless-stopped
    platform: linux/amd64
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11235/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - crawl4ai-network

networks:
  crawl4ai-network:
    driver: bridge
```

### 环境变量

创建 `.env` 文件并配置以下变量：

```bash
# 必需配置
CRAWL4AI_API_TOKEN=12345

# LLM API 密钥（可选）
OPENAI_API_KEY=sk-your-openai-api-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here
GEMINI_API_TOKEN=your-gemini-api-token-here

# 其他LLM提供商（可选）
# DEEPSEEK_API_KEY=your-deepseek-api-key
# GROQ_API_KEY=your-groq-api-key
# TOGETHER_API_KEY=your-together-api-key
# MISTRAL_API_KEY=your-mistral-api-key
```

## 🔧 API 使用

### 健康检查

```bash
curl http://localhost:11235/health
```

### 基础爬取

```bash
curl -X POST http://localhost:11235/crawl \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 12345" \
  -d '{
    "urls": ["https://example.com"],
    "crawler_config": {
      "cache_mode": "bypass",
      "screenshot": true,
      "wait_for": "body"
    }
  }'
```

### 智能导航爬取

```bash
curl -X POST http://localhost:11235/crawl \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 12345" \
  -d '{
    "urls": ["https://example.com"],
    "browser_config": {
      "headless": true,
      "viewport_width": 1920,
      "viewport_height": 1080
    },
    "crawler_config": {
      "cache_mode": "bypass",
      "screenshot": true,
      "js_code": "document.querySelector(\"button[type=\\\"submit\\\"]\")?.click();",
      "wait_for": "body",
      "delay_before_return_html": 3
    }
  }'
```

## 🏗️ 系统架构

```
客户端应用
     ↓ HTTP API 调用
Crawl4AI 服务 (localhost:11235)
     ↓ Docker 容器
Intel CPU 兼容镜像 (linux/amd64)
```

## 📊 监控和维护

### 服务状态检查

```bash
# 查看容器状态
docker ps | grep crawl4ai

# 查看容器日志
docker logs crawl4ai-server

# 实时日志
docker logs -f crawl4ai-server

# 资源使用情况
docker stats crawl4ai-server
```

### 健康检查

服务内置健康检查，每30秒检查一次：
- 端点：`/health`
- 超时：10秒
- 重试：3次

## 🔧 故障排除

### 常见问题

**1. 容器启动失败**
```bash
# 查看详细错误信息
docker logs crawl4ai-server

# 检查端口占用
lsof -i :11235
```

**2. API 连接失败**
```bash
# 测试服务可达性
curl -v http://localhost:11235/health

# 检查防火墙设置
sudo ufw status
```

**3. M1/M2 Mac 兼容性问题**
```bash
# 确保使用 Intel 架构镜像
docker run --platform linux/amd64 unclecode/crawl4ai:latest
```

**4. 内存不足**
```bash
# 增加共享内存大小
docker run --shm-size=2g unclecode/crawl4ai:latest
```

### 性能优化

**内存配置**
- 默认共享内存：1GB
- 推荐生产环境：2GB 或更高

**并发配置**
- 调整请求间隔避免被封
- 限制最大并发请求数

**缓存策略**
- 使用 `bypass` 模式获取最新内容
- 考虑实现应用层缓存

## 🔄 更新和维护

### 更新镜像

```bash
# 拉取最新镜像
docker pull unclecode/crawl4ai:latest

# 重启服务
docker-compose down
docker-compose up -d
```

### 数据备份

爬取结果通过API返回，建议：
- 实现应用层数据持久化
- 定期备份重要爬取结果
- 版本控制配置文件

## 🔒 安全配置

### API 访问控制

- **生产环境**：使用强密码替换默认 token `12345`
- **网络安全**：配置防火墙限制访问来源
- **HTTPS**：生产环境启用 SSL/TLS

### 资源限制

```yaml
# Docker Compose 资源限制示例
services:
  crawl4ai:
    # ... 其他配置
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          memory: 2G
```

## 📚 相关链接

- [Crawl4AI 官方文档](https://github.com/unclecode/crawl4ai)
- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 文档](https://docs.docker.com/compose/)

## 📝 许可证

本服务基于 Crawl4AI 项目，请参考其许可证条款。 
