// GET /api/sources —— 可用站源列表。
// 对应原 Go 版 handleSources：逐个探测源可用性，这里直接返回注册表。

import { jsonResponse } from '../_lib/util.js';
import { allSources } from '../_lib/sources.js';

export async function onRequestGet() {
  return jsonResponse({ items: allSources() });
}