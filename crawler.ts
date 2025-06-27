import axios from 'axios';
import { fileStorage } from './fileStorage';

// Crawl4AI API 配置
const CRAWL4AI_BASE_URL = '/api/crawl4ai';
const CRAWL4AI_API_TOKEN = '12345';

// 智能导航配置接口
export interface NavigationConfig {
  waitForSelector?: string; // 等待特定元素加载
  clickSelectors?: string[]; // 需要点击的按钮文字列表（支持跨页面导航）
  loginConfig?: {
    usernameSelector: string;
    passwordSelector: string;
    submitSelector: string;
    username: string;
    password: string;
  };
  scrollToBottom?: boolean; // 是否滚动到页面底部
  waitTime?: number; // 每次点击后的等待时间（秒，考虑页面加载和跳转）
}

// 爬虫配置接口
export interface CrawlerConfig {
  url: string;
  maxDepth: number;
  delay: number; // 请求间隔（秒）
  maxPages: number;
  respectRobots: boolean;
  userAgent: string;
  enableJavaScript: boolean;
  extractImages: boolean;
  extractLinks: boolean;
  enableScreenshots: boolean; // 是否启用截图
  navigationConfig?: NavigationConfig; // 新增：导航配置
  repeatInterval?: number; // 重复间隔（分钟）
}

// 单个页面的截图数据
export interface PageScreenshot {
  url: string;
  title: string;
  screenshot: string; // base64格式的截图
  timestamp: Date;
}

// 爬虫结果接口
export interface CrawlResult {
  id: string;
  url: string;
  title: string;
  content: string;
  images: string[];
  links: { text: string; url: string }[];
  screenshot?: string; // 主页面截图 (base64格式)
  screenshots: PageScreenshot[]; // 新增：所有页面的截图集合
  timestamp: Date;
  status: 'success' | 'error' | 'pending';
  error?: string;
  metadata: {
    statusCode?: number;
    contentType?: string;
    size?: number;
    loadTime?: number;
  };
}

// 爬虫任务接口
export interface CrawlerTask {
  id: string;
  name: string;
  config: CrawlerConfig;
  results: CrawlResult[];
  status: 'idle' | 'running' | 'paused' | 'error';
  lastRunTime?: Date;
  nextRunTime?: Date;
  totalRuns: number;
  successCount: number;
  errorCount: number;
  createdAt: Date;
  timerId?: NodeJS.Timeout;
}

// 爬虫任务状态
export interface CrawlerStatus {
  isRunning: boolean;
  currentTaskId?: string;
  currentUrl?: string;
  completedCount: number;
  totalCount: number;
  startTime?: Date;
  estimatedTimeRemaining?: number;
  errors: string[];
}

class CrawlerService {
  private status: CrawlerStatus = {
    isRunning: false,
    completedCount: 0,
    totalCount: 0,
    errors: []
  };

  private tasks: Map<string, CrawlerTask> = new Map();
  private abortController?: AbortController;

