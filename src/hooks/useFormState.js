// Form state management hook with validation
import { useState, useCallback } from 'react';

/**
 * Hook for managing form state with validation
 * @param {Object} initialValues - Initial form values
 * @param {Object} validators - Object with field names as keys and validation functions as values
 * @param {Function} onSubmit - Callback when form is submitted and valid
 * @returns {Object} Form state and methods
 */
export const useFormState = (initialValues, validators = {}, onSubmit = null) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = useCallback((fieldName, fieldValue) => {
    if (validators[fieldName]) {
      const error = validators[fieldName](fieldValue);
      return error;
    }
    return null;
  }, [validators]);

  const validate = useCallback(() => {
    const newErrors = {};
    Object.entries(values).forEach(([fieldName, fieldValue]) => {
      const error = validateField(fieldName, fieldValue);
      if (error) newErrors[fieldName] = error;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [values, validateField]);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;

    setValues(prev => ({ ...prev, [name]: fieldValue }));
    setTouched(prev => ({ ...prev, [name]: true }));
    setIsDirty(true);

    // Validate on change if field has been touched
    if (touched[name]) {
      const error = validateField(name, fieldValue);
      setErrors(prev => {
        if (error) {
          return { ...prev, [name]: error };
        } else {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        }
      });
    }
  }, [touched, validateField]);

  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));

    // Validate on blur
    const error = validateField(name, values[name]);
    setErrors(prev => {
      if (error) {
        return { ...prev, [name]: error };
      } else {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      }
    });
  }, [values, validateField]);

  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();

    setTouched(Object.keys(values).reduce((acc, key) => ({ ...acc, [key]: true }), {}));

    if (!validate()) {
      return false;
    }

    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(values);
      }
      return true;
    } catch (error) {
      console.error('Form submission error:', error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validate, onSubmit]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsDirty(false);
  }, [initialValues]);

  const setFieldValue = useCallback((fieldName, fieldValue) => {
    setValues(prev => ({ ...prev, [fieldName]: fieldValue }));
    setIsDirty(true);
  }, []);

  const setFieldError = useCallback((fieldName, error) => {
    setErrors(prev => {
      if (error) {
        return { ...prev, [fieldName]: error };
      } else {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      }
    });
  }, []);

  return {
    values,
    errors,
    touched,
    isDirty,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setFieldValue,
    setFieldError,
    setValues,
    setErrors,
    setTouched,
    isValid: Object.keys(errors).length === 0
  };
};
