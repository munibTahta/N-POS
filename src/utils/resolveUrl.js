export function resolveUrl(path) {
  let base = import.meta.env.VITE_API_BASE_URL || '';
  // const placeholder = 'https://via.placeholder.com/80?text=No+Image';
  
  // Strip /api suffix from base URL since images are served at root level, not under /api
  if (base.endsWith('/api')) {
    base = base.substring(0, base.length - 4);
  }
  
  if (!path) return null;

  // If path is an object, try common properties
  if (typeof path === 'object') {
    const candidate = path.url || path.path || path.gambar || path.filename || path.file || path.url_image;
    if (!candidate) return null;
    path = candidate;
  }

  if (typeof path === 'string') {
    // Already an absolute URL
    if (path.startsWith('http')) {
      return path;
    }

    // If the backend returned a filesystem path (eg. '/home/.../public/uploads/produk/..')
    // try to locate the public uploads segment and use that. This handles cases where
    // server stores full disk paths in DB but serves files under '/uploads/...'.
    const uploadsIdx = path.indexOf('/uploads/');
    if (uploadsIdx !== -1) {
      const publicPath = path.substring(uploadsIdx); // '/uploads/produk/..'
      const cleanBase = base.replace(/\/$/, '');
      const cleanPath = publicPath.replace(/^\//, '');
      const result = cleanBase ? `${cleanBase}/${cleanPath}` : cleanPath;
      return result;
    }

    // Also handle cases like '/some/dir/public/uploads/..' -> take the part after '/public'
    const publicIdx = path.indexOf('/public/');
    if (publicIdx !== -1) {
      const publicPath = path.substring(publicIdx + '/public'.length); // '/uploads/..'
      const cleanBase = base.replace(/\/$/, '');
      const cleanPath = publicPath.replace(/^\//, '');
      const result = cleanBase ? `${cleanBase}/${cleanPath}` : cleanPath;
      return result;
    }

    // Fallback: treat as relative path and join with API base
    const cleanBase = base.replace(/\/$/, '');
    const cleanPath = String(path).replace(/^\//, '');
    const result = cleanBase ? `${cleanBase}/${cleanPath}` : cleanPath;
    return result;
  }

  return null;
}
