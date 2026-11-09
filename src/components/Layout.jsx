import React, { useState, useCallback, useEffect } from 'react';
import { Outlet, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { useMenuContext } from '../context/MenuContext';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../context/SettingsContext';
import { useSync } from '../context/SyncContext';
import { useSyncQueue } from '../hooks/useSyncQueue';
import useProductOfflineDB from '../hooks/useProductOfflineDB';
import SyncModal from './SyncModal';
import SyncStatusNotification from './SyncStatusNotification';
import NavDropdown from './NavDropdown';
import { renderLucideIcon } from '../utils/lucideIconHelper';
import Drawer from './common/Drawer';
import { useMediaQuery } from '../hooks/useMediaQuery';
import syncEngine from '../services/syncEngine';
import { Sun, Moon, Search, Keyboard, LogOut } from 'lucide-react';
import CommandPalette from './common/CommandPalette';
import ShortcutModal from './ShortcutModal';
import UserMenu from './UserMenu';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';
import { GO_SHORTCUTS } from '../hooks/globalNav';
// Note: OfflineStatusIndicator removed - already rendered globally in App.jsx

const Layout = () => {
  const { user } = usePermissions();
  const { hasMenuAccess } = usePermissions();
  const { menus } = useMenuContext();
  const { logout } = useAuth();
  const { storeInfo, loadingSettings, theme, toggleTheme } = useSettings();
  const { getConnectionStatus, getSyncInfo, performSync } = useSync();
  const { isSyncing, syncStatus, queueSize } = useSyncQueue();
  const { syncAllProducts } = useProductOfflineDB();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isMdUp = useMediaQuery('(min-width: 768px)');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isQuickSyncing, setIsQuickSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [isElectron, setIsElectron] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [mobileSearchTerm, setMobileSearchTerm] = useState('');

  const connectionStatus = getConnectionStatus();
  const syncInfo = getSyncInfo();

  // Detect if running in Electron
  useEffect(() => {
    const checkElectron = () => {
      // Check for Electron-specific APIs
      const electronCheck = typeof window !== 'undefined' && (
        window.electronAPI ||
        (window.process && window.process.versions && window.process.versions.electron) ||
        (window.require && window.require('electron'))
      );
      setIsElectron(!!electronCheck);
    };

    checkElectron();
  }, []);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const closeMenu = () => {
    setIsMenuOpen(false);
    closeUserDropdown();
  };

  const toggleUserDropdown = () => setIsUserDropdownOpen(!isUserDropdownOpen);

  const closeUserDropdown = () => setIsUserDropdownOpen(false);

  const handleLogout = () => {
    logout();
    closeUserDropdown();
  };

  const menuIconClasses = [
    'text-emerald-500',
    'text-indigo-500',
    'text-amber-500',
    'text-fuchsia-500',
    'text-sky-500',
    'text-rose-500',
    'text-lime-500',
    'text-cyan-500'
  ];

  const getMenuIconClass = (path, index) => {
    if (path === '/pos') return 'text-blue-600';
    return menuIconClasses[index % menuIconClasses.length];
  };

  const getMenuCategory = (menuPath = '') => {
    const path = (menuPath || '').toLowerCase().trim();
    if (['/pos', '/penjualan', '/pembelian'].includes(path)) {
      return { key: 'penjualan', label: 'Penjualan' };
    }
    if (['/produk', '/stok', '/pelanggan', '/menu', '/pengguna', '/kategori', '/unit', '/supplier', '/branch'].includes(path)) {
      return { key: 'manajemen', label: 'Manajemen' };
    }
    if (path === '/laporan' || path.startsWith('/laporan') || ['/audit-trail', '/log-aktivitas'].includes(path)) {
      return { key: 'laporan', label: 'Laporan' };
    }
    if (path === '/pengaturan' || path === '/akun-keuangan' || path === '/rekening-keuangan') {
      return { key: 'pengaturan', label: 'Pengaturan' };
    }
    return { key: 'manajemen', label: 'Manajemen' }; // Default to manajemen
  };

  const canViewMenuItem = (menu) => {
    if (!menu) return false;

    // Normalize menu properties for consistent checking
    const normalizedMenu = {
      ...menu,
      path: menu.path && !menu.path.startsWith('/') ? `/${menu.path}` : menu.path,
      grup: (menu.grup || '').toLowerCase().trim(),
      menu_key: (menu.menu_key || '').toLowerCase().trim()
    };

    if (normalizedMenu.menu_key && hasMenuAccess(normalizedMenu.menu_key)) return true;
    if (normalizedMenu.grup === 'laporan' && hasMenuAccess('laporan')) return true;
    if (normalizedMenu.grup === 'pengaturan' && hasMenuAccess('pengaturan')) return true;
    if (normalizedMenu.path && normalizedMenu.path.startsWith('/laporan') && hasMenuAccess('laporan')) return true;
    return false;
  };

  const groupMenuItems = (items) => {
    return Object.values(items.reduce((groups, item) => {
      const category = getMenuCategory(item.path);
      if (!groups[category.key]) {
        groups[category.key] = { key: category.key, label: category.label, items: [] };
      }
      groups[category.key].items.push(item);
      return groups;
    }, {}));
  };

  const getVisibleMenuItems = () => {
    if (menus && menus.length > 0) {
      return menus
        .filter(m => m.aktif !== false && canViewMenuItem(m))
        .sort((a, b) => (a.urutan || 0) - (b.urutan || 0))
        .map((menu, index) => ({
          id: menu.id_menu || menu.menu_key,
          name: menu.nama_menu,
          path: menu.path,
          icon: menu.icon ? renderLucideIcon(menu.icon, `w-4 h-4 ${getMenuIconClass(menu.path, index)}`) : null
        }));
    }

    return [
      ...(hasMenuAccess('pos') ? [{
        id: 'pos',
        name: 'POS',
        path: '/pos'
      }] : []),
      ...(hasMenuAccess('penjualan') ? [{
        id: 'penjualan',
        name: 'Riwayat',
        path: '/penjualan'
      }] : []),
      ...(hasMenuAccess('stok') || hasMenuAccess('stok/kasir') ? [{
        id: 'stok',
        name: 'Stok',
        path: hasMenuAccess('stok') ? '/stok' : '/stok/kasir'
      }] : []),
      ...(hasMenuAccess('audit-trail') ? [{
        id: 'audit-trail',
        name: 'Audit Trail',
        path: '/audit-trail'
      }] : []),
      ...(hasMenuAccess('log-aktivitas') ? [{
        id: 'log-aktivitas',
        name: 'Log Aktivitas',
        path: '/log-aktivitas'
      }] : [])
    ];
  };

  const visibleMenuItems = getVisibleMenuItems();
  const groupedMobileMenuItems = groupMenuItems(visibleMenuItems);
  const navDropdownItems = groupedMobileMenuItems.flatMap(group =>
    group.items.map(item => ({
      ...item,
      group: group.key,
      groupLabel: group.label
    }))
  );

  // Halaman utama di bilah navigasi (urut prioritas, hanya yang boleh diakses), maks. 3 di md dan 5 di lg+; sisanya "Lainnya".
  const isLgUp = useMediaQuery('(min-width: 1024px)');
  const PRIMARY_ORDER = ['/pos', '/penjualan', '/produk', '/stok', '/stok/kasir', '/laporan', '/pembelian'];
  const rankOf = (path) => { const i = PRIMARY_ORDER.indexOf(path && !path.startsWith('/') ? `/${path}` : path); return i === -1 ? Infinity : i; };
  const primaryLimit = isLgUp ? 5 : 3;
  const primaryNavItems = [...visibleMenuItems].filter((m) => rankOf(m.path) !== Infinity).sort((a, b) => rankOf(a.path) - rankOf(b.path)).slice(0, primaryLimit)
    .map((m) => ({ ...m, path: m.path && !m.path.startsWith('/') ? `/${m.path}` : m.path }));
  const primaryIds = new Set(primaryNavItems.map((m) => m.id));
  const overflowNavItems = navDropdownItems.filter((m) => !primaryIds.has(m.id));

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.user-dropdown')) {
        closeUserDropdown();
      }
    };

    if (isUserDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserDropdownOpen]);

  // Sync mobile menu filtering when the mobile search term changes
  useEffect(() => {
    try {
      const items = document.querySelectorAll('[data-menu-item]');
      const search = (mobileSearchTerm || '').toLowerCase();
      items.forEach(item => {
        const text = (item.textContent || '').toLowerCase();
        item.style.display = search.length === 0 || text.includes(search) ? 'block' : 'none';
      });
    } catch (_e) {
      // DOM might not be ready; ignore errors
    }
  }, [mobileSearchTerm]);

  const handleConnectionStatusClick = useCallback(() => {
    if (isElectron) {
      setIsSyncModalOpen(true);
    }
  }, [isElectron]);

  const handleCloseSyncModal = useCallback(() => {
    setIsSyncModalOpen(false);
  }, []);

  const _handleQuickSync = async () => {
    if (!connectionStatus.isOnline || isQuickSyncing) return;

    setIsQuickSyncing(true);
    try {
      await performSync();
    } catch (error) {
      console.error('Quick sync failed:', error);
    } finally {
      setIsQuickSyncing(false);
    }
  };

  const handleRefresh = async () => {
    if (!connectionStatus.isOnline || isRefreshing) return;

    setIsRefreshing(true);
    setSyncProgress(0);
    try {
      // Setup progress callback di syncEngine
      syncEngine.setProgressCallback((percent) => {
        setSyncProgress(percent);
      });

      // Update data hanya dari server
      await syncEngine.updateDataFromServer();

      // Sync products untuk offline search
      syncAllProducts(true);
      setSyncProgress(100);

      // Clear progress
      setTimeout(() => setSyncProgress(0), 1500);
    } catch (error) {
      console.error('Perbarui data gagal:', error);
      setSyncProgress(0);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSync = async () => {
    if (!connectionStatus.isOnline || isSyncingLocal) return;

    setIsSyncingLocal(true);
    setSyncProgress(0);
    try {
      // Setup progress callback di syncEngine
      syncEngine.setProgressCallback((percent) => {
        setSyncProgress(percent);
      });

      // Sinkron bidirectional: push perubahan lokal + pull server
      await syncEngine.syncDataBidirectional();

      // Sync products untuk offline search
      syncAllProducts(true);
      setSyncProgress(100);

      // Clear progress
      setTimeout(() => setSyncProgress(0), 1500);
    } catch (error) {
      console.error('Sinkronisasi gagal:', error);
      setSyncProgress(0);
    } finally {
      setIsSyncingLocal(false);
    }
  };

  const roleLabel = (() => {
    const r = String(user?.role_display || user?.role || user?.nama_role || 'Pengguna');
    return r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
  })();

  // ---- Palet perintah (Ctrl/Cmd+K), bantuan pintasan (?), dan navigasi g+huruf ----
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const normPath = (p) => (p && !p.startsWith('/') ? `/${p}` : p);
  const accessiblePaths = new Set(['/', '/pengaturan', ...visibleMenuItems.map((m) => normPath(m.path))]);
  const canAccessPath = (path) => accessiblePaths.has(path);

  useGlobalShortcuts({
    onOpenPalette: () => setPaletteOpen(true),
    onOpenHelp: () => setHelpOpen(true),
    onNavigate: (path) => navigate(path),
    canAccess: canAccessPath,
    pathname,
  });

  const goHint = (path) => { const g = GO_SHORTCUTS.find((x) => x.path === path); return g ? `g ${g.key}` : undefined; };
  const paletteItems = [
    ...visibleMenuItems.map((m) => ({ id: `menu-${m.id}`, label: m.name, group: 'Halaman', keywords: [m.path], icon: m.icon, hint: goHint(normPath(m.path)), run: () => navigate(normPath(m.path)) })),
    ...(visibleMenuItems.some((m) => normPath(m.path) === '/') ? [] : [{ id: 'menu-dashboard', label: 'Dashboard', group: 'Halaman', keywords: ['beranda', 'home'], hint: goHint('/'), run: () => navigate('/') }]),
    ...(visibleMenuItems.some((m) => normPath(m.path) === '/pengaturan') ? [] : [{ id: 'menu-pengaturan', label: 'Pengaturan', group: 'Halaman', keywords: ['setting', 'konfigurasi'], hint: goHint('/pengaturan'), run: () => navigate('/pengaturan') }]),
    { id: 'act-tema', label: theme === 'light' ? 'Ganti ke tema gelap' : 'Ganti ke tema terang', group: 'Aksi', keywords: ['tema', 'dark', 'light', 'gelap', 'terang'], icon: theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />, run: toggleTheme },
    { id: 'act-bantuan', label: 'Bantuan pintasan keyboard', group: 'Aksi', keywords: ['shortcut', 'keyboard', 'bantuan', 'help'], hint: '?', icon: <Keyboard className="w-4 h-4" />, run: () => setHelpOpen(true) },
    { id: 'act-logout', label: 'Keluar (logout)', group: 'Aksi', keywords: ['logout', 'keluar', 'sign out'], icon: <LogOut className="w-4 h-4" />, run: handleLogout },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-xl font-bold text-blue-600 hover:text-blue-700 transition-colors" onClick={closeMenu}>
              {loadingSettings ? (
                <div className="flex items-center gap-2">
                  <div className="spinner w-5 h-5"></div>
                  <span className="text-gray-600">Memuat...</span>
                </div>
              ) : (
                storeInfo.nama_cabang || 'N-POS'
              )}
            </Link>

            {/* Navigasi utama (desktop): tautan langsung ke halaman yang paling sering dipakai; sisanya di "Lainnya" dan palet Ctrl K.
                Logo/nama toko = Beranda (Menu Utama), jadi tidak perlu tautan "Dashboard"/"Menu" terpisah. */}
            <div className="hidden md:flex items-center gap-1" role="navigation" aria-label="Navigasi utama">
              {primaryNavItems.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }) =>
                    `inline-flex min-h-[40px] items-center rounded-full px-4 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                    }`
                  }
                >
                  {item.name}
                </NavLink>
              ))}
              {overflowNavItems.length > 0 && (
                <NavDropdown label="Lainnya" items={overflowNavItems} />
              )}
            </div>

            {/* User Info & Connection Status - Desktop */}
            {user && (
              <div className="hidden md:flex items-center gap-4">
                {/* Connection Status - Desktop */}
                <div className="flex items-center gap-2">
                  {isElectron ? (
                    <>
                      <button
                        onClick={handleConnectionStatusClick}
                        disabled={!isElectron}
                        className={`flex items-center gap-2 px-2 py-2 rounded-xl transition-all duration-200 hover:shadow-md ${
                          connectionStatus.isOnline
                            ? 'bg-green-50 hover:bg-green-100 border border-green-200 text-green-700'
                            : 'bg-red-50 hover:bg-red-100 border border-red-200 text-red-700'
                        } ${!isElectron ? 'cursor-not-allowed opacity-60' : ''}`}
                        title={isElectron ? `Buka panel sinkronisasi data — ${connectionStatus.isOnline ? 'Online' : 'Offline'}` : `Sinkronisasi hanya tersedia di desktop app — ${connectionStatus.isOnline ? 'Online' : 'Offline'}`}
                        aria-label={`Connection status: ${connectionStatus.isOnline ? 'Online' : 'Offline'}`}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full ${connectionStatus.isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="sr-only">{connectionStatus.isOnline ? 'Online' : 'Offline'}</span>
                        <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Quick Action Buttons - Only in Electron */}
                      {connectionStatus.isOnline && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSync}
                            disabled={isSyncingLocal}
                            className={`btn text-xs px-3 py-2 relative transition-all ${
                              isSyncingLocal 
                                ? 'btn-warning opacity-75' 
                                : 'btn-primary hover:btn-primary-dark'
                            }`}
                            title={`Sinkron Data: Kirim perubahan lokal + ambil dari server${isSyncingLocal ? ` (${syncProgress}%)` : ''}`}
                          >
                            {isSyncingLocal ? (
                              <>
                                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span className="ml-1 text-xs font-medium">{syncProgress}%</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </>
                            )}
                          </button>

                          <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className={`btn text-xs px-3 py-2 relative transition-all ${
                              isRefreshing 
                                ? 'btn-warning opacity-75' 
                                : 'btn-success hover:btn-success-dark'
                            }`}
                            title={`Perbarui Data: Ambil data terbaru dari server${isRefreshing ? ` (${syncProgress}%)` : ''}`}
                          >
                            {isRefreshing ? (
                              <>
                                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span className="ml-1 text-xs font-medium">{syncProgress}%</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    // Web: tidak ada yang perlu dilaporkan saat online (dulu chip "Web Mode" selalu tampil tanpa informasi);
                    // saat koneksi putus tampilkan peringatan yang jelas.
                    !connectionStatus.isOnline && (
                      <div role="status" className="inline-flex min-h-[36px] items-center gap-2 rounded-full bg-red-50 px-3 text-sm font-medium text-red-800 dark:bg-red-500/15 dark:text-red-200">
                        <span className="h-2 w-2 rounded-full bg-red-600 dark:bg-red-400" aria-hidden="true" />
                        Offline
                      </div>
                    )
                  )}

                  {/* Pending count badge - Only in Electron */}
                  {isElectron && syncInfo.pendingCount > 0 && (
                    <div className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-semibold animate-bounce-subtle" title="Transaksi menunggu sinkronisasi">
                      {syncInfo.pendingCount}
                    </div>
                  )}

                  {/* Failed count badge - Only in Electron. A sale can be stuck
                      permanently "failed" (e.g. exhausted retries) while
                      pendingCount reads 0 — surface it separately so that
                      doesn't read as false "everything synced" confidence. */}
                  {isElectron && syncInfo.failedCount > 0 && (
                    <div className="bg-red-600 text-white text-xs px-2 py-1 rounded-full font-semibold animate-bounce-subtle" title="Transaksi gagal sinkronisasi - perlu perhatian">
                      {syncInfo.failedCount} gagal
                    </div>
                  )}
                </div>

                {/* Pencarian cepat / palet perintah */}
                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  className="btn-outlined btn-sm gap-2 text-gray-600"
                  aria-label="Buka pencarian cepat (Ctrl K)"
                  aria-haspopup="dialog"
                  data-command-trigger
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden lg:inline">Cari</span>
                  <kbd className="hidden rounded border border-gray-300 px-1.5 text-xs text-gray-600 lg:inline">Ctrl K</kbd>
                </button>

                {/* Menu pengguna: identitas + Pengaturan, tema, bantuan, Keluar */}
                <UserMenu
                  name={user.nama || user.nama_lengkap || user.username}
                  roleLabel={roleLabel}
                  branchName={storeInfo?.nama_cabang}
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  onOpenHelp={() => setHelpOpen(true)}
                  onLogout={handleLogout}
                />
              </div>
            )}

            {/* Pencarian cepat (mobile) */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="md:hidden btn-icon btn-text text-gray-600 ml-auto mr-1"
              aria-label="Buka pencarian cepat"
              aria-haspopup="dialog"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={toggleMenu}
              className="md:hidden btn-icon btn-text text-gray-600"
              aria-label="Buka menu navigasi"
              aria-haspopup="dialog"
              aria-expanded={isMenuOpen}
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Navigasi mobile: drawer dari kiri (menggantikan panel 192px yang memaksa scroll di dalam scroll) */}
          {!isMdUp && (
            <Drawer open={isMenuOpen} onClose={closeMenu} side="left" title="Menu" widthClassName="w-[min(88vw,20rem)]">
              <div className="flex flex-col space-y-2 pt-4">
                {/* Search input untuk mobile */}
                {menus && menus.length > 0 && (
                  <div className="px-4 pb-3 relative">
                    <input
                      type="text"
                      placeholder="Cari menu..."
                      value={mobileSearchTerm}
                      onChange={(e) => setMobileSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setMobileSearchTerm('');
                      }}
                      className="w-full pr-12 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                    {mobileSearchTerm && (
                      <button
                        onClick={() => setMobileSearchTerm('')}
                        aria-label="Clear search"
                        className="absolute inset-y-0 right-2 flex items-center justify-center px-2 touch-manipulation text-gray-500 hover:text-gray-700"
                        type="button"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 8.586L15.293 3.293a1 1 0 011.414 1.414L11.414 10l5.293 5.293a1 1 0 01-1.414 1.414L10 11.414l-5.293 5.293a1 1 0 01-1.414-1.414L8.586 10 3.293 4.707A1 1 0 014.707 3.293L10 8.586z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}

                {/* Menu items dengan scrollable container */}
                <div className={`space-y-2 px-1`}>
                  {groupedMobileMenuItems.map(group => (
                    <div key={group.key} className="space-y-2">
                      <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {group.label}
                      </div>
                      {group.items.map(menu => (
                        <NavLink
                          key={menu.id}
                          to={menu.path}
                          onClick={closeMenu}
                          data-menu-item
                          className={({ isActive }) =>
                            `block px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                              isActive
                                ? 'text-blue-600 bg-blue-50 border border-blue-200'
                                : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                            }`
                          }
                        >
                          <span className="inline-flex items-center gap-2">
                            {menu.icon && <span className="inline-flex items-center justify-center">{menu.icon}</span>}
                            {menu.name}
                          </span>
                        </NavLink>
                      ))}
                    </div>
                  ))}
                  <NavLink
                    to="/"
                    end
                    onClick={closeMenu}
                    data-menu-item
                    className={({ isActive }) =>
                      `block px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'text-blue-600 bg-blue-50 border border-blue-200'
                          : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                      }`
                    }
                  >
                    Dashboard
                  </NavLink>
                  <NavLink
                    to="/pengaturan"
                    onClick={closeMenu}
                    data-menu-item
                    className={({ isActive }) =>
                      `block px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'text-blue-600 bg-blue-50 border border-blue-200'
                          : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                      }`
                    }
                  >
                    Pengaturan
                  </NavLink>
                </div>
                {user && (
                  <>
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      {/* Connection Status - Mobile */}
                      <div className="mb-4">
                        {isElectron ? (
                          <>
                            <button
                              onClick={handleConnectionStatusClick}
                              disabled={!isElectron}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                                connectionStatus.isOnline
                                  ? 'bg-green-50 hover:bg-green-100 border border-green-200'
                                  : 'bg-red-50 hover:bg-red-100 border border-red-200'
                              } ${!isElectron ? 'cursor-not-allowed opacity-60' : ''}`}
                            >
                              <div className={`w-3 h-3 rounded-full ${connectionStatus.isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              <div className="flex-1 text-left">
                                <div className={`text-sm font-medium ${connectionStatus.isOnline ? 'text-green-700' : 'text-red-700'}`}>
                                  {connectionStatus.isOnline ? 'Online' : 'Offline'}
                                </div>
                                {syncInfo.pendingCount > 0 && (
                                  <div className="text-xs text-yellow-600">
                                    {syncInfo.pendingCount} data pending
                                  </div>
                                )}
                                {syncInfo.failedCount > 0 && (
                                  <div className="text-xs text-red-600 font-semibold">
                                    {syncInfo.failedCount} gagal sync
                                  </div>
                                )}
                              </div>
                              <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {/* Quick Sync Button - Mobile - Only show when online */}
                            {connectionStatus.isOnline && (
                              <div className="mt-3 flex gap-3">
                                <button
                                  onClick={handleSync}
                                  disabled={isSyncingLocal}
                                  className={`flex-1 btn text-sm py-3 transition-all ${
                                    isSyncingLocal 
                                      ? 'btn-warning opacity-75' 
                                      : 'btn-primary'
                                  }`}
                                  title="Sinkron Data: Kirim perubahan lokal + ambil dari server"
                                >
                                  <svg className={`w-4 h-4 mr-2 ${isSyncingLocal ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  {isSyncingLocal ? `Sinkron ${syncProgress}%` : 'Sinkron Data'}
                                </button>

                                <button
                                  onClick={handleRefresh}
                                  disabled={isRefreshing}
                                  className={`flex-1 btn text-sm py-3 transition-all ${
                                    isRefreshing 
                                      ? 'btn-warning opacity-75' 
                                      : 'btn-success'
                                  }`}
                                  title="Perbarui Data: Ambil data terbaru dari server"
                                >
                                  <svg className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  {isRefreshing ? `Update ${syncProgress}%` : 'Perbarui Data'}
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0 9c-1.657 0-3-4.03-3-9s1.343-9 3-9m0 18c1.657 0 3-4.03 3-9s-1.343-9-3-9" />
                            </svg>
                            <div>
                              <div className="text-sm font-medium text-blue-700">Mode Web Browser</div>
                              <div className="text-xs text-blue-600">Sync tersedia di desktop app</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Theme Toggle - Mobile */}
                      <div className="mb-4">
                        <button
                          onClick={toggleTheme}
                          className="flex items-center justify-between w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {theme === 'light' ? (
                              <Moon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <Sun className="w-5 h-5 text-amber-500" />
                            )}
                            <span className="text-sm font-medium">
                              {theme === 'light' ? 'Mode Gelap' : 'Mode Terang'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {theme === 'light' ? 'Nonaktif' : 'Aktif'}
                          </span>
                        </button>
                      </div>

                      {/* User Info - Mobile */}
                      <div className="relative user-dropdown">
                        <button
                          onClick={toggleUserDropdown}
                          className="flex items-center justify-between w-full px-4 py-3 rounded-xl hover:bg-gray-100 transition-all duration-200 border border-gray-200"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-medium text-gray-900">{user.nama || user.nama_lengkap}</div>
                              <div className="text-xs text-gray-500">{roleLabel}</div>
                            </div>
                          </div>
                          <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isUserDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Mobile Dropdown Menu */}
                        {isUserDropdownOpen && (
                          <div className="mt-3 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-lg animate-fade-in">
                            <div className="py-2">
                              <button
                                onClick={() => { handleLogout(); closeMenu(); }}
                                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-danger-600 hover:bg-red-50 hover:text-red-700 transition-colors rounded-lg mx-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                Logout
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Drawer>
          )}
        </div>
      </nav>
      <main className="w-full max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8 py-6 md:py-8">
        <Outlet />
      </main>

      {/* Sync Modal - Only in Electron */}
      {isElectron && (
        <SyncModal
          isOpen={isSyncModalOpen}
          onClose={handleCloseSyncModal}
        />
      )}
      <SyncStatusNotification syncStatus={syncStatus} isSyncing={isSyncing} queueSize={queueSize} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />
      {helpOpen && <ShortcutModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
};

export default Layout;
