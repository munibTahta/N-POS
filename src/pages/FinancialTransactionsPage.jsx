import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit, Trash2, Download } from 'lucide-react';
import HeaderActionButton from '../components/HeaderActionButton';
import DataTable from '../components/DataTable';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import {
  getJournalEntries,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  getBranches,
  getAccounts,
  getFinancialAccounts
} from '../services/api';
import { extractArray } from '../utils/apiResponseHelper';
import { exportToExcel } from '../utils/exportHelper';
import { toast } from 'react-toastify';

const INITIAL_LINE = { id_akun: '', debit: 0, kredit: 0, keterangan: '' };

const getInitialTransactionForm = () => ({
  tanggal: new Date().toISOString().split('T')[0],
  id_cabang: '',
  jenis_transaksi: 'lainnya',
  keterangan: '',
  referensi_tabel: '',
  referensi_id: '',
  lines: [
    { ...INITIAL_LINE },
    { ...INITIAL_LINE }
  ]
});

const FinancialTransactionsPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [branches, setBranches] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [financialAccounts, setFinancialAccounts] = useState([]);
  const [formState, setFormState] = useState(getInitialTransactionForm());

  useEffect(() => {
    loadMasterData();
    loadTransactions();
  }, []);

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
      toast.error('Gagal memuat data master keuangan.');
    }
  };

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const response = await getJournalEntries({ limit: 1000 });
      const payload = response?.data || response;
      const rows = extractArray(payload?.rows || payload || []);
      setTransactions(rows);
    } catch (err) {
      console.error('Failed to load financial transactions:', err);
      toast.error('Gagal memuat transaksi keuangan.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  const getTotalDebit = () => {
    return formState.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  };

  const getTotalKredit = () => {
    return formState.lines.reduce((sum, line) => sum + Number(line.kredit || 0), 0);
  };

  const isBalanced = useMemo(() => getTotalDebit() === getTotalKredit(), [formState.lines]);

  const resetForm = () => {
    setFormState(getInitialTransactionForm());
    setEditingTransaction(null);
  };

  const handleOpenForm = (transaction = null) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setFormState({
        tanggal: transaction.tanggal ? transaction.tanggal.split('T')[0] : new Date().toISOString().split('T')[0],
        id_cabang: transaction.id_cabang || '',
        jenis_transaksi: transaction.jenis_transaksi || 'lainnya',
        keterangan: transaction.keterangan || '',
        referensi_tabel: transaction.referensi_tabel || '',
        referensi_id: transaction.referensi_id || '',
        lines: (transaction.lines || []).map((line) => ({
          id_akun: line.id_akun || '',
          debit: Number(line.debit || 0),
          kredit: Number(line.kredit || 0),
          keterangan: line.keterangan || ''
        }))
      });
    } else {
      resetForm();
      setShowForm(true);
      return;
    }

    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    resetForm();
  };

  const addLine = () => {
    setFormState((prev) => ({
      ...prev,
      lines: [...prev.lines, { ...INITIAL_LINE }]
    }));
  };

  const updateLine = (index, field, value) => {
    setFormState((prev) => ({
      ...prev,
      lines: prev.lines.map((line, idx) => idx === index ? { ...line, [field]: field === 'id_akun' ? value : Number(value) } : line)
    }));
  };

  const removeLine = (index) => {
    setFormState((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, idx) => idx !== index)
    }));
  };

  const validateForm = () => {
    if (!formState.keterangan.trim()) {
      toast.error('Keterangan transaksi harus diisi.');
      return false;
    }

    if (!formState.id_cabang) {
      toast.error('Cabang harus dipilih.');
      return false;
    }

    if (formState.lines.length < 2) {
      toast.error('Minimal dua baris jurnal diperlukan.');
      return false;
    }

    const hasEmptyAccount = formState.lines.some((line) => !line.id_akun);
    if (hasEmptyAccount) {
      toast.error('Semua baris jurnal harus memilih akun.');
      return false;
    }

    const hasEmptyAmount = formState.lines.some((line) => Number(line.debit || 0) === 0 && Number(line.kredit || 0) === 0);
    if (hasEmptyAmount) {
      toast.error('Semua baris jurnal harus memiliki debit atau kredit.');
      return false;
    }

    if (!isBalanced) {
      toast.error('Transaksi harus seimbang antara debit dan kredit.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) return;

    const payload = {
      tanggal: formState.tanggal,
      id_cabang: formState.id_cabang,
      jenis_transaksi: formState.jenis_transaksi,
      keterangan: formState.keterangan,
      referensi_tabel: formState.referensi_tabel,
      referensi_id: formState.referensi_id,
      lines: formState.lines.map((line) => ({
        id_akun: line.id_akun,
        debit: Number(line.debit || 0),
        kredit: Number(line.kredit || 0),
        keterangan: line.keterangan || ''
      }))
    };

    try {
      if (editingTransaction) {
        await updateJournalEntry(editingTransaction.id_jurnal, payload);
        toast.success('Transaksi berhasil diperbarui.');
      } else {
        await createJournalEntry(payload);
        toast.success('Transaksi berhasil dibuat.');
      }
      handleCloseForm();
      await loadTransactions();
      window.dispatchEvent(new Event('financial-transactions-updated'));
    } catch (err) {
      console.error('Failed to save transaction:', err);
      toast.error(editingTransaction ? 'Gagal memperbarui transaksi.' : 'Gagal membuat transaksi.');
    }
  };

  const handleDelete = async (transaction) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus transaksi pada tanggal ${new Date(transaction.tanggal).toLocaleDateString('id-ID')}?`)) {
      return;
    }

    try {
      await deleteJournalEntry(transaction.id_jurnal);
      toast.success('Transaksi berhasil dihapus.');
      await loadTransactions();
      window.dispatchEvent(new Event('financial-transactions-updated'));
    } catch (err) {
      console.error('Failed to delete transaction:', err);
      toast.error('Gagal menghapus transaksi.');
    }
  };

  const exportTransactions = () => {
    const rows = transactions.map((row) => ({
      Tanggal: new Date(row.tanggal).toLocaleDateString('id-ID'),
      Cabang: row.cabang?.nama_cabang || '-',
      Jenis: row.jenis_transaksi || '-',
      Keterangan: row.keterangan || '-',
      Debit: formatCurrency(row.total_debit),
      Kredit: formatCurrency(row.total_kredit)
    }));
    exportToExcel(rows, `Transaksi_Keuangan_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const transactionColumns = [
    { key: 'tanggal', header: 'Tanggal', render: (row) => new Date(row.tanggal).toLocaleDateString('id-ID'), width: '140px' },
    { key: 'cabang.nama_cabang', header: 'Cabang', render: (row) => row.cabang?.nama_cabang || '-' },
    { key: 'jenis_transaksi', header: 'Jenis Transaksi', render: (row) => row.jenis_transaksi || '-' },
    { key: 'keterangan', header: 'Keterangan', render: (row) => row.keterangan || '-' },
    { key: 'total_debit', header: 'Debit', render: (row) => formatCurrency(row.total_debit), headerClassName: 'text-right', className: 'text-right' },
    { key: 'total_kredit', header: 'Kredit', render: (row) => formatCurrency(row.total_kredit), headerClassName: 'text-right', className: 'text-right' },
    {
      key: 'actions',
      header: 'Aksi',
      render: (row) => (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => handleOpenForm(row)}
            className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
            title="Edit"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => handleDelete(row)}
            className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
            title="Hapus"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
      className: 'text-center'
    }
  ];

  const transactionsSummary = useMemo(() => {
    const totalDebit = transactions.reduce((sum, row) => sum + Number(row.total_debit || 0), 0);
    const totalKredit = transactions.reduce((sum, row) => sum + Number(row.total_kredit || 0), 0);
    return { totalDebit, totalKredit };
  }, [transactions]);

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Transaksi Keuangan"
          subtitle="Kelola jurnal dan transaksi keuangan yang terintegrasi dengan laporan keuangan"
          actions={(
            <>
              <HeaderActionButton
                icon={Download}
                label="Export"
                onClick={exportTransactions}
                variant="secondary"
              />
              <HeaderActionButton
                icon={Plus}
                label="Tambah Transaksi"
                onClick={() => handleOpenForm(null)}
                variant="primary"
              />
            </>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="text-sm font-semibold text-gray-600">Total Transaksi</div>
            <div className="text-3xl font-bold text-blue-600 mt-2">{transactions.length}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="text-sm font-semibold text-gray-600">Total Debit</div>
            <div className="text-3xl font-bold text-green-600 mt-2">{formatCurrency(transactionsSummary.totalDebit)}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="text-sm font-semibold text-gray-600">Total Kredit</div>
            <div className="text-3xl font-bold text-red-600 mt-2">{formatCurrency(transactionsSummary.totalKredit)}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm">
          <DataTable
            data={transactions}
            columns={transactionColumns}
            searchKeys={[ 'keterangan', 'cabang.nama_cabang', 'jenis_transaksi' ]}
            filters={[
              {
                key: 'id_cabang',
                label: 'Cabang',
                type: 'select',
                options: [
                  { value: '', label: 'Semua Cabang' },
                  ...branches.map((branch) => ({ value: String(branch.id_cabang), label: branch.nama_cabang }))
                ]
              },
              {
                key: 'jenis_transaksi',
                label: 'Jenis Transaksi',
                type: 'select',
                options: [
                  { value: '', label: 'Semua Jenis' },
                  { value: 'penjualan', label: 'Penjualan' },
                  { value: 'pembelian', label: 'Pembelian' },
                  { value: 'biaya', label: 'Biaya' },
                  { value: 'transfer', label: 'Transfer' },
                  { value: 'lainnya', label: 'Lainnya' }
                ]
              }
            ]}
            searchPlaceholder="Cari transaksi, cabang, atau keterangan..."
            itemsPerPage={15}
            loading={loading}
            emptyMessage="Tidak ada transaksi ditemukan"
          />
        </div>

        {showForm && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-xl w-full max-w-4xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{editingTransaction ? 'Edit Transaksi' : 'Tambah Transaksi'}</h2>
                  <p className="text-sm text-gray-500">Lengkapi informasi transaksi dan detail jurnal untuk integrasi laporan.</p>
                </div>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={handleCloseForm}
                  aria-label="Tutup"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal</label>
                    <input
                      type="date"
                      value={formState.tanggal}
                      onChange={(e) => setFormState((prev) => ({ ...prev, tanggal: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Cabang</label>
                    <select
                      value={formState.id_cabang}
                      onChange={(e) => setFormState((prev) => ({ ...prev, id_cabang: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    >
                      <option value="">Pilih Cabang</option>
                      {branches.map((branch) => (
                        <option key={branch.id_cabang} value={branch.id_cabang}>
                          {branch.nama_cabang}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Jenis Transaksi</label>
                    <select
                      value={formState.jenis_transaksi}
                      onChange={(e) => setFormState((prev) => ({ ...prev, jenis_transaksi: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
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
                    value={formState.keterangan}
                    onChange={(e) => setFormState((prev) => ({ ...prev, keterangan: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Contoh: Penyesuaian kas toko bulan Mei"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Referensi Tabel</label>
                    <input
                      type="text"
                      value={formState.referensi_tabel}
                      onChange={(e) => setFormState((prev) => ({ ...prev, referensi_tabel: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Opsional: sales, pembelian, pembayaran"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Referensi ID</label>
                    <input
                      type="text"
                      value={formState.referensi_id}
                      onChange={(e) => setFormState((prev) => ({ ...prev, referensi_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Opsional: 12345"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Detail Jurnal</h3>
                    <button
                      type="button"
                      onClick={addLine}
                      className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700"
                    >
                      Tambah Baris
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Akun</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Debit</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Kredit</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Keterangan</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {formState.lines.map((line, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2">
                              <select
                                value={line.id_akun}
                                onChange={(e) => updateLine(index, 'id_akun', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                required
                              >
                                <option value="">Pilih Akun</option>
                                {accounts.map((account) => (
                                  <option key={account.id_akun} value={account.id_akun}>
                                    {account.kode_akun} - {account.nama_akun}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={line.debit}
                                onChange={(e) => updateLine(index, 'debit', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                min="0"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={line.kredit}
                                onChange={(e) => updateLine(index, 'kredit', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                min="0"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={line.keterangan}
                                onChange={(e) => updateLine(index, 'keterangan', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                placeholder="Keterangan baris"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              {formState.lines.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => removeLine(index)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  Hapus
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan="1" className="px-3 py-3 text-right font-semibold text-gray-700">Total</td>
                          <td className="px-3 py-3 text-right font-semibold text-green-700">{formatCurrency(getTotalDebit())}</td>
                          <td className="px-3 py-3 text-right font-semibold text-red-700">{formatCurrency(getTotalKredit())}</td>
                          <td colSpan="2" className="px-3 py-3 text-sm text-gray-600">
                            {isBalanced ? 'Seimbang' : 'Tidak seimbang'}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="text-sm text-gray-600">
                    Pastikan total debit dan kredit seimbang sebelum menyimpan.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleCloseForm}
                      className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={!isBalanced}
                      className={`px-4 py-2 rounded-lg text-white ${isBalanced ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
                    >
                      {editingTransaction ? 'Perbarui Transaksi' : 'Simpan Transaksi'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </PageContainer>
    </PageLayout>
  );
};

export default FinancialTransactionsPage;
