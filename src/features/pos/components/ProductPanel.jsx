import { Check, Flame, History, ShoppingCart } from 'lucide-react';
import ProductGrid from '../../../components/pos/ProductGrid';

export function ProductPanel({ allowNegativeStock = false, totalProduk, activeCategory, barcodeInputRef, browseError, browseLoading, cart, cartQtyMap, categories, changeDensity, filteredProducts, focusedSection, gridDensity, handleAddToCart, handleBarcodeScan, isScannerLikeInput, loading, paymentAmountInputRef, searchInputRef, searchKeyTimesRef, searchTerm, selectedProductIndex, setActiveCategory, setBrowseRetry, setCartOpen, setFocusedSection, setSearchTerm, setSelectedProductIndex, setShowCameraScanner, setShowShortcutsModal, showCameraScanner, showCustomerPopup, showPaymentModal, showShortcutsModal, stockInfo }) {
  return (
<div className="flex-1 min-w-0">
        <div 
          className={`bg-white rounded-lg shadow-md p-3 sm:p-6 transition-all duration-300 cursor-pointer ${focusedSection === 'search' || focusedSection === 'products' ? 'ring-2 ring-blue-500/50 border border-blue-300' : 'border border-gray-200'}`}
          onClick={() => {
            setFocusedSection('search');
            if (searchInputRef.current) {
              searchInputRef.current.focus();
              searchInputRef.current.select();
            }
          }}
          tabIndex={0}
          title="Klik untuk fokus ke Produk (Alt+P)"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setFocusedSection('search');
              if (searchInputRef.current) {
                searchInputRef.current.focus();
                searchInputRef.current.select();
              }
            }
          }}
        >
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight flex items-center gap-2 text-gray-900">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m0 0l8 4m-8-4v10l8 4m0-10l8 4m-8-4v10M10 9l4 2m-4-2l4-2" />
              </svg>
              Produk
            </h2>
            <div className="flex gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="btn-icon btn-tonal relative lg:hidden"
                aria-label={`Buka keranjang (${cart.length} item)`}
              >
                <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                {cart.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-bold tabular-nums text-white">
                    {cart.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setShowCameraScanner(true);
                }}
                className="btn-icon btn-tonal"
                title="Scan (F3)"
                aria-label="Scan barcode dengan kamera (F3)"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button
                onClick={() => setShowShortcutsModal(true)}
                className="btn-icon btn-tonal"
                title="Bantuan & Shortcut Keyboard"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-3 sm:mb-4 relative">
            <div className="relative">
              <input
                ref={searchInputRef}
                placeholder="Cari produk atau scan barcode"
                value={searchTerm}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                onChange={(e) => {
                  const v = e.target.value;
                  const now = Date.now();
                  const times = searchKeyTimesRef.current;
                  // Isi/hapus riwayat waktu sesuai panjang teks (paste atau hapus = reset)
                  if (v.length <= 1 || v.length < times.length) searchKeyTimesRef.current = [now];
                  else { times.push(now); if (times.length > 64) times.splice(0, times.length - 64); }
                  setSearchTerm(v);
                  setSelectedProductIndex(-1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchTerm('');
                    searchKeyTimesRef.current = [];
                    return;
                  }
                  if (e.key !== 'Enter') return;
                  const value = e.currentTarget.value.trim();
                  if (!value) return;
                  e.preventDefault();

                  // 1) Scanner fisik yang mengetik ke kolom ini: proses sebagai barcode
                  if (isScannerLikeInput(value)) {
                    searchKeyTimesRef.current = [];
                    handleBarcodeScan(value);
                    return;
                  }

                  // 2) Ketik manual: kode persis cocok atau hasil tunggal langsung masuk keranjang
                  const lower = value.toLowerCase();
                  const exact = filteredProducts.find(p =>
                    String(p.kode_produk || '').toLowerCase() === lower ||
                    String(p.barcode || '').toLowerCase() === lower);
                  const target = exact || (filteredProducts.length === 1 ? filteredProducts[0] : null);
                  if (target) {
                    searchKeyTimesRef.current = [];
                    handleAddToCart(target);
                  } else if (/^\S{6,}$/.test(value) && filteredProducts.length === 0) {
                    // Kode yang ditempel (paste) atau hasil belum termuat: cari persis ke sumber data
                    searchKeyTimesRef.current = [];
                    handleBarcodeScan(value);
                  }
                }}
                className="w-full px-4 py-3 sm:py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all touch-manipulation text-sm sm:text-base"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                {searchTerm ? (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedProductIndex(-1);
                    }}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none p-1 touch-manipulation"
                    title="Hapus pencarian"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </div>
            </div>

          </div>

          {/* Category chips - filter cepat */}
          {(
            <div
              className="mb-3 sm:mb-4 flex gap-2 overflow-x-auto max-w-full pb-2 snap-x [scrollbar-width:thin] overscroll-x-contain"
              role="tablist"
              aria-label="Filter kategori produk"
              onClick={(e) => e.stopPropagation()}
            >
              {[{ id_kategori: 'all', nama_kategori: 'Semua', jumlah_produk: totalProduk }, { id_kategori: 'fav', nama_kategori: 'Terlaris', Icon: Flame }, { id_kategori: 'recent', nama_kategori: 'Terakhir', Icon: History }, ...categories].map((cat) => {
                const id = String(cat.id_kategori);
                const active = String(activeCategory) === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setActiveCategory(id); setSelectedProductIndex(-1); }}
                    className={`snap-start shrink-0 min-h-[40px] px-4 rounded-lg text-sm font-medium border transition-all duration-150 touch-manipulation whitespace-nowrap flex items-center gap-1.5 active:scale-95 ${
                      active
                        ? 'bg-blue-100 text-blue-900 border-blue-200 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {active ? <Check className="w-4 h-4" aria-hidden="true" /> : (cat.Icon && <cat.Icon className="w-4 h-4" aria-hidden="true" />)}
                    {cat.nama_kategori}
                    {cat.jumlah_produk != null && <span className="text-xs font-normal tabular-nums opacity-70">{cat.jumlah_produk}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Hidden barcode input - MUST ALWAYS BE FOCUSED for POS operation */}
          <input
            ref={barcodeInputRef}
            type="text"
            inputMode="none"
            autoComplete="off"
            spellCheck="false"
            className="absolute opacity-0 pointer-events-none"
            aria-hidden="true"
            inert={true}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const barcodeValue = e.target.value.trim();
                if (barcodeValue) {
                  handleBarcodeScan(barcodeValue);
                  e.target.value = '';
                  // Ensure focus stays on barcode input after scan
                  e.target.focus();
                }
              }
            }}
            onBlur={() => {
              // Prevent focus loss - barcode input should never lose focus
              // unless a modal/popup is open or user is actively typing in search/payment inputs
              if (
                !showPaymentModal &&
                !showCameraScanner &&
                !showShortcutsModal &&
                !showCustomerPopup
              ) {
                // Only refocus after a delay to allow for normal input switching
                setTimeout(() => {
                  const activeEl = document.activeElement;
                  const isTypingInInput = activeEl?.tagName === 'INPUT' && 
                                        (activeEl === searchInputRef.current || 
                                         activeEl === paymentAmountInputRef.current);
                  
                  if (!isTypingInInput && barcodeInputRef.current) {
                    barcodeInputRef.current.focus();
                  }
                }, 200); // Increased delay
              }
            }}
          />

          {/* Products Grid - tampil di semua ukuran layar */}
          <div className="border-t pt-3 sm:pt-4 max-h-[55vh] lg:max-h-[60vh] overflow-y-auto overflow-x-hidden min-w-0 px-1 sm:px-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 mb-2 text-xs sm:text-sm text-gray-500">
              <div className="flex rounded-lg border border-gray-300 overflow-hidden" role="group" aria-label="Ukuran kartu produk">
                {[['compact','S'],['normal','M'],['large','L']].map(([d,l]) => (
                  <button key={d} type="button" onClick={() => changeDensity(d)} aria-pressed={gridDensity === d}
                    className={`w-9 min-h-[36px] text-xs font-semibold ${gridDensity === d ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{l}</button>
                ))}
              </div>
              <span className="flex-1 truncate">
                {searchTerm ? `Hasil untuk "${searchTerm}"` : (activeCategory === 'all' ? 'Semua produk' : 'Kategori terpilih')}
              </span>
              <span>{filteredProducts.length} produk</span>
            </div>
            {browseError && !searchTerm && filteredProducts.length === 0 && !browseLoading && (
              <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-gray-600">Daftar produk gagal dimuat. Anda tetap bisa mencari atau scan barcode.</p>
                <button
                  type="button"
                  onClick={() => setBrowseRetry(n => n + 1)}
                  className="btn-primary"
                >
                  Coba lagi
                </button>
              </div>
            )}
            <ProductGrid
              allowNegativeStock={allowNegativeStock}
              products={filteredProducts}
              stockInfo={stockInfo}
              onAddToCart={handleAddToCart}
              loading={loading || browseLoading}
              density={gridDensity}
              cartQty={cartQtyMap}
              selectedProductIndex={selectedProductIndex}
            />
          </div>
        </div>
      </div>
  );
}

export default ProductPanel;
