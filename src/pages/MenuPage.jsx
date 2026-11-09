import React, { useState, useMemo, useEffect, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { useMenuContext } from '../context/MenuContext';
import { useRoleContext } from '../context/RoleContext';
import { PageLayout, PageContainer, PageHeader, MetaLine } from '../components/layouts/index.jsx';
import { renderLucideIcon } from '../utils/lucideIconHelper';
import { useSettings } from '../context/SettingsContext';
import { useTodaySales } from '../hooks/useTodaySales';
import { formatFullDate } from '../utils/dateRange';
import { formatCurrency } from '../utils/formatHelper';
// import { getUserMenus } from '../services/api';

// Add custom animations
const styles = `
  @keyframes fade-in-up {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fade-in-up {
    animation: fade-in-up 0.6s ease-out forwards;
    opacity: 0;
  }
`;

const MenuCard = memo(({ to, icon, title, description, isPrimary = false, borderClass = 'border-l-blue-500', iconClass = 'text-gray-600 dark:text-zinc-400' }) => (
  <Link
    to={to}
    className={`group block h-full ${isPrimary ? 'md:col-span-2 lg:col-span-1' : ''}`}
  >
    <div className={`card p-4 h-full flex flex-col justify-between hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-l-2 ${borderClass} relative overflow-hidden bg-white dark:bg-zinc-900`}>
      <div>
        <div className="mb-2">
          {renderLucideIcon(icon, `${iconClass} text-3xl`)}
        </div>
        <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-zinc-100 group-hover:text-blue-600 transition-colors">
          {title}
        </h2>
        <p
          className="text-gray-600 dark:text-zinc-400 text-xs leading-relaxed"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {description}
        </p>
      </div>
    </div>
  </Link>
));

MenuCard.displayName = 'MenuCard';

const SkeletonCard = memo(() => (
  <div className="card p-4 border-l-2 border-l-gray-300 animate-pulse">
    <div className="w-12 h-12 bg-gray-300 rounded mb-2"></div>
    <div className="h-4 bg-gray-300 rounded mb-2"></div>
    <div className="h-3 bg-gray-300 rounded"></div>
  </div>
));

SkeletonCard.displayName = 'SkeletonCard';

const menuBorderClasses = [
  'border-l-emerald-500',
  'border-l-indigo-500',
  'border-l-amber-500',
  'border-l-fuchsia-500',
  'border-l-sky-500',
  'border-l-rose-500',
  'border-l-lime-500',
  'border-l-cyan-500'
];

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

const menuDescriptionMap = {
  '/pos': 'Buka kasir untuk transaksi penjualan cepat',
  '/penjualan': 'Lihat riwayat penjualan dan laporan transaksi',
  '/pembelian': 'Kelola pembelian, faktur, dan pemasok',
  '/produk': 'Tambahkan, edit, dan kelola produk Anda',
  '/stok': 'Pantau stok, ketersediaan, dan mutasi barang',
  '/pelanggan': 'Kelola data pelanggan dan histori pembelian',
  '/menu': 'Atur menu dan akses cepat aplikasi',
  '/pengguna': 'Kelola akun pengguna dan hak akses',
  '/kategori': 'Atur kategori produk untuk pengelompokan',
  '/unit': 'Kelola satuan ukuran barang',
  '/supplier': 'Kelola informasi pemasok dan vendor',
  '/branch': 'Kelola cabang dan lokasi toko',
  '/laporan': 'Lihat laporan penjualan dan kinerja bisnis',
  '/pengaturan': 'Sesuaikan pengaturan aplikasi dan preferensi'
};

const getMenuDescription = (path, fallback) => menuDescriptionMap[path] || fallback;

const MenuPage = () => {
  const { user } = useAuth();
  const { menus: contextMenus, loading: contextLoading } = useMenuContext();
  const { getRoleById } = useRoleContext();
  const { hasMenuAccess, canManage } = usePermissions();
  const navigate = useNavigate();
  const { storeInfo } = useSettings();
  // Ringkasan hari ini hanya untuk pengguna yang boleh melihat penjualan (cakupan cabang ditentukan server)
  const todaySales = useTodaySales({ enabled: hasMenuAccess('penjualan') || hasMenuAccess('pos') });
  const [menuItems, setMenuItems] = useState([]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // F9: Navigate to POS page
      if (e.key === 'F9') {
        e.preventDefault();
        e.stopPropagation();
        navigate('/pos');
        return;
      }

      // F10: Navigate to Purchase Management page
      if (e.key === 'F10') {
        e.preventDefault();
        e.stopPropagation();
        navigate('/pembelian');
        return;
      }

      // F11: Navigate to Sales History page
      if (e.key === 'F11') {
        e.preventDefault();
        e.stopPropagation();
        navigate('/penjualan');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [navigate]);

  // Load menus from context
  useEffect(() => {
    const loadMenuItems = () => {
      let transformedMenus = [];

      if (contextMenus && contextMenus.length > 0) {
        transformedMenus = contextMenus.map((menu, index) => ({
          to: menu.path,
          icon: menu.icon || 'FileText',
          title: menu.nama_menu || 'Menu Item',
          description: getMenuDescription(menu.path, `Kelola ${menu.nama_menu || 'menu ini'}`),
          isPrimary: menu.path === '/pos', // POS is primary
          borderClass: menu.path === '/pos'
            ? 'border-l-blue-600'
            : menuBorderClasses[index % menuBorderClasses.length],
          iconClass: menu.path === '/pos'
            ? 'text-blue-600'
            : menuIconClasses[index % menuIconClasses.length]
        }));
      }

      setMenuItems(transformedMenus);
    };

    loadMenuItems();
  }, [contextMenus, contextLoading]);

  // Group menu items by category
  const groupedMenuItems = useMemo(() => {
    const groups = {
      penjualan: { key: 'penjualan', name: 'Penjualan', items: [] },
      manajemen: { key: 'manajemen', name: 'Manajemen', items: [] },
      laporan: { key: 'laporan', name: 'Laporan', items: [] },
      pengaturan: { key: 'pengaturan', name: 'Pengaturan', items: [] }
    };

    menuItems.forEach(item => {
      // Normalize path for consistent checking
      const normalizedPath = item.to && !item.to.startsWith('/') ? `/${item.to}` : item.to;

      if (['/pos', '/penjualan', '/pembelian'].includes(normalizedPath)) {
        groups.penjualan.items.push(item);
      } else if (['/produk', '/stok', '/pelanggan', '/menu', '/pengguna', '/kategori', '/unit', '/supplier', '/branch'].includes(normalizedPath)) {
        groups.manajemen.items.push(item);
      } else if (normalizedPath === '/laporan' || normalizedPath.startsWith('/laporan')) {
        groups.laporan.items.push(item);
      } else if (normalizedPath === '/akun-keuangan' || normalizedPath === '/rekening-keuangan' || normalizedPath === '/pengaturan') {
        groups.pengaturan.items.push(item);
      } else {
        groups.manajemen.items.push(item); // Default to manajemen
      }
    });

    // Remove empty groups
    return Object.values(groups).filter(group => group.items.length > 0);
  }, [menuItems]);

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Menu Utama"
          subtitle={(
            <MetaLine parts={[
              storeInfo?.nama_cabang,
              formatFullDate(new Date(), false),
              todaySales.data && `${todaySales.data.jumlah_transaksi.toLocaleString('id-ID')} transaksi hari ini`,
              todaySales.data && todaySales.data.jumlah_transaksi > 0 && `Rp ${formatCurrency(todaySales.data.total_penjualan)}`,
              todaySales.data && todaySales.data.belum_lunas > 0 && { text: `${todaySales.data.belum_lunas} belum lunas`, tone: 'warn' },
            ]} />
          )}
        />
        <style>{styles}</style>
        <div className="space-y-6 pt-2">

      {/* Loading State */}
      {contextLoading && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      )}

      {/* Menu Groups */}
      {!contextLoading && groupedMenuItems.map((group) => (
        <div key={group.name} className="space-y-4">
          <h3 className="text-xl font-bold text-gray-800 border-b border-gray-200 pb-2">
            {group.name}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {group.items.map((item) => (
              <div key={item.to}>
                <MenuCard
                  to={item.to}
                  icon={item.icon}
                  title={item.title}
                  description={item.description}
                  isPrimary={item.isPrimary}
                  borderClass={item.borderClass}
                  iconClass={item.iconClass}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* No menus found */}
      {!contextLoading && menuItems.length === 0 && (
        <div className="text-center py-16">
          <div className="mb-6">
            {renderLucideIcon('Clipboard', 'w-16 h-16 mx-auto text-gray-400')}
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Tidak ada menu tersedia</h3>
          <p className="text-gray-600 text-lg max-w-md mx-auto">
            Belum ada menu yang dapat diakses.
          </p>
        </div>
      )}

      {/* Quick Actions */}
      {hasMenuAccess('pos') && (
        <div className="card p-8 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-center gap-2 mb-6">
            {renderLucideIcon('Zap', 'w-6 h-6 text-amber-500')}
            <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100 text-center">Aksi Cepat</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link to="/pos" className="group">
              <div className="card p-6 bg-white dark:bg-zinc-900 hover:shadow-md transition-all duration-200 border-l-4 border-l-blue-500 rounded-xl">
                <div className="flex items-center gap-4">
                  {renderLucideIcon('CreditCard', 'w-10 h-10 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform')}
                  <div>
                    <p className="font-bold text-gray-900 dark:text-zinc-100 group-hover:text-blue-600 transition-colors">Buka Kasir POS</p>
                    <p className="text-gray-600 dark:text-zinc-400 text-sm">Mulai transaksi penjualan</p>
                  </div>
                </div>
              </div>
            </Link>
            {hasMenuAccess('stok/kasir') && (
              <Link to="/stok/kasir" className="group">
                <div className="card p-6 bg-white dark:bg-zinc-900 hover:shadow-md transition-all duration-200 border-l-4 border-l-green-500 rounded-xl">
                  <div className="flex items-center gap-4">
                    {renderLucideIcon('Package', 'w-10 h-10 text-green-600 dark:text-emerald-400 group-hover:scale-110 transition-transform')}
                    <div>
                      <p className="font-bold text-gray-900 dark:text-zinc-100 group-hover:text-success-600 transition-colors">Cek Stok Cabang</p>
                      <p className="text-gray-600 dark:text-zinc-400 text-sm">Lihat ketersediaan produk</p>
                    </div>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Permission Info Box */}
      <div className="card p-6 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          {renderLucideIcon('Lock', 'w-5 h-5 text-purple-600 dark:text-purple-400')}
          <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100">Informasi Akses Menu</h2>
        </div>
        <div className="text-sm text-slate-600 dark:text-zinc-400 space-y-3">
          {(() => {
            const roleData = getRoleById(user?.id_role);
            const roleName = roleData?.nama_role || user?.role_display || user?.role || 'Unknown';
            const roleId = user?.id_role;

            let description = 'Akses terbatas sesuai dengan konfigurasi.';

            if (roleId === 1 || roleName?.toLowerCase() === 'admin' || roleName?.toLowerCase() === 'administrator') {
              description = 'Akses penuh ke semua menu sistem termasuk laporan, manajemen data master, dan konfigurasi.';
            } else if (roleId === 2 || roleName?.toLowerCase() === 'kasir') {
              description = 'Akses ke POS, riwayat penjualan, dan stok cabang sendiri. Tidak bisa akses laporan atau manajemen data.';
            } else if (roleId === 3 || roleName?.toLowerCase() === 'gudang') {
              description = 'Akses terbatas untuk pengisian data stok dan operasional gudang.';
            } else if (roleId === 4 || roleName?.toLowerCase() === 'owner') {
              description = 'Akses penuh ke semua menu sistem dan laporan untuk analisis bisnis.';
            }

            return (
              <p className="flex items-start gap-2">
                {renderLucideIcon('Check', 'w-4 h-4 text-purple-600 dark:text-purple-400 mt-1')}
                <span><strong>{roleName.toUpperCase()}:</strong> {description}</span>
              </p>
            );
          })()}
        </div>
      </div>

      {/* Tips */}
      <div className="card p-6 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          {renderLucideIcon('Lightbulb', 'w-5 h-5 text-emerald-600 dark:text-emerald-400')}
          <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100">Tips Penggunaan</h2>
        </div>
        <ul className="text-sm text-slate-600 dark:text-zinc-400 space-y-3">
          {hasMenuAccess('pos') && (
            <li className="flex items-start gap-2">
              {renderLucideIcon('Check', 'w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-1')}
              <span>Gunakan menu <strong>Kasir POS</strong> untuk proses transaksi penjualan harian</span>
            </li>
          )}
          {hasMenuAccess('penjualan') && (
            <li className="flex items-start gap-2">
              {renderLucideIcon('Check', 'w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-1')}
              <span>Periksa <strong>Riwayat Penjualan</strong> untuk pencetakan struk dan verifikasi transaksi</span>
            </li>
          )}
          {(hasMenuAccess('stok') || hasMenuAccess('stok/kasir')) && (
            <li className="flex items-start gap-2">
              {renderLucideIcon('Check', 'w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-1')}
              <span>Periksa <strong>Manajemen Stok</strong> secara berkala untuk memastikan stok tersedia</span>
            </li>
          )}
          {hasMenuAccess('pengaturan') && (
            <li className="flex items-start gap-2">
              {renderLucideIcon('Check', 'w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-1')}
              <span>Akses <strong>Pengaturan</strong> untuk mengubah preferensi personal Anda</span>
            </li>
          )}
          {hasMenuAccess('laporan') && (
            <li className="flex items-start gap-2">
              {renderLucideIcon('Check', 'w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-1')}
              <span>Gunakan <strong>Laporan & Monitoring</strong> untuk analisis penjualan dan performa</span>
            </li>
          )}
          {hasMenuAccess('rekonsiliasi') && (
            <li className="flex items-start gap-2">
              {renderLucideIcon('Check', 'w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-1')}
              <span>Lakukan <strong>Rekonsiliasi Pembayaran</strong> untuk verifikasi pembayaran yang belum lunas</span>
            </li>
          )}
          {canManage && (
            <li className="flex items-start gap-2">
              {renderLucideIcon('Check', 'w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-1')}
              <span>Konfigurasikan <strong>Metode Pembayaran</strong> dan <strong>Pengaturan Sistem</strong> sesuai kebutuhan bisnis</span>
            </li>
          )}
        </ul>
      </div>
        </div>
      </PageContainer>
    </PageLayout>
  );
};

export default MenuPage;
