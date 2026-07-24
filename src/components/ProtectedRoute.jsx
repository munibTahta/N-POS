import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { useSync } from '../context/SyncContext';
import safeStorage from '../utils/safeStorage';

const ProtectedRoute = ({ children, allowedRoles, menuKey, allowOfflineAccess = true }) => {
  // ALL HOOKS MUST BE CALLED FIRST, BEFORE ANY EARLY RETURNS
  const { user, isAuthenticated, loading } = useAuth();
  const { hasMenuAccess } = usePermissions();
  const { isOnline } = useSync();
  const location = useLocation();
  const toastShownRef = useRef(false);
  const [cachedUser] = useState(() => {
    try {
      const cached = safeStorage.getItem('cachedUserSession');
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error parsing cached user session:', error);
      return null;
    }
  });

  // Cache user session when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      safeStorage.setJSON('cachedUserSession', user);
    }
  }, [isAuthenticated, user]);

  // Derived offline mode
  const isOfflineMode = !isOnline && allowOfflineAccess;

  // Compute if access is denied - as a regular value (not useMemo) to avoid hook order issues
  let accessDenied = null;
  let denialReason = null;
  
  const menuKeys = menuKey ? (Array.isArray(menuKey) ? menuKey : [menuKey]) : [];
  const hasAnyMenuAccess = () => {
    if (!menuKeys.length) return true;
    return menuKeys.some((key) => hasMenuAccess(key));
  };

  if (!isOfflineMode) {
    if (menuKeys.length > 0 && !hasAnyMenuAccess()) {
      accessDenied = true;
      denialReason = `Akses ditolak ke ${Array.isArray(menuKey) ? menuKey.join(', ') : menuKey}`;
    } else if (allowedRoles && !allowedRoles.includes(user?.role?.toLowerCase())) {
      accessDenied = true;
      denialReason = 'Anda tidak memiliki izin untuk mengakses halaman ini';
    }
  }

  // Show toast only once when access is denied
  useEffect(() => {
    if (accessDenied && !toastShownRef.current) {
      toastShownRef.current = true;
      console.warn(`Access denied to ${menuKey || location.pathname} for user ${user?.username}`);
      toast.error(denialReason, { autoClose: 3000 });
    } else if (!accessDenied) {
      toastShownRef.current = false;
    }
  }, [accessDenied, denialReason, menuKey, location.pathname, user?.username]);

  // NOW DO ALL CONDITIONAL RETURNS AFTER ALL HOOKS
  // Tampilkan loading spinner/text saat status otentikasi sedang diperiksa
  if (loading && (!isOfflineMode && !cachedUser)) {
    return <div className="flex justify-center items-center h-screen">Loading session...</div>;
  }

  // Check authentication
  const isAuthorized = isAuthenticated || (isOfflineMode && cachedUser);
  
  if (!isAuthorized) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If access is denied, navigate and let the effect show the toast
  if (accessDenied) {
    return <Navigate to="/menu" replace />;
  }

  // Jika terotentikasi dan authorized, tampilkan komponen anak
  return children;
};

export default ProtectedRoute;
