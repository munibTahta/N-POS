import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useRoleContext } from '../context/RoleContext.jsx';

// Define permissions mapping
const PERMISSIONS = {
  // User management
  MANAGE_USERS: ['admin', 'owner'],
  VIEW_USERS: ['admin', 'owner', 'kasir'],

  // Sales management
  CREATE_SALES: ['admin', 'owner', 'kasir'],
  VIEW_SALES: ['admin', 'owner', 'kasir'],
  VOID_SALES: ['admin', 'owner'],
  EDIT_SALES: ['admin', 'owner'],

  // Payment management
  PROCESS_PAYMENTS: ['admin', 'owner', 'kasir'],
  VERIFY_PAYMENTS: ['admin', 'owner'],
  VIEW_PAYMENTS: ['admin', 'owner', 'kasir'],

  // Product management
  MANAGE_PRODUCTS: ['admin', 'owner'],
  VIEW_PRODUCTS: ['admin', 'owner', 'kasir'],

  // Branch management
  MANAGE_BRANCHES: ['admin', 'owner'],
  VIEW_BRANCHES: ['admin', 'owner', 'kasir'],

  // Reports
  VIEW_REPORTS: ['admin', 'owner'],
  EXPORT_DATA: ['admin', 'owner'],

  // Settings
  MANAGE_SETTINGS: ['admin', 'owner'],

  // Audit trail
  VIEW_AUDIT: ['admin', 'owner'],
};

// Hook untuk cek permission
export const usePermissions = () => {
  const { user } = useContext(AuthContext);
  const { hasPermission, hasMenuAccess } = useRoleContext();

  const hasAnyPermission = (permissions) => {
    return permissions.some(permission => hasPermission(permission));
  };

  const hasAllPermissions = (permissions) => {
    return permissions.every(permission => hasPermission(permission));
  };

  const canManageUsers = () => hasPermission('users');
  const canViewUsers = () => hasPermission('users');
  const canCreateSales = () => hasPermission('sales');
  const canVoidSales = () => hasPermission('sales');
  const canEditSales = () => hasPermission('sales');
  const canProcessPayments = () => hasPermission('sales');
  const canVerifyPayments = () => hasPermission('sales');
  const canManageProducts = () => hasPermission('inventory');
  const canManageBranches = () => hasPermission('inventory');
  const canViewReports = () => hasPermission('reports');
  const canExportData = () => hasPermission('reports');
  const canManageSettings = () => hasPermission('all');
  const canViewAudit = () => hasPermission('all');
  const canManage = () => hasPermission('all'); // Admin/Owner level access

  return {
    user,
    hasPermission,
    hasMenuAccess,
    hasAnyPermission,
    hasAllPermissions,
    canManageUsers,
    canViewUsers,
    canCreateSales,
    canVoidSales,
    canEditSales,
    canProcessPayments,
    canVerifyPayments,
    canManageProducts,
    canManageBranches,
    canViewReports,
    canExportData,
    canManageSettings,
    canViewAudit,
    canManage,
  };
};

// Hook untuk cek role
export const useRole = () => {
  const { user } = useContext(AuthContext);

  const isAdmin = () => user?.role === 'admin';
  const isOwner = () => user?.role === 'owner';
  const isKasir = () => user?.role === 'kasir';
  const isAdminOrOwner = () => isAdmin() || isOwner();
  const getRole = () => user?.role || null;

  return {
    isAdmin,
    isOwner,
    isKasir,
    isAdminOrOwner,
    getRole,
    user,
  };
};