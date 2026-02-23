'use strict'

/**
 * static files (404.html, sw.js, conf.js)
 */
const PREFIX = '/'
// 部署时间，每次部署时手动更新
const DEPLOY_TIME = '2026-02-23 15:40:23'
const Config = {
    jsdelivr: 0 // 此配置保留但未使用
}

const whiteList = [] // 白名单

const PREFLIGHT_INIT = {
    status: 204,
    headers: new Headers({
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,TRACE,DELETE,HEAD,OPTIONS',
        'access-control-max-age': '1728000',
    }),
}

// HTML 页面模板
const HTML_PAGE = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Wallhaven 加速</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .container {
            background: white;
            padding: 2rem;
            border-radius: 15px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 800px;
            margin: 20px;
        }

        h2 {
            color: #2c3e50;
            margin-bottom: 1.5rem;
            text-align: center;
            font-weight: 600;
        }

        form {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        input {
            flex: 1;
            padding: 12px 15px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s ease;
        }

        input:focus {
            outline: none;
            border-color: #3498db;
            box-shadow: 0 0 5px rgba(52, 152, 219, 0.3);
        }

        button {
            padding: 12px 25px;
            background: #3498db;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            transition: background 0.3s ease, transform 0.1s ease;
        }

        button:hover {
            background: #2980b9;
        }

        button:active {
            transform: scale(0.98);
        }

        pre {
            background: #f6f6f6;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            margin-top: 20px;
            font-size: 14px;
        }

        .footer {
            margin-top: 2rem;
            text-align: center;
            color: #666;
            font-size: 14px;
        }

        .footer a {
            color: #3498db;
            text-decoration: none;
            transition: color 0.3s ease;
        }

        .footer a:hover {
            color: #2980b9;
            text-decoration: underline;
        }

        .deploy-time {
            font-size: 12px;
            color: #999;
            margin-bottom: 10px;
        }

        @media (max-width: 480px) {
            form {
                flex-direction: column;
            }
            
            button {
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Wallhaven 加速</h2>
        <form onsubmit="handleSubmit(event)">
            <input type="text" id="urlInput" placeholder="输入要加速的URL，如 https://wallhaven.cc/api/v1/search?q=girl" required>
            <button type="submit">提交</button>
        </form>
        <div class="footer">
            <div class="deploy-time">部署时间：${DEPLOY_TIME}</div>
            推荐使用路径方式：https://domain.com/https://wallhaven.cc/xxx<br>
            项目基于Cloudflare Workers，开源于GitHub
            <a href="https://github.com/KevinZjYang/Wallhaven-Proxy" target="_blank">
                KevinZjYang/Wallhaven-Proxy
            </a>
        </div>
    </div>
    <script>
        function handleSubmit(event) {
            event.preventDefault();
            const url = document.getElementById('urlInput').value.trim();
            // 先对用户输入的 URL 进行编码，避免 & 被截断
            const encodedUrl = encodeURIComponent(url);
            const proxyUrl = '/?q=' + encodedUrl;
            window.open(proxyUrl, '_blank');
        }
    </script>
</body>
</html>
`

const exp = [
    /^(?:https?:\/\/)?wallhaven\.cc\/.+/i,
    /^(?:https?:\/\/)?(?:w\.)?wallhaven\.cc\/.+/i,
    /^(?:https?:\/\/)?(?:th\.)?wallhaven\.cc\/.+/i,
]

function makeRes(body, status = 200, headers = {}) {
    headers['access-control-allow-origin'] = '*'
    return new Response(body, { status, headers })
}

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

    // 支持不带 https:// 前缀的方式：/wallhaven.cc/xxx
    const pathWithoutSlash = urlObj.pathname.slice(1); // 去掉开头的 /
    let handled = false; // 标记是否已处理请求
    if (pathWithoutSlash.match(/^(wallhaven\.cc|w\.wallhaven\.cc|th\.wallhaven\.cc)\//i)) {
        const urlStrProxy = 'https://' + pathWithoutSlash + urlObj.search;
        const urlObjProxy = newUrl(urlStrProxy);
        if (urlObjProxy) {
            const reqInit = {
                method: req.method,
                headers: new Headers(req.headers),
                redirect: 'manual',
                body: req.body
            }
            handled = true;
            return proxy(urlObjProxy, reqInit)
        }
    }

    // 如果路径已处理，跳过后续的 q 参数处理
    if (handled) {
        return makeRes('Proxy error', 500);
    }

    // 显示输入页面
    if (req.method === 'GET' && urlObj.pathname === PREFIX) {
        const q = urlObj.searchParams.get('q')
        if (!q) {
            return new Response(HTML_PAGE, {
                headers: { 'content-type': 'text/html;charset=UTF-8' }
            })
        }
    }

    let path = urlObj.searchParams.get('q')
    if (path) {
        // 解码 URL，避免 & 被截断
        path = decodeURIComponent(path)
        // 如果是完整 URL，直接代理
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

    path = urlObj.href.slice(urlObj.origin.length + PREFIX.length)
    
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

    const reqHdrNew = new Headers(req.headers)
    let urlStrProxy = path
    if (urlStrProxy.search(/^https?:\/\//) !== 0) {
        urlStrProxy = `https://${urlStrProxy}`
    }

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

    const reqInit = {
        method: req.method,
        headers: reqHdrNew,
        redirect: 'manual',
        body: req.body
    }
    return proxy(urlObjProxy, reqInit)
}

async function proxy(urlObj, reqInit) {
    const res = await fetch(urlObj.href, reqInit)
    const resHdrOld = res.headers
    const resHdrNew = new Headers(resHdrOld)
    const status = res.status

    if (resHdrNew.has('location')) {
        let _location = resHdrNew.get('location')
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
            reqInit.redirect = 'follow'
            return proxy(newUrl(_location), reqInit)
        }
    }

    resHdrNew.set('access-control-expose-headers', '*')
    resHdrNew.set('access-control-allow-origin', '*')
    resHdrNew.delete('content-security-policy')
    resHdrNew.delete('content-security-policy-report-only')
    resHdrNew.delete('clear-site-data')

    return new Response(res.body, {
        status,
        headers: resHdrNew,
    })
}
