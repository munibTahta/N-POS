import React, { useState, useEffect } from 'react';
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';

function Pagination({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage, onItemsPerPageChange }) {
  const [jumpToPageInput, setJumpToPageInput] = useState(currentPage.toString());

  useEffect(() => {
    setJumpToPageInput(currentPage.toString());
  }, [currentPage]);

  const handleJumpToPage = (e) => {
    e.preventDefault();
    const page = parseInt(jumpToPageInput, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
    } else {
      setJumpToPageInput(currentPage.toString());
      alert(`Nomor halaman tidak valid. Harap masukkan angka antara 1 dan ${totalPages}.`);
    }
  };

  // Selalu tampilkan pagination untuk memberikan ruang di bawah
  // if (totalPages <= 1) {
  //   return null; // Jangan tampilkan pagination jika hanya ada satu halaman atau kurang
  // }

  return (
    <div className="mt-4">
      {/* Mobile layout: Single row, compact */}
      <div className="block md:hidden px-2 py-2">
        <div className="flex items-center justify-between gap-1">
          {/* Left: Navigation buttons */}
          <div className="flex items-center gap-0.5">
            <button onClick={() => onPageChange(1)} disabled={currentPage === 1} className="p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-600">
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-600">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Center: Page info and items per page */}
          <div className="flex items-center gap-1 flex-1 justify-center">
            <form onSubmit={handleJumpToPage} className="flex items-center gap-0.5">
              <input
                type="text"
                value={jumpToPageInput}
                onChange={(e) => setJumpToPageInput(e.target.value)}
                onBlur={() => { if (jumpToPageInput.trim() === '') { setJumpToPageInput(currentPage.toString()); } }}
                className="w-8 text-center border border-gray-300 rounded py-0.5 px-1 text-xs bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400"
                title={`Hal 1-${totalPages}`}
              />
              <span className="text-xs text-gray-600">/</span>
              <span className="text-xs font-semibold text-gray-700 w-6 text-right">{totalPages}</span>
            </form>
            <span className="text-xs text-gray-500 ml-1">|</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="border border-gray-300 rounded py-0.5 px-1 text-xs bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400"
              title="Items per page"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Right: Navigation buttons */}
          <div className="flex items-center gap-0.5">
            <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-600">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-600">
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Row 2: Total items info */}
        <div className="text-center text-xs text-gray-600 mt-1.5">
          Total: <span className="font-semibold">{totalItems}</span> item
        </div>
      </div>

      {/* Desktop layout: Full layout */}
      <div className="hidden md:flex items-center justify-between px-4 py-3 gap-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-700">
            Total Item: <span className="font-semibold">{totalItems}</span>
          </span>
          <div className="flex items-center gap-2">
            <label htmlFor="itemsPerPage" className="text-sm text-gray-700">Tampilkan:</label>
            <select
              id="itemsPerPage"
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="border border-gray-300 rounded-md py-1 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <button onClick={() => onPageChange(1)} disabled={currentPage === 1} className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-600">
            <ChevronsLeft />
          </button>
          <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-600">
            <ChevronLeft />
          </button>

          <form onSubmit={handleJumpToPage} className="flex items-center gap-1">
            <span className="text-sm text-gray-700">Halaman</span>
            <input
              type="text"
              value={jumpToPageInput}
              onChange={(e) => setJumpToPageInput(e.target.value)}
              onBlur={() => { if (jumpToPageInput.trim() === '') { setJumpToPageInput(currentPage.toString()); } }}
              className="w-12 text-center border border-gray-300 rounded-md py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400"
            />
          </form>

          <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-600">
            <ChevronRight />
          </button>
          <button onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-600">
            <ChevronsRight />
          </button>
        </div>

        <span className="text-sm text-gray-700">
          Halaman <span className="font-semibold">{currentPage}</span> dari <span className="font-semibold">{totalPages}</span>
        </span>
      </div>
    </div>
  );
}

export default Pagination;