import { useEffect, useRef } from 'react';

/**
 * Menjaga sorotan baris keranjang (cartFocusedIndex) tetap pada PRODUK yang sama saat isi keranjang berubah
 * (hapus baris lain, tambah baris, undo). Tanpa ini indeks "bergeser" ke produk lain: tombol +/-/Hapus lalu bekerja pada
 * produk yang bukan sorotan semula. Bila produk yang disorot hilang, sorotan pindah ke tetangga terdekat (atau -1 bila kosong).
 */
export function nextFocusIndex(prevIds, prevIdx, ids) {
  if (prevIdx < 0) return -1;
  if (ids.length === 0) return -1;
  const focusedId = prevIds[prevIdx];
  const found = focusedId === undefined ? -1 : ids.indexOf(focusedId);
  if (found >= 0) return found;
  return Math.min(Math.max(prevIdx, 0), ids.length - 1);
}

export function useCartFocusSync(cart, cartFocusedIndex, setCartFocusedIndex) {
  const prev = useRef({ ids: [], idx: -1 });
  useEffect(() => {
    const ids = cart.map((i) => i.id_produk);
    const same = ids.length === prev.current.ids.length && ids.every((id, k) => id === prev.current.ids[k]);
    let idx = cartFocusedIndex;
    if (!same) {
      idx = nextFocusIndex(prev.current.ids, prev.current.idx, ids);
      if (idx !== cartFocusedIndex) setCartFocusedIndex(idx);
    }
    prev.current = { ids, idx };
  }, [cart, cartFocusedIndex, setCartFocusedIndex]);
}

export default useCartFocusSync;
