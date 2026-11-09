import React, { useEffect, useMemo, useState } from 'react';
import { getLogAktivitas } from '../services/api';
import DataTable from '../components/DataTable';
import { PageLayout, PageContainer, PageHeader, MetaLine } from '../components/layouts';
import DateRangeFilter from '../components/common/DateRangeFilter';
import { getPresetRange, isDateInRange, parseFlexibleDate, formatDateTimeID } from '../utils/dateRange';
import { describeRange } from '../utils/dateRange';


const normalizeLog = (item = {}, index) => {
  const aktivitas = item.aktivitas || item.aksi || item.action || item.activity || 'Tidak diketahui';
  const tanggal = item.tanggal || item.dilakukan_pada || item.created_at || item.createdAt || item.waktu || item.timestamp || item.date || item.date_time || item.datetime || '';
  const userName = item.user?.nama_lengkap || item.user?.nama || item.user?.username || item.User?.nama_lengkap || item.User?.nama || item.user_name || item.username || (typeof item.user === 'string' ? item.user : 'Pengguna tidak dikenal');
  return {
    ...(typeof item === 'object' ? item : {}),
    id_log: item.id_log || item.id || `log-${index}`,
    aktivitas,
    tanggal,
    userName
  };
};

const LogAktivitasPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Log bisa sangat banyak: bawaan 7 hari terakhir (pilih "Semua" untuk seluruhnya).
  const [range, setRange] = useState(() => getPresetRange('last7'));
  const logsInRange = useMemo(
    () => logs.filter((l) => isDateInRange(parseFlexibleDate(l.tanggal), range.start, range.end)),
    [logs, range]
  );

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await getLogAktivitas({ limit: 1500 });
        const data = response?.data?.data || [];
        setLogs(Array.isArray(data) ? data.map(normalizeLog) : []);
      } catch (err) {
        console.error('Error fetching log aktivitas:', err);
        setError(`Gagal memuat log aktivitas: ${err.message || 'Server tidak dapat dijangkau'}`);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const uniqueUsers = useMemo(() => [...new Set(logsInRange.map((log) => log.userName).filter(Boolean))], [logsInRange]);
  const uniqueActivities = useMemo(() => [...new Set(logsInRange.map((log) => log.aktivitas).filter(Boolean))].length, [logsInRange]);

  const filters = useMemo(() => [
    {
      key: 'userName',
      label: 'Pengguna',
      type: 'select',
      placeholder: 'Semua Pengguna',
      options: uniqueUsers.map((user) => ({ value: user, label: user }))
    }
  ], [uniqueUsers]);

  const columns = useMemo(() => [
    {
      key: 'id_log',
      header: 'ID Log',
      width: '120px',
      render: (log) => log.id_log || 'N/A'
    },
    {
      key: 'tanggal',
      header: 'Waktu',
      width: '180px',
      render: (log) => formatDateTimeID(log.tanggal)
    },
    {
      key: 'userName',
      header: 'Pengguna',
      render: (log) => log.userName || 'Tidak Diketahui'
    },
    {
      key: 'aktivitas',
      header: 'Aktivitas',
      render: (log) => log.aktivitas || 'Tidak diketahui'
    }
  ], []);

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Log Aktivitas"
          subtitle={<MetaLine parts={[describeRange(range.start, range.end), `${logsInRange.length.toLocaleString('id-ID')} aktivitas`]} />}
        />

        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Total Log</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{logsInRange.length.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Pengguna Unik</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{uniqueUsers.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Aktivitas Unik</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{uniqueActivities.toLocaleString()}</p>
            </div>
          </div>

          {loading && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
              Memuat log aktivitas...
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <DateRangeFilter compact className="mb-4" start={range.start} end={range.end} onChange={setRange} />
              <DataTable
                data={logsInRange}
                columns={columns}
                searchPlaceholder="Cari pengguna atau aktivitas..."
                searchKeys={['userName', 'aktivitas']}
                filters={filters}
                itemsPerPage={20}
                emptyMessage="Tidak ada log aktivitas yang cocok."
                loading={loading}
              />
            </div>
          )}

        </div>
      </PageContainer>
    </PageLayout>
  );
};

export default LogAktivitasPage;
