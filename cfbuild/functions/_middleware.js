// Cloudflare Pages Functions 中间件。
//
// 作用：给所有 /api/* 响应补上基础安全头，并把未捕获的异常统一转成 JSON，
// 避免前端拿到一坨 HTML 错误页而 parse 失败。

export async function onRequest(context) {
  try {
    const response = await context.next();
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'no-referrer');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch (error) {
    const message = (error && error.message) || '服务内部错误';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}