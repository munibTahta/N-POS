/**
 * Submission Progress Handler - Shows transaction submission stages
 * Provides visual feedback for multi-step async operations
 */

import { toast } from 'react-toastify';

const STAGES = {
  START: { label: '⏳ Memproses transaksi...', duration: 0 },
  VALIDATING: { label: '🔍 Validasi produk...', duration: 0 },
  CREATING_SALE: { label: '💾 Menyimpan penjualan...', duration: 0 },
  RECORDING_PAYMENT: { label: '💳 Merekam pembayaran...', duration: 0 },
  SAVING_OFFLINE: { label: '💾 Menyimpan ke database lokal...', duration: 0 },
  LOGGING: { label: '📝 Menyimpan audit log...', duration: 0 },
  PREPARING_RECEIPT: { label: '🧾 Menyiapkan struk...', duration: 0 },
  COMPLETE: { label: '✅ Transaksi berhasil!', duration: 2000 },
};

class SubmissionProgressHandler {
  constructor(options = {}) {
    this.toastId = null;
    this.currentStage = null;
    this.startTime = Date.now();
    this.stages = STAGES;
    this.isOnline = options.isOnline !== false;
  }

  /**
   * Show stage progress
   */
  show(stageName, customLabel = null) {
    if (!this.isOnline) return; // Don't show for offline transactions

    const stage = this.stages[stageName];
    if (!stage) {
      console.warn(`Unknown stage: ${stageName}`);
      return;
    }

    const label = customLabel || stage.label;
    const elapsed = Math.round((Date.now() - this.startTime) / 100) / 10; // in deciseconds

    if (this.toastId) {
      toast.update(this.toastId, {
        render: `${label} (${elapsed}s)`,
        type: 'info',
        autoClose: false,
        closeButton: false,
        closeOnClick: false
      });
    } else {
      this.toastId = toast.loading(`${label} (${elapsed}s)`, {
        autoClose: false,
        closeButton: false,
        closeOnClick: false
      });
    }

    this.currentStage = stageName;
  }

  /**
   * Complete with success
   */
  success(message = null) {
    if (!this.isOnline) return;

    const msg = message || this.stages.COMPLETE.label;
    if (this.toastId) {
      toast.update(this.toastId, {
        render: msg,
        type: 'success',
        isLoading: false,
        autoClose: 3000,
        closeButton: true
      });
    } else {
      toast.success(msg, { autoClose: 3000 });
    }
    this.toastId = null;
  }

  /**
   * Complete with error
   */
  error(message) {
    if (this.toastId) {
      toast.update(this.toastId, {
        render: `❌ ${message}`,
        type: 'error',
        isLoading: false,
        autoClose: 5000,
        closeButton: true
      });
    } else {
      toast.error(`❌ ${message}`, { autoClose: 5000 });
    }
    this.toastId = null;
  }

  /**
   * Dismiss toast
   */
  dismiss() {
    if (this.toastId) {
      toast.dismiss(this.toastId);
      this.toastId = null;
    }
  }

  /**
   * Get elapsed time
   */
  getElapsedTime() {
    return Math.round((Date.now() - this.startTime) / 100) / 10; // in deciseconds
  }
}

export default SubmissionProgressHandler;
export { STAGES };
