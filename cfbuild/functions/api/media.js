// GET /api/media?u=<上游地址>&r=<referer> —— 媒体同源代理。
//
// 上游 m3u8 / ts / mp4 都是跨域的，浏览器直接拉会受 CORS 与 Referer 防盗链限制。
// 这里用同源路径转发：m3u8 播放列表里的分片地址会重写成继续走本代理，
// 于是 hls.js 只跟同源打交道，跨域与 Referer 都由服务端处理。

const PASSTHROUGH_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified'];
const M3U8_TYPES = ['mpegurl', 'x-mpegurl', 'vnd.apple.mpegurl'];

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const target = url.searchParams.get('u');
  if (!target) {
    return new Response('缺少媒体地址', { status: 400 });
  }
  const referer = url.searchParams.get('r') || '';
  if (!/^https?:\/\//i.test(target)) {
    return new Response('媒体地址无效', { status: 400 });
  }

  const range = request.headers.get('Range');
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Accept: '*/*',
  };
  if (referer) {
    headers.Referer = referer;
  }
  if (range) {
    headers.Range = range;
  }

  let upstream;
  try {
    upstream = await fetch(target, { method: 'GET', headers, redirect: 'follow' });
  } catch (error) {
    return new Response('上游取流失败：' + (error.message || error), { status: 502 });
  }

  const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
  const isPlaylist = M3U8_TYPES.some((type) => contentType.includes(type)) || /\.m3u8(\?|$)/i.test(target);

  if (isPlaylist && upstream.ok) {
    const body = await upstream.text();
    const rewritten = rewritePlaylist(body, target, referer);
    return new Response(rewritten, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const outHeaders = new Headers();
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) {
      outHeaders.set(name, value);
    }
  }
  outHeaders.set('Access-Control-Allow-Origin', '*');
  return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
}

// 把播放列表里的所有 URI（分片与嵌套列表）改写成继续走本代理。
// 相对地址按上游地址解析后再包一层，嵌套列表同样会被本函数再次改写。
function rewritePlaylist(body, base, referer) {
  const lines = body.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      out.push(line);
      continue;
    }
    if (trimmed.startsWith('#')) {
      // 关键帧 / 加密等标签里也可能带 URI 属性，一并改写。
      out.push(line.replace(/URI="([^"]+)"/g, (match, uri) => 'URI="' + proxyFor(uri, base, referer) + '"'));
      continue;
    }
    out.push(proxyFor(trimmed, base, referer));
  }
  return out.join('\n');
}

function proxyFor(raw, base, referer) {
  let absolute;
  try {
    absolute = new URL(raw, base).toString();
  } catch (error) {
    return raw;
  }
  const query = new URLSearchParams({ u: absolute });
  if (referer) {
    query.set('r', referer);
  }
  return '/api/media?' + query.toString();
}