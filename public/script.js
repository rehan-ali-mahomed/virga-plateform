// script.js

// Client-side form validation and interactivity

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('inspection-form');
    const loadingOverlay = document.getElementById('loading-overlay');
  
    // Form submission event
    form.addEventListener('submit', (e) => {
      // Perform client-side validation if needed
  
      // Show loading overlay
      loadingOverlay.style.display = 'flex';
    });
  
    // Add real-time validation for inputs (optional)
    // Example:
    const clientPhoneInput = document.getElementById('client_phone');
    clientPhoneInput.addEventListener('input', () => {
      const value = clientPhoneInput.value;
      const pattern = /^\d{0,10}$/;
      if (!pattern.test(value)) {
        clientPhoneInput.setCustomValidity('Please enter up to 10 digits.');
      } else {
        clientPhoneInput.setCustomValidity('');
      }
    });
  });
  