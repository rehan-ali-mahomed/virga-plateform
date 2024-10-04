document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('inspection-form');
  const loadingOverlay = document.getElementById('loading-overlay');

  // Form submission event
  form.addEventListener('submit', (e) => {
    // Perform client-side validation
    if (!validateForm()) {
      e.preventDefault();
      return;
    }

    // Show loading overlay
    loadingOverlay.style.display = 'flex';
  });

  // Client-side validation function
  function validateForm() {
    let isValid = true;

    // Validate date
    const dateInput = document.getElementById('date');
    if (!dateInput.value) {
      showError(dateInput, 'Please enter a valid date.');
      isValid = false;
    } else {
      clearError(dateInput);
    }

    // Validate client name
    const clientNameInput = document.getElementById('client_name');
    if (!clientNameInput.value || clientNameInput.value.length > 50) {
      showError(clientNameInput, 'Client name must be at most 50 characters long.');
      isValid = false;
    } else {
      clearError(clientNameInput);
    }

    // Validate client phone
    const clientPhoneInput = document.getElementById('client_phone');
    if (!clientPhoneInput.value || clientPhoneInput.value.length > 15) {
      showError(clientPhoneInput, 'Phone number must be at most 15 characters long.');
      isValid = false;
    } else {
      clearError(clientPhoneInput);
    }

    // Validate vehicle registration
    const vehicleRegistrationInput = document.getElementById('vehicle_registration');
    if (!vehicleRegistrationInput.value || vehicleRegistrationInput.value.length > 20) {
      showError(vehicleRegistrationInput, 'Vehicle registration must be at most 20 characters long.');
      isValid = false;
    } else {
      clearError(vehicleRegistrationInput);
    }

    // Validate vehicle make
    const vehicleMakeInput = document.getElementById('vehicle_make');
    if (!vehicleMakeInput.value || vehicleMakeInput.value.length > 50) {
      showError(vehicleMakeInput, 'Vehicle make must be at most 50 characters long.');
      isValid = false;
    } else {
      clearError(vehicleMakeInput);
    }

    // Validate vehicle model
    const vehicleModelInput = document.getElementById('vehicle_model');
    if (!vehicleModelInput.value || vehicleModelInput.value.length > 50) {
      showError(vehicleModelInput, 'Vehicle model must be at most 50 characters long.');
      isValid = false;
    } else {
      clearError(vehicleModelInput);
    }

    // Validate mileage
    const mileageInput = document.getElementById('mileage');
    if (!mileageInput.value || isNaN(mileageInput.value) || mileageInput.value < 0 || mileageInput.value > 9999999) {
      showError(mileageInput, 'Mileage must be a number between 0 and 9,999,999.');
      isValid = false;
    } else {
      clearError(mileageInput);
    }

    // Validate next inspection date (optional)
    const nextInspectionDateInput = document.getElementById('next_inspection_date');
    if (nextInspectionDateInput.value && !isValidDate(nextInspectionDateInput.value)) {
      showError(nextInspectionDateInput, 'Please enter a valid date for the next inspection.');
      isValid = false;
    } else {
      clearError(nextInspectionDateInput);
    }

    return isValid;
  }

  function showError(input, message) {
    const formGroup = input.closest('.form-group');
    const errorElement = formGroup.querySelector('.error-message') || document.createElement('div');
    errorElement.className = 'error-message text-danger';
    errorElement.textContent = message;
    formGroup.appendChild(errorElement);
    input.classList.add('is-invalid');
  }

  function clearError(input) {
    const formGroup = input.closest('.form-group');
    const errorElement = formGroup.querySelector('.error-message');
    if (errorElement) {
      errorElement.remove();
    }
    input.classList.remove('is-invalid');
  }

  function isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }
});