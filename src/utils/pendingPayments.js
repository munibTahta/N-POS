import { recordPayment } from '../services/api';

const STORAGE_KEY = 'toko_pending_payments_v1';

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.warn('pendingPayments: failed to read storage', e);
    return [];
  }
}

function writeStore(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('pendingPayments: failed to write storage', e);
  }
}

export function getPendingPayments() {
  return readStore();
}

export function addPendingPayment({ saleId, payload, meta }) {
  const list = readStore();
  const item = {
    id: `${Date.now()}-${Math.floor(Math.random()*10000)}`,
    saleId,
    payload,
    meta: meta || {},
    createdAt: new Date().toISOString()
  };
  list.push(item);
  writeStore(list);
  return item;
}

export function removePendingPayment(id) {
  const list = readStore();
  const filtered = list.filter(i => i.id !== id);
  writeStore(filtered);
  return filtered;
}

// Attempt to sync pending payments. Returns array of result objects { id, status, detail }
export async function syncPendingPayments() {
  const list = readStore();
  const results = [];
  for (const item of list) {
    try {
      // attempt to record payment via API
      const res = await recordPayment(item.saleId, item.payload);
      results.push({ id: item.id, status: 'success', detail: res.data });
      // remove on success
      removePendingPayment(item.id);
    } catch (err) {
      results.push({ id: item.id, status: 'error', detail: err.response?.data || String(err.message) });
    }
  }
  return results;
}

export default {
  getPendingPayments,
  addPendingPayment,
  removePendingPayment,
  syncPendingPayments
};
