import React from 'react';
import { usePermissions } from '../hooks/usePermissions';

/**
 * Komponen untuk conditional rendering berdasarkan permission
 * @param {string} permission - Permission yang diperlukan
 * @param {ReactNode} children - Komponen yang akan dirender jika memiliki permission
 * @param {ReactNode} fallback - Komponen yang akan dirender jika tidak memiliki permission (default: null)
 */
export const PermissionGuard = ({ permission, children, fallback = null }) => {
  const { hasPermission } = usePermissions();

  if (hasPermission(permission)) {
    return children;
  }

  return fallback;
};

/**
 * Komponen untuk conditional rendering berdasarkan role
 * @param {string|string[]} roles - Role yang diperlukan (string atau array)
 * @param {ReactNode} children - Komponen yang akan dirender jika memiliki role
 * @param {ReactNode} fallback - Komponen yang akan dirender jika tidak memiliki role (default: null)
 */
export const RoleGuard = ({ roles, children, fallback = null }) => {
  const { user } = usePermissions();

  const hasRole = Array.isArray(roles)
    ? roles.includes(user?.role)
    : user?.role === roles;

  if (hasRole) {
    return children;
  }

  return fallback;
};

/**
 * Komponen untuk conditional rendering khusus admin/owner
 * @param {ReactNode} children - Komponen yang akan dirender jika admin/owner
 * @param {ReactNode} fallback - Komponen yang akan dirender jika bukan admin/owner (default: null)
 */
export const AdminOwnerGuard = ({ children, fallback = null }) => {
  return (
    <RoleGuard roles={['admin', 'owner']} fallback={fallback}>
      {children}
    </RoleGuard>
  );
};

/**
 * Komponen untuk menyembunyikan elemen jika tidak memiliki permission
 * @param {string} permission - Permission yang diperlukan
 * @param {ReactNode} children - Komponen yang akan disembunyikan
 */
export const HideIfNoPermission = ({ permission, children }) => {
  return (
    <PermissionGuard permission={permission} fallback={null}>
      {children}
    </PermissionGuard>
  );
};

/**
 * Komponen untuk menampilkan pesan error jika tidak memiliki permission
 * @param {string} permission - Permission yang diperlukan
 * @param {string} message - Pesan error yang akan ditampilkan
 * @param {ReactNode} children - Komponen yang akan dirender jika memiliki permission
 */
export const PermissionError = ({ permission, message = "Anda tidak memiliki akses untuk fitur ini", children }) => {
  return (
    <PermissionGuard
      permission={permission}
      fallback={
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
          <p className="font-medium">Akses Ditolak</p>
          <p>{message}</p>
        </div>
      }
    >
      {children}
    </PermissionGuard>
  );
};