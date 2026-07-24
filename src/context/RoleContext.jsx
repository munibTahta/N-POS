/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import { getRoles, getMenuPermissionsForRole } from '../services/api';

export const RoleContext = createContext(null);

// Default roles configuration - Updated to match API structure
const DEFAULT_ROLES = {
  1: { // owner
    id_role: 1,
    nama_role: 'Owner',
    deskripsi: 'Pemilik toko dengan akses penuh',
    permissions: {
      sales: true,
      inventory: true,
      reports: true,
      users: true,
      all: true,
      menus: {
        pos: true,
        penjualan: true,
        stok: true,
        'stok/kasir': true,
        'stok/transfer': true,
        'stok/distribusi': true,
        pembelian: true,
        laporan: true,
        rekonsiliasi: true,
        produk: true,
        kategori: true,
        satuan: true,
        pelanggan: true,
        supplier: true,
        users: true,
        cabang: true,
        roles: true,
        'menu-management': true,
        'api-testing': true,
        pengaturan: true,
        'metode-pembayaran': true,
        'pembayaran/pending': true,
        'audit-trail': true,
        'log-aktivitas': true,
        loyalty: true,
        diskon: true,
        voucher: true,
        pajak: true
      }
    },
    level: 100
  },
  2: { // admin
    id_role: 2,
    nama_role: 'Administrator',
    deskripsi: 'Administrator dengan akses luas',
    permissions: {
      sales: true,
      inventory: true,
      reports: true,
      users: true,
      all: true,
      menus: {
        pos: true,
        penjualan: true,
        stok: true,
        'stok/kasir': true,
        'stok/transfer': true,
        'stok/distribusi': true,
        pembelian: true,
        laporan: true,
        rekonsiliasi: true,
        produk: true,
        kategori: true,
        satuan: true,
        pelanggan: true,
        supplier: true,
        users: true,
        cabang: true,
        roles: true,
        'menu-management': true,
        'api-testing': true,
        pengaturan: true,
        'metode-pembayaran': true,
        'pembayaran/pending': true,
        'audit-trail': true,
        'log-aktivitas': true,
        loyalty: true,
        diskon: true,
        voucher: true,
        pajak: true
      }
    },
    level: 80
  },
  3: { // gudang
    id_role: 3,
    nama_role: 'Gudang',
    deskripsi: 'Staff gudang untuk mengelola stok',
    permissions: {
      sales: false,
      inventory: true,
      reports: true,
      users: false,
      all: false,
      menus: {
        pos: false,
        penjualan: false,
        stok: true,
        'stok/kasir': false,
        'stok/transfer': true,
        'stok/distribusi': true,
        pembelian: true,
        laporan: true,
        rekonsiliasi: false,
        produk: true,
        kategori: true,
        satuan: true,
        pelanggan: false,
        supplier: true,
        users: false,
        cabang: false,
        roles: false,
        'api-testing': false,
        pengaturan: true,
        'metode-pembayaran': false,
        'pembayaran/pending': false,
        'audit-trail': false,
        loyalty: false,
        diskon: false,
        voucher: false,
        pajak: false
      }
    },
    level: 40
  },
  4: { // kasir
    id_role: 4,
    nama_role: 'Kasir',
    deskripsi: 'Kasir untuk transaksi penjualan',
    permissions: {
      sales: true,
      inventory: false,
      reports: false,
      users: false,
      all: false,
      menus: {
        pos: true,
        penjualan: true,
        stok: false,
        'stok/kasir': true,
        'stok/transfer': false,
        'stok/distribusi': false,
        pembelian: false,
        laporan: false,
        rekonsiliasi: false,
        produk: false,
        kategori: false,
        satuan: false,
        pelanggan: true,
        supplier: false,
        users: false,
        cabang: false,
        roles: false,
        'api-testing': false,
        pengaturan: true,
        'metode-pembayaran': false,
        'pembayaran/pending': false,
        'audit-trail': false,
        'log-aktivitas': false,
        loyalty: true,
        diskon: true,
        voucher: true,
        pajak: false
      }
    },
    level: 20
  }
};

