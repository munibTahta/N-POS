import React, { useState, useEffect } from 'react';
import { Download, BookOpen, TrendingUp, Wallet, FileText, Plus, Filter, X, Edit2, Trash2 } from 'lucide-react';
import HeaderActionButton from '../components/HeaderActionButton';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import SearchFilterBar from '../components/SearchFilterBar';
import {
  getGeneralLedgerReport,
  getCashFlowReport,
  getCashReport,
  getBalanceSheetReport,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  getJournalEntries,
  getBranches,
  getAccounts,
  getFinancialAccounts
} from '../services/api';
import { extractArray, extractData } from '../utils/apiResponseHelper';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import { exportToExcel } from '../utils/exportHelper';
import { toast } from 'react-toastify';

const FinancialReportsPage = () => {
  // Tab & Report State
  const [activeTab, setActiveTab] = useState('buku-besar');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // Search & Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedRekening, setSelectedRekening] = useState('');

  // Journal Entry List & Pagination
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

  // Master Data
  const [branches, setBranches] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [financialAccounts, setFinancialAccounts] = useState([]);

  // Journal Form State
  const [showJournalForm, setShowJournalForm] = useState(false);
  const [editingJournal, setEditingJournal] = useState(null);
  const [journalForm, setJournalForm] = useState(getInitialJournalForm());

  function getInitialJournalForm() {
    return {
      tanggal: new Date().toISOString().split('T')[0],
      keterangan: '',
      id_cabang: '',
      jenis_transaksi: 'lainnya',
      referensi_tabel: '',
      referensi_id: '',
      lines: [
        { id_akun: '', debit: 0, kredit: 0, keterangan: '' },
        { id_akun: '', debit: 0, kredit: 0, keterangan: '' }
      ]
    };
  }

  // Load master data on mount
  useEffect(() => {
    loadMasterData();
  }, []);

  // Load report or journal data when tab/filters change
  useEffect(() => {
    if (activeTab === 'jurnal') {
      loadJournalEntries();
    } else {
      loadReportData();
    }
  }, [activeTab, selectedBranch, startDate, endDate, selectedAccount, selectedRekening, currentPage, itemsPerPage]);

  const loadMasterData = async () => {
    try {
      const [branchesRes, accountsRes, financialAccountsRes] = await Promise.all([
        getBranches(),
        getAccounts(),
        getFinancialAccounts()
      ]);
      setBranches(extractArray(branchesRes));
      setAccounts(extractArray(accountsRes));
      setFinancialAccounts(extractArray(financialAccountsRes));
    } catch (err) {
      console.error('Failed to load master data:', err);
      toast.error('Gagal memuat data master');
    }
  };

  const loadJournalEntries = async () => {
    setJournalLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery || undefined,
        id_cabang: selectedBranch || undefined,
        tanggal_dari: startDate || undefined,
        tanggal_sampai: endDate || undefined,
      };
      const response = await getJournalEntries(params);
      const data = response?.data || response;
      setJournalEntries(extractArray(data?.rows || data || []));
      setTotalItems(data?.pagination?.total || data?.length || 0);
    } catch (err) {
      console.error('Failed to load journal entries:', err);
      toast.error('Gagal memuat data jurnal');
    } finally {
      setJournalLoading(false);
    }
  };

  const loadReportData = async () => {
    setLoading(true);
    setError('');

    try {
      const params = {
        id_cabang: selectedBranch || undefined,
        tanggal_dari: startDate || undefined,
        tanggal_sampai: endDate || undefined,
      };

      let response;
      switch (activeTab) {
        case 'buku-besar':
          params.id_akun = selectedAccount || undefined;
          response = await getGeneralLedgerReport(params);
          break;
        case 'arus-kas':
          params.id_rekening = selectedRekening || undefined;
          response = await getCashFlowReport(params);
          break;
        case 'kas':
          params.id_rekening = selectedRekening || undefined;
          response = await getCashReport(params);
          break;
        case 'neraca':
          response = await getBalanceSheetReport(params);
          break;
        default:
          return;
      }

      setData(extractData(response));
    } catch (err) {
      console.error('Failed to load report data:', err);
      setError('Gagal memuat data laporan');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenJournalForm = (journal = null) => {
    if (journal) {
      setEditingJournal(journal);
      setJournalForm({
        tanggal: journal.tanggal?.split('T')[0] || new Date().toISOString().split('T')[0],
        keterangan: journal.keterangan || '',
        id_cabang: journal.id_cabang || '',
        jenis_transaksi: journal.jenis_transaksi || 'lainnya',
        referensi_tabel: journal.referensi_tabel || '',
        referensi_id: journal.referensi_id || '',
        lines: journal.lines || [
          { id_akun: '', debit: 0, kredit: 0, keterangan: '' },
          { id_akun: '', debit: 0, kredit: 0, keterangan: '' }
        ]
      });
    } else {
      setEditingJournal(null);
      setJournalForm(getInitialJournalForm());
    }
    setShowJournalForm(true);
  };

  const handleCloseJournalForm = () => {
    setShowJournalForm(false);
    setEditingJournal(null);
    setJournalForm(getInitialJournalForm());
  };

  const handleCreateOrUpdateJournal = async () => {
    try {
      if (!journalForm.keterangan.trim()) {
        toast.error('Keterangan jurnal harus diisi');
        return;
      }

      if (journalForm.lines.length < 2) {
        toast.error('Minimal 2 baris jurnal');
        return;
      }

      const totalDebit = getTotalDebit();
      const totalKredit = getTotalKredit();

      if (totalDebit !== totalKredit) {
        toast.error(`Total debit (${formatCurrency(totalDebit)}) dan kredit (${formatCurrency(totalKredit)}) harus sama`);
        return;
      }

      const journalData = {
        ...journalForm,
        lines: journalForm.lines.map(line => ({
          ...line,
          debit: Number(line.debit || 0),
          kredit: Number(line.kredit || 0)
        }))
      };

      if (editingJournal) {
        await updateJournalEntry(editingJournal.id_jurnal, journalData);
        toast.success('Jurnal berhasil diperbarui');
      } else {
        await createJournalEntry(journalData);
        toast.success('Jurnal berhasil dibuat');
      }

      handleCloseJournalForm();
      setCurrentPage(1);
      loadJournalEntries();
    } catch (err) {
      console.error('Failed to create/update journal:', err);
      toast.error(editingJournal ? 'Gagal memperbarui jurnal' : 'Gagal membuat jurnal');
    }
  };

  const handleDeleteJournal = async (id) => {
    if (!window.confirm('Yakin ingin menghapus jurnal ini?')) return;

    try {
      await deleteJournalEntry(id);
      toast.success('Jurnal berhasil dihapus');
      setCurrentPage(1);
      loadJournalEntries();
    } catch (err) {
      console.error('Failed to delete journal:', err);
      toast.error('Gagal menghapus jurnal');
    }
  };

  const handleExport = () => {
    if (!data) return;

    try {
      let exportData = [];
      const fileName = `Laporan_${activeTab}_${new Date().toISOString().slice(0, 10)}.xlsx`;

      switch (activeTab) {
        case 'buku-besar':
          exportData = data.rows || [];
          break;
        case 'arus-kas':
          exportData = data.items || [];
          break;
        case 'kas':
          exportData = data.rekening || [];
          break;
        case 'neraca':
          exportData = data.neraca?.flatMap(category =>
            category.accounts?.map(account => ({
              tipe_akun: category.tipe_akun,
              kode_akun: account.akun?.kode_akun,
              nama_akun: account.akun?.nama_akun,
              total_debit: account.total_debit,
              total_kredit: account.total_kredit,
              balance: account.balance
            })) || []
          ) || [];
          break;
      }

      exportToExcel(exportData, fileName);
      toast.success('Data berhasil diekspor');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Gagal mengekspor data');
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedBranch('');
    setStartDate('');
    setEndDate('');
    setSelectedAccount('');
    setSelectedRekening('');
    setCurrentPage(1);
    setShowFilters(false);
  };

  // Helper functions
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const getTotalDebit = () => journalForm.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const getTotalKredit = () => journalForm.lines.reduce((sum, line) => sum + Number(line.kredit || 0), 0);
  const isBalanced = getTotalDebit() === getTotalKredit();

  const addJournalLine = () => {
    setJournalForm(prev => ({
      ...prev,
      lines: [...prev.lines, { id_akun: '', debit: 0, kredit: 0, keterangan: '' }]
    }));
  };

  const updateJournalLine = (index, field, value) => {
    setJournalForm(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      )
    }));
  };

  const removeJournalLine = (index) => {
    if (journalForm.lines.length > 2) {
      setJournalForm(prev => ({
        ...prev,
        lines: prev.lines.filter((_, i) => i !== index)
      }));
    }
  };

  // Computed values
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const hasActiveFilters = searchQuery || selectedBranch || startDate || endDate || selectedAccount || selectedRekening;
  
  const tabs = [
    { id: 'buku-besar', label: 'Buku Besar', icon: BookOpen },
    { id: 'arus-kas', label: 'Arus Kas', icon: TrendingUp },
    { id: 'kas', label: 'Kas', icon: Wallet },
    { id: 'neraca', label: 'Neraca', icon: FileText },
    { id: 'jurnal', label: 'Jurnal', icon: FileText }
  ];

  // Render functions
  const renderSummaryCards = () => {
    if (!data?.summary) return null;

    const cards = [];
    switch (activeTab) {
      case 'buku-besar':
        cards.push(
          { label: 'Saldo Awal', value: formatCurrency(data.summary.opening_balance) },
          { label: 'Total Debit', value: formatCurrency(data.summary.total_debit) },
          { label: 'Total Kredit', value: formatCurrency(data.summary.total_kredit) },
          { label: 'Saldo Akhir', value: formatCurrency(data.summary.ending_balance) }
        );
        break;
      case 'arus-kas':
        cards.push(
          { label: 'Total Masuk', value: formatCurrency(data.summary.total_masuk) },
          { label: 'Total Keluar', value: formatCurrency(data.summary.total_keluar) },
          { label: 'Saldo Bersih', value: formatCurrency(data.summary.saldo_bersih) },
          { label: 'Transaksi', value: data.summary.transaksi }
        );
        break;
      case 'kas':
        cards.push(
          { label: 'Total Rekening', value: data.summary.total_rekening },
          { label: 'Total Saldo', value: formatCurrency(data.summary.total_saldo_akhir) }
        );
        break;
      case 'neraca':
        cards.push(
          { label: 'Total Kategori', value: data.summary.total_kategori },
          { label: 'Total Saldo', value: formatCurrency(data.summary.total_saldo) }
        );
        break;
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {cards.map((card, index) => (
          <div key={index} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition">
            <div className="text-sm text-gray-600 font-medium">{card.label}</div>
            <div className="text-xl md:text-2xl font-bold text-blue-600 mt-2">{card.value}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderReportTable = () => {
    if (!data) return null;

    switch (activeTab) {
      case 'buku-besar':
        return (
          <DataTable
            data={data.rows || []}
            columns={[
              { key: 'tanggal', header: 'Tanggal', render: (row) => new Date(row.tanggal).toLocaleDateString('id-ID') },
              { key: 'akun', header: 'Akun', render: (row) => `${row.akun?.kode_akun} - ${row.akun?.nama_akun}` },
              { key: 'cabang', header: 'Cabang', render: (row) => row.cabang?.nama_cabang || '-' },
              { key: 'keterangan', header: 'Keterangan' },
              { key: 'debit', header: 'Debit', render: (row) => formatCurrency(row.debit) },
              { key: 'kredit', header: 'Kredit', render: (row) => formatCurrency(row.kredit) },
              { key: 'saldo_berjalan', header: 'Saldo Berjalan', render: (row) => formatCurrency(row.saldo_berjalan) }
            ]}
            searchKeys={['keterangan', 'akun.nama_akun']}
          />
        );

      case 'arus-kas':
        return (
          <DataTable
            data={data.items || []}
            columns={[
              { key: 'tanggal', header: 'Tanggal', render: (row) => new Date(row.tanggal).toLocaleDateString('id-ID') },
              { key: 'kategori', header: 'Kategori' },
              { key: 'keterangan', header: 'Keterangan' },
              { key: 'jumlah', header: 'Jumlah', render: (row) => formatCurrency(row.jumlah) },
              {
                key: 'tipe',
                header: 'Tipe',
                render: (row) => (
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    row.tipe === 'masuk' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {row.tipe === 'masuk' ? 'Masuk' : 'Keluar'}
                  </span>
                )
              }
            ]}
            searchKeys={['keterangan', 'kategori']}
          />
        );

      case 'kas':
        return (
          <DataTable
            data={data.rekening || []}
            columns={[
              { key: 'nama_rekening', header: 'Nama Rekening' },
              { key: 'tipe_rekening', header: 'Tipe' },
              { key: 'saldo_awal', header: 'Saldo Awal', render: (row) => formatCurrency(row.saldo_awal) },
              { key: 'saldo_akhir', header: 'Saldo Akhir', render: (row) => formatCurrency(row.saldo_akhir) },
              { key: 'id_cabang', header: 'Cabang', render: (row) => row.id_cabang ? 'Cabang' : 'Pusat' }
            ]}
            searchKeys={['nama_rekening']}
          />
        );

      case 'neraca':
        return (
          <div className="space-y-6">
            {data.neraca?.map((category, index) => (
              <div key={index} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 capitalize text-gray-900">{category.tipe_akun}</h3>
                <DataTable
                  data={category.accounts || []}
                  columns={[
                    { key: 'akun', header: 'Akun', render: (row) => `${row.akun?.kode_akun} - ${row.akun?.nama_akun}` },
                    { key: 'total_debit', header: 'Total Debit', render: (row) => formatCurrency(row.total_debit) },
                    { key: 'total_kredit', header: 'Total Kredit', render: (row) => formatCurrency(row.total_kredit) },
                    { key: 'balance', header: 'Balance', render: (row) => formatCurrency(row.balance) }
                  ]}
                  searchKeys={['akun.nama_akun']}
                />
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between font-semibold text-gray-900">
                    <span>Total {category.tipe_akun}:</span>
                    <span className="text-blue-600">{formatCurrency(category.total_balance)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  const renderJournalTable = () => {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Tanggal</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Keterangan</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Cabang</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Debit</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Kredit</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {journalEntries.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-6 text-center text-gray-500">
                    {journalLoading ? 'Memuat data...' : 'Tidak ada data jurnal'}
                  </td>
                </tr>
              ) : (
                journalEntries.map((journal) => (
                  <tr key={journal.id_jurnal} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-sm">{new Date(journal.tanggal).toLocaleDateString('id-ID')}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{journal.keterangan}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{journal.cabang?.nama_cabang || '-'}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(journal.total_debit)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(journal.total_kredit)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleOpenJournalForm(journal)}
                          className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-600 transition"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteJournal(journal.id_jurnal)}
                          className="p-1.5 hover:bg-red-100 rounded-lg text-red-600 transition"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderJournalForm = () => {
    if (!showJournalForm) return null;

    const totalDebit = getTotalDebit();
    const totalKredit = getTotalKredit();

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
            <h3 className="text-2xl font-bold text-gray-900">
              {editingJournal ? '✏️ Edit Jurnal' : '➕ Buat Jurnal Baru'}
            </h3>
            <button
              onClick={handleCloseJournalForm}
              className="p-2 hover:bg-gray-100 rounded-full transition"
            >
              <X size={24} className="text-gray-600" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal</label>
                <input
                  type="date"
                  value={journalForm.tanggal}
                  onChange={(e) => setJournalForm(prev => ({ ...prev, tanggal: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Cabang</label>
                <select
                  value={journalForm.id_cabang}
                  onChange={(e) => setJournalForm(prev => ({ ...prev, id_cabang: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Pilih Cabang</option>
                  {branches.map(branch => (
                    <option key={branch.id_cabang} value={branch.id_cabang}>
                      {branch.nama_cabang}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Jenis Transaksi</label>
                <select
                  value={journalForm.jenis_transaksi}
                  onChange={(e) => setJournalForm(prev => ({ ...prev, jenis_transaksi: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="penjualan">Penjualan</option>
                  <option value="pembelian">Pembelian</option>
                  <option value="biaya">Biaya</option>
                  <option value="transfer">Transfer</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Keterangan</label>
              <textarea
                value={journalForm.keterangan}
                onChange={(e) => setJournalForm(prev => ({ ...prev, keterangan: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Masukkan keterangan jurnal..."
              />
            </div>

            {/* Journal Lines */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-gray-900">Detail Jurnal</h4>
                <button
                  onClick={addJournalLine}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                >
                  <Plus size={16} /> Tambah Baris
                </button>
              </div>

              <div className="overflow-x-auto border border-gray-300 rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-300">
                      <th className="px-4 py-3 text-left text-sm font-semibold">Akun</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Debit</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Kredit</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Keterangan</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalForm.lines.map((line, index) => (
                      <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <select
                            value={line.id_akun}
                            onChange={(e) => updateJournalLine(index, 'id_akun', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="">Pilih Akun</option>
                            {accounts.map(account => (
                              <option key={account.id_akun} value={account.id_akun}>
                                {account.kode_akun} - {account.nama_akun}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={line.debit}
                            onChange={(e) => updateJournalLine(index, 'debit', Number(e.target.value))}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right"
                            min="0"
                            step="1"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={line.kredit}
                            onChange={(e) => updateJournalLine(index, 'kredit', Number(e.target.value))}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right"
                            min="0"
                            step="1"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={line.keterangan}
                            onChange={(e) => updateJournalLine(index, 'keterangan', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="Keterangan..."
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {journalForm.lines.length > 2 && (
                            <button
                              onClick={() => removeJournalLine(index)}
                              className="p-1 hover:bg-red-100 rounded transition text-red-600"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-300 font-semibold">
                      <td className="px-4 py-3 text-right">Total:</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(totalDebit)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(totalKredit)}</td>
                      <td colSpan="2" className="px-4 py-3">
                        {isBalanced ? (
                          <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                            ✓ Seimbang
                          </span>
                        ) : (
                          <span className="inline-block px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                            ✗ Tidak Seimbang ({formatCurrency(Math.abs(totalDebit - totalKredit))})
                          </span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
              <button
                onClick={handleCloseJournalForm}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
              >
                Batal
              </button>
              <button
                onClick={handleCreateOrUpdateJournal}
                disabled={!isBalanced}
                className={`px-4 py-2 rounded-lg text-white font-medium transition ${
                  isBalanced
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {editingJournal ? 'Perbarui Jurnal' : 'Simpan Jurnal'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Main Render
  return (
    <PageLayout>
      <PageContainer>
        {/* Header */}
        <PageHeader title="📊 Laporan Keuangan">
          <div className="flex flex-wrap gap-2">
            {activeTab !== 'jurnal' && (
              <HeaderActionButton
                icon={Download}
                label="Export Excel"
                onClick={handleExport}
                disabled={!data}
              />
            )}
            {activeTab === 'jurnal' && (
              <HeaderActionButton
                icon={Plus}
                label="Buat Jurnal"
                onClick={() => handleOpenJournalForm()}
              />
            )}
          </div>
        </PageHeader>

        {/* Tab Navigation */}
        <div className="bg-white p-4 rounded-xl shadow-sm mb-6 border border-gray-200">
          <div className="flex flex-wrap gap-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search & Filter Bar - Only for Reports */}
        {activeTab !== 'jurnal' && (
          <>
            <SearchFilterBar
              searchTerm={searchQuery}
              onSearchChange={setSearchQuery}
              onClearSearch={() => setSearchQuery('')}
              onFilterToggle={() => setShowFilters(prev => !prev)}
              isFilterActive={showFilters}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={handleClearFilters}
              searchPlaceholder="Cari berdasarkan keterangan, akun, cabang..."
            />

            {/* Filter Panel */}
            {showFilters && (
              <div className="bg-white p-4 rounded-xl shadow-sm mb-6 border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Cabang</label>
                    <select
                      value={selectedBranch}
                      onChange={(e) => {
                        setSelectedBranch(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Semua Cabang</option>
                      {branches.map(branch => (
                        <option key={branch.id_cabang} value={branch.id_cabang}>
                          {branch.nama_cabang}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal Dari</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal Sampai</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {(activeTab === 'buku-besar' || activeTab === 'arus-kas' || activeTab === 'kas') && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {activeTab === 'buku-besar' ? 'Akun' : 'Rekening'}
                      </label>
                      <select
                        value={activeTab === 'buku-besar' ? selectedAccount : selectedRekening}
                        onChange={(e) => {
                          if (activeTab === 'buku-besar') {
                            setSelectedAccount(e.target.value);
                          } else {
                            setSelectedRekening(e.target.value);
                          }
                          setCurrentPage(1);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">
                          {activeTab === 'buku-besar' ? 'Semua Akun' : 'Semua Rekening'}
                        </option>
                        {(activeTab === 'buku-besar' ? accounts : financialAccounts).map(item => (
                          <option
                            key={activeTab === 'buku-besar' ? item.id_akun : item.id_rekening}
                            value={activeTab === 'buku-besar' ? item.id_akun : item.id_rekening}
                          >
                            {activeTab === 'buku-besar'
                              ? `${item.kode_akun} - ${item.nama_akun}`
                              : item.nama_rekening
                            }
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Search & Filter Bar for Jurnal Tab */}
        {activeTab === 'jurnal' && (
          <>
            <SearchFilterBar
              searchTerm={searchQuery}
              onSearchChange={setSearchQuery}
              onClearSearch={() => setSearchQuery('')}
              onFilterToggle={() => setShowFilters(prev => !prev)}
              isFilterActive={showFilters}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={handleClearFilters}
              searchPlaceholder="Cari jurnal berdasarkan tanggal, keterangan, cabang..."
            />

            {showFilters && (
              <div className="bg-white p-4 rounded-xl shadow-sm mb-6 border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Cabang</label>
                    <select
                      value={selectedBranch}
                      onChange={(e) => {
                        setSelectedBranch(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Semua Cabang</option>
                      {branches.map(branch => (
                        <option key={branch.id_cabang} value={branch.id_cabang}>
                          {branch.nama_cabang}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal Dari</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal Sampai</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Loading State */}
        {(loading || journalLoading) && (
          <div className="bg-white p-8 rounded-xl shadow-sm text-center border border-gray-200">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Memuat data{activeTab === 'jurnal' ? ' jurnal' : ' laporan'}...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 p-4 rounded-xl shadow-sm border border-red-200">
            <p className="text-red-700 font-medium">⚠️ {error}</p>
          </div>
        )}

        {/* Summary Cards */}
        {!loading && !error && activeTab !== 'jurnal' && data && renderSummaryCards()}

        {/* Report Table */}
        {!loading && !error && activeTab !== 'jurnal' && data && renderReportTable()}

        {/* Journal Table with Pagination */}
        {!journalLoading && activeTab === 'jurnal' && (
          <>
            {renderJournalTable()}

            {/* Pagination */}
            {journalEntries.length > 0 && (
              <div className="mt-6">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  itemsPerPage={itemsPerPage}
                  onItemsPerPageChange={setItemsPerPage}
                  totalItems={totalItems}
                />
              </div>
            )}
          </>
        )}

        {/* Journal Form Modal */}
        {renderJournalForm()}
      </PageContainer>
    </PageLayout>
  );
};

export default FinancialReportsPage;
