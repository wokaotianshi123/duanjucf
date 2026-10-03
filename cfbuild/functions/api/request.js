// POST /api/request —— 目录、分类、详情等通用请求入口。
// 对应原 Go 版的 handleRequest + core.NativeRequest 的 catalog / categories / detail 分支。

import { cleanText, fail, ok, readJSON } from '../_lib/util.js';
import { allSources, getSource } from '../_lib/sources.js';

function sanitizeDrama(raw) {
  const drama = raw && typeof raw === 'object' ? raw : {};
  return {
    id: String(drama.id || ''),
    source: String(drama.source || ''),
    title: cleanText(drama.title || ''),
    cover: String(drama.cover || ''),
  };
}

function sourceOf(input, drama) {
  const direct = String((input && input.source) || '').trim();
  if (direct) {
    return direct;
  }
  const id = String((drama && drama.id) || '');
  if (id.includes(':')) {
    return id.split(':')[0];
  }
  return '';
}

export async function onRequestPost(context) {
  const { request } = context;
  let input;
  try {
    input = await readJSON(request);
  } catch (error) {
    return fail('请求不是合法 JSON');
  }
  const action = String(input.action || '');
  const drama = sanitizeDrama(input.drama);
  const sourceID = sourceOf(input, drama);

  try {
    if (action === 'categories') {
      const source = getSource(sourceID);
      if (!source) {
        return fail('当前网页版不包含此站源' + (sourceID ? '（' + sourceID + '）' : ''));
      }
      const items = (source.CATEGORIES || []).map((entry) => ({ id: entry.id, name: entry.name }));
      return ok({ items });
    }

    if (action === 'catalog') {
      const source = getSource(sourceID);
      if (!source) {
        return fail('当前网页版不包含此站源' + (sourceID ? '（' + sourceID + '）' : ''));
      }
      const page = Number(input.page) || 1;
      const category = String(input.category || '');
      const query = String(input.query || '');
      const result = await source.fetchCatalogPage(page, category, query);
      return ok({
        items: result.items,
        hasMore: !!result.hasMore,
        page,
      });
    }

    if (action === 'detail') {
      const source = getSource(sourceID);
      if (!source) {
        return fail('当前网页版不包含此站源' + (sourceID ? '（' + sourceID + '）' : ''));
      }
      const id = String(drama.id || '');
      const parts = id.split(':');
      const providerID = parts[1] || '';
      const result = await source.fetchDetail(providerID);
      return ok(result);
    }

    if (action === 'sourceStatus') {
      // 源是否可用，用于 /api/sources 过滤。
      const source = getSource(sourceID);
      return ok({ available: !!source });
    }

    return fail('不支持的请求类型' + (action ? '：' + action : ''));
  } catch (error) {
    return fail(error && error.message ? error.message : '站源请求失败');
  }
}

export async function onRequestGet() {
  // 便于自检，列出可用站源。
  return ok({ sources: allSources() });
}