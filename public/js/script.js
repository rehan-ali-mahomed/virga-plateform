document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('inspection-form');
  
  // Debug helper
  const debug = (message, error = null) => {
    console.log('Debug:', message);
    if (error) {
      console.error('Error details:', error);
    }
  };

  // Client-side validation function
  function validateForm() {
    try {
      let isValid = true;
      debug('Starting form validation');

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
          debug(`Required field not found: ${field.id}`);
          isValid = false;
          return;
        }
        
        if (!input.value.trim()) {
          debug(`Empty required field: ${field.id}`);
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
          debug('Invalid phone format');
          showError(phoneInput, 'Format de téléphone invalide (10 chiffres requis).');
          isValid = false;
        }
      }

      // Validate email format if provided
      const emailInput = document.getElementById('client_email');
      if (emailInput && emailInput.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailInput.value.trim())) {
          debug('Invalid email format');
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
          debug('Invalid license plate format');
          showError(licensePlateInput, 'Format d\'immatriculation invalide (ex: AB-123-CD).');
          isValid = false;
        }
      }

      // Validate date format if present
      const dateInput = document.getElementById('date');
      if (dateInput && dateInput.value) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateInput.value.trim())) {
          debug('Invalid date format');
          showError(dateInput, 'Format de date invalide (YYYY-MM-DD).');
          isValid = false;
        }
      }

      debug(`Form validation result: ${isValid}`);
      return isValid;
    } catch (error) {
      debug('Error in validateForm', error);
      return false;
    }
  }

  // Helper functions for error handling
  function showError(input, message) {
    try {
      if (!input) {
        debug('Cannot show error: input is null');
        return;
      }

      const formGroup = input.closest('.form-group');
      if (!formGroup) {
        debug('Cannot show error: .form-group not found');
        return;
      }

      const errorDiv = formGroup.querySelector('.error-message') || document.createElement('div');
      errorDiv.className = 'error-message text-danger small mt-1';
      errorDiv.textContent = message;
      
      if (!formGroup.querySelector('.error-message')) {
        formGroup.appendChild(errorDiv);
      }
      input.classList.add('is-invalid');
      
      debug(`Error shown: ${message}`);
    } catch (error) {
      debug('Error in showError', error);
    }
  }

  function clearError(input) {
    try {
      if (!input) {
        debug('Cannot clear error: input is null');
        return;
      }

      const formGroup = input.closest('.form-group');
      if (!formGroup) {
        debug('Cannot clear error: .form-group not found');
        return;
      }

      const errorDiv = formGroup.querySelector('.error-message');
      if (errorDiv) {
        errorDiv.remove();
      }
      input.classList.remove('is-invalid');
      
      debug(`Error cleared for input: ${input.id}`);
    } catch (error) {
      debug('Error in clearError', error);
    }
  }

  // Form submission handler
  if (form) {
    debug('Form found, adding submit event listener');
    form.addEventListener('submit', (e) => {
      try {
        if (!validateForm()) {
          debug('Form validation failed, preventing submission');
          e.preventDefault();
        } else {
          debug('Form validation successful, allowing submission');
        }
      } catch (error) {
        debug('Error in submit handler', error);
        e.preventDefault();
      }
    });
  } else {
    debug('Form not found in DOM');
  }

  // Auto-format license plate
  const licensePlateInput = document.getElementById('license_plate');
  if (licensePlateInput) {
    debug('License plate input found, adding input event listener');
    licensePlateInput.addEventListener('input', (e) => {
      try {
        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (value.length > 4) {
          value = value.slice(0, 2) + '-' + value.slice(2, 5) + '-' + value.slice(5, 7);
        } else if (value.length > 2) {
          value = value.slice(0, 2) + '-' + value.slice(2);
        }
        e.target.value = value;
        debug('License plate formatted:', value);
      } catch (error) {
        debug('Error in license plate formatter', error);
      }
    });
  } else {
    debug('License plate input not found');
  }
});