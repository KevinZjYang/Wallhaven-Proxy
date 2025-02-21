'use strict'

/**
 * static files (404.html, sw.js, conf.js)
 */
const PREFIX = '/'
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
    <title>Wallhaven 加速 </title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; }
        input { width: 70%; padding: 8px; }
        button { padding: 8px 16px; margin-left: 10px; }
        pre { background: #f6f6f6; padding: 15px; overflow-x: auto; }
    </style>
</head>
<body>
    <h2>Wallhaven 加速</h2>
    <form onsubmit="handleSubmit(event)">
        <input type="text" id="urlInput" placeholder="Enter URL to proxy" required>
        <button type="submit">提交</button>
    </form>
    <script>
        function handleSubmit(event) {
            event.preventDefault();
            const url = document.getElementById('urlInput').value;
            fetch('/?q=' + encodeURIComponent(url))
                .then(response => {
                    const contentType = response.headers.get('content-type') || '';
                    if (contentType.includes('image')) {
                        window.open('/?q=' + encodeURIComponent(url), '_blank');
                    } else if (contentType.includes('json')) {
                        return response.json().then(data => {
                            const win = window.open('', '_blank');
                            win.document.write(
                                '<pre>' + 
                                JSON.stringify(data, null, 2) + 
                                '</pre>'
                            );
                        });
                    } else {
                        window.open('/?q=' + encodeURIComponent(url), '_blank');
                    }
                })
                .catch(err => alert('Error: ' + err.message));
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
        return Response.redirect(`https://${urlObj.host}${PREFIX}${path}`, 301)
    }

    path = urlObj.href.substr(urlObj.origin.length + PREFIX.length)
    
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
