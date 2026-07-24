import { useState, useCallback, useMemo } from 'react';

/**
 * Custom hook untuk form state management yang dioptimasi
 * Menggabungkan state, validation, dan handlers dalam satu hook
 */
export const useOptimizedForm = (initialValues = {}, validateFn = null) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Memoized validation result
  const validationResult = useMemo(() => {
    if (!validateFn) return { isValid: true, errors: {} };
    return validateFn(values);
  }, [values, validateFn]);

  // Memoized form state
  const formState = useMemo(() => ({
    values,
    errors: { ...errors, ...validationResult.errors },
    touched,
    isValid: validationResult.isValid && Object.keys(errors).length === 0,
    isSubmitting,
    isDirty: JSON.stringify(values) !== JSON.stringify(initialValues)
  }), [values, errors, touched, validationResult, isSubmitting, initialValues]);

  // Optimized handlers
  const handleChange = useCallback((field, value) => {
    setValues(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  const handleBlur = useCallback((field) => {
    setTouched(prev => ({ ...prev, [field]: true }));

    // Validate on blur if validation function provided
    if (validateFn) {
      const fieldErrors = validateFn({ [field]: values[field] }).errors;
      if (fieldErrors[field]) {
        setErrors(prev => ({ ...prev, [field]: fieldErrors[field] }));
      }
    }
  }, [values, validateFn]);

  const handleSubmit = useCallback(async (onSubmit) => {
    setIsSubmitting(true);
    try {
      const result = await onSubmit(values);
      return result;
    } catch (error) {
      setErrors(prev => ({ ...prev, submit: error.message }));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [values]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  const setFieldValue = useCallback((field, value) => {
    setValues(prev => ({ ...prev, [field]: value }));
  }, []);

  const setFieldError = useCallback((field, error) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  return {
    ...formState,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setFieldValue,
    setFieldError
  };
};

/**
 * Hook untuk form array fields (seperti multiple items)
 */
export const useFormArray = (initialArray = []) => {
  const [items, setItems] = useState(initialArray);

  const addItem = useCallback((item = {}) => {
    setItems(prev => [...prev, { ...item, id: Date.now() }]);
  }, []);

  const removeItem = useCallback((index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateItem = useCallback((index, updates) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    ));
  }, []);

  const moveItem = useCallback((fromIndex, toIndex) => {
    setItems(prev => {
      const newItems = [...prev];
      const [movedItem] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, movedItem);
      return newItems;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  return {
    items,
    addItem,
    removeItem,
    updateItem,
    moveItem,
    clear,
    count: items.length
  };
};