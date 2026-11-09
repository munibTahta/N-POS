import { test, expect } from '@playwright/test';
import { toLucideKebab } from '../src/utils/lucideIconName.js';
import dynamicIconImports from 'lucide-react/dynamicIconImports.mjs';

// Semua nama ikon yang tersimpan di tabel `menus` produksi (dua format: PascalCase dan kebab-case).
const dbIcons = ['ScanBarcode', 'ClipboardList', 'Store', 'Warehouse', 'hand-coins', 'Receipt', 'PackageMinus', 'Users',
  'PackageSearch', 'GanttChartSquare', 'Scale', 'Building2', 'file-text', 'ClipboardCheck', 'Settings', 'user', 'star',
  'ticket-percent', 'percent', 'credit-card', 'user-lock', 'layout-dashboard', 'ArrowLeftRight', 'Truck', 'Divide',
  'Clock3', 'CloudOff', 'logs', 'book-text', 'clipboard-plus', 'landmark', 'banknote-arrow-up'];

test('semua nama ikon menu di database terpetakan ke ikon lucide', () => {
  const missing = dbIcons.filter((n) => !(toLucideKebab(n) in dynamicIconImports));
  expect(missing).toEqual([]);
});

test('normalisasi nama ikon', () => {
  expect(toLucideKebab('ShoppingCart')).toBe('shopping-cart');
  expect(toLucideKebab('Clock3')).toBe('clock-3');
  expect(toLucideKebab('Building2')).toBe('building-2');
  expect(toLucideKebab('hand coins')).toBe('hand-coins');
  expect(toLucideKebab('')).toBe('');
});
