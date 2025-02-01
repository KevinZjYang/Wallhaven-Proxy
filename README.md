# Wallhaven-Proxy
## 简介
wallhaven.cc站点api请求及图片的加速项目，部署在Cloudflare Workers。

## cf worker部署
需要有一个托管在cf的域名。cf的域名在国内访问很差。

首页：https://dash.cloudflare.com/

- 1、注册，登陆，计算（workers），Workers 和 Pages，创建--创建worker，取个名字直接部署。

- 2、复制worker.js中的代码到左侧代码框，右上角部署。
- 3、返回后点击创建的worker，设置，域和路由，添加自定义域。

## Cloudflare Workers计费
到 overview 页面可参看使用情况。免费版每天有 10 万次免费请求，并且有每分钟1000次请求的限制。

如果不够用，可升级到 $5 的高级版本，每月可用 1000 万次请求（超出部分 $0.5/百万次请求）。

## 参考
[hunshcn/gh-proxy](https://github.com/hunshcn/gh-proxy)
