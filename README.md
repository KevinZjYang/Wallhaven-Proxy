# Wallhaven-Proxy

## 简介
wallhaven.cc 站点 API 请求及图片的加速项目，部署在 Cloudflare Workers。

## 代理的地址
- `https://wallhaven.cc/xxx` - 主站
- `https://w.wallhaven.cc/xxx` - 全尺寸图片
- `https://th.wallhaven.cc/xxx` - 缩略图

## worker.js 和 worker_html.js 的区别
- `worker.js` - 纯代理版本
- `worker_html.js` - 带网页调试界面版本（推荐）

![界面预览](https://github.com/user-attachments/assets/ce421f6f-693c-4623-a667-b81434381f77)

## 使用方式

### 方式一（推荐）：路径前缀
```
https://your-domain.com/https://wallhaven.cc/api/v1/search?q=girl
https://your-domain.com/wallhaven.cc/api/v1/search?q=girl
```

支持的格式：
- `domain/https://wallhaven.cc/xxx` - 带 https:// 前缀
- `domain/wallhaven.cc/xxx` - 简写形式
- `domain/w.wallhaven.cc/xxx` - 图片域名
- `domain/th.wallhaven.cc/xxx` - 缩略图域名

### 方式二：查询参数
```
https://your-domain.com?q=https://wallhaven.cc/api/v1/search?q=girl
```
注意：URL 中的 `&` 需要编码为 `%26`

## Cloudflare Workers 部署

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 Workers 和 Pages → 创建 Worker
3. 将 `workers_html.js` 代码粘贴到编辑器，点击部署
4. 设置 → 域和路由 → 添加自定义域

## 部署时间
页面底部会显示最近部署时间（手动更新）。

## Cloudflare Workers 计费
- 免费版：每天 10 万次请求，每分钟 1000 次请求限制
- $5/月：每月 1000 万次请求，超出部分 $0.5/百万次

## 参考
[hunshcn/gh-proxy](https://github.com/hunshcn/gh-proxy)
