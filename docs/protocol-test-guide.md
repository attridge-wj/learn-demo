# 协议测试指南

## 测试目标

验证修复后的协议处理逻辑：
1. 应用未启动时，点击协议链接会启动应用并处理参数
2. 应用已启动时，点击协议链接不会创建新窗口，只处理参数

## 测试步骤

### 1. 测试应用未启动的情况

1. 确保没有 rebirth 应用在运行
2. 在浏览器中点击或输入以下链接：
   ```
   rebirth://card-editor?id=test123&cardType=diary&subType=personal
   ```
3. 预期结果：
   - 应用会启动
   - 控制台会显示 "应用未运行，延迟处理协议参数"
   - 1秒后会显示 "设置协议参数: {id: 'test123', cardType: 'diary', subType: 'personal'}"
   - Vue3渲染进程会收到参数并显示日志

### 2. 测试应用已启动的情况

1. 确保 rebirth 应用正在运行
2. 在浏览器中点击或输入以下链接：
   ```
   rebirth://card-editor?id=test456&cardType=note&subType=work
   ```
3. 预期结果：
   - 不会创建新窗口
   - 控制台会显示 "应用已运行，直接处理协议参数"
   - 立即显示 "设置协议参数: {id: 'test456', cardType: 'note', subType: 'work'}"
   - Vue3渲染进程会收到参数并显示日志

### 3. 检查控制台日志

在应用运行时，控制台应该显示以下类型的日志：

```
处理 rebirth 协议: rebirth://card-editor?id=test123&cardType=diary
应用已运行，通过协议处理器处理参数
设置协议参数: { id: 'test123', cardType: 'diary', subType: 'personal' }
```

### 4. 检查Vue3渲染进程日志

在Vue3组件的控制台中应该看到：

```
收到协议参数变化: { id: 'test123', cardType: 'diary', subType: 'personal' }
处理协议参数: { id: 'test123', cardType: 'diary', subType: 'personal' }
准备打开卡片: test123 类型: diary
```

## 常见问题排查

### 问题1：仍然会打开新窗口

**可能原因**：
- 单实例锁没有生效
- 协议处理器被重复注册

**解决方案**：
- 检查控制台是否有 "应用已经在运行，退出当前实例" 的日志
- 确保 `app.requestSingleInstanceLock()` 正常工作

### 问题2：Vue3渲染进程收不到参数

**可能原因**：
- `window.appParamsApi` 未定义
- 监听器设置时机不对
- IPC通信失败

**解决方案**：
- 检查 `preload.ts` 中是否正确暴露了 `appParamsApi`
- 确保在 `onMounted` 中设置监听器
- 检查主进程控制台是否有错误日志

### 问题3：参数解析失败

**可能原因**：
- URL格式不正确
- 协议前缀不匹配

**解决方案**：
- 确保URL格式为 `rebirth://card-editor?id=xxx&cardType=xxx`
- 检查协议前缀是否为 `rebirth://`

## 测试用例

### 基本测试用例

```
rebirth://card-editor?id=123&cardType=diary
rebirth://card-editor?id=456&cardType=note&subType=work
rebirth://card-editor?id=789&enabled=true&count=5
```

### 边界测试用例

```
rebirth://card-editor?id=
rebirth://card-editor?cardType=diary
rebirth://card-editor
```

## 验证清单

- [ ] 应用未启动时，协议链接能正常启动应用
- [ ] 应用已启动时，协议链接不会创建新窗口
- [ ] 参数能正确解析并传递给Vue3渲染进程
- [ ] 控制台日志显示正确的处理流程
- [ ] 单实例锁正常工作
- [ ] 错误处理机制正常工作

## 性能测试

- 连续快速点击协议链接，确保不会创建多个实例
- 大量参数的情况下，确保解析性能正常
- 长时间运行后，确保内存使用正常
