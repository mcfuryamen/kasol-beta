// ============================================================
// Form Validation Utilities
// ============================================================

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

export interface ValidationErrors {
  [key: string]: string;
}

export function validate(
  data: Record<string, any>,
  rules: Record<string, ValidationRule>
): ValidationErrors {
  const errors: ValidationErrors = {};

  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];

    if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
      errors[field] = `${field} wajib diisi`;
      continue;
    }

    if (value && rule.minLength && String(value).length < rule.minLength) {
      errors[field] = `Minimal ${rule.minLength} karakter`;
    }

    if (value && rule.maxLength && String(value).length > rule.maxLength) {
      errors[field] = `Maksimal ${rule.maxLength} karakter`;
    }

    if (value !== undefined && rule.min !== undefined && Number(value) < rule.min) {
      errors[field] = `Minimal ${rule.min}`;
    }

    if (value !== undefined && rule.max !== undefined && Number(value) > rule.max) {
      errors[field] = `Maksimal ${rule.max}`;
    }

    if (value && rule.pattern && !rule.pattern.test(String(value))) {
      errors[field] = `Format tidak valid`;
    }

    if (value && rule.custom) {
      const customError = rule.custom(value);
      if (customError) errors[field] = customError;
    }
  }

  return errors;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone: string): boolean {
  return /^(\+62|62|0)\d{8,13}$/.test(phone.replace(/[\s-]/g, ''));
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
