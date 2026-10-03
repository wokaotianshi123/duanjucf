// 共享工具函数：JSON 响应、HTML 实体解码、文本清洗、截断。
// 命名以 _ 开头，不会被 Cloudflare Pages 注册成路由。

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign(
      {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      extraHeaders,
    ),
  });
}

export function ok(data) {
  return jsonResponse({ ok: true, data: data === undefined ? null : data });
}

export function fail(message, code) {
  const body = { ok: false, error: message || '请求失败' };
  if (code) {
    body.code = code;
  }
  return jsonResponse(body);
}

const NAMED_ENTITIES = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

// 解码 HTML 实体（数字与常见命名实体）。
export function unescapeHTML(text) {
  return String(text == null ? '' : text).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code) => {
    if (code.charAt(0) === '#') {
      const hex = code.charAt(1) === 'x' || code.charAt(1) === 'X';
      const value = parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (Number.isFinite(value) && value >= 0 && value <= 0x10ffff) {
        try {
          return String.fromCodePoint(value);
        } catch (error) {
          return match;
        }
      }
      return match;
    }
    if (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, code)) {
      return NAMED_ENTITIES[code];
    }
    return match;
  });
}

export function stripTags(text) {
  return String(text == null ? '' : text).replace(/<[^>]+>/g, '');
}

// 去标签、解实体、压缩空白。
export function cleanText(text) {
  if (!text) {
    return '';
  }
  let out = stripTags(text);
  out = unescapeHTML(out);
  out = out.replace(/\u3000/g, ' ');
  return out.split(/\s+/).filter(Boolean).join(' ');
}

export function truncate(text, limit) {
  const value = String(text == null ? '' : text).trim();
  const chars = Array.from(value);
  if (chars.length <= limit) {
    return value;
  }
  return chars.slice(0, limit).join('') + '...';
}

export function firstNonEmpty(...values) {
  for (const value of values) {
    if (value != null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

export async function readJSON(request, limit = 1 << 20) {
  const text = await request.text();
  if (text.length > limit) {
    throw new Error('请求体过大');
  }
  return JSON.parse(text);
}

// 带超时的抓取，统一设置浏览器式请求头。
export async function fetchText(url, { referer, userAgent, timeoutMs = 20000, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: Object.assign(
        {
          'User-Agent':
            userAgent ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9',
        },
        referer ? { Referer: referer } : {},
        headers,
      ),
    });
    if (!response.ok) {
      throw new Error(`上游返回 ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}