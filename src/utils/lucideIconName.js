// Normalisasi nama ikon dari database ke kunci peta ikon lucide.
// Menerima 'ShoppingCart', 'shopping-cart', 'Clock3', 'hand coins', dst. -> 'shopping-cart', 'clock-3', 'hand-coins'.
export const toLucideKebab = (iconName) =>
  String(iconName || '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