export const RoleProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [menuPermissions, setMenuPermissions] = useState({});

  // Load roles and menu permissions from API on mount and when user changes
  useEffect(() => {
    const loadRolesAndPermissions = async () => {
      try {
        // Load roles
        const response = await getRoles();
        if (response.data && response.data.success && response.data.data) {
          // Convert array to object keyed by id_role
          const rolesObject = {};
          response.data.data.forEach(role => {
            rolesObject[role.id_role] = role;
          });
          setRoles(rolesObject);
        }
      } catch (error) {
        console.error('Failed to load roles from API:', error);
        // Keep default roles if API fails
      }

      // Load menu permissions for current user if logged in
      if (user && user.id_role) {
        try {
          const permissionsResponse = await getMenuPermissionsForRole(user.id_role);
          if (permissionsResponse.data && permissionsResponse.data.success) {
            // Convert menu permissions array to object keyed by menu_key
            const permissionsObject = {};
            permissionsResponse.data.data.menuPermissions.forEach(permission => {
              permissionsObject[permission.menu_key] = permission.dapat_akses;
            });
            setMenuPermissions(permissionsObject);
          }
        } catch (error) {
          console.error('Failed to load menu permissions from API:', error);
          // Keep default permissions if API fails
        }
      } else {
        // Clear permissions if user is not logged in
        setMenuPermissions({});
      }
    };

    loadRolesAndPermissions();
  }, [user]);

  const getRoleByName = (roleName) => {
    // Find role by name (for backward compatibility).
    // Accepts full names like 'Administrator' or short slugs like 'admin'.
    if (!roleName) return null;
    const needle = String(roleName).toLowerCase();
    return (
      Object.values(roles).find(role => {
        const rName = String(role.nama_role || '').toLowerCase();
        if (rName === needle) return true;
        if (rName.includes(needle)) return true;
        // Support roles provided as simple slugs on the user object (e.g., 'admin')
        if (String(role.value || '').toLowerCase() === needle) return true;
        return false;
      }) || null
    );
  };

  const getRoleById = (roleId) => {
    return roles[roleId] || null;
  };

  const getUserPermissions = () => {
    if (!user || !user.role) return {};

    const userRole = getRoleByName(user.role);
    return userRole ? userRole.permissions : {};
  };

  const getUserMenuPermissions = () => {
    // If we have permissions from API, use them
    if (Object.keys(menuPermissions).length > 0) {
      return menuPermissions;
    }

    // Fallback to default permissions from role
    const permissions = getUserPermissions();
    return permissions.menus || {};
  };

  const hasMenuAccess = (menuPath) => {
    const menuPermissions = getUserMenuPermissions();
    return menuPermissions[menuPath] === true || getUserPermissions().all === true;
  };

  const hasPermission = (permission) => {
    const userPermissions = getUserPermissions();
    return userPermissions[permission] === true || userPermissions.all === true;
  };

  const hasAnyPermission = (permissions) => {
    return permissions.some(permission => hasPermission(permission));
  };

  const hasAllPermissions = (permissions) => {
    return permissions.every(permission => hasPermission(permission));
  };

  const canManageRole = (targetRole) => {
    if (!user || !user.role) return false;

    const currentRole = getRoleByName(user.role);
    const targetRoleData = getRoleByName(targetRole);

    if (!currentRole || !targetRoleData) return false;

    // Only admin and owner can manage roles
    if (!['admin', 'owner'].includes(user.role.toLowerCase())) return false;

    // Cannot manage roles with higher or equal level
    return currentRole.level > targetRoleData.level;
  };

  const getAvailableRoles = () => {
    // Convert all roles to display format
    const allRoles = Object.values(roles)
      .map(role => ({
        value: role.nama_role.toLowerCase(),
        id_role: role.id_role,
        label: role.nama_role,
        description: role.deskripsi
      }))
      .sort((a, b) => b.id_role - a.id_role);

    // If user not loaded, return all roles (for initial form display)
    if (!user || !user.role) {
      return allRoles;
    }

    const currentRole = getRoleByName(user.role);
    if (!currentRole) {
      // Fallback: return all roles if current role can't be identified
      return allRoles;
    }

    // If user is admin or owner, allow managing any role
    if (['admin', 'owner'].includes(user.role.toLowerCase())) {
      return allRoles;
    }

    // For other users, return empty (they shouldn't have access to user management anyway)
    return [];
  };

  const updateRolePermissions = (roleId, newPermissions) => {
    setRoles(prevRoles => ({
      ...prevRoles,
      [roleId]: {
        ...prevRoles[roleId],
        permissions: newPermissions
      }
    }));
  };

  const value = {
    roles,
    menuPermissions,
    getRoleByName,
    getRoleById,
    getUserPermissions,
    getUserMenuPermissions,
    hasMenuAccess,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canManageRole,
    getAvailableRoles,
    updateRolePermissions,
  };

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRoleContext = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRoleContext must be used within a RoleProvider');
  }
  return context;
};