  // 创建Crawl4AI API客户端实例
  private createApiClient() {
    return axios.create({
      baseURL: CRAWL4AI_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRAWL4AI_API_TOKEN}`
      },
      timeout: 30000
    });
  }

  // 检查Crawl4AI服务状态
  async checkServiceHealth(): Promise<boolean> {
    try {
      const client = this.createApiClient();
      const response = await client.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('Crawl4AI服务不可用:', error);
      return false;
    }
  }

  // 创建新任务
  createTask(name: string, config: CrawlerConfig): string {
    const taskId = this.generateId();
    const task: CrawlerTask = {
      id: taskId,
      name,
      config,
      results: [],
      status: 'idle',
      totalRuns: 0,
      successCount: 0,
      errorCount: 0,
      createdAt: new Date()
    };

    this.tasks.set(taskId, task);
    
    // 如果设置了重复间隔，立即启动定时器
    if (config.repeatInterval && config.repeatInterval > 0) {
      this.scheduleTask(taskId);
    }

    return taskId;
  }

  // 删除任务
  deleteTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // 清除定时器
    if (task.timerId) {
      clearInterval(task.timerId);
    }

    // 如果任务正在运行，停止它
    if (task.status === 'running') {
      this.stopTask(taskId);
    }

    this.tasks.delete(taskId);
    return true;
  }

  // 获取所有任务
  getTasks(): CrawlerTask[] {
    return Array.from(this.tasks.values());
  }

  // 获取单个任务
  getTask(taskId: string): CrawlerTask | undefined {
    return this.tasks.get(taskId);
  }

  // 手动执行任务
  async runTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    if (task.status === 'running') {
      throw new Error('任务正在运行中');
    }

    await this.executeTask(taskId);
  }

  // 停止任务
  stopTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (this.abortController && this.status.currentTaskId === taskId) {
      this.abortController.abort();
    }

    task.status = 'idle';
    return true;
  }

  // 暂停/恢复任务的定时执行
  toggleTaskSchedule(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.timerId) {
      // 暂停定时执行
      clearInterval(task.timerId);
      task.timerId = undefined;
      task.nextRunTime = undefined;
      if (task.status === 'idle') {
        task.status = 'paused';
      }
    } else if (task.config.repeatInterval && task.config.repeatInterval > 0) {
      // 恢复定时执行
      this.scheduleTask(taskId);
      if (task.status === 'paused') {
        task.status = 'idle';
      }
    }

    return true;
  }

  // 更新任务配置
  updateTask(taskId: string, name?: string, config?: Partial<CrawlerConfig>): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (name) {
      task.name = name;
    }

    if (config) {
      task.config = { ...task.config, ...config };
      
      // 如果更新了重复间隔，重新设置定时器
      if (config.repeatInterval !== undefined) {
        if (task.timerId) {
          clearInterval(task.timerId);
          task.timerId = undefined;
        }
        
        if (config.repeatInterval > 0) {
          this.scheduleTask(taskId);
        }
      }
    }

    return true;
  }

  // 安排任务定时执行
  private scheduleTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || !task.config.repeatInterval || task.config.repeatInterval <= 0) {
      return;
    }

    // 清除现有定时器
    if (task.timerId) {
      clearInterval(task.timerId);
    }

    const intervalMs = task.config.repeatInterval * 60 * 1000;
    task.nextRunTime = new Date(Date.now() + intervalMs);

    task.timerId = setInterval(async () => {
      if (task.status === 'idle') {
        try {
          await this.executeTask(taskId);
        } catch (error) {
          console.error(`定时任务执行失败 [${task.name}]:`, error);
        }
      }
      
      // 更新下次执行时间
      task.nextRunTime = new Date(Date.now() + intervalMs);
    }, intervalMs);
  }

  // 执行单个任务
  private async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('任务不存在');

    // 检查服务状态
    const isHealthy = await this.checkServiceHealth();
    if (!isHealthy) {
      throw new Error('Crawl4AI服务不可用，请确保Docker容器正在运行');
    }

    task.status = 'running';
    task.totalRuns++;
    task.lastRunTime = new Date();

    this.status.isRunning = true;
    this.status.currentTaskId = taskId;
    this.status.currentUrl = task.config.url;
    this.status.startTime = new Date();
    this.status.completedCount = 0;
    this.status.totalCount = 1;
    this.status.errors = [];

    this.abortController = new AbortController();

    try {
      // 检查是否有多按钮点击配置
      const clickSelectors = task.config.navigationConfig?.clickSelectors;
      if (clickSelectors && clickSelectors.length > 1) {
        console.log(`检测到多按钮配置，将为每个按钮单独截图，共${clickSelectors.length}个按钮`);
        
        this.status.totalCount = clickSelectors.length + 1; // +1 为初始页面
        
        // 1. 先截图初始页面
        console.log('截图初始页面...');
        const initialResult = await this.crawlWithCrawl4AI(task.config.url, {
          ...task.config,
          navigationConfig: undefined // 不执行任何点击
        });
        initialResult.title = '初始页面 - ' + initialResult.title;
        task.results.unshift(initialResult);
        this.status.completedCount = 1;
        
        // 2. 为每个按钮单独截图
        for (let i = 0; i < clickSelectors.length; i++) {
          const buttonText = clickSelectors[i];
          console.log(`截图按钮 ${i + 1}/${clickSelectors.length}: ${buttonText}`);
          
          try {
            const buttonResult = await this.crawlWithCrawl4AI(task.config.url, {
              ...task.config,
              navigationConfig: {
                ...task.config.navigationConfig,
                clickSelectors: [buttonText] // 只点击当前按钮
              }
            });
            buttonResult.title = `${buttonText} - ` + buttonResult.title;
            task.results.unshift(buttonResult);
            this.status.completedCount++;
          } catch (error) {
            console.error(`按钮 "${buttonText}" 截图失败:`, error);
            this.status.errors.push(`按钮 "${buttonText}" 截图失败: ${error instanceof Error ? error.message : '未知错误'}`);
          }
        }
        
        task.successCount++;
      } else {
        // 单个任务执行
        const result = await this.crawlWithCrawl4AI(task.config.url, task.config);
        
        // 将结果添加到任务中，保持最近50个结果
        task.results.unshift(result);
        
        if (result.status === 'success') {
          task.successCount++;
        } else {
          task.errorCount++;
        }

        this.status.completedCount = 1;
      }
      
      // 保持最近50个结果
      if (task.results.length > 50) {
        task.results = task.results.slice(0, 50);
      }

      // 自动保存文件
      console.log('开始自动保存爬虫结果到本地文件...');
      try {
        const successResults = task.results.slice(0, 5).filter(r => r.status === 'success'); // 只保存最新的5个成功结果
        for (const result of successResults) {
          try {
            await fileStorage.saveCrawlResult(result, this.status.startTime?.toISOString());
            console.log(`文件已保存到项目目录，来源: ${result.url}`);
          } catch (resultError) {
            console.error(`保存结果失败 (${result.url}):`, resultError);
            // 继续处理其他结果
          }
        }
        
        console.log(`文件保存完成！所有结果已保存到 ./crawler-data 文件夹`);
      } catch (saveError) {
        console.error('文件保存服务失败:', saveError);
        // 不影响主要的爬虫功能，只记录错误
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.status.errors.push(`${task.config.url}: ${errorMessage}`);
      task.errorCount++;
      task.status = 'error';
      
      // 创建错误结果
      const errorResult: CrawlResult = {
        id: this.generateId(),
        url: task.config.url,
        title: '爬取失败',
        content: '',
        images: [],
        links: [],
        screenshot: undefined,
        screenshots: [],
        timestamp: new Date(),
        status: 'error',
        error: errorMessage,
        metadata: {}
      };
      
      task.results.unshift(errorResult);
      if (task.results.length > 50) {
        task.results = task.results.slice(0, 50);
      }
    } finally {
      if (task.status !== 'error') {
        task.status = 'idle';
      }
      this.status.isRunning = false;
      this.status.currentTaskId = undefined;
      this.status.currentUrl = undefined;
    }
  }

  // 使用Crawl4AI爬取单个URL
    private async crawlWithCrawl4AI(url: string, config: CrawlerConfig): Promise<CrawlResult> {
    const client = this.createApiClient();
    
    try {
      console.log(`开始智能导航和截图: ${url}`);
      
      // 构建高级爬取配置
      const hasNavigation = config.navigationConfig?.clickSelectors?.length || 0;
      const navigationTime = hasNavigation > 0 ? (hasNavigation * (config.navigationConfig?.waitTime || 3) + 8) : 3;
      
      const crawlRequest = {
        urls: [url],
        browser_config: {
          headless: true,
          user_agent: config.userAgent,
          viewport_width: 1920,
          viewport_height: 1080
        },
        crawler_config: {
          cache_mode: "bypass",
          screenshot: true, // 总是截图
          screenshot_wait_for: navigationTime,
          pdf: false,
          wait_for_images: true,
          delay_before_return_html: navigationTime,
          // 启用JavaScript执行和智能导航
          js_code: this.generateNavigationJSCode(config.navigationConfig),
          wait_for: "body",
          // 为处理页面跳转增加额外的等待时间
          page_timeout: (navigationTime + 10) * 1000
        }
      };

      console.log('发送爬取请求，配置:', {
        url,
        hasNavigationConfig: !!config.navigationConfig,
        clickSelectors: config.navigationConfig?.clickSelectors || [],
        jsCode: this.generateNavigationJSCode(config.navigationConfig)
      });

      const response = await client.post('/crawl', crawlRequest);
      
      if (!response.data.success || !response.data.results) {
        throw new Error(response.data.error || '智能导航失败');
      }

      const result = response.data.results[0];
      
      // 提取内容
      let content = '无内容';
      if (result.markdown?.raw_markdown) {
        content = result.markdown.raw_markdown;
      } else if (result.markdown?.fit_markdown) {
        content = result.markdown.fit_markdown;
      } else if (result.cleaned_html) {
        content = result.cleaned_html;
      } else if (result.html) {
        content = result.html;
      }
      
      // 提取图片
      let images: string[] = [];
      if (result.media?.images && Array.isArray(result.media.images) && config.extractImages) {
        images = result.media.images
          .filter((img: any) => img && img.src)
          .map((img: any) => this.resolveUrl(img.src, url));
      }

      // 提取链接  
      let links: { text: string; url: string }[] = [];
      if (result.links?.internal && Array.isArray(result.links.internal) && config.extractLinks) {
        links = result.links.internal
          .filter((link: any) => link && link.href)
          .map((link: any) => ({
            text: link.text || link.href || '无标题链接',
            url: this.resolveUrl(link.href, url)
          }));
      }

      // 去重
      images = [...new Set(images)];
      const linkUrls = new Set();
      links = links.filter(link => {
        if (linkUrls.has(link.url)) return false;
        linkUrls.add(link.url);
        return true;
      });

      // 处理截图数据 - 智能多页面版本
      const screenshots: PageScreenshot[] = [];
      
      if (config.enableScreenshots && result.screenshot) {
        const finalTitle = result.metadata?.title || this.extractTitle(content);
        const finalUrl = result.url || url; // 使用返回的URL，可能已经跳转
        
        screenshots.push({
          url: finalUrl,
          title: finalTitle + (config.navigationConfig?.clickSelectors?.length ? ' (导航后)' : ''),
          screenshot: result.screenshot,
          timestamp: new Date()
        });
        
        // 如果启用了导航，记录导航信息
        if (config.navigationConfig?.clickSelectors?.length) {
          const clickCount = config.navigationConfig.clickSelectors.length;
          console.log(`智能导航完成，点击了 ${clickCount} 个按钮，获得最终状态截图`);
          console.log(`最终页面: ${finalUrl}`);
          console.log(`页面标题: ${finalTitle}`);
        }
      }

      console.log(`智能导航完成，获得 ${screenshots.length} 个截图`);

      return {
        id: this.generateId(),
        url: result.url,
        title: result.metadata?.title || this.extractTitle(content),
        content: content,
        images,
        links,
        screenshot: result.screenshot,
        screenshots,
        timestamp: new Date(),
        status: 'success',
        metadata: {
          statusCode: result.status_code || 200,
          contentType: 'text/html',
          size: content.length,
          loadTime: undefined
        }
      };
    } catch (error) {
      console.error('智能导航失败:', url, error);
      
      return {
        id: this.generateId(),
        url,
        title: '智能导航失败',
        content: '',
        images: [],
        links: [],
        screenshot: undefined,
        screenshots: [],
        timestamp: new Date(),
        status: 'error',
        error: error instanceof Error ? error.message : '未知错误',
        metadata: {}
      };
    }
  }

  // 生成智能导航和截图代码
  private generateNavigationJSCode(navConfig?: NavigationConfig): string {
    if (!navConfig || !navConfig.clickSelectors || navConfig.clickSelectors.length === 0) {
      return '';
    }

    const clickTexts = navConfig.clickSelectors;
    const waitTime = navConfig.waitTime || 3;

    // 单个按钮的简化版本
    if (clickTexts.length === 1) {
      const text = clickTexts[0];
      return `
        // 点击单个按钮
        (async function() {
          async function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
          }
          
          function findElementByText(text) {
            const elements = Array.from(document.querySelectorAll('a, button, [role="button"], .btn, .menu-item, .tab, .nav-item, span, div, li'));
            return elements.find(el => 
              el.textContent && el.textContent.trim().includes(text.trim())
            );
          }
          
          console.log('寻找按钮: "${text}"');
          const element = findElementByText('${text}');
          if (element) {
            console.log('找到按钮，点击:', element.textContent?.trim());
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(1000);
            element.click();
            console.log('已点击按钮');
            await sleep(${waitTime} * 1000);
          } else {
            console.log('未找到按钮: ${text}');
            const allButtons = Array.from(document.querySelectorAll('a, button, [role="button"], .btn, .menu-item, .tab, .nav-item, span, div, li'));
            const buttonTexts = allButtons.slice(0, 10).map(el => el.textContent?.trim()).filter(t => t);
            console.log('页面按钮示例:', buttonTexts);
          }
        })();
      `;
    }
    
    // 多个按钮的智能导航版本：考虑页面跳转
    return `
      // 智能多按钮导航，处理页面跳转
      (async function() {
        async function sleep(ms) {
          return new Promise(resolve => setTimeout(resolve, ms));
        }
        
        function findElementByText(text) {
          const elements = Array.from(document.querySelectorAll('a, button, [role="button"], .btn, .menu-item, .tab, .nav-item, span, div, li'));
          return elements.find(el => 
            el.textContent && el.textContent.trim().includes(text.trim())
          );
        }
        
        // 等待页面稳定加载
        function waitForPageReady() {
          return new Promise((resolve) => {
            if (document.readyState === 'complete') {
              resolve();
            } else {
              window.addEventListener('load', resolve, { once: true });
            }
          });
        }
        
        // 检测页面是否发生跳转
        function hasPageChanged(originalUrl) {
          return window.location.href !== originalUrl;
        }
        
        const clickTargets = ${JSON.stringify(clickTexts)};
        let currentUrl = window.location.href;
        
        console.log('开始智能导航，当前URL:', currentUrl);
        console.log('要点击 ' + clickTargets.length + ' 个按钮:', clickTargets);
        
        for (let i = 0; i < clickTargets.length; i++) {
          const text = clickTargets[i];
          console.log('\\n=== 第' + (i + 1) + '个按钮: "' + text + '" ===');
          
          try {
            // 等待页面完全加载
            await waitForPageReady();
            await sleep(1000);
            
            // 记录点击前的URL
            const beforeClickUrl = window.location.href;
            console.log('点击前URL:', beforeClickUrl);
            
            // 寻找目标元素
            const element = findElementByText(text);
            if (element) {
              console.log('找到按钮:', element.textContent?.trim());
              
              // 滚动到元素位置并点击
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await sleep(800);
              element.click();
              console.log('已点击按钮: "' + text + '"');
              
              // 等待页面响应和可能的跳转
              await sleep(${waitTime} * 1000);
              
              // 检查是否发生页面跳转
              const afterClickUrl = window.location.href;
              if (afterClickUrl !== beforeClickUrl) {
                console.log('检测到页面跳转:');
                console.log('  从: ' + beforeClickUrl);
                console.log('  到: ' + afterClickUrl);
                
                // 如果发生跳转，更新当前URL并等待新页面加载
                currentUrl = afterClickUrl;
                await waitForPageReady();
                await sleep(1500); // 额外等待时间确保页面完全加载
                console.log('新页面已加载完成');
              } else {
                console.log('页面未跳转，在当前页面继续操作');
              }
              
            } else {
              console.log('未找到按钮: "' + text + '"');
              console.log('当前页面URL:', window.location.href);
              
              // 输出当前页面的可点击元素，用于调试
              const allButtons = Array.from(document.querySelectorAll('a, button, [role="button"], .btn, .menu-item, .tab, .nav-item, span, div, li'));
              const buttonTexts = allButtons.slice(0, 15).map(el => el.textContent?.trim()).filter(t => t && t.length < 50);
              console.log('当前页面可点击元素示例:', buttonTexts);
            }
            
          } catch (error) {
            console.error('点击第' + (i + 1) + '个按钮时出错:', error);
          }
          
          // 在下一次点击前稍作等待
          await sleep(500);
        }
        
        console.log('\\n=== 所有按钮点击完成 ===');
        console.log('最终页面URL:', window.location.href);
        
        // 最后等待一段时间确保页面完全稳定
        await sleep(2000);
        
      })();
    `;
  }

  // 解析相对URL为绝对URL
  private resolveUrl(url: string, baseUrl: string): string {
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      if (url.startsWith('//')) {
        const baseProtocol = new URL(baseUrl).protocol;
        return `${baseProtocol}${url}`;
      }
      if (url.startsWith('/')) {
        const base = new URL(baseUrl);
        return `${base.protocol}//${base.host}${url}`;
      }
      return new URL(url, baseUrl).href;
    } catch {
      return url;
    }
  }

  // 从内容中提取标题
  private extractTitle(content: string): string {
    // 确保content是字符串
    if (typeof content !== 'string') {
      return '未知标题';
    }

    // 尝试从markdown中提取标题
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) return h1Match[1].trim();

    // 尝试从HTML中提取标题
    const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) return titleMatch[1].trim();

    // 尝试提取第一行作为标题
    const firstLine = content.split('\n')[0]?.trim();
    if (firstLine && firstLine.length < 100) {
      return firstLine.replace(/^#+\s*/, ''); // 移除markdown标题标记
    }

    return '未知标题';
  }

  // 生成唯一ID
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // 获取整体状态
  getStatus(): CrawlerStatus {
    return { ...this.status };
  }

  // 获取所有结果（向后兼容）
  getResults(): CrawlResult[] {
    const allResults: CrawlResult[] = [];
    for (const task of this.tasks.values()) {
      allResults.push(...task.results);
    }
    return allResults.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // 清空所有结果
  clearResults(): void {
    for (const task of this.tasks.values()) {
      task.results = [];
      task.successCount = 0;
      task.errorCount = 0;
    }
  }

  // 停止所有任务
  stopCrawling(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.status.isRunning = false;
    this.status.currentTaskId = undefined;
    this.status.currentUrl = undefined;

    // 停止所有运行中的任务
    for (const task of this.tasks.values()) {
      if (task.status === 'running') {
        task.status = 'idle';
      }
    }
  }

  // 导出结果为JSON
  exportResults(): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      totalTasks: this.tasks.size,
      tasks: Array.from(this.tasks.values()).map(task => ({
        ...task,
        timerId: undefined, // 不导出定时器
        results: task.results.map(result => ({
          ...result,
          // 分离文本内容和图片资源
          textContent: {
            title: result.title,
            content: result.content,
            url: result.url,
            timestamp: result.timestamp
          },
          imageResources: result.images.map((imageUrl, index) => ({
            id: `${result.id}_img_${index}`,
            url: imageUrl,
            sourceUrl: result.url,
            extractedAt: result.timestamp
          })),
          linkResources: result.links.map((link, index) => ({
            id: `${result.id}_link_${index}`,
            text: link.text,
            url: link.url,
            sourceUrl: result.url,
            extractedAt: result.timestamp
          })),
          screenshot: result.screenshot, // 主页面截图（向后兼容）
          screenshotResources: result.screenshots.map((screenshot, index) => ({
            id: `${result.id}_screenshot_${index}`,
            url: screenshot.url,
            title: screenshot.title,
            screenshot: screenshot.screenshot,
            timestamp: screenshot.timestamp,
            sourceTaskUrl: result.url
          }))
        }))
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  // 工具函数：延迟
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 计算任务的下次执行时间倒计时
  getTaskCountdown(taskId: string): string | null {
    const task = this.tasks.get(taskId);
    if (!task || !task.nextRunTime || !task.timerId) {
      return null;
    }

    const now = new Date().getTime();
    const nextTime = task.nextRunTime.getTime();
    const diffMs = nextTime - now;

    if (diffMs <= 0) {
      return '即将执行';
    }

    const minutes = Math.floor(diffMs / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    if (minutes > 0) {
      return `${minutes}分${seconds}秒后执行`;
    } else {
      return `${seconds}秒后执行`;
    }
  }
}

// 导出单例实例
export const crawlerService = new CrawlerService();

  // 向后兼容的导出
export { CrawlerService };