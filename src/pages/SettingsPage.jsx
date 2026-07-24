import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { updateBranch, updateUser, getSettings, updateSetting, resetDatabase } from '../services/api';
import { useAuth } from '../hooks/useAuth'; // Impor useAuth untuk mendapatkan data user
import { useSettings } from '../context/SettingsContext'; // Impor hook settings
import { useNotifications } from '../hooks/useNotifications';
import { useSync } from '../context/SyncContext';
import { usePermissions } from '../hooks/usePermissions';
import usePrinter from '../hooks/usePrinter';
import { Printer, Trash2 } from 'lucide-react';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';

const SettingsPage = () => {
  const { user, refreshUser } = useAuth(); // Dapatkan data user yang sedang login dan fungsi refresh
  const { success, error, warning, info: _info } = useNotifications();
  const { canManageSettings, canManageBranches } = usePermissions();
  const { storeInfo, posSettings, loadingSettings, refreshSettings, updatePosSettings, setStoreInfo } = useSettings(); // Gunakan context
  const { getConnectionStatus, getSyncInfo } = useSync();
  const { printTestReceipt } = usePrinter();

  // OPTIMIZATION: Initialize form state from localStorage (draft-save feature)
  // This prevents data loss when user navigates away without saving
  const [settings, setSettings] = useState(() => {
    const savedSettings = localStorage.getItem('settingsPageDraft');
    return savedSettings ? JSON.parse(savedSettings) : { cabang: {}, printer: {} };
  });
  
  const [systemSettings, setSystemSettings] = useState(() => {
    const savedSettings = localStorage.getItem('systemSettingsDraft');
    return savedSettings ? JSON.parse(savedSettings) : {
      pajak_default_persen: 10,
      loyalitas_aktif: true,
      conversion_rate_loyalitas: 1000,
      poin_kadaluarsa_bulan: 12
    };
  });
  
  const [posSettingsForm, setPosSettingsForm] = useState(() => {
    const savedSettings = localStorage.getItem('posSettingsDraft');
    if (savedSettings) {
      return JSON.parse(savedSettings);
    }
    return {
      showPaymentSelector: true,
      showCustomerSearch: true,
      showVoucherInput: true,
      enablePPN: false,
      allowOversellSync: false,
      ...(posSettings || {})
    };
  });
  const [printers, setPrinters] = useState([]);
  const [showQzTrayCertificate, setShowQzTrayCertificate] = useState(false);
  const [showSystemConfig, setShowSystemConfig] = useState(false);
  const [printerError, setPrinterError] = useState('');
  const [qzTrayStatus, setQzTrayStatus] = useState('');
  const [qzTrayAvailable, setQzTrayAvailable] = useState(null);
  const [checkingQzTray, setCheckingQzTray] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [serverData, setServerData] = useState(null);
  const [showPrinterTestModal, setShowPrinterTestModal] = useState(false);
  const [printerTestLoading, setPrinterTestLoading] = useState(false);
  const [qzCertificate, setQzCertificate] = useState('');
  const [qzCertificatePath, setQzCertificatePath] = useState('');
  const [certificateStatus, setCertificateStatus] = useState('');
  const [loadingCertificate, setLoadingCertificate] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [confirmResetText, setConfirmResetText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleResetDatabase = async (e) => {
    e.preventDefault();
    if (confirmResetText !== 'RESET_MY_DATABASE') {
      setResetError('Konfirmasi teks salah. Harap ketik "RESET_MY_DATABASE"');
      return;
    }
    
    try {
      setIsResetting(true);
      setResetError('');
      const res = await resetDatabase(confirmResetText);
      if (res.data?.success) {
        success('Database berhasil diinisialisasi ulang.');
        setShowResetModal(false);
        setConfirmResetText('');
        // Refresh page after delay to reload configuration
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setResetError(res.data?.message || 'Gagal reset database');
      }
    } catch (err) {
      setResetError(err.response?.data?.message || err.message || 'Gagal reset database');
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    // remove any legacy general printer config stored locally; only one
    // default printer is supported now.
    try { localStorage.removeItem('defaultGeneralPrinterName'); } catch (_) { /* ignore */ }

    const fetchPrinters = async () => {
      try {
        // Ambil daftar printer dari Electron
        if (window.electronAPI && window.electronAPI.getPrinters) {
            const availablePrinters = await window.electronAPI.getPrinters();
            setPrinters(availablePrinters || []);
            if (!availablePrinters || availablePrinters.length === 0) {
              setPrinterError('Tidak ada printer terdeteksi dari sistem');
            }
          } else {
            // non-electron environment: leave printer list empty
            setPrinters([]);
            setPrinterError('API printer tidak tersedia');
          }
      } catch (_err) {
        setPrinterError('Gagal memuat daftar printer');
        // Fallback printers jika error
        setPrinters([
          { name: 'POS-58', displayName: 'POS-58 Thermal Printer' },
          { name: 'EPSON-TM', displayName: 'EPSON TM Series' }
        ]);
      }
    };

    fetchPrinters();
  }, []);

  const checkQzTrayAvailability = async () => {
    if (!window.electronAPI || !window.electronAPI.checkQzTray) {
      setQzTrayStatus('QZ Tray tidak tersedia di lingkungan ini. Jalankan aplikasi desktop N-POS di mode Electron.');
      setQzTrayAvailable(false);
      return;
    }

    setCheckingQzTray(true);
    try {
      const result = await window.electronAPI.checkQzTray();
      const printerCount = Array.isArray(result?.printers) ? result.printers.length : 0;

      if (result?.success) {
        setQzTrayAvailable(true);
        setQzTrayStatus(`QZ Tray siap. ${printerCount} printer terdeteksi.`);
      } else {
        setQzTrayAvailable(false);
        setQzTrayStatus(`QZ Tray tidak tersedia: ${result?.error || 'Tidak dapat terhubung.'}`);
      }
    } catch (err) {
      setQzTrayAvailable(false);
      setQzTrayStatus(`QZ Tray error: ${err?.message || err}`);
    } finally {
      setCheckingQzTray(false);
    }
  };

  const loadQzCertificate = async () => {
    if (!window.electronAPI || !window.electronAPI.getQzCertificate) {
      setCertificateStatus('API certificate tidak tersedia');
      return;
    }

    setLoadingCertificate(true);
    try {
      const result = await window.electronAPI.getQzCertificate();
      if (result?.success && result.certificate) {
        setQzCertificate(result.certificate);
        setQzCertificatePath(result.path || '');
        setCertificateStatus(result.path ? 'Sertifikat dimuat dengan sukses' : 'Sertifikat dimuat dari aplikasi');
      } else {
        setQzCertificate('');
        setQzCertificatePath('');
        setCertificateStatus('Sertifikat tidak ditemukan');
      }
    } catch (err) {
      setQzCertificatePath('');
      setCertificateStatus(`Error memuat sertifikat: ${err?.message || err}`);
    } finally {
      setLoadingCertificate(false);
    }
  };

  const saveQzCertificate = async () => {
    if (!window.electronAPI || !window.electronAPI.saveQzCertificate) {
      error('API certificate tidak tersedia');
      return;
    }

    if (!qzCertificate.trim()) {
      error('Sertifikat tidak boleh kosong');
      return;
    }

    setLoadingCertificate(true);
    try {
      const result = await window.electronAPI.saveQzCertificate(qzCertificate.trim());
      if (result?.success) {
        success('Sertifikat QZ Tray berhasil disimpan');
        setQzCertificatePath(result.path || qzCertificatePath);
        setCertificateStatus('Sertifikat berhasil disimpan');
        await checkQzTrayAvailability();
      } else {
        error(`Gagal menyimpan sertifikat: ${result?.error || 'Unknown error'}`);
      }
    } catch (err) {
      error(`Error menyimpan sertifikat: ${err?.message || err}`);
    } finally {
      setLoadingCertificate(false);
    }
  };

  const generateNewCertificate = async () => {
    if (!window.electronAPI || !window.electronAPI.generateQzCertificate) {
      error('API generate certificate tidak tersedia');
      return;
    }

    setLoadingCertificate(true);
    try {
      const result = await window.electronAPI.generateQzCertificate();
      if (result?.success && result.certificate) {
        setQzCertificate(result.certificate);
        setQzCertificatePath(result.certPath || '');
        setCertificateStatus('Sertifikat baru berhasil dibuat');
        success('Sertifikat baru berhasil dibuat');
        await checkQzTrayAvailability();
      } else {
        error(`Gagal membuat sertifikat: ${result?.error || 'Unknown error'}`);
      }
    } catch (err) {
      error(`Error membuat sertifikat: ${err?.message || err}`);
    } finally {
      setLoadingCertificate(false);
    }
  };

  useEffect(() => {
    checkQzTrayAvailability();
    loadQzCertificate();
  }, []);

  // OPTIMIZATION: Auto-save form drafts to localStorage to prevent data loss
  useEffect(() => {
    // Save settings draft with debounce (only save if form changes)
    localStorage.setItem('settingsPageDraft', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    // Save system settings draft
    localStorage.setItem('systemSettingsDraft', JSON.stringify(systemSettings));
  }, [systemSettings]);

  useEffect(() => {
    // Save POS settings draft
    localStorage.setItem('posSettingsDraft', JSON.stringify(posSettingsForm));
  }, [posSettingsForm]);

  // Track perubahan storeInfo untuk sync form setelah penyimpanan
  useEffect(() => {
    // Jika ada serverData dan storeInfo, sync form dengan prioritas user data
    if (serverData && storeInfo && user) {
      // Prioritas: user data > localStorage > server (storeInfo)
      let userPrinter = user.printer_nama || '';
      const localPrinter = localStorage.getItem('defaultPrinterName') || '';
      const serverPrinter = storeInfo.printer?.nama || '';

      // If configured printer doesn't exist in available list, try to find a match
      if (userPrinter && printers.length > 0) {
        const printerExists = printers.some(p => p.name === userPrinter);
        if (!printerExists) {
          // Strategy 1: Try to find similar printer (POS-58 -> POS-58C)
          let similarPrinter = printers.find(p => 
            p.name.toUpperCase().includes(userPrinter.toUpperCase().substring(0, 6))
          );
          
          // Strategy 2: Find ANY thermal printer
          if (!similarPrinter) {
            similarPrinter = printers.find(p => 
              /\b(POS|THERMAL|58|80|PRINTER)\b/i.test(p.name || p.displayName)
            );
          }
          
          // Strategy 3: Use first non-system printer
          if (!similarPrinter) {
            similarPrinter = printers.find(p => 
              !/\b(WRITER|FAXE?|PRINT TO PDF|ONENOTE)\b/i.test(p.name)
            );
          }
          
          if (similarPrinter) {
            userPrinter = similarPrinter.name;
          }
        }
      }

      // Prioritas: user data > localStorage > server
      const newPrinter = userPrinter || localPrinter || serverPrinter;

      // Selalu sync dengan nilai terbaru dari user untuk semua field
      // only one printer now; ignore any "general" field
      setSettings(prevSettings => ({
        ...prevSettings,
        printer: {
          nama: newPrinter,
          paperWidth: prevSettings?.printer?.paperWidth || localStorage.getItem('printerPaperWidth') || ''
        },
      }));
      setServerData(storeInfo);
    }
  }, [storeInfo, serverData, user, printers]);

  // Load initial data hanya saat pertama kali halaman load
  useEffect(() => {
    if (storeInfo && !serverData) {
      setServerData(storeInfo);
      const initialPrinterName = (user?.printer_nama && user.printer_nama.trim()) ? user.printer_nama.trim() : (localStorage.getItem('defaultPrinterName') || storeInfo.printer?.nama || '');
      const savedPaperWidth = localStorage.getItem('printerPaperWidth') || '';
      setSettings({
        cabang: storeInfo,
        printer: {
          nama: initialPrinterName,
          paperWidth: savedPaperWidth
        },
      });
    }
  }, [storeInfo, serverData, user]);

  useEffect(() => {
    // Hanya merge jika posSettings tersedia, jangan menimpa dengan undefined
    if (posSettings) {
      setPosSettingsForm(prev => ({ ...prev, ...posSettings }));
    }
  }, [posSettings]);

  // Load system settings
  useEffect(() => {
    const fetchSystemSettings = async () => {
      try {
        const response = await getSettings();
        if (response.data.success) {
          // Merge dengan nilai default agar field yang tidak dikirim server tidak menjadi undefined
          setSystemSettings(prev => ({ ...prev, ...(response.data.data || {}) }));
        }
      } catch (_error) {
        error('Gagal memuat pengaturan sistem');
      }
    };

    if (canManageSettings) {
      fetchSystemSettings();
    }
  }, [user, canManageSettings, error]);

  // Handler untuk POS settings
  const handlePosSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPosSettingsForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setHasUnsavedChanges(true);
  };

  // Handler untuk system settings
  const handleSystemSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSystemSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }));
    setHasUnsavedChanges(true);
  };

  const handleTestPrint = async () => {
    if (!settings.printer?.nama) {
      warning('Silakan pilih printer terlebih dahulu');
      return;
    }

    // Tampilkan modal terlebih dahulu
    setShowPrinterTestModal(true);
  };

  const handleConfirmPrinterTest = React.useCallback(async () => {
    try {
      setPrinterTestLoading(true);
      await printTestReceipt(settings.printer.nama, storeInfo);
      success('Test cetak berhasil!');
      // Tutup modal setelah cetak
      setTimeout(() => {
        setShowPrinterTestModal(false);
      }, 500);
    } catch (err) {
      error('Gagal test cetak: ' + err.message);
    } finally {
      setPrinterTestLoading(false);
    }
  }, [settings.printer?.nama, storeInfo, printTestReceipt, success, error]);

  // Handle ESC key to close printer test modal and Enter key to print
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showPrinterTestModal && !printerTestLoading) {
        setShowPrinterTestModal(false);
      } else if (e.key === 'Enter' && showPrinterTestModal && !printerTestLoading && settings.printer?.nama) {
        handleConfirmPrinterTest();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showPrinterTestModal, printerTestLoading, settings.printer?.nama, handleConfirmPrinterTest]);

  const handleChange = (e) => {
    // name akan berupa "cabang.nama_cabang" atau "printer.nama"
    const [section, field] = e.target.name.split('.');

    if (field === 'paperWidth') {
    }

    setSettings(prev => ({
      ...prev,
      // Perbarui bagian state yang sesuai (cabang atau printer)
      [section]: {
        ...prev[section],
        [field]: e.target.value,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (!user || !user.id_user || !user.id_cabang) {
        throw new Error("Data pengguna atau cabang tidak lengkap. Tidak dapat menyimpan.");
      }

      const promises = [];

      // Semua user bisa update printer settings melalui updateUser
      if (user.id_user) {
        promises.push(updateUser(user.id_user, {
          printer_nama: settings.printer.nama || null
          // note: we don't send portName to server, it's maintained locally only
        }));
      }

      // Admin/Owner juga bisa update data cabang lainnya
      const canEditBranch = ['admin', 'owner'].includes(user.role);
      if (canEditBranch && user.id_cabang) {
        promises.push(updateBranch(user.id_cabang, {
          nama_cabang: settings.cabang.nama_cabang,
          alamat: settings.cabang.alamat,
          no_telp: settings.cabang.no_telp,
          struk_header: settings.cabang.struk_header,
          struk_footer: settings.cabang.struk_footer,
        }));
      }

      await Promise.all(promises);
      
      // Simpan printer ke localStorage untuk penggunaan lokal
      localStorage.setItem('defaultPrinterName', settings.printer.nama || '');
      if (settings.printer?.paperWidth) {
        localStorage.setItem('printerPaperWidth', settings.printer.paperWidth);
      } else {
        localStorage.removeItem('printerPaperWidth');
      }
      if (settings.printer?.portName) {
        // storeInfo is updated below; no need to keep a separate localStorage copy
      } else {
        // nothing to remove
      }
      
      // Simpan POS settings
      updatePosSettings(posSettingsForm);

      // Simpan system settings jika user adalah admin/owner
      if (canEditBranch) {
        const systemPromises = Object.keys(systemSettings).map(key => 
          updateSetting(key, systemSettings[key])
        );
        await Promise.all(systemPromises);
      }

      // Update storeInfo secara manual untuk memastikan sync
      const updatedPrinterData = {
        nama: settings.printer.nama || null,
        ...(settings.printer?.paperWidth ? { paperWidth: settings.printer.paperWidth } : {})
      };
      setStoreInfo(prev => ({
        ...prev,
        printer: updatedPrinterData
      }));

      // Panggil refreshSettings untuk memperbarui data di seluruh aplikasi
      await refreshSettings();

      // Refresh user data untuk memastikan printer settings terbaru
      if (user && user.id_user) {
        await refreshUser();
      }

      // Force sync form dengan data terbaru setelah penyimpanan
      setTimeout(() => {
        if (storeInfo && user) {
          // Prioritas: user data > localStorage > server
          const userPrinter = (user.printer_nama && user.printer_nama.trim()) ? user.printer_nama.trim() : '';
          const localPrinter = localStorage.getItem('defaultPrinterName') || '';
          const serverPrinter = storeInfo.printer?.nama || '';
          const finalPrinter = userPrinter || localPrinter || serverPrinter;

          setSettings(prevSettings => ({
            ...prevSettings,
            printer: { 
              nama: finalPrinter
            },
          }));
          setServerData(storeInfo);
        }
      }, 100);

      // Refresh user data to get updated printer settings
      await refreshUser();

      // OPTIMIZATION: Clear form drafts after successful save
      localStorage.removeItem('settingsPageDraft');
      localStorage.removeItem('systemSettingsDraft');
      localStorage.removeItem('posSettingsDraft');

      success('Pengaturan berhasil disimpan!');
      setHasUnsavedChanges(false); // Reset flag perubahan
    } catch (err) {
      const message = err.message || 'Error saving settings';
      error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingSettings) return <div className="text-center mt-10">Memuat Pengaturan...</div>;

  const canEditBranch = canManageBranches;

  return (
    <PageLayout maxWidth="5xl">
      <PageHeader
        title="Pengaturan Aplikasi"
        subtitle="Konfigurasi pengaturan sistem dan preferensi aplikasi Anda"
        actions={
          hasUnsavedChanges && (
            <span className="text-sm text-orange-600 bg-orange-100 px-3 py-1 rounded-full flex items-center gap-2 flex-shrink-0">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Belum disimpan
            </span>
          )
        }
      />

      <PageContainer>
        {/* Form Content */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informasi Toko & Struk Section */}
          <div className="pb-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              </svg>
              Informasi Toko &amp; Konfigurasi Struk
            </h2>
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${!canEditBranch ? 'opacity-50 pointer-events-none' : ''}`}>
              {/* Kolom Kiri */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Toko</label>
                <input type="text" name="cabang.nama_cabang" value={settings.cabang?.nama_cabang || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={!canEditBranch} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telepon Toko</label>
                <input type="text" name="cabang.no_telp" value={settings.cabang?.no_telp || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={!canEditBranch} />
              </div>

              {/* Kolom Kanan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Header Struk</label>
                <input type="text" name="cabang.struk_header" value={settings.cabang?.struk_header || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={!canEditBranch} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Footer Struk</label>
                <input type="text" name="cabang.struk_footer" value={settings.cabang?.struk_footer || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={!canEditBranch} />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Toko</label>
              <textarea name="cabang.alamat" value={settings.cabang?.alamat || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" rows="3" disabled={!canEditBranch}></textarea>
            </div>
          </div>

          {/* Printer Configuration Section */}
          <div className="py-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Konfigurasi Printer
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Printer Kasir Default</label>
                <div className="flex gap-2 items-start">
                <select
                  name="printer.nama"
                  value={settings.printer?.nama || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const selected = printers.find(p => p.name === val);
                    setSettings(prev => ({
                      ...prev,
                      printer: {
                        ...prev.printer,
                        nama: val,
                        portName: selected?.portName || ''
                      }
                    }));
                    setHasUnsavedChanges(true);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Pilih Printer --</option>
                  {printers.map(p => (
                    <option key={p.name} value={p.name}>
                        {p.displayName} {p.isDefault ? '(Default)' : ''} {p.status === 0 ? '' : '(Offline)'}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleTestPrint}
                  className="inline-flex items-center justify-center rounded-lg px-3 py-2 bg-indigo-600 text-white text-xs sm:text-sm font-medium hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:text-gray-200"
                  disabled={!settings.printer?.nama}
                  title="Test Print"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span className="hidden sm:inline ml-2">Test Cetak</span>
                </button>
              </div>
              <div className="mb-4 mt-4">
                <label className="block text-gray-700">Lebar Kertas Struk</label>
                <select
                  name="printer.paperWidth"
                  value={settings.printer?.paperWidth || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Deteksi otomatis dari printer</option>
                  
                  <optgroup label="Thermal Printer (ESC/POS)">
                    <option value="58mm">58mm - Thermal (Compact)</option>
                    <option value="80mm">80mm - Thermal (Standard)</option>
                    <option value="100mm">100mm - Thermal (Wide)</option>
                  </optgroup>
                  
                  <optgroup label="Regular Printer (Inkjet/Laser)">
                    <option value="A5">A5 - Compact (148mm)</option>
                    <option value="Letter">Letter - USA Standard (8.5")</option>
                    <option value="A4">A4 - International (210mm)</option>
                  </optgroup>
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  Pilih override jika printer Anda tidak terdeteksi otomatis. Gunakan 58/80mm untuk thermal, dan A4/Letter untuk reguler.
                </p>
              </div>
              {printerError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{printerError}</span>
                </div>
              )}
              <div className="mt-4 p-4 rounded border bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold">Troubleshooting Printer</p>
                    
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${qzTrayAvailable === null ? 'bg-slate-100 text-slate-700' : qzTrayAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {qzTrayAvailable === null ? 'Belum dicek' : qzTrayAvailable ? 'Aktif' : 'Tidak aktif'}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={checkQzTrayAvailability}
                    className="px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm flex items-center gap-2"
                    disabled={checkingQzTray}
                    title="Periksa status QZ Tray"
                    aria-label="Periksa status QZ Tray"
                  >
                    <svg className={`w-4 h-4 ${checkingQzTray ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="hidden sm:inline ml-2">Periksa Status</span>
                  </button>
                </div>
                {qzTrayStatus && (
                  <p className={`text-sm mt-2 ${qzTrayAvailable ? 'text-green-700' : 'text-red-700'}`}>{qzTrayStatus}</p>
                )}
                {!qzTrayAvailable && qzTrayAvailable !== null && (
                  <div className="mt-2 text-sm text-red-600">
                    <p>Pastikan QZ Tray berjalan dan printer terdeteksi di QZ Tray.</p>
                    <p>Jika belum, jalankan QZ Tray lalu klik "Periksa QZ Tray" kembali.</p>
                  </div>
                )}
              </div>

              {/* QZ Tray Certificate Management - Toggle */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowQzTrayCertificate(!showQzTrayCertificate)}
                  className="w-full flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className={`w-5 h-5 transition-transform ${showQzTrayCertificate ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-medium text-blue-900">QZ Tray Certificate</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {showQzTrayCertificate ? 'Sembunyikan' : 'Tampilkan'} konfigurasi sertifikat
                  </span>
                </button>

                {showQzTrayCertificate && (
                  <div className="mt-2 p-4 rounded border bg-blue-50">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold">QZ Tray Certificate</p>
                        <p className="text-xs text-gray-600">Kelola sertifikat digital untuk koneksi aman QZ Tray</p>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${certificateStatus.includes('berhasil') ? 'bg-green-100 text-green-800' : certificateStatus.includes('Error') || certificateStatus.includes('tidak') ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                        {certificateStatus || 'Belum dimuat'}
                      </span>
                      {qzCertificatePath && (
                        <p className="text-xs text-slate-600 mt-1">Lokasi file: {qzCertificatePath}</p>
                      )}
                    </div>

                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Digital Certificate
                        </label>
                        <textarea
                          value={qzCertificate}
                          onChange={(e) => setQzCertificate(e.target.value)}
                          placeholder="Paste certificate content here (-----BEGIN CERTIFICATE----- ... -----END CERTIFICATE-----)"
                          className="w-full h-32 p-2 border border-gray-300 rounded-md text-xs font-mono"
                          disabled={loadingCertificate}
                        />
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={loadQzCertificate}
                          className="px-3 py-2 bg-blue-200 text-blue-800 rounded hover:bg-blue-300 text-sm flex items-center gap-2"
                          disabled={loadingCertificate}
                          title="Load the current QZ Tray certificate from disk"
                        >
                          <svg className={`w-4 h-4 ${loadingCertificate ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>Load Certificate</span>
                        </button>

                        <button
                          type="button"
                          onClick={generateNewCertificate}
                          className="px-3 py-2 bg-green-200 text-green-800 rounded hover:bg-green-300 text-sm flex items-center gap-2"
                          disabled={loadingCertificate}
                          title="Generate a new self-signed QZ Tray certificate"
                        >
                          <svg className={`w-4 h-4 ${loadingCertificate ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          <span>Generate Certificate</span>
                        </button>

                        <button
                          type="button"
                          onClick={saveQzCertificate}
                          className="px-3 py-2 bg-purple-200 text-purple-800 rounded hover:bg-purple-300 text-sm flex items-center gap-2"
                          disabled={loadingCertificate || !qzCertificate.trim()}
                          title="Save the current certificate text to disk"
                        >
                          <svg className={`w-4 h-4 ${loadingCertificate ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                          </svg>
                          <span>Save Certificate</span>
                        </button>
                      </div>

                      <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
                        <p><strong>Cara menggunakan:</strong></p>
                        <ol className="list-decimal list-inside mt-1 space-y-1">
                          <li>Klik "Generate Certificate" untuk membuat sertifikat self-signed baru dan menyimpannya ke folder aplikasi.</li>
                          <li>Klik "Load Certificate" untuk memuat ulang sertifikat yang tersimpan ke dalam area teks.</li>
                          <li>Klik "Save Certificate" setelah menempelkan atau mengedit isi sertifikat agar tersimpan ke disk.</li>
                          <li>Restart QZ Tray setelah menyimpan atau membuat sertifikat baru.</li>
                          <li>Gunakan tombol "Check Status" untuk memeriksa apakah QZ Tray terhubung dan mengenali sertifikat.</li>
                          <li>Jika QZ Tray meminta persetujuan sertifikat, pilih "Allow" atau "Approve" agar sertifikat disimpan secara permanen.</li>
                        </ol>
                        <p className="mt-2 text-slate-700">Catatan: private key disimpan secara lokal oleh aplikasi dan tidak boleh dibagikan.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pengaturan POS */}
        <div className="py-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Pengaturan POS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <input 
                type="checkbox" 
                name="showPaymentSelector" 
                checked={posSettingsForm.showPaymentSelector} 
                onChange={handlePosSettingsChange} 
                className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <label className="text-sm text-gray-700 leading-6">
                <span className="font-medium">Tampilkan Pemilih Metode Pembayaran</span>
                <p className="text-xs text-gray-600 mt-0.5">Aktifkan pemilihan metode pembayaran di kasir</p>
              </label>
            </div>
            <div className="flex items-start gap-3">
              <input 
                type="checkbox" 
                name="showCustomerSearch" 
                checked={posSettingsForm.showCustomerSearch} 
                onChange={handlePosSettingsChange} 
                className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <label className="text-sm text-gray-700 leading-6">
                <span className="font-medium">Tampilkan Pencarian Pelanggan</span>
                <p className="text-xs text-gray-600 mt-0.5">Aktifkan fitur pencarian dan tracking pelanggan</p>
              </label>
            </div>
            <div className="flex items-start gap-3">
              <input 
                type="checkbox" 
                name="showVoucherInput" 
                checked={posSettingsForm.showVoucherInput} 
                onChange={handlePosSettingsChange} 
                className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <label className="text-sm text-gray-700 leading-6">
                <span className="font-medium">Tampilkan Input Voucher</span>
                <p className="text-xs text-gray-600 mt-0.5">Aktifkan input kode voucher dan diskon</p>
              </label>
            </div>
            <div className="flex items-start gap-3">
              <input 
                type="checkbox" 
                name="enablePPN" 
                checked={posSettingsForm.enablePPN} 
                onChange={handlePosSettingsChange} 
                className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <label className="text-sm text-gray-700 leading-6">
                <span className="font-medium">Aktifkan Kalkulator PPN</span>
                <p className="text-xs text-gray-600 mt-0.5">Aktifkan perhitungan pajak otomatis</p>
              </label>
            </div>
            <div className="flex items-start gap-3">
              <input 
                type="checkbox" 
                name="allowOversellSync" 
                checked={posSettingsForm.allowOversellSync || false} 
                onChange={handlePosSettingsChange} 
                className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <label className="text-sm text-gray-700 leading-6">
                <span className="font-medium">Loloskan Transaksi Oversell saat Sync</span>
                <p className="text-xs text-gray-600 mt-0.5">Ijinkan sinkronisasi penjualan offline meskipun stok di server kurang</p>
              </label>
            </div>
          </div>
        </div>

        {/* Pengaturan Sistem */}
        {canEditBranch && (
          <div className="py-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Pengaturan Sistem
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pajak Default (%)</label>
                <input 
                  type="number" 
                  name="pajak_default_persen" 
                  value={systemSettings.pajak_default_persen} 
                  onChange={handleSystemSettingsChange} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  min="0" 
                  max="100" 
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conversion Rate Loyalitas (Rp/Poin)</label>
                <input 
                  type="number" 
                  name="conversion_rate_loyalitas" 
                  value={systemSettings.conversion_rate_loyalitas} 
                  onChange={handleSystemSettingsChange} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Poin Kadaluarsa (Bulan)</label>
                <input 
                  type="number" 
                  name="poin_kadaluarsa_bulan" 
                  value={systemSettings.poin_kadaluarsa_bulan} 
                  onChange={handleSystemSettingsChange} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  min="1"
                />
              </div>
              <div className="flex items-start gap-3">
                <input 
                  type="checkbox" 
                  name="loyalitas_aktif" 
                  checked={systemSettings.loyalitas_aktif} 
                  onChange={handleSystemSettingsChange} 
                  className="mt-1 rounded border-gray-300 text-amber-600 focus:ring-2 focus:ring-amber-500"
                />
                <label className="text-sm text-gray-700 leading-6">
                  <span className="font-medium">Aktifkan Sistem Loyalitas</span>
                  <p className="text-xs text-gray-600 mt-0.5">Aktifkan fitur point loyalitas untuk pelanggan</p>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* API & Sistem Configuration */}
        {canEditBranch && (
          <div className="py-6 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setShowSystemConfig(!showSystemConfig)}
              className="w-full flex items-center justify-between hover:bg-gray-50 transition-colors rounded text-left"
            >
              <div className="flex items-center gap-3">
                <svg className={`w-5 h-5 text-gray-600 transition-transform ${showSystemConfig ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
                <div className="flex items-center gap-2">
                  <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-semibold text-gray-900">Konfigurasi Sistem</span>
                </div>
              </div>
              <span className="text-sm text-gray-500">
                {showSystemConfig ? '— Sembunyikan' : '+ Tampilkan'}
              </span>
            </button>

            {showSystemConfig && (
              <div className="p-6 bg-gray-50 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="font-semibold text-gray-900 mb-1">Base URL API</p>
                    <p className="text-gray-600 text-xs font-mono break-all">{import.meta.env.VITE_API_BASE_URL || 'http://localhost:3400/api'}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="font-semibold text-gray-900 mb-1">API Key Status</p>
                    <p className="text-green-700 text-sm flex items-center gap-1"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> Terkonfigurasi</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="font-semibold text-gray-900 mb-1">Versi Aplikasi</p>
                    <p className="text-gray-600">1.0.0</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="font-semibold text-gray-900 mb-1">Mode Environment</p>
                    <p className="text-gray-600 inline-flex items-center gap-1">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                      {import.meta.env.MODE || 'production'}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="font-semibold text-gray-900 mb-1">Role Pengguna</p>
                    <p className="text-gray-600 capitalize font-medium">{user?.role || 'N/A'}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="font-semibold text-gray-900 mb-1">Cabang</p>
                    <p className="text-gray-600">{settings.cabang?.nama_cabang || user?.Cabang?.nama_cabang || 'N/A'}</p>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-2">
                  <p className="font-semibold">Informasi Konfigurasi:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800">
                    <li>Pastikan API server berjalan di URL yang terkonfigurasi</li>
                    <li>API Key disimpan aman dalam environment variables</li>
                    <li>Token JWT otomatis disimpan dalam localStorage setelah login</li>
                    <li>Untuk mengubah API URL, update file .env.local atau .env</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sync Status & Controls */}
        <div className="py-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sinkronisasi Data
          </h2>
          <div className="mb-4 p-3 rounded-lg border border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getConnectionStatus().icon}</span>
                <div>
                  <p className={`font-medium ${getConnectionStatus().statusColor}`}>
                    Status: {getConnectionStatus().statusText}
                  </p>
                  <p className="text-sm text-gray-600">
                    Terakhir sync: {getSyncInfo().lastSyncTime ? new Date(getSyncInfo().lastSyncTime).toLocaleString('id-ID') : 'Belum pernah'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {getSyncInfo().pendingCount > 0 && (
                  <p className="text-sm text-yellow-600">
                    {getSyncInfo().pendingCount} data menunggu sync
                  </p>
                )}
                {getSyncInfo().failedCount > 0 && (
                  <p className="text-sm text-red-600">
                    {getSyncInfo().failedCount} sync gagal
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Sync Messages */}
          {/* Removed unused sync message displays */}

          {/* Sync Information */}
          <div className="mt-4 text-sm text-gray-600 space-y-1">
            <p><strong>Mode Offline:</strong> Aplikasi dapat berjalan tanpa koneksi internet. Data disimpan di database lokal (SQLite).</p>
            <p><strong>Mode Online:</strong> Data otomatis tersinkronisasi dengan server pusat (MySQL).</p>
            <p><strong>Transaksi:</strong> Penjualan yang dibuat saat offline akan ditandai dan disinkronkan saat online.</p>
          </div>
        </div>

        {/* Informasi Aplikasi */}
        <div className="py-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Informasi Aplikasi
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div className="p-4 rounded border border-gray-200 bg-gray-50">
              <p className="font-medium text-gray-700 mb-1">User Login</p>
              <p className="text-gray-900 font-semibold">{user?.nama_lengkap || user?.username || 'N/A'}</p>
            </div>
            <div className="p-4 rounded border border-gray-200 bg-gray-50">
              <p className="font-medium text-gray-700 mb-1">Username</p>
              <p className="text-gray-900">{user?.username || 'N/A'}</p>
            </div>
            <div className="p-4 rounded border border-gray-200 bg-gray-50">
              <p className="font-medium text-gray-700 mb-1">Role Akses</p>
              <p className="text-gray-900 capitalize font-semibold">{user?.role || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* System Management */}
        {['admin', 'owner'].includes(user?.role) && (
          <div className="py-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Manajemen Sistem Lanjutan
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link
                to="/pengaturan/role"
                className="p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 12H9m4 5h4m-11 2a9 9 0 1118 0 9 9 0 01-18 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Management Role</h3>
                    <p className="text-xs text-gray-600">Kelola role dan permission</p>
                  </div>
                </div>
              </Link>
              <Link
                to="/pengaturan/menu"
                className="p-4 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Management Menu</h3>
                    <p className="text-xs text-gray-600">Kelola menu sistem</p>
                  </div>
                </div>
              </Link>
              <Link
                to="/pengaturan/database"
                className="p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7m0 0c0 2.21-3.582 4-8 4s-8-1.79-8-4m0 0V5c0 2.21 3.582 4 8 4s8-1.79 8-4v2zm0 9v3c0 2.21-3.582 4-8 4s-8-1.79-8-4v-3" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Database Offline</h3>
                    <p className="text-xs text-gray-600">Konfigurasi database lokal</p>
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(true);
                  setConfirmResetText('');
                  setResetError('');
                }}
                className="p-4 text-left rounded-lg border border-red-200 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex items-center gap-3"
              >
                <div className="p-2 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-lg">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-red-600 dark:text-red-400">Inisialisasi Database</h3>
                  <p className="text-xs text-gray-600 dark:text-zinc-400">Bersihkan data transaksi & master untuk setup awal</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Footer - Submit Button */}
        <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
          <button 
            type="submit" 
            disabled={saving} 
            className="inline-flex items-center justify-center rounded-lg px-6 py-2 bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:text-gray-200"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </form>
      </PageContainer>

  {/* Modal Printer Test */}
  {showPrinterTestModal && (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-40">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md text-center max-h-[90vh] overflow-y-auto">
            {/* Pratinjau Struk Test */}
            <div className="flex justify-center mb-6 bg-gray-50 p-4 rounded-lg max-h-[40vh] overflow-y-auto">
              <div className="bg-white p-4 font-mono text-xs text-black w-[300px]">
                {/* Header */}
                <div className="text-center">
                  <h2 className="font-bold text-sm">{storeInfo?.nama_cabang || 'Nama Toko'}</h2>
                  <p>{storeInfo?.alamat || 'Alamat Toko'}</p>
                  <p>{storeInfo?.no_telp || ''}</p>
                  {storeInfo?.struk_header && <p className="mt-2">{storeInfo.struk_header}</p>}
                </div>
                <div className="border-t border-dashed border-black my-2"></div>
                
                {/* Info */}
                <div className="flex justify-between">
                  <span>No: TEST-{new Date().getTime()}</span>
                  <span>{new Date().toLocaleDateString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kasir: TEST</span>
                  <span>{new Date().toLocaleTimeString('id-ID')}</span>
                </div>
                <div className="border-t border-dashed border-black my-2"></div>
                
                {/* Sample Item */}
                <div>
                  <div>
                    <p>Test Print Item</p>
                    <div className="flex justify-between">
                      <span>1 x Rp 50.000</span>
                      <span>Rp 50.000</span>
                    </div>
                  </div>
                </div>
                <div className="border-t border-dashed border-black my-2"></div>
                
                {/* Total */}
                <div className="space-y-1">
                  <div className="text-sm">
                    <span>Metode: Tunai</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>Rp 50.000</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bayar</span>
                    <span>Rp 50.000</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kembali</span>
                    <span>Rp 0</span>
                  </div>
                </div>
                <div className="border-t border-dashed border-black my-2"></div>
                
                {/* Footer */}
                <div className="text-center mt-2">
                  <p>{storeInfo?.struk_footer || 'Terima Kasih!'}</p>
                </div>
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleConfirmPrinterTest}
                disabled={printerTestLoading || !settings.printer?.nama}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {printerTestLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Sedang Cetak...
                  </>
                ) : (
                  <>
                    <Printer className="w-5 h-5" />
                    Cetak Struk
                  </>
                )}
              </button>

              <button
                onClick={() => setShowPrinterTestModal(false)}
                disabled={printerTestLoading}
                className="w-full text-gray-600 py-2 hover:bg-gray-100 rounded-lg transition-colors text-sm disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                Selesaikan Tanpa Cetak
              </button>

              {/* Keyboard Shortcuts Info */}
              <div className="text-xs text-gray-500 text-center mt-2">
                <span className="bg-gray-100 px-2 py-1 rounded mr-2">Enter</span> Cetak Struk
                <span className="bg-gray-100 px-2 py-1 rounded ml-4 mr-2">Esc</span> Selesaikan Tanpa Cetak
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Inisialisasi Database */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 dark:border-zinc-800">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-950/50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Inisialisasi Database</h2>
              <p className="text-sm text-gray-500 dark:text-zinc-400 mt-2">
                Tindakan ini akan menghapus permanen seluruh data berikut:
              </p>
            </div>

            <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-4 mb-6 border border-red-100 dark:border-red-900/30 text-xs text-red-800 dark:text-red-300 space-y-2">
              <p className="font-semibold">⚠️ PERINGATAN KERAS:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Seluruh Laporan & Jurnal Keuangan</li>
                <li>Seluruh Transaksi Penjualan & Pembelian</li>
                <li>Seluruh Data Produk & Kategori</li>
                <li>Seluruh Pelanggan & Supplier</li>
                <li>Catatan Riwayat Stok & Mutasi Barang</li>
              </ul>
              <p className="mt-2 font-medium">
                * Akun user, cabang, role, dan konfigurasi pembayaran tetap dipertahankan.
              </p>
            </div>

            <form onSubmit={handleResetDatabase} className="space-y-4">
              {resetError && (
                <div className="p-3 text-xs bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-lg text-center font-semibold">
                  {resetError}
                </div>
              )}
              
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                  Ketik <span className="font-mono bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-red-600 dark:text-red-400 font-bold">RESET_MY_DATABASE</span> untuk konfirmasi:
                </label>
                <input
                  type="text"
                  value={confirmResetText}
                  onChange={(e) => setConfirmResetText(e.target.value)}
                  placeholder="RESET_MY_DATABASE"
                  disabled={isResetting}
                  className="input w-full"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setConfirmResetText('');
                  }}
                  disabled={isResetting}
                  className="w-1/2 px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-sm font-semibold rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isResetting || confirmResetText !== 'RESET_MY_DATABASE'}
                  className="w-1/2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition disabled:bg-gray-300 dark:disabled:bg-zinc-800 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isResetting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Memproses...
                    </>
                  ) : (
                    'Ya, Reset Data'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default SettingsPage;