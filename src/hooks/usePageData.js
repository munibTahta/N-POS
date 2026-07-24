// Page-specific data loading hooks to reduce boilerplate across pages
import { useMultiDataLoader } from './useDataLoader';
import { getSales, getProducts, getSalesReturns, getBranches, getMetodePembayaran, getCategories, getUnits, getSuppliers, getCustomers, getPaymentMethods } from '../services/api';
import { extractArray } from '../utils/apiResponseHelper';

/**
 * Hook for loading all data needed by SalesListPage
 * @param {Object} options - Configuration options
 * @returns {Object} { sales, products, returns, branches, paymentMethods, loading, errors, refetch }
 */
export const useSalesPageData = (options = {}) => {
  const { onError = null, context = 'useSalesPageData' } = options;

  const { data: multiData, loading, errors, refetch } = useMultiDataLoader(
    {
      sales: async () => extractArray(await getSales({ include: 'detail_pembayaran' })),
      products: async () => extractArray(await getProducts({ limit: 1000 })),
      returns: async () => extractArray(await getSalesReturns()),
      branches: async () => extractArray(await getBranches()),
      paymentMethods: async () => extractArray(await getMetodePembayaran())
    },
    { context, onError }
  );

  return {
    sales: multiData.sales || [],
    products: multiData.products || [],
    returns: multiData.returns || [],
    branches: multiData.branches || [],
    paymentMethods: multiData.paymentMethods || [],
    loading,
    errors,
    refetch
  };
};

/**
 * Hook for loading all data needed by ProductsPage
 * @param {Object} options - Configuration options
 * @returns {Object} { products, categories, units, suppliers, loading, errors, refetch }
 */
export const useProductsPageData = (options = {}) => {
  const { onError = null, context = 'useProductsPageData' } = options;

  const { data: multiData, loading, errors, refetch } = useMultiDataLoader(
    {
      products: async () => extractArray(await getProducts({ limit: 1000 })),
      categories: async () => extractArray(await getCategories({ limit: 500 })),
      units: async () => extractArray(await getUnits({ limit: 500 })),
      suppliers: async () => extractArray(await getSuppliers({ limit: 500 }))
    },
    { context, onError }
  );

  return {
    products: multiData.products || [],
    categories: multiData.categories || [],
    units: multiData.units || [],
    suppliers: multiData.suppliers || [],
    loading,
    errors,
    refetch
  };
};

/**
 * Hook for loading all data needed by CustomersPage
 * @param {Object} options - Configuration options
 * @returns {Object} { customers, loading, errors, refetch }
 */
export const useCustomersPageData = (options = {}) => {
  const { onError = null, context = 'useCustomersPageData' } = options;

  const { data: multiData, loading, errors, refetch } = useMultiDataLoader(
    {
      customers: async () => extractArray(await getCustomers({ limit: 1000 }))
    },
    { context, onError }
  );

  return {
    customers: multiData.customers || [],
    loading,
    errors,
    refetch
  };
};

/**
 * Hook for loading all data needed by PosPage
 * @param {Object} options - Configuration options
 * @returns {Object} { products, paymentMethods, loading, errors, refetch }
 */
export const usePosPageData = (options = {}) => {
  const { onError = null, context = 'usePosPageData' } = options;

  const { data: multiData, loading, errors, refetch } = useMultiDataLoader(
    {
      products: async () => extractArray(await getProducts({ limit: 1000 })),
      paymentMethods: async () => extractArray(await getPaymentMethods())
    },
    { context, onError }
  );

  return {
    products: multiData.products || [],
    paymentMethods: multiData.paymentMethods || [],
    loading,
    errors,
    refetch
  };
};

/**
 * Hook for loading all data needed by CategoriesPage
 * @param {Object} options - Configuration options
 * @returns {Object} { categories, loading, errors, refetch }
 */
export const useCategoriesPageData = (options = {}) => {
  const { onError = null, context = 'useCategoriesPageData' } = options;

  const { data: multiData, loading, errors, refetch } = useMultiDataLoader(
    {
      categories: async () => extractArray(await getCategories({ limit: 500 }))
    },
    { context, onError }
  );

  return {
    categories: multiData.categories || [],
    loading,
    errors,
    refetch
  };
};
