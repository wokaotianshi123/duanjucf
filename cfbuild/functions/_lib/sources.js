// 站源注册表。
//
// 网页版运行在 Cloudflare Workers 运行时，能力边界和原 Go 版差别很大：
//   - 不能编译 Go、没有文件系统、没有 ffmpeg、没有 TLS 指纹伪装（tls-client / utls）。
// 因此只有「纯 HTTPS + 正则解析 + 返回直链 m3u8/mp4」的站源能完整运行。
//
// 当前落地的是爱看机器人（ikanbot）——它恰好满足上述全部条件。
// 其余站源（红果、黄果系列、野果、黄豆等）要么依赖加密流 + ffmpeg 转码，
// 要么依赖 Chrome TLS 指纹绕过风控，在 Workers 上无法工作，故未纳入。
//
// 若要继续扩展，只需在此处与 _lib 下新增一个同鱼类模块即可。

import * as ikanbot from './ikanbot.js';

const REGISTRY = [ikanbot];

export function allSources() {
  return REGISTRY.map((item) => ({ id: item.SOURCE_ID, name: item.SOURCE_NAME }));
}

export function getSource(id) {
  return REGISTRY.find((item) => item.SOURCE_ID === id) || null;
}

export function sourceNames() {
  const map = {};
  for (const item of REGISTRY) {
    map[item.SOURCE_ID] = item.SOURCE_NAME;
  }
  return map;
}

export function unauthorizedSource(id) {
  return new Error('当前网页版不包含此站源' + (id ? '（' + id + '）' : ''));
}