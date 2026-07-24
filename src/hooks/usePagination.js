import { useState, useMemo } from 'react';

/**
 * Custom hook modern dan efisien untuk mengelola logika pagination di sisi klien.
 * @param {Array} data - Array data lengkap yang akan dipaginasi.
 * @param {number} itemsPerPage - Jumlah item per halaman.
 */
export const usePagination = ({ data, itemsPerPage = 15 }) => {
  const [currentPage, setCurrentPage] = useState(1);

  // Defensive check: ensure data is an array
  const safeData = useMemo(() => Array.isArray(data) ? data : [], [data]);

  // `useMemo` digunakan untuk menghitung total halaman.
  // Kalkulasi ini hanya akan berjalan kembali jika jumlah data atau item per halaman berubah.
  // Ini sangat efisien dan mencegah kalkulasi yang tidak perlu pada setiap render.
  const totalPages = useMemo(() => {
    return Math.ceil(safeData.length / itemsPerPage);
  }, [safeData.length, itemsPerPage]);

  // `useMemo` juga digunakan untuk memotong (slice) data.
  // `data.slice()` adalah cara native JavaScript yang sangat cepat untuk mendapatkan bagian dari array.
  // Hook ini hanya akan memotong ulang data jika data itu sendiri, halaman saat ini, atau item per halaman berubah.
  // Ini adalah inti dari performa pagination yang cepat.
  const currentData = useMemo(() => {
    // Ensure currentPage is valid - if currentPage exceeds totalPages, use the last valid page
    const validCurrentPage = Math.min(currentPage, Math.max(1, totalPages));
    const begin = (validCurrentPage - 1) * itemsPerPage;
    const end = begin + itemsPerPage;
    return safeData.slice(begin, end);
  }, [safeData, currentPage, itemsPerPage, totalPages]);

  // Mengembalikan semua state dan fungsi yang dibutuhkan oleh komponen.
  return {
    currentData,
    currentPage: Math.min(currentPage, Math.max(1, totalPages)), // Effective current page
    totalPages,
    setPage: setCurrentPage, // Mengekspor fungsi untuk mengubah halaman.
    itemsPerPage,
  };
};