import { BrowserWindow } from 'electron';

export interface AppStartParams {
  [key: string]: string;
}

export class AppStartParamsManager {
  private static instance: AppStartParamsManager;
  private currentParams: AppStartParams = {};

  private constructor() {}

  public static getInstance(): AppStartParamsManager {
    if (!AppStartParamsManager.instance) {
      AppStartParamsManager.instance = new AppStartParamsManager();
    }
    return AppStartParamsManager.instance;
  }

  /**
   * 解析自定义协议参数
   */
  public parseProtocolParams(protocolUrl: string): AppStartParams {
    try {
      // 移除协议前缀
      const cleanUrl = protocolUrl.replace(/^rebirth:\/\//, '');
      
      // 分离路径和参数
      const [path, queryString] = cleanUrl.split('?');
      
      if (!queryString) {
        return {};
      }
      
      // 构造完整的URL进行解析
      const fullUrl = `http://localhost?${queryString}`;
      const urlObj = new URL(fullUrl);
      const searchParams = urlObj.searchParams;
      
      const params: AppStartParams = {};
      for (const [key, value] of searchParams.entries()) {
        params[key] = value;
      }
      
      return params;
    } catch (error) {
      // 直接忽略错误
      return {};
    }
  }

  /**
   * 设置参数并通知渲染进程
   */
  public setParamsAndNotify(params: AppStartParams): void {
    if (Object.keys(params).length === 0) {
      return;
    }
    
    this.currentParams = { ...params };
    console.log('设置协议参数:', params);
    
    // 通知所有渲染进程窗口
    this.notifyRenderProcesses();
  }

  /**
   * 获取当前参数
   */
  public getParams(): AppStartParams {
    return { ...this.currentParams };
  }

  /**
   * 清空当前参数
   */
  public clearParams(): void {
    if (Object.keys(this.currentParams).length > 0) {
      this.currentParams = {};
      console.log('清空协议参数');
      // 通知渲染进程参数已清空
      this.notifyRenderProcesses();
    }
  }

  /**
   * 通知渲染进程参数变化
   */
  private notifyRenderProcesses(): void {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      try {
        // 检查渲染进程是否准备就绪
        if (window.webContents && !window.webContents.isDestroyed()) {
          window.webContents.send('app-params:changed', this.currentParams);
        }
      } catch (error) {
        // 直接忽略错误
      }
    }
  }

  /**
   * 处理启动参数
   */
  public handleStartupParams(): void {
    const args = process.argv;
    for (const arg of args) {
      if (arg.startsWith('rebirth://')) {
        const params = this.parseProtocolParams(arg);
        if (Object.keys(params).length > 0) {
          this.setParamsAndNotify(params);
        }
      }
    }
  }

  /**
   * 处理运行时协议参数
   */
  public handleRuntimeParams(protocolUrl: string): void {
    const params = this.parseProtocolParams(protocolUrl);
    if (Object.keys(params).length > 0) {
      this.setParamsAndNotify(params);
    }
  }
}

// 导出单例实例
export const appStartParamsManager = AppStartParamsManager.getInstance();
