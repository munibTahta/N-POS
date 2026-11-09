export const POS_SEARCH_HISTORY_KEY = 'npos_pos_search_history';

export const normalizeSearchValue = (value = '') => {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
};

const toUniqueSearchEntries = (source = []) => {
  const seen = new Set();

  return source
    .map(item => String(item ?? '').trim())
    .filter(Boolean)
    .filter(item => {
      const normalized = normalizeSearchValue(item);
      if (!normalized || seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
};

export const getRecentSearches = () => {
  if (typeof window === 'undefined') return [];

  try {
    const saved = window.localStorage.getItem(POS_SEARCH_HISTORY_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return toUniqueSearchEntries(parsed).slice(0, 8);
  } catch (error) {
    console.warn('Failed to load recent POS searches:', error);
    return [];
  }
};

export const saveRecentSearch = (history = [], nextValue = '') => {
  const value = String(nextValue ?? '').trim();
  if (!value) return toUniqueSearchEntries(history).slice(0, 8);

  const merged = [value, ...(Array.isArray(history) ? history : [])];
  return toUniqueSearchEntries(merged).slice(0, 8);
};

export const getSearchSuggestionItems = (products = [], query = '', recentSearches = []) => {
  const normalizedQuery = normalizeSearchValue(query);
  const safeProducts = Array.isArray(products) ? products : [];
  const historyItems = Array.isArray(recentSearches) ? recentSearches : [];

  const productSuggestions = safeProducts
    .map((product) => {
      const name = String(product?.nama_produk || product?.nama || '');
      const code = String(product?.kode_produk || product?.kode || '');
      const normalizedName = normalizeSearchValue(name);
      const normalizedCode = normalizeSearchValue(code);
      const combined = `${normalizedName} ${normalizedCode}`;

      if (!combined) {
        return null;
      }

      let score = 0;
      if (!normalizedQuery) {
        score += 25;
      } else {
        if (normalizedName === normalizedQuery) score += 100;
        if (normalizedCode === normalizedQuery) score += 95;
        if (normalizedName.startsWith(normalizedQuery)) score += 40;
        if (normalizedCode.startsWith(normalizedQuery)) score += 35;
        if (normalizedName.includes(normalizedQuery)) score += 20;
        if (normalizedCode.includes(normalizedQuery)) score += 18;
      }

      if (product?.stok !== undefined && Number(product.stok) > 0) score += 5;
      if (product?.status === 'aktif') score += 3;
      if (normalizedQuery && !combined.includes(normalizedQuery)) return null;

      return {
        type: 'product',
        label: name,
        value: code ? `${name} (${code})` : name,
        product,
        score,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 8);

  const historySuggestions = (normalizedQuery
    ? historyItems.filter(item => normalizeSearchValue(item).includes(normalizedQuery))
    : historyItems
  )
    .slice(0, 4)
    .map(item => ({ type: 'history', label: item, value: item, score: normalizedQuery ? 11 : 30 }));

  const suggestions = [...historySuggestions, ...productSuggestions]
    .filter((item, index, arr) => {
      const key = `${item.type}-${item.value}`;
      return arr.findIndex(candidate => `${candidate.type}-${candidate.value}` === key) === index;
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 8);

  return suggestions;
};
