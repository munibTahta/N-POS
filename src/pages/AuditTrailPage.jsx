import React, { useState, useEffect, useCallback } from 'react';
import { getAuditTrail } from '../services/api';
import { withErrorBoundary } from '../components/withErrorBoundary';
import DataTable from '../components/DataTable';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';

// Safe date formatter to handle invalid dates
const formatAuditDate = (dateString) => {
  if (!dateString) return 'Tanggal tidak tersedia';
  
  try {
    // Handle various date formats
    let date;
    
    // If it's a string that looks like a timestamp
    if (typeof dateString === 'string') {
      // Try parsing ISO format first
      date = new Date(dateString);
      
      // If invalid, try other formats
      if (isNaN(date.getTime())) {
        // Try timestamp format (milliseconds or seconds)
        const timestamp = parseInt(dateString, 10);
        if (!isNaN(timestamp)) {
          date = new Date(timestamp > 9999999999 ? timestamp : timestamp * 1000);
        }
      }
    } else if (typeof dateString === 'number') {
      date = new Date(dateString > 9999999999 ? dateString : dateString * 1000);
    } else {
      date = new Date(dateString);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Tanggal tidak valid';
    }
    
    return date.toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (err) {
    console.error('Date formatting error:', err, dateString);
    return 'Tanggal tidak valid';
  }
};

const AuditTrailPage = ({ pageTitle = 'Audit Trail' }) => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch audit trail
  const fetchAuditTrail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        limit: 1000, // Load all data for client-side filtering
      };
      const response = await getAuditTrail(params);
      const data = response.data.data || [];
      const normalizedLogs = (Array.isArray(data) ? data : []).map((item, index) => {
        const aktivitas = item.aktivitas || item.aksi || item.action || item.activity || item.activity_type || item.action_type || item.aktivitas_name || item.activity_name || item.code || '';
        const tanggal = item.tanggal || item.dilakukan_pada || item.created_at || item.createdAt || item.waktu || item.timestamp || item.date || item.date_time || item.datetime || '';
        const userName = item.user?.nama_lengkap || item.user?.nama || item.user?.username || item.User?.nama_lengkap || item.User?.nama || item.user_name || item.username || (typeof item.user === 'string' ? item.user : 'Unknown User');
        const resource = item.nama_tabel || item.table_name || item.table || item.tabel || item.model_name || item.entity || '';
        const id_audit = item.id_log || item.id_audit || item.audit_id || item.id || `audit-${index}`;

        return {
          ...item,
          id_audit,
          aktivitas,
          tanggal,
          userName,
          resource,
          data_sebelum: item.data_sebelum || item.before || item.dataBefore || item.previous || null,
          data_sesudah: item.data_sesudah || item.after || item.dataAfter || item.current || null,
        };
      });
      setAuditLogs(normalizedLogs);
    } catch (err) {
      setError(`Gagal memuat audit trail: ${err.message}`);
      console.error('Error fetching audit trail:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditTrail();
  }, [fetchAuditTrail]);

  const tables = [...new Set(auditLogs.map(log => log.resource).filter(Boolean))];
  const actions = [...new Set(auditLogs.map(log => log.aktivitas).filter(Boolean))];

  // DataTable columns configuration
  const columns = [
    {
      key: 'id_audit',
      header: 'ID Log',
      render: (log) => log.id_audit || 'N/A',
    },
    {
      key: 'aktivitas',
      header: 'Aktivitas',
      render: (log) => log.aktivitas || 'Tidak diketahui',
    },
    {
      key: 'resource',
      header: 'Tabel / Resource',
      render: (log) => log.resource || 'Tidak tersedia',
    },
    {
      key: 'userName',
      header: 'User',
      render: (log) => `${log.userName || 'Unknown User'}`,
    },
    {
      key: 'tanggal',
      header: 'Waktu',
      render: (log) => `${formatAuditDate(log.tanggal)}`,
    },
  ];

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title={pageTitle}
          description="Pantau semua aktivitas sistem dan perubahan data yang tercatat."
        />

        <div className="space-y-6">
          {/* Status Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">Total Log</p>
              <p className="text-2xl font-bold text-gray-900">{auditLogs.length.toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">Tabel Terpengaruh</p>
              <p className="text-2xl font-bold text-blue-600">{tables.length}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">Total Tabel</p>
              <p className="text-2xl font-bold text-green-600">{tables.length}</p>
            </div>
          </div>

          {/* Search & Filter Section */}
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="p-6">
              {/* DataTable with built-in search and filters */}
              <DataTable
                data={auditLogs}
                columns={columns}
                searchKeys={['aktivitas', 'resource', 'userName', 'id_audit']}
                filters={[
                  {
                    key: 'resource',
                    label: 'Tabel',
                    type: 'select',
                    options: tables.map(table => ({ label: table, value: table })),
                    defaultValue: ''
                  },
                  {
                    key: 'aktivitas',
                    label: 'Aktivitas',
                    type: 'select',
                    options: actions.map(action => ({ label: action, value: action })),
                    defaultValue: ''
                  }
                ]}
                itemsPerPage={20}
                showPagination={true}
                loading={loading}
                error={error}
                emptyMessage="Tidak ada audit trail ditemukan dengan filter yang dipilih."
              />
            </div>
          </div>

        </div>
      </PageContainer>
    </PageLayout>
  );
};

const AuditTrailPageWithErrorBoundary = withErrorBoundary(AuditTrailPage);

export default AuditTrailPageWithErrorBoundary;