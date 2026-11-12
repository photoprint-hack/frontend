/** Доступ к токену только в памяти приложения (требование ТЗ 4.2 / 23). */
let accessToken: string | null = null;

type Listener = (token: string | null) => void;
const listeners = new Set<Listener>();

export const tokenStore = {
  get(): string | null {
    return accessToken;
  },
  set(token: string | null) {
    accessToken = token;
    listeners.forEach((listener) => listener(token));
  },
  clear() {
    tokenStore.set(null);
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
