import React, { useState, useCallback, useEffect } from 'react';
import { Outlet, Link, NavLink } from 'react-router-dom';
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
import syncEngine from '../services/syncEngine';
import { Sun, Moon } from 'lucide-react';
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
      console.error('❌ Perbarui data gagal:', error);
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
      console.error('❌ Sinkronisasi gagal:', error);
      setSyncProgress(0);
    } finally {
      setIsSyncingLocal(false);
    }
  };

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

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-4">
              {menus && menus.length > 0 ? (
                <>
                  {/* Dropdown untuk semua menu dinamis */}
                  <NavDropdown
                    label="Menu"
                    items={navDropdownItems}
                  />
                </>
              ) : (
                <>
                  {/* Dropdown untuk default menus saat database kosong */}
                  <NavDropdown
                    label="Menu"
                    items={groupMenuItems([
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
                      }] : [])
                    ]).flatMap(group =>
                      group.items.map(item => ({
                        ...item,
                        group: group.key,
                        groupLabel: group.label
                      }))
                    )}
                  />
                </>
              )}
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
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
                className={({ isActive }) =>
                  `px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'text-blue-600 bg-blue-50 border border-blue-200'
                      : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                  }`
                }
              >
                Pengaturan
              </NavLink>
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
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0 9c-1.657 0-3-4.03-3-9s1.343-9 3-9m0 18c1.657 0 3-4.03 3-9s-1.343-9-3-9" />
                      </svg>
                      <span>Web Mode</span>
                    </div>
                  )}

                  {/* Pending count badge - Only in Electron */}
                  {isElectron && syncInfo.pendingCount > 0 && (
                    <div className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-semibold animate-bounce-subtle">
                      {syncInfo.pendingCount}
                    </div>
                  )}
                </div>

                {/* Theme Toggle Button */}
                <button
                  onClick={toggleTheme}
                  className="p-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 transition-colors shrink-0"
                  title={theme === 'light' ? 'Ubah ke Mode Gelap' : 'Ubah ke Mode Terang'}
                >
                  {theme === 'light' ? (
                    <Moon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <Sun className="w-4 h-4 text-amber-500" />
                  )}
                </button>

                {/* User Dropdown - Desktop */}
                <div className="relative user-dropdown">
                  <button
                    onClick={toggleUserDropdown}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-100 transition-all duration-200 border border-gray-200"
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="hidden lg:block text-left">
                      <div className="text-sm font-medium text-gray-900">Halo, {user.nama || user.nama_lengkap}</div>
                      <div className="text-xs text-gray-500">{user.email || 'User'}</div>
                    </div>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isUserDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {isUserDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 z-50 animate-fade-in">
                      <div className="py-2">
                        <button
                          onClick={handleLogout}
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
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={toggleMenu}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-gray-200 animate-fade-in">
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
                <div className={`space-y-2 ${visibleMenuItems.length > 5 ? 'max-h-48 overflow-y-auto px-4' : 'px-4'}`}>
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
                              <div className="text-sm font-medium text-gray-900">Halo, {user.nama || user.nama_lengkap}</div>
                              <div className="text-xs text-gray-500">{user.email || 'User'}</div>
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
            </div>
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
    </div>
  );
};

export default Layout;
