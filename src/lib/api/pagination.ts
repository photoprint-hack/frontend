import type { Paginated } from '@/types/api';
import { http } from './client';

/** Exhaust server pagination for screens that consume a complete collection. */
export async function readAllPages<T>(path: string, params?: Record<string, unknown>): Promise<Paginated<T>> {
  const first = await http.get<Paginated<T>>(path, { params: { ...params, page: 1, page_size: 100 } });
  const items = [...first.items];
  for (let page = 2; page <= first.pages; page += 1) {
    const next = await http.get<Paginated<T>>(path, { params: { ...params, page, page_size: 100 } });
    items.push(...next.items);
  }
  return { ...first, items };
}
