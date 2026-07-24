/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthContext } from './AuthContext';
import { getMenus, createMenu, updateMenu, deleteMenu } from '../services/api';

export const MenuContext = createContext(null);

export const MenuProvider = ({ children }) => {
  const { user, logout } = useContext(AuthContext);
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load menus when component mounts or user changes
  // `loadMenus` is defined below but we need to call it in an effect,
  // so declare it first to avoid "Cannot access before initialization".
  const loadMenus = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      setError(null);
      const response = await getMenus(params);
      if (response.data && response.data.success) {
        // Normalize menu data to ensure consistent formatting
        const normalizedMenus = (response.data.data || []).map(menu => ({
          ...menu,
          path: menu.path && !menu.path.startsWith('/') ? `/${menu.path}` : menu.path,
          grup: (menu.grup || '').toLowerCase().trim(),
          menu_key: (menu.menu_key || '').toLowerCase().trim()
        }));
        setMenus(normalizedMenus);
      }
    } catch (err) {
      console.error('Failed to load menus:', err);
      // if unauthorized, force logout so app can redirect to login
      if (err.response?.status === 401) {
        logout();
      }
      setError('Gagal memuat data menu');
      setMenus([]);
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    // Only load menus if user is authenticated and token exists
    const token = localStorage.getItem('authToken');
    if (user && token) {
      // Add small delay to ensure token is properly set in axios headers
      setTimeout(() => {
        loadMenus();
      }, 100);
    } else {

      // Clear menus if user is not authenticated
      setMenus([]);
      setError(null);
    }
  }, [user, loadMenus]);

  const addMenu = async (menuData) => {
    try {
      setError(null);
      const response = await createMenu(menuData);
      if (response.data && response.data.success) {
        await loadMenus();
        return response.data.data;
      } else {
        const errorMessage = response.data?.message || 'Gagal membuat menu';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error('Failed to create menu:', err);
      let errorMessage = 'Gagal membuat menu';

      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.status === 400) {
        errorMessage = 'Data tidak valid. Periksa kembali form Anda.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Sesi login telah berakhir. Silakan login ulang.';
      } else if (err.response?.status === 403) {
        errorMessage = 'Anda tidak memiliki izin untuk membuat menu.';
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const editMenu = async (id, menuData) => {

    try {
      setError(null);
      const response = await updateMenu(id, menuData);

      if (response.data && response.data.success) {

        await loadMenus();
        return response.data.data;
      } else {
        console.warn('Update response not successful:', response.data);
      }
    } catch (err) {
      console.error('Failed to update menu:', err);
      setError('Gagal memperbarui menu');
      throw err; // Re-throw error instead of using optimistic updates
    }
  };

  const removeMenu = async (id) => {
    try {
      setError(null);
      await deleteMenu(id);
      await loadMenus();
    } catch (err) {
      console.error('Failed to delete menu:', err);
      let errorMessage = 'Gagal menghapus menu';

      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.status === 400) {
        errorMessage = 'Menu tidak dapat dihapus karena masih digunakan oleh role tertentu. Hapus assignment role terlebih dahulu.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Sesi login telah berakhir. Silakan login ulang.';
      } else if (err.response?.status === 403) {
        errorMessage = 'Anda tidak memiliki izin untuk menghapus menu.';
      } else if (err.response?.status === 404) {
        errorMessage = 'Menu tidak ditemukan.';
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const getMenuById = (id) => {
    return menus.find(menu => menu.id_menu === id) || null;
  };

  const getMenusByGroup = (group) => {
    return menus.filter(menu => menu.grup === group);
  };

  const getActiveMenus = () => {
    return menus.filter(menu => menu.aktif !== false);
  };

  const getMenuTree = () => {
    const menuMap = {};
    const roots = [];

    menus.forEach(menu => {
      menuMap[menu.id_menu] = { ...menu, children: [] };
    });

    menus.forEach(menu => {
      if (menu.parent_menu) {
        if (menuMap[menu.parent_menu]) {
          menuMap[menu.parent_menu].children.push(menuMap[menu.id_menu]);
        }
      } else {
        roots.push(menuMap[menu.id_menu]);
      }
    });

    return roots;
  };

  const value = {
    menus,
    loading,
    error,
    loadMenus,
    addMenu,
    editMenu,
    removeMenu,
    getMenuById,
    getMenusByGroup,
    getActiveMenus,
    getMenuTree,
    clearError: () => setError(null)
  };

  return (
    <MenuContext.Provider value={value}>
      {children}
    </MenuContext.Provider>
  );
};

export const useMenuContext = () => {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error('useMenuContext must be used within a MenuProvider');
  }
  return context;
};
