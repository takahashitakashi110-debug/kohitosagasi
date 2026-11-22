export const SETTINGS_KEY = 'kohitosagasi.settings.v1';
export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type StorageSource = () => SettingsStorage;
export const browserStorage: StorageSource = () => localStorage;

export function readMuted(storage: StorageSource = browserStorage): boolean {
  try {
    const value: unknown = JSON.parse(storage().getItem(SETTINGS_KEY) ?? 'null');
    return typeof value === 'object' && value !== null && 'muted' in value && value.muted === true;
  } catch { return false; }
}
export function writeMuted(muted: boolean, storage: StorageSource = browserStorage): void {
  try { storage().setItem(SETTINGS_KEY, JSON.stringify({ muted })); } catch { /* 保存不可でも今の設定で遊べる。 */ }
}
