import { normalizeSearchValue, saveRecentSearch, getSearchSuggestionItems } from '../posSearchUtils';

describe('posSearchUtils', () => {
  it('normalizes search text for quick matching', () => {
    expect(normalizeSearchValue('  KOPI  HITAM  ')).toBe('kopi hitam');
    expect(normalizeSearchValue('')).toBe('');
  });

  it('keeps recent searches unique and limited', () => {
    const result = saveRecentSearch(['kopi hitam', 'teh tarik', 'kopi hitam'], 'susu cair');
    expect(result).toEqual(['susu cair', 'kopi hitam', 'teh tarik']);
  });

  it('returns history and product suggestions in priority order', () => {
    const products = [
      { id_produk: 1, nama_produk: 'Kopi Hitam', kode_produk: 'KHB-01' },
      { id_produk: 2, nama_produk: 'Teh Tarik', kode_produk: 'TT-02' },
      { id_produk: 3, nama_produk: 'Susu Kedelai', kode_produk: 'SK-03' },
    ];

    const suggestions = getSearchSuggestionItems(products, 'kopi', ['teh tarik', 'kopi hitam']);

    expect(suggestions[0]).toMatchObject({ type: 'product', label: 'Kopi Hitam' });
    expect(suggestions.some(item => item.type === 'history')).toBe(true);
  });

  it('shows immediate suggestions on empty focus without waiting for typing', () => {
    const products = [
      { id_produk: 1, nama_produk: 'Kopi Hitam', kode_produk: 'KHB-01' },
      { id_produk: 2, nama_produk: 'Teh Tarik', kode_produk: 'TT-02' },
    ];

    const suggestions = getSearchSuggestionItems(products, '', ['kopi hitam', 'teh tarik']);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toMatchObject({ type: 'history', label: 'kopi hitam' });
    expect(suggestions.some(item => item.type === 'history')).toBe(true);
    expect(suggestions.some(item => item.type === 'product')).toBe(true);
  });
});
