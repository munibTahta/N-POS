import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Download, Upload, ArrowLeft } from 'lucide-react';
import LoadingButton from '../components/common/LoadingButton';
import HeaderActionButton from '../components/HeaderActionButton';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';

const DatabaseSetupPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleResetDatabase = async () => {
    if (!window.confirm('Apakah Anda yakin ingin reset database? Semua data offline akan hilang!')) {
      return;
    }

    setLoading(true);

    try {
      if (window.electronAPI?.dbReset) {
        await window.electronAPI.dbReset();
        toast.success('Database berhasil direset. Aplikasi akan restart...', {
          autoClose: 2000,
        });

        // Restart aplikasi setelah 2 detik
        setTimeout(async () => {
          if (window.electronAPI?.restartApp) {
            window.electronAPI.restartApp();
          } else {
            try {
              const { safeReload } = await import('../utils/appRefresh');
              safeReload('databaseSetup:after-reset');
            } catch (_e) {
              // Fallback reload if safeReload import fails
              window.location.reload();
            }
          }
        }, 2000);
      } else {
        throw new Error('Fungsi reset database tidak tersedia');
      }
    } catch (err) {
      toast.error(`Gagal reset database: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReinitializeDatabase = async () => {
    setLoading(true);

    try {
      if (window.electronAPI?.dbReinitialize) {
        await window.electronAPI.dbReinitialize();
        toast.success('Database berhasil diinisialisasi ulang.');
      } else {
        throw new Error('Fungsi reinitialize database tidak tersedia');
      }
    } catch (err) {
      toast.error(`Gagal inisialisasi ulang database: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBackupDatabase = async () => {
    setLoading(true);

    try {
      if (window.electronAPI?.dbBackup) {
        const result = await window.electronAPI.dbBackup();
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
      } else {
        throw new Error('Fungsi backup database tidak tersedia');
      }
    } catch (err) {
      toast.error(`Gagal backup database: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreDatabase = async () => {
    const skipIntegrityCheck = window.confirm(
      'PERINGATAN: Restore database akan menggantikan semua data saat ini dengan data dari file backup.\n\n' +
      'Apakah Anda ingin melewati pemeriksaan integritas database? (Pilih "Cancel" untuk pemeriksaan ketat, "OK" untuk melewati)'
    );

    if (!window.confirm('Apakah Anda yakin ingin melanjutkan restore database?')) {
      return;
    }

    setLoading(true);

    try {
      if (window.electronAPI?.dbRestore) {
        const result = await window.electronAPI.dbRestore({ skipIntegrityCheck });
        if (result.success) {
          toast.success(`${result.message} Aplikasi akan restart untuk menerapkan perubahan.`, {
            autoClose: 3000,
          });

          // Restart aplikasi setelah 3 detik
          setTimeout(async () => {
            if (window.electronAPI?.restartApp) {
              window.electronAPI.restartApp();
            } else {
              try {
                const { safeReload } = await import('../utils/appRefresh');
                safeReload('databaseSetup:after-action');
              } catch (_e) {
                // Fallback reload if safeReload import fails
                window.location.reload();
              }
            }
          }, 3000);
        } else {
          toast.error(result.message);
        }
      } else {
        throw new Error('Fungsi restore database tidak tersedia');
      }
    } catch (err) {
      toast.error(`Gagal restore database: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Setup Database Offline"
          subtitle="Kelola dan setup database offline aplikasi"
          actions={
            <>
              <HeaderActionButton
                icon={Download}
                label="Backup"
                onClick={handleBackupDatabase}
                disabled={loading}
                variant="success"
              />
              <HeaderActionButton
                icon={Upload}
                label="Restore"
                onClick={handleRestoreDatabase}
                disabled={loading}
                variant="warning"
              />
              <HeaderActionButton
                icon={ArrowLeft}
                label="Kembali"
                onClick={() => navigate('/pengaturan')}
                variant="secondary"
              />
            </>
          }
        />

        <div className="space-y-6">
          {/* Database Info */}
          <div className="space-y-4">
            {/* Offline DB */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-800 mb-2">📊 Database Umum (offline.db)</h3>
              <div className="text-sm text-gray-600 space-y-1 mb-3">
                <p><strong>Fungsi:</strong> Menyimpan data transaksi, pelanggan, kategori, satuan</p>
                <p><strong>Path:</strong> <code className="bg-gray-200 px-1 rounded text-xs">~/AppData/Roaming/n-pos/offline.db</code></p>
              </div>
            </div>

            {/* Product DB */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-800 mb-2">🔍 Database Produk (product_offline.db)</h3>
              <div className="text-sm text-blue-700 space-y-1 mb-3">
                <p><strong>Fungsi:</strong> Index produk teroptimasi untuk pencarian cepat & offline</p>
                <p><strong>Path:</strong> <code className="bg-blue-100 px-1 rounded text-xs">~/AppData/Roaming/n-pos/product_offline.db</code></p>
                <p><strong>Size (per 1000 produk):</strong> ~2.5MB</p>
              </div>
              <div className="mt-2 p-2 bg-blue-100 rounded text-xs text-blue-800">
                ⚡ Query time: 5-50ms (indexed), Delta sync setiap 1 jam
              </div>
            </div>

            {/* Tips */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded">
              <h4 className="font-medium text-amber-800 mb-1">💡 Tips Backup</h4>
              <ul className="text-xs text-amber-700 space-y-1">
                <li>• Backup kedua database secara berkala sebelum update aplikasi</li>
                <li>• Product database auto-recreate jika dihapus saat sync berikutnya</li>
                <li>• Test restore di environment terpisah terlebih dahulu</li>
              </ul>
            </div>
          </div>

          {/* Database Actions */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Aksi Database</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-2">Reset Database</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Hapus semua data offline dan buat ulang struktur database dari awal.
                  Data yang belum tersinkron akan hilang.
                </p>
                <LoadingButton
                  onClick={handleResetDatabase}
                  loading={loading}
                  loadingText="Mereset..."
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Reset Database
                </LoadingButton>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-2">Reinisialisasi Database</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Perbaiki struktur database tanpa menghapus data.
                  Berguna jika ada masalah dengan schema database.
                </p>
                <LoadingButton
                  onClick={handleReinitializeDatabase}
                  loading={loading}
                  loadingText="Memproses..."
                  className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Reinisialisasi
                </LoadingButton>
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </PageLayout>
  );
};

export default DatabaseSetupPage;