/* eslint-env browser */

document.addEventListener('DOMContentLoaded', () => {
  // Global variables
  const form = document.getElementById('inspection-form');
  const licensePlateInput = document.getElementById('license_plate');
  const dropdown = document.getElementById('search_dropdown');
  const previewPdfBtn = document.getElementById('preview-pdf-template-btn');

  const inputsToFormat = [
    {input: 'client_name', type: 'first_letter_only'}, 
    {input: 'brand', type: 'camel'},
    {input: 'model', type: 'first_letter_only'},
    {input: 'revision_oil_type', type: 'upper'}, 
    {input: 'engine_code', type: 'upper'},
    {input: 'brake_disc_thickness_front', type: 'brake_thicknesses'},
    {input: 'brake_disc_thickness_rear', type: 'brake_thicknesses'},
    {input: 'client_email', type: 'lower'}
  ];

  // If the form is with report id (/report/:id), fill the form with the data
  const id = window.location.href.split('/').pop();
  if (id != 'form') {
    console.log(`Fetching data for report ${id}`);

    // Fetch report data
    fetch(`/report/api-inspection-report/${id}`)
      .then(response => response.json())
      .then(data => fillForm(data));
    
    // Set form action to update instead of submit
    form.action = `/form/update/${id}`;

    // Hide preview PDF button to avoid double submission
    previewPdfBtn.hidden = true;
  }

  // Form submission handler
  if (form) {
    form.addEventListener('submit', (e) => {
      try {
        if (!validateForm()) {
          console.error('Form validation failed, preventing submission');
          e.preventDefault();

        } else {
          setUnsetRadioInputs();

          const formData = new FormData(form);

          // Set is_company value to true if checkbox is checked
          if(document.getElementById('is_company').checked) {
            formData.set('is_company', true);
          } else {
            formData.set('is_company', false);
          }

          console.info('Form validation successful, allowing submission');

        }
      } catch (error) {
        console.error('Error in submit handler', error);
        e.preventDefault();
      }
    });
  } else {
    console.error('Form not found in DOM');
  }

  // Auto-format license plate
  if (licensePlateInput) {
    licensePlateInput.addEventListener('input', (e) => {
      try {
        let value = e.target.value.toUpperCase();
        
        // Keep any manually entered spaces or dashes
        const manuallyFormatted = value.includes(' ') || value.includes('-');
        
        // Remove any characters that aren't letters, numbers, spaces, or dashes
        value = value.replace(/[^A-Z0-9\s-]/g, '');
        
        // If user hasn't manually formatted, detect and auto-format
        if (!manuallyFormatted) {
          // Remove any existing spaces or dashes for pattern detection
          const stripped = value.replace(/[\s-]/g, '');
          
          // Detect format based on input pattern
          const isFNIPattern = /^\d{0,3}[A-Z]{0,3}\d{0,3}$/.test(stripped);
          const isSIVPattern = /^[A-Z]{0,2}\d{0,3}[A-Z]{0,2}$/.test(stripped);
          
          // If neither pattern matches, prevent input
          if (!isFNIPattern && !isSIVPattern) {
            value = value.slice(0, -1);
          }
          
          // Enforce maximum length
          if (isFNIPattern && stripped.length > 9) {
            value = stripped.slice(0, 9);
          } else if (isSIVPattern && stripped.length > 7) {
            value = stripped.slice(0, 7);
          }
          
          // Auto-format complete plates
          if (stripped.length === 9 && /^\d{3}[A-Z]{3}\d{3}$/.test(stripped)) {
            // FNI format (DOM-TOM): 123ABC000 -> 123 ABC 000
            value = stripped.slice(0, 3) + ' ' + stripped.slice(3, 6) + ' ' + stripped.slice(6);
          } else if (stripped.length === 7 && /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(stripped)) {
            // SIV format: AB123CD -> AB-123-CD
            value = stripped.slice(0, 2) + '-' + stripped.slice(2, 5) + '-' + stripped.slice(5);
          }
        } else {
          // For manually formatted input, just enforce max length including separators
          const isFNIFormat = value.includes(' '); // FNI uses spaces
          const maxLength = isFNIFormat ? 11 : 9; // 11 chars for FNI (9 + 2 spaces), 9 for SIV (7 + 2 dashes)
          if (value.length > maxLength) {
            value = value.slice(0, maxLength);
          }
        }
        
        e.target.value = value;
      } catch (error) {
        console.error('Error in license plate formatter', error);
      }
    });

    // Add blur event to validate format
    licensePlateInput.addEventListener('blur', (e) => {
      try {
        let value = e.target.value.trim().toUpperCase();
        const stripped = value.replace(/[\s-]/g, '');
        
        // Check if it's a complete plate of either format
        const isFNI = /^\d{3}[A-Z]{3}\d{3}$/.test(stripped);
        const isSIV = /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(stripped);
        
        // If complete but not properly formatted, apply formatting
        if (isFNI && !/^\d{3}\s[A-Z]{3}\s\d{3}$/.test(value)) {
          value = stripped.slice(0, 3) + ' ' + stripped.slice(3, 6) + ' ' + stripped.slice(6);
        } else if (isSIV && !/^[A-Z]{2}-\d{3}-[A-Z]{2}$/.test(value)) {
          value = stripped.slice(0, 2) + '-' + stripped.slice(2, 5) + '-' + stripped.slice(5);
        }
        
        e.target.value = value;
      } catch (error) {
        console.error('Error in license plate blur handler', error);
      }
    });
  } else {
    console.error('License plate input not found');
  }

  // Format inputs
  inputsToFormat.forEach(inputToFormat => {
    const inputElement = document.getElementById(inputToFormat.input);
    if (inputElement) {
      inputElement.addEventListener('input', (e) => {
        formatInput(e.target, inputToFormat.type);
      });
    }
  });
  
  // Input focus event
  licensePlateInput.addEventListener('focus', () => {
    updateDropdown();
    dropdown.classList.remove('d-none');
  });
  
  // Input keyup event for filtering
  licensePlateInput.addEventListener('input', (e) => {
    filterVehicles(e.target.value);
  });
  
  // Click events for dropdown items
  document.addEventListener('click', (e) => {
    if (e.target.closest('.search-item-text')) {
      const immat = e.target.closest('.search-item-text').dataset.immat;
      const id = e.target.closest('.search-item-text').dataset.id;
      
      handleSearch(immat, id);
      // dropdown.classList.add('d-none');

    } else if (e.target.closest('.search-item-report')) {

      const immat = e.target.closest('.search-item-report').dataset.immat;
      // Open new tab with report page
      window.open(`/dashboard?search=${encodeURIComponent(immat)}`, '_blank');

    } else if (!e.target.closest('#license_plate')) {
      dropdown.classList.add('d-none');
    }
  });
  
  // Enter key
  licensePlateInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch(licensePlateInput.value.trim(), licensePlateInput.dataset.id);
      dropdown.classList.add('d-none');
    }
  });

  previewPdfBtn.addEventListener('click', async () => {
    if (!validateForm(true)) {
      console.error('Form validation failed, preventing submission');
      return;
    }
    
    setUnsetRadioInputs();
    
    // Set form attributes for preview submission
    form.action = '/form/submit-preview';
    form.target = '_blank';
    
    // Submit form to generate preview in new tab
    form.submit();

    previewPdfBtn.disabled = true;
    
    // Redirect main page to dashboard after a short delay
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1000);
  });

    
  // Client-side validation function
  function validateForm(isPreview = false) {
    try {
      let isValid = true;
      
      // Validate required fields
      const requiredFields = [
        { id: 'client_name', message: 'Le nom du client est requis.' },
        { id: 'license_plate', message: 'L\'immatriculation est requise.' }
      ];

      requiredFields.forEach(field => {
        const input = document.getElementById(field.id);
        if (!input) {
          console.error(`Required field not found: ${field.id}`);
          isValid = false;
          return;
        }
        
        if (!input.value.trim()) {
          console.error(`Empty required field: ${field.id}`);
          showError(input, field.message);
          isValid = false;
        }
      });

      // Validate phone format
      const phoneInput = document.getElementById('client_phone');
      if (phoneInput && phoneInput.value) {
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phoneInput.value.trim())) {
          console.error('Invalid phone format');
          showError(phoneInput, 'Format de téléphone invalide (10 chiffres requis).');
          isValid = false;
        }
      }

      // Validate email format if provided
      const emailInput = document.getElementById('client_email');
      if (emailInput && emailInput.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailInput.value.trim())) {
          console.error('Invalid email format');
          showError(emailInput, 'Format d\'email invalide.');
          isValid = false;
        }
      }

      // Validate license plate format
      const licensePlateInput = document.getElementById('license_plate');
      if (licensePlateInput && licensePlateInput.value) {
        const sivRegex = /^[A-Z]{2}[-]?[0-9]{3}[-]?[A-Z]{2}$/;
        const fniRegex = /^[0-9]{3}\s?[A-Z]{3}\s?[0-9]{3}$/;
        const value = licensePlateInput.value.trim().toUpperCase();
        
        if (!sivRegex.test(value) && !fniRegex.test(value)) {
          console.error('Invalid license plate format');
          showError(licensePlateInput, 'Format d\'immatriculation invalide (ex: AB-123-CD ou 123 ABC 000)');
          isValid = false;
        }
      }

      // Validate all dates format if present
      const dateInputs = document.querySelectorAll('[type="date"]');
      dateInputs.forEach(dateInput => {
        if (dateInput.value.trim()) {
          const date = new Date(dateInput.value);
          if (!date) {
            showError(dateInput, 'Impossible de convertir la date en format valide (ex: 19/11/2023)');
            isValid = false;
          }
        }
      });

      // Trim all inputs
      const inputs = document.querySelectorAll('input');
      inputs.forEach(input => {
        input.value = input.value.trim();
      });

      // Validate at least one mechanic is selected
      const mechanics = document.querySelectorAll('.custom-control-input.mechanic-checkbox:checked');
      if (mechanics.length === 0 && !isPreview) {
        showError(document.getElementById('mechanicList'), 'Au moins un mécanicien est requis.');
        isValid = false;
      }

      console.info(`Form validation result: ${isValid}`);
      return isValid;
    } catch (error) {
      console.error('Error in validateForm', error);
      return false;
    }
  }

  // Helper functions for error handling
  function showError(input, message) {
    try {
      if (!input) {
        console.error('Cannot show error: input is null');
        return;
      }

      const formGroup = input.closest('.form-group');
      if (!formGroup) {
        // console.error('Cannot show error: .form-group not found');
        return;
      }

      const errorDiv = formGroup.querySelector('.error-message') || document.createElement('div');
      errorDiv.className = 'error-message text-danger small mt-1';
      errorDiv.textContent = message;
      
      if (!formGroup.querySelector('.error-message')) {
        formGroup.appendChild(errorDiv);
      }
      input.classList.add('is-invalid');
      
      console.error(`Error shown: ${message}`);
    } catch (error) {
      console.error('Error in showError', error);
    }
  }

  // Format input based on type
  function formatInput(input, type) {
    // input.value = input.value.trim();
    switch(type) {
    case 'sentence': input.value = toSentenceCase(input.value); break;
    case 'upper': input.value = input.value.toUpperCase(); break;
    case 'camel': input.value = toCamelCase(input.value); break;
    case 'first_letter_only': input.value = input.value.charAt(0).toUpperCase() + input.value.slice(1); break;
    case 'lower': input.value = input.value.toLowerCase(); break;
    case 'brake_thicknesses': 
      if (input.value.includes('/')) {
        input.value = input.value.replace(/\//g, ' / ').replace(/\s+/g, ' ').replace(/\s+$/, '');
      }
      break;
    }
  }

  // Fill form with data using their key as html element id
  function fillForm(data) {
    console.log('Filling form with data');
    console.log(data);
    const form = document.getElementById('inspection-form');

    if (form) {
      for(const [key, val] of Object.entries(data)) {
        const input = document.getElementById(key);

        if (input) {
          switch(input.type) {
          case 'checkbox': input.checked = !!val; break;
          case 'date': 
            try {
              input.value = new Date(val).toISOString().split('T')[0];
            } catch (error) {
              input.value = val;
              console.error(`fillForm() : Error in date formatting for ${key} => ${val}`, error);
            }
            break;
          case 'number': input.value = Number(val); break;
          case 'textarea': input.value = val; break;
          default: input.value = val; break;
          }
        }
      }

      for (let ir in data.inspection_results){ 
        const radioName = `${data.inspection_results[ir].category}_${data.inspection_results[ir].item_id}_${data.inspection_results[ir].value.value}`;
        const radio = document.getElementById(radioName);
        // console.log('Building radio:', radioName);
        if (radio) {
          radio.checked = true;
        }
      }
      
      if (!data.mechanics === '{}') {
        const parsedMechanics = JSON.parse(data.mechanics);

        for (let mechanic in parsedMechanics) {
          console.log(`Fetching mechanic details for ${parsedMechanics[mechanic]}`);
          
          fetch(`/form/api-user-details/${parsedMechanics[mechanic]}`)
            .then(response => response.json())
            .then(data => {
              const option = document.getElementById(`mechanicList_${data.user.user_id}`);
              if (option && !option.checked) {
                option.checked = true;
              } else if (option && option.selected) {
                option.selected = true;
              }
            });
        }
      }
    } else {
      console.error('Form not found in DOM');
    }
  }

  // Convert first letter to uppercase and the rest to lowercase
  function toSentenceCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  // Convert string to camel case
  const toCamelCase = (str) => {
    return str
      .split(' ') // Split into words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize first letter
      .join(' '); // Join back with single spaces
  };

  // Set radio inputs to checked if not already checked
  const setUnsetRadioInputs = () => {
    const radioGroups = document.querySelectorAll('.custom-radio-group');
    radioGroups.forEach(group => {
      const radios = group.querySelectorAll('input[type="radio"]');
      const isChecked = Array.from(radios).some(radio => radio.checked);

      if (!isChecked) {
        const nonVerifieRadio = group.querySelector('input[type="radio"][value="2"]');
        if (nonVerifieRadio) {
          nonVerifieRadio.checked = true;
          console.info(`Set radio with id="2" to checked for group: ${group.id}`);
        } else {
          console.error(`Radio with id="2" not found in group: ${group.id}`);
        }
      }
    });
  };

  let allVehicles = [];
  let filteredVehicles = [];

  // Fetch all vehicules on page load
  const fetchVehicles = async () => {
    try {
      const response = await fetch('/form/api-vehicules');
      const data = await response.json();
      if (data.success) {
        allVehicles = data.data;
        filteredVehicles = [...allVehicles];
      }
    } catch (error) {
      console.error('Error fetching vehicules:', error);
    }
  };

  // Filter vehicules based on search input
  const filterVehicles = (searchText) => {
    if (!searchText.trim()) {
      filteredVehicles = [...allVehicles];
    } else {
      const searchLower = searchText.toLowerCase();
      filteredVehicles = allVehicles.filter(vehicule => 
        vehicule.license_plate.toLowerCase().includes(searchLower) ||
        vehicule.brand.toLowerCase().includes(searchLower) ||
        vehicule.model.toLowerCase().includes(searchLower)
      );
    }
    updateDropdown();
  };

  // Update dropdown content
  const updateDropdown = () => {
    const dropdown = document.getElementById('search_dropdown');
    const content = document.querySelector('.search-dropdown-content');
    
    if (filteredVehicles.length === 0) {
      content.innerHTML = '<div class="search-item">Aucun véhicule trouvé</div>';
    } else {
      content.innerHTML = filteredVehicles.map(vehicule => `
        <div class="search-item">
          <div class="search-item-text" data-immat="${vehicule.license_plate}" data-id="${vehicule.vehicule_id}">
            <div class="search-item-title">${vehicule.license_plate}</div>
            <div class="search-item-subtitle">${vehicule.brand} ${vehicule.model}</div>
          </div>
          <div class="search-item-report" data-immat="${vehicule.license_plate}">
            <i class="fas fa-list"></i>
          </div>
        </div>
      `).join('');
    }
    
    dropdown.classList.remove('d-none');
  };

  // Handle search functionality
  const handleSearch = async (immatriculation, id) => {
    console.log(`Handling search for: ${immatriculation} with id: ${id}`);

    const searchResult = document.getElementById('search_result');
    
    if (!immatriculation) {
      searchResult.innerHTML = `
        <div class="alert alert-warning">
          Veuillez entrer une immatriculation
        </div>
      `;
      return;
    }

    try {
      searchResult.innerHTML = `
        <div class="alert alert-info">
          <i class="fas fa-spinner fa-spin pr-1"></i> Recherche en cours...
        </div>
      `;

      const response = await fetch(`/form/api-vehicule-details/${id}`);
      const data = await response.json();

      fillForm(data.vehicule);
      fillForm(data.customer);

      if (data.success) {
        searchResult.innerHTML = `
          <div class="alert alert-success">
            <i class="fas fa-check-circle pr-1"></i> Véhicule trouvé ! Les informations ont été pré-remplies.
          </div>
        `;
        
        dropdown.classList.add('d-none');
      } else {
        searchResult.innerHTML = `
          <div class="alert alert-warning">
            <i class="fas fa-exclamation-triangle pr-1"></i> ${data.message}
          </div>
        `;
      }

      setTimeout(() => {
        searchResult.innerHTML = '';
      }, 2500);

    } catch (error) {
      console.error('Search error:', error);
      searchResult.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-circle"></i> Une erreur est survenue lors de la recherche
        </div>
      `;
    }
  };

  // Fetch vehicules on page load
  fetchVehicles();

  // Customer Search Functionality
  let searchTimeout = null;
  const clientNameInput = document.getElementById('client_name');
  const customerDropdown = document.getElementById('customer_search_dropdown');
  let filteredCustomers = [];

  // Input focus event for customer search
  clientNameInput.addEventListener('focus', () => {
    if (clientNameInput.value.trim().length >= 2) {
      handleCustomerSearch(clientNameInput.value.trim());
    }
  });

  // Input keyup event for customer filtering
  clientNameInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const searchTerm = e.target.value.trim();
    
    if (searchTerm.length < 2) {
      document.getElementById('customer_search_dropdown').classList.add('d-none');
      return;
    }
    
    searchTimeout = setTimeout(() => handleCustomerSearch(searchTerm), 600);
  });

  // Click events for customer dropdown items
  document.addEventListener('click', (e) => {
    const customerResult = e.target.closest('.customer-result');
    if (customerResult) {
      const customerId = customerResult.dataset.id;
      selectCustomerFromID(customerId);
    } else if (!e.target.closest('#client_name')) {
      customerDropdown.classList.add('d-none');
    }
  });

  // Handle customer search
  const handleCustomerSearch = async (searchTerm) => {
    try {
      const response = await fetch(`/form/api-customers-search?query=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Search failed');
      }
      
      filteredCustomers = data.data;
      const resultsContainer = document.querySelector('.customer-search-dropdown-content');
      
      if (filteredCustomers.length === 0) {
        resultsContainer.innerHTML = '<div class="p-2 text-gray-500">Aucun client trouvé</div>';
        return;
      }
      
      resultsContainer.innerHTML = filteredCustomers.map(customer => `
        <div class="customer-result p-2 hover:bg-gray-100 cursor-pointer" 
             data-id="${customer.customer_id}"
             data-name="${customer.name}"
             data-phone="${customer.phone || ''}"
             data-address="${customer.address || ''}">
          <div class="font-medium"><i class="fas fa-user mr-2"></i>${customer.name}</div>
          <div class="text-sm text-gray-600">
            ${customer.phone ? `<i class="fas fa-phone mr-2"></i>${customer.phone}` : ''}
            ${customer.email ? `<br><i class="fas fa-envelope mr-2"></i>${customer.email}` : ''}
            ${customer.address ? `<br><i class="fas fa-map-marker-alt mr-2"></i>${customer.address}` : ''}
          </div>
        </div>
        <div class="border-b border-gray-200"></div>
      `).join('');
      
      customerDropdown.classList.remove('d-none');
    } catch (error) {
      console.error('Search error:', error);
      const searchResult = document.getElementById('customer_search_result');
      searchResult.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-circle"></i> Une erreur est survenue lors de la recherche
        </div>
      `;
      setTimeout(() => {
        searchResult.innerHTML = '';
      }, 2500);
    }
  };

  // Select customer from ID
  const selectCustomerFromID = async (customerId) => {
    const searchResult = document.getElementById('customer_search_result');
    
    try {
      searchResult.innerHTML = `
        <div class="alert alert-info">
          <i class="fas fa-spinner fa-spin pr-1"></i> Chargement des informations...
        </div>
      `;

      const customer = filteredCustomers.find(c => c.customer_id === customerId);
      
      if (customer) {
        // Update form fields
        document.getElementById('customer_id').value = customer.customer_id;
        document.getElementById('client_name').value = customer.name;
        document.getElementById('client_phone').value = customer.phone || '';
        document.getElementById('client_email').value = customer.email || '';
        document.getElementById('client_address').value = customer.address || '';
        document.getElementById('is_company').checked = customer.is_company;

        searchResult.innerHTML = `
          <div class="alert alert-success">
            <i class="fas fa-check-circle pr-1"></i> Informations client chargées avec succès.
          </div>
        `;
        
        customerDropdown.classList.add('d-none');
      }

      setTimeout(() => {
        searchResult.innerHTML = '';
      }, 2500);

    } catch (error) {
      console.error('Error selecting customer:', error);
      searchResult.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-circle"></i> Une erreur est survenue
        </div>
      `;
    }
  };

  // Add CSS styles for customer search
  const style = document.createElement('style');
  style.textContent = `
    .search-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      z-index: 1000;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      max-height: 300px;
      overflow-y: auto;
    }
    
    .customer-result {
      transition: background-color 0.2s;
    }
    
    .customer-result:hover {
      background-color: #f3f4f6;
    }
    
    .customer-result .font-medium {
      color: #1a202c;
      font-weight: 500;
    }
    
    .customer-result .text-sm {
      font-size: 0.875rem;
    }
    
    .customer-result i {
      color: #4a5568;
    }
  `;
  document.head.appendChild(style);
});