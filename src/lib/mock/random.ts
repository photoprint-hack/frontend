/** Детерминированный PRNG, чтобы демо-данные были воспроизводимы между перезагрузками. */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number) {
  const random = mulberry32(seed);
  return {
    random,
    int(min: number, max: number) {
      return Math.floor(random() * (max - min + 1)) + min;
    },
    float(min: number, max: number, digits = 2) {
      const value = random() * (max - min) + min;
      const factor = 10 ** digits;
      return Math.round(value * factor) / factor;
    },
    pick<T>(items: readonly T[]): T {
      return items[Math.floor(random() * items.length)] as T;
    },
    chance(probability: number) {
      return random() < probability;
    },
    weighted<T extends string>(entries: readonly (readonly [T, number])[]): T {
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
      let roll = random() * total;
      for (const [value, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return value;
      }
      return entries[entries.length - 1]![0];
    },
    shuffle<T>(items: T[]): T[] {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
      }
      return copy;
    },
  };
}

export type Rng = ReturnType<typeof createRng>;

const UUID_CHARS = '0123456789abcdef';

/** Стабильные UUID из целочисленного индекса — связи между наборами не рвутся. */
export function uuidFrom(prefix: number, index: number): string {
  const base = `${prefix.toString(16).padStart(8, '0')}${index.toString(16).padStart(8, '0')}`;
  let out = '';
  for (let i = 0; i < 32; i += 1) {
    const ch = base[i % base.length] ?? '0';
    out += UUID_CHARS[parseInt(ch, 16) % 16];
  }
  return `${out.slice(0, 8)}-${out.slice(8, 12)}-4${out.slice(13, 16)}-8${out.slice(17, 20)}-${out.slice(20, 32)}`;
}

export function randomUuid(rng: Rng): string {
  let out = '';
  for (let i = 0; i < 32; i += 1) out += UUID_CHARS[Math.floor(rng.random() * 16)];
  return `${out.slice(0, 8)}-${out.slice(8, 12)}-4${out.slice(13, 16)}-8${out.slice(17, 20)}-${out.slice(20, 32)}`;
}

/** UUID v4 для новых сущностей, созданных пользователем в демо-режиме. */
export function newUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return randomUuid(createRng(Date.now() ^ Math.floor(Math.random() * 1e9)));
}

export const DAY_MS = 86_400_000;

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toIso(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function atTime(date: Date, hour: number, minute = 0): Date {
  const copy = startOfDay(date);
  copy.setHours(hour, minute, 0, 0);
  return copy;
}

export function startOfMonth(date: Date): Date {
  const copy = startOfDay(date);
  copy.setDate(1);
  return copy;
}

export function startOfWeek(date: Date): Date {
  const copy = startOfDay(date);
  const day = (copy.getDay() + 6) % 7;
  return addDays(copy, -day);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
