// src/utils/validation.js
export const validators = {
  // Product validation
  product: (product) => {
    const errors = [];

    if (!product.nama_produk?.trim()) {
      errors.push('Nama produk wajib diisi');
    }

    if (!product.id_produk || product.id_produk <= 0) {
      errors.push('ID produk tidak valid');
    }

    if (product.harga_jual < 0) {
      errors.push('Harga jual tidak boleh negatif');
    }

    if (product.harga_beli < 0) {
      errors.push('Harga beli tidak boleh negatif');
    }

    if (product.harga_jual < product.harga_beli) {
      errors.push('Harga jual tidak boleh lebih rendah dari harga beli');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Cart item validation
  cartItem: (item) => {
    const errors = [];

    if (!item.id_produk || item.id_produk <= 0) {
      errors.push('ID produk tidak valid');
    }

    if (!item.jumlah || item.jumlah <= 0) {
      errors.push('Jumlah harus lebih dari 0');
    }

    if (item.jumlah > 9999) {
      errors.push('Jumlah terlalu besar');
    }

    if (!item.harga_jual || item.harga_jual < 0) {
      errors.push('Harga jual tidak valid');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Payment validation
  payment: (amount, total, isPendingAllowed = false) => {
    const errors = [];

    if (typeof amount !== 'number' || isNaN(amount)) {
      errors.push('Jumlah pembayaran harus berupa angka');
    }

    if (amount < 0) {
      errors.push('Jumlah pembayaran tidak boleh negatif');
    }

    if (amount > 100000000) { // 100 million limit
      errors.push('Jumlah pembayaran terlalu besar');
    }

    if (!isPendingAllowed && amount < total) {
      errors.push(`Pembayaran kurang ${formatCurrency(total - amount)}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Customer validation
  customer: (customer) => {
    const errors = [];

    if (!customer.nama_pelanggan?.trim()) {
      errors.push('Nama pelanggan wajib diisi');
    }

    if (customer.email && !isValidEmail(customer.email)) {
      errors.push('Format email tidak valid');
    }

    if (customer.no_telepon && !isValidPhone(customer.no_telepon)) {
      errors.push('Format nomor telepon tidak valid');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Transaction validation
  transaction: (cart, paymentAmount, paymentMethod, customer = null) => {
    const errors = [];

    // Validate cart
    if (!cart || cart.length === 0) {
      errors.push('Keranjang kosong');
    } else {
      cart.forEach((item, index) => {
        const itemValidation = validators.cartItem(item);
        if (!itemValidation.isValid) {
          errors.push(`Item ${index + 1}: ${itemValidation.errors.join(', ')}`);
        }
      });
    }

    // Validate payment
    if (paymentAmount !== undefined) {
      const paymentValidation = validators.payment(paymentAmount, 0, true);
      if (!paymentValidation.isValid) {
        errors.push(...paymentValidation.errors);
      }
    }

    // Validate payment method
    if (!paymentMethod || !paymentMethod.id_metode_pembayaran) {
      errors.push('Metode pembayaran wajib dipilih');
    }

    // Validate customer if provided
    if (customer) {
      const customerValidation = validators.customer(customer);
      if (!customerValidation.isValid) {
        errors.push(...customerValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

// Helper functions
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhone = (phone) => {
  const phoneRegex = /^[+]?[0-9\-\s()]{10,15}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR'
  }).format(amount);
};

export const validateAndThrow = (validator, ...args) => {
  const result = validator(...args);
  if (!result.isValid) {
    throw new Error(result.errors.join('. '));
  }
  return result;
};