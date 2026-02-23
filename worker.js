'use strict'

/**
 * static files (404.html, sw.js, conf.js)
 */
// 前缀，如果自定义路由为 example.com/wh/*，将 PREFIX 改为 '/wh/'，注意少一个杠都会错！
const PREFIX = '/'
const Config = {
    jsdelivr: 0 // 此配置保留但未使用
}

const whiteList = [] // 白名单，路径里面有包含字符的才会通过

/** @type {ResponseInit} */
const PREFLIGHT_INIT = {
    status: 204,
    headers: new Headers({
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,TRACE,DELETE,HEAD,OPTIONS',
        'access-control-max-age': '1728000',
    }),
}

// 匹配 wallhaven.cc 的各种 URL 模式
const exp = [
    // 匹配 API 请求：https://wallhaven.cc/api/xxx
    /^(?:https?:\/\/)?wallhaven\.cc\/.+/i,
    // 匹配全尺寸图片：https://w.wallhaven.cc/full/5g/wallhaven-5g9r91.jpg
    /^(?:https?:\/\/)?(?:w\.)?wallhaven\.cc\/.+/i,
    // 匹配小尺寸图片：https://th.wallhaven.cc/small/5g/5g9r91.jpg
    /^(?:https?:\/\/)?(?:th\.)?wallhaven\.cc\/.+/i,
]

/**
 * @param {any} body
 * @param {number} status
 * @param {Object<string, string>} headers
 */
function makeRes(body, status = 200, headers = {}) {
    headers['access-control-allow-origin'] = '*'
    return new Response(body, { status, headers })
}

/**
 * @param {string} urlStr
 */
function newUrl(urlStr) {
    try {
        return new URL(urlStr)
    } catch (err) {
        return null
    }
}

addEventListener('fetch', e => {
    const ret = fetchHandler(e)
        .catch(err => makeRes('cfworker error:\n' + err.stack, 502))
    e.respondWith(ret)
})

/**
 * @param {FetchEvent} e
 */
async function fetchHandler(e) {
    const req = e.request
    const urlStr = req.url
    const urlObj = new URL(urlStr)

    // 优先处理路径前缀方式（最可靠）：/https://wallhaven.cc/xxx
    const pathPrefix = '/https://';
    if (urlObj.pathname.startsWith(pathPrefix)) {
        const urlStrProxy = 'https://' + urlObj.pathname.slice(pathPrefix.length) + urlObj.search;
        const urlObjProxy = newUrl(urlStrProxy);
        if (urlObjProxy) {
            const reqInit = {
                method: req.method,
                headers: new Headers(req.headers),
                redirect: 'manual',
                body: req.body
            }
            return proxy(urlObjProxy, reqInit)
        }
    }

    // 获取路径参数中的 q 值（用于直接代理）
    // 使用 URLSearchParams 获取完整的 q 值，避免 & 符号截断问题
    let path = new URLSearchParams(urlObj.search).get('q')
    if (path) {
        // 检查是否已经是完整 URL，直接代理而不是重定向
        if (path.match(/^https?:\/\//)) {
            const urlObjProxy = newUrl(path)
            if (urlObjProxy) {
                const reqInit = {
                    method: req.method,
                    headers: new Headers(req.headers),
                    redirect: 'manual',
                    body: req.body
                }
                return proxy(urlObjProxy, reqInit)
            }
        }
        return Response.redirect(`https://${urlObj.host}${PREFIX}${path}`, 301)
    }

    // 提取完整路径并处理
    path = urlObj.href.slice(urlObj.origin.length + PREFIX.length)
    
    // 检查是否匹配 wallhaven.cc 的 URL 模式
    let matched = false
    for (const regex of exp) {
        if (regex.test(path)) {
            matched = true
            break
        }
    }
    if (!matched) {
        return makeRes('Not supported URL', 404)
    }

    // 处理请求头和代理
    const reqHdrNew = new Headers(req.headers)

    let urlStrProxy = path
    // 如果没有协议前缀，添加 https://
    if (urlStrProxy.search(/^https?:\/\//) !== 0) {
        urlStrProxy = `https://${urlStrProxy}`
    }

    // 检查是否在白名单范围内
    let flag = !Boolean(whiteList.length)
    for (const i of whiteList) {
        if (urlStrProxy.includes(i)) {
            flag = true
            break
        }
    }
    if (!flag) {
        return makeRes('Blocked by whitelist', 403)
    }

    const urlObjProxy = newUrl(urlStrProxy)
    if (!urlObjProxy) {
        return makeRes('Invalid URL', 400)
    }

    // 发起代理请求
    const reqInit = {
        method: req.method,
        headers: reqHdrNew,
        redirect: 'manual',
        body: req.body
    }
    return proxy(urlObjProxy, reqInit)
}

/**
 * @param {URL} urlObj
 * @param {RequestInit} reqInit
 */
async function proxy(urlObj, reqInit) {
    const res = await fetch(urlObj.href, reqInit)
    const resHdrOld = res.headers
    const resHdrNew = new Headers(resHdrOld)

    const status = res.status

    // 处理重定向
    if (resHdrNew.has('location')) {
        let _location = resHdrNew.get('location')
        // 如果新的 location 匹配 wallhaven.cc 模式，更新 location
        let matched = false
        for (const regex of exp) {
            if (regex.test(_location)) {
                matched = true
                break
            }
        }
        if (matched) {
            resHdrNew.set('location', `${PREFIX}${_location}`)
        } else {
            // 跟随重定向
            reqInit.redirect = 'follow'
            return proxy(newUrl(_location), reqInit)
        }
    }

    // 设置 CORS 头
    resHdrNew.set('access-control-expose-headers', '*')
    resHdrNew.set('access-control-allow-origin', '*')

    // 删除不必要的安全头
    resHdrNew.delete('content-security-policy')
    resHdrNew.delete('content-security-policy-report-only')
    resHdrNew.delete('clear-site-data')

    return new Response(res.body, {
        status,
        headers: resHdrNew,
    })
}
