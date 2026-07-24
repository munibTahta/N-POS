// src/hooks/useNotifications.js
import { useCallback } from 'react';
import { toast } from 'react-toastify';

export const useNotifications = () => {
  const success = useCallback((message, options = {}) => {
    toast.success(message, {
      position: 'top-right',
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options
    });
  }, []);

  const error = useCallback((message, options = {}) => {
    toast.error(message, {
      position: 'top-right',
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options
    });
  }, []);

  const warning = useCallback((message, options = {}) => {
    toast.warning(message, {
      position: 'top-right',
      autoClose: 4000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options
    });
  }, []);

  const info = useCallback((message, options = {}) => {
    toast.info(message, {
      position: 'top-right',
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options
    });
  }, []);

  const loading = useCallback((message = 'Memproses...', options = {}) => {
    return toast.loading(message, {
      position: 'top-right',
      hideProgressBar: false,
      closeOnClick: false,
      pauseOnHover: false,
      draggable: false,
      ...options
    });
  }, []);

  const update = useCallback((toastId, message, type = 'success', options = {}) => {
    toast.update(toastId, {
      render: message,
      type,
      isLoading: false,
      autoClose: 3000,
      ...options
    });
  }, []);

  const dismiss = useCallback((toastId) => {
    toast.dismiss(toastId);
  }, []);

  const dismissAll = useCallback(() => {
    toast.dismiss();
  }, []);

  return {
    success,
    error,
    warning,
    info,
    loading,
    update,
    dismiss,
    dismissAll
  };
};