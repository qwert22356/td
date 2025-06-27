import React, { useState, useEffect } from 'react';
import { crawlerService, CrawlerStatus as CrawlerStatusType, CrawlerTask } from '../services/crawler';
import { 
  PlayIcon,
  PauseIcon,
  StopIcon,
  ClockIcon,
  DocumentTextIcon,
  PhotoIcon,
  LinkIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  CpuChipIcon
} from '@heroicons/react/24/outline';

interface CrawlerStatusProps {
  stats: CrawlerStatusType;
  onStop: () => void;
}

export const CrawlerStatus: React.FC<CrawlerStatusProps> = ({
  stats,
  onStop,
}) => {
  const [tasks, setTasks] = useState<CrawlerTask[]>([]);
  const [isServiceHealthy, setIsServiceHealthy] = useState<boolean | null>(null);

  // 定期更新任务列表和服务状态
  useEffect(() => {
    const updateStatus = async () => {
      const currentTasks = crawlerService.getTasks();
      setTasks(currentTasks);
      
      try {
        const healthy = await crawlerService.checkServiceHealth();
        setIsServiceHealthy(healthy);
      } catch {
        setIsServiceHealthy(false);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // 计算统计信息
  const runningTasks = tasks.filter(t => t.status === 'running').length;
  const totalTasks = tasks.length;
  const totalRuns = tasks.reduce((sum, t) => sum + t.totalRuns, 0);
  const totalSuccess = tasks.reduce((sum, t) => sum + t.successCount, 0);
  const totalErrors = tasks.reduce((sum, t) => sum + t.errorCount, 0);
  const tasksWithSchedule = tasks.filter(t => t.config.repeatInterval && t.timerId).length;

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟${secs}秒`;
    }
    if (minutes > 0) {
      return `${minutes}分钟${secs}秒`;
    }
    return `${secs}秒`;
  };

  const getSystemStatusIcon = () => {
    if (runningTasks > 0) {
      return <PlayIcon className="h-5 w-5" />;
    }
    return <StopIcon className="h-5 w-5" />;
  };

  const getSystemStatusText = () => {
    if (runningTasks > 0) {
      return `${runningTasks} 个任务运行中`;
    }
    if (tasksWithSchedule > 0) {
      return `${tasksWithSchedule} 个任务等待中`;
    }
    return '系统空闲';
  };

  const getSystemStatusColor = () => {
    if (runningTasks > 0) {
      return 'text-green-600 bg-green-50';
    }
    if (tasksWithSchedule > 0) {
      return 'text-blue-600 bg-blue-50';
    }
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">系统状态</h2>
        <div className="flex items-center space-x-2">
          {runningTasks > 0 && (
            <button
              onClick={onStop}
              className="inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100"
            >
              <StopIcon className="h-4 w-4 mr-1" />
              停止所有任务
            </button>
          )}
        </div>
      </div>

      {/* 核心状态指标 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${getSystemStatusColor()}`}>
              {getSystemStatusIcon()}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">系统状态</p>
              <p className="text-lg font-semibold text-gray-900">{getSystemStatusText()}</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center">
            <DocumentTextIcon className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-700">总任务数</p>
              <p className="text-lg font-semibold text-blue-900">{totalTasks}</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center">
            <CheckCircleIcon className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-700">成功执行</p>
              <p className="text-lg font-semibold text-green-900">{totalSuccess}</p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 p-4 rounded-lg">
          <div className="flex items-center">
            <XCircleIcon className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-red-700">执行失败</p>
              <p className="text-lg font-semibold text-red-900">{totalErrors}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 服务状态和当前活动 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Crawl4AI 服务状态 */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <CpuChipIcon className="h-6 w-6 text-gray-600 mr-2" />
              <h3 className="text-sm font-medium text-gray-800">Crawl4AI 服务</h3>
            </div>
            <div className="flex items-center">
              <div className={`h-2 w-2 rounded-full mr-2 ${
                isServiceHealthy === null ? 'bg-yellow-400 animate-pulse' :
                isServiceHealthy ? 'bg-green-400' : 'bg-red-400'
              }`}></div>
              <span className={`text-xs font-medium ${
                isServiceHealthy === null ? 'text-yellow-600' :
                isServiceHealthy ? 'text-green-600' : 'text-red-600'
              }`}>
                {isServiceHealthy === null ? '检查中' : isServiceHealthy ? '在线' : '离线'}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-600">Docker 容器运行在 localhost:11235</p>
          {!isServiceHealthy && isServiceHealthy !== null && (
            <p className="text-xs text-red-600 mt-1">
              请执行: docker-compose up -d
            </p>
          )}
        </div>

        {/* 当前活动 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <ClockIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h3 className="text-sm font-medium text-blue-800">当前活动</h3>
          </div>
          {stats.isRunning && stats.currentUrl ? (
            <div>
              <p className="text-xs text-blue-700 mb-1">正在处理</p>
              <p className="text-xs text-blue-800 break-all">{stats.currentUrl}</p>
              <div className="mt-2 text-xs text-blue-600">
                进度: {stats.completedCount} / {stats.totalCount || '∞'}
              </div>
            </div>
          ) : (
            <div>
              {tasksWithSchedule > 0 ? (
                <div>
                  <p className="text-xs text-blue-700">{tasksWithSchedule} 个任务已安排定时执行</p>
                  <div className="mt-2 space-y-1">
                    {tasks.filter(t => t.timerId).slice(0, 3).map(task => {
                      const countdown = crawlerService.getTaskCountdown(task.id);
                      return (
                        <div key={task.id} className="text-xs text-blue-600">
                          {task.name}: {countdown || '计算中...'}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-blue-700">暂无活动任务</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 错误信息 */}
      {stats.errors && stats.errors.length > 0 && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-sm font-medium text-red-800">最近错误</p>
          </div>
          <div className="space-y-1">
            {stats.errors.slice(-3).map((error, index) => (
              <p key={index} className="text-sm text-red-700">
                • {error}
              </p>
            ))}
            {stats.errors.length > 3 && (
              <p className="text-xs text-red-600">
                还有 {stats.errors.length - 3} 个错误...
              </p>
            )}
          </div>
        </div>
      )}

      {/* 快速统计 */}
      <div className="mt-6 grid grid-cols-3 gap-4 text-center">
        <div className="bg-purple-50 p-3 rounded-lg">
          <p className="text-lg font-bold text-purple-600">{totalRuns}</p>
          <p className="text-xs text-purple-700">总执行次数</p>
        </div>
        <div className="bg-indigo-50 p-3 rounded-lg">
          <p className="text-lg font-bold text-indigo-600">{tasksWithSchedule}</p>
          <p className="text-xs text-indigo-700">定时任务</p>
        </div>
        <div className="bg-emerald-50 p-3 rounded-lg">
          <p className="text-lg font-bold text-emerald-600">
            {totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 100) : 0}%
          </p>
          <p className="text-xs text-emerald-700">成功率</p>
        </div>
      </div>
    </div>
  );
}; 