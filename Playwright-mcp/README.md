# Playwright MCP Docker Compose 部署

这个项目提供了基于 Docker Compose 的 [Playwright MCP](https://github.com/microsoft/playwright-mcp) 服务器部署方案。Playwright MCP 是一个 Model Context Protocol (MCP) 服务器，提供基于 Playwright 的浏览器自动化功能。

## 功能特性

- **快速轻量**: 使用 Playwright 的可访问性树，而非基于像素的输入
- **LLM 友好**: 无需视觉模型，纯基于结构化数据操作
- **确定性工具应用**: 避免了基于截图方法的常见歧义
- **Docker 容器化**: 易于部署和扩展

## 快速开始

### 1. 克隆或下载配置文件

将 `docker-compose.yml` 和 `env.example` 文件放在您的项目目录中。

### 2. 配置环境变量

```bash
# 复制环境变量示例文件
cp env.example .env

# 根据需要编辑环境变量
nano .env
```

### 3. 创建必要的目录

```bash
# 创建输出和存储目录
mkdir -p output storage
```

### 4. 启动服务

```bash
# 构建并启动服务（生产模式）
docker-compose up -d

# 查看日志
docker-compose logs -f playwright-mcp

# 或者启动开发模式（如果您有本地代码）
docker-compose --profile dev up -d
```

## 服务访问

服务启动后，可以通过以下方式访问：

- **SSE 端点**: `http://localhost:8931/sse`
- **健康检查**: `http://localhost:8931/health`

## 配置 MCP 客户端

### VS Code / Cursor

在您的 MCP 客户端配置中添加：

```json
{
  "mcpServers": {
    "playwright": {
      "url": "http://localhost:8931/sse"
    }
  }
}
```

### Claude Desktop

在 Claude Desktop 配置文件中添加：

```json
{
  "mcpServers": {
    "playwright": {
      "url": "http://localhost:8931/sse"
    }
  }
}
```

## 可用的服务

### 主服务 (playwright-mcp)

- **端口**: 8931
- **模式**: 生产模式，从 GitHub 构建
- **用途**: 生产环境使用

### 开发服务 (playwright-mcp-dev)

- **端口**: 8932
- **模式**: 开发模式，挂载本地代码
- **用途**: 本地开发和调试
- **启动**: `docker-compose --profile dev up -d`

## 高级配置

### 环境变量说明

主要环境变量：

- `PORT`: 服务端口 (默认: 8931)
- `BROWSER`: 浏览器类型 (chromium/firefox/webkit)
- `HEADLESS`: 是否无头模式
- `VIEWPORT_WIDTH/HEIGHT`: 视窗大小
- `VISION_MODE`: 是否启用视觉模式（使用截图）

### 自定义配置

您可以通过修改 `docker-compose.yml` 中的 `command` 部分来添加更多参数：

```yaml
command: [
  "node", "cli.js", 
  "--headless", 
  "--browser", "chromium", 
  "--no-sandbox", 
  "--port", "8931",
  "--vision",  # 启用视觉模式
  "--viewport-size", "1920,1080"  # 自定义视窗大小
]
```

### 持久化存储

- `playwright_data`: Playwright 浏览器数据
- `./output`: 输出文件（截图、PDF等）
- `./storage`: 存储状态文件

## 可用工具

Playwright MCP 提供以下工具分类：

### 交互工具
- `browser_snapshot`: 页面快照
- `browser_click`: 点击元素
- `browser_type`: 输入文本
- `browser_hover`: 悬停
- `browser_drag`: 拖拽

### 导航工具
- `browser_navigate`: 导航到 URL
- `browser_navigate_back`: 后退
- `browser_navigate_forward`: 前进

### 资源工具
- `browser_take_screenshot`: 截图
- `browser_pdf_save`: 保存为 PDF
- `browser_network_requests`: 网络请求列表

### 标签页管理
- `browser_tab_list`: 列出标签页
- `browser_tab_new`: 新建标签页
- `browser_tab_select`: 选择标签页

## 故障排除

### 常见问题

1. **服务无法启动**
   ```bash
   # 检查日志
   docker-compose logs playwright-mcp
   
   # 检查端口占用
   netstat -an | grep 8931
   ```

2. **浏览器安装失败**
   ```bash
   # 重新构建镜像
   docker-compose build --no-cache
   ```

3. **权限问题**
   ```bash
   # 确保输出目录权限正确
   sudo chown -R $USER:$USER output storage
   ```

### 调试模式

启用调试输出：

```bash
# 修改环境变量
echo "DEBUG=true" >> .env

# 重启服务
docker-compose restart
```

## 清理

```bash
# 停止并删除容器
docker-compose down

# 删除所有数据（包括浏览器数据）
docker-compose down -v

# 删除镜像
docker rmi playwright-mcp:latest playwright-mcp-dev:latest
```

## 更多资源

- [Playwright MCP GitHub 仓库](https://github.com/microsoft/playwright-mcp)
- [Model Context Protocol 文档](https://modelcontextprotocol.io/)
- [Playwright 官方文档](https://playwright.dev/)

## 许可证

本配置文件遵循 MIT 许可证。Playwright MCP 项目遵循 Apache-2.0 许可证。 