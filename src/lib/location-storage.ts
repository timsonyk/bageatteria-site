// Хранение выбранной точки с TTL 12 часов
const STORAGE_KEY = "selected_store_location";
const TTL_MS = 12 * 60 * 60 * 1000;

export function saveSelectedLocationId(id: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, ts: Date.now() }));
  } catch {}
}

export function loadSelectedLocationId(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // Легаси-формат: просто строка с числом
    if (!raw.startsWith("{")) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const parsed = JSON.parse(raw) as { id: number; ts: number };
    if (!parsed || typeof parsed.id !== "number" || typeof parsed.ts !== "number") {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (Date.now() - parsed.ts > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.id;
  } catch {
    return null;
  }
}
