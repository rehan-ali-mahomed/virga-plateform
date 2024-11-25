document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('inspection-form');

  // Client-side validation function
  function validateForm() {
    try {
      let isValid = true;
      
      // Validate required fields
      const requiredFields = [
        { id: 'client_name', message: 'Le nom du client est requis.' },
        { id: 'client_phone', message: 'Le téléphone du client est requis.' },
        { id: 'license_plate', message: 'L\'immatriculation est requise.' },
        { id: 'date', message: 'La date est requise.' }
      ];

      requiredFields.forEach(field => {
        const input = document.getElementById(field.id);
        if (!input) {
          logger.error(`Required field not found: ${field.id}`);
          isValid = false;
          return;
        }
        
        if (!input.value.trim()) {
          logger.error(`Empty required field: ${field.id}`);
          showError(input, field.message);
          isValid = false;
        } else {
          clearError(input);
        }
      });

      // Validate phone format
      const phoneInput = document.getElementById('client_phone');
      if (phoneInput && phoneInput.value) {
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phoneInput.value.trim())) {
          logger.error('Invalid phone format');
          showError(phoneInput, 'Format de téléphone invalide (10 chiffres requis).');
          isValid = false;
        }
      }

      // Validate email format if provided
      const emailInput = document.getElementById('client_email');
      if (emailInput && emailInput.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailInput.value.trim())) {
          logger.error('Invalid email format');
          showError(emailInput, 'Format d\'email invalide.');
          isValid = false;
        }
      }

      // Validate license plate format
      const licensePlateInput = document.getElementById('license_plate');
      if (licensePlateInput && licensePlateInput.value) {
        const plateRegex = /^[A-Z]{2}[-]?[0-9]{3}[-]?[A-Z]{2}$/;
        const value = licensePlateInput.value.trim().toUpperCase();
        if (!plateRegex.test(value)) {
          logger.error('Invalid license plate format');
          showError(licensePlateInput, 'Format d\'immatriculation invalide (ex: AB-123-CD).');
          isValid = false;
        }
      }

      // Validate date format if present
      const dateInput = document.getElementById('date');
      if (dateInput && dateInput.value) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateInput.value.trim())) {
          logger.error('Invalid date format');
          showError(dateInput, 'Format de date invalide (YYYY-MM-DD).');
          isValid = false;
        }
      }

      logger.info(`Form validation result: ${isValid}`);
      return isValid;
    } catch (error) {
      logger.error('Error in validateForm', error);
      return false;
    }
  }

  // Helper functions for error handling
  function showError(input, message) {
    try {
      if (!input) {
        logger.error('Cannot show error: input is null');
        return;
      }

      const formGroup = input.closest('.form-group');
      if (!formGroup) {
        logger.error('Cannot show error: .form-group not found');
        return;
      }

      const errorDiv = formGroup.querySelector('.error-message') || document.createElement('div');
      errorDiv.className = 'error-message text-danger small mt-1';
      errorDiv.textContent = message;
      
      if (!formGroup.querySelector('.error-message')) {
        formGroup.appendChild(errorDiv);
      }
      input.classList.add('is-invalid');
      
      logger.error(`Error shown: ${message}`);
    } catch (error) {
      logger.error('Error in showError', error);
    }
  }

  function clearError(input) {
    try {
      if (!input) {
        logger.error('Cannot clear error: input is null');
        return;
      }

      const formGroup = input.closest('.form-group');
      if (!formGroup) {
        logger.error('Cannot clear error: .form-group not found');
        return;
      }

      const errorDiv = formGroup.querySelector('.error-message');
      if (errorDiv) {
        errorDiv.remove();
      }
      input.classList.remove('is-invalid');
      
    } catch (error) {
      logger.error('Error in clearError', error);
    }
  }

  // Form submission handler
  if (form) {
    form.addEventListener('submit', (e) => {
      try {
        if (!validateForm()) {
          logger.error('Form validation failed, preventing submission');
          e.preventDefault();
        } else {
          logger.info('Form validation successful, allowing submission');
        }
      } catch (error) {
        logger.error('Error in submit handler', error);
        e.preventDefault();
      }
    });
  } else {
    logger.error('Form not found in DOM');
  }

  // Auto-format license plate
  const licensePlateInput = document.getElementById('license_plate');
  if (licensePlateInput) {
    licensePlateInput.addEventListener('input', (e) => {
      try {
        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (value.length > 4) {
          value = value.slice(0, 2) + '-' + value.slice(2, 5) + '-' + value.slice(5, 7);
        } else if (value.length > 2) {
          value = value.slice(0, 2) + '-' + value.slice(2);
        }
        e.target.value = value;
        logger.info('License plate formatted:', value);
      } catch (error) {
        logger.error('Error in license plate formatter', error);
      }
    });
  } else {
    logger.error('License plate input not found');
  }
});