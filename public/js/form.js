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
        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (value.length > 4) {
          value = value.slice(0, 2) + '-' + value.slice(2, 5) + '-' + value.slice(5, 7);
        } else if (value.length > 2) {          
          value = value.slice(0, 2) + '-' + value.slice(2);
        }
        e.target.value = value;
        // console.info('License plate formatted:', value);
      } catch (error) {
        console.error('Error in license plate formatter', error);
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

  // Fetch vehicules on page load
  fetchVehicles();
  
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
      
      console.log('Selected vehicule:', immat, id);
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

  previewPdfBtn.addEventListener('click', async (e) => {

    if (!validateForm()) {
      console.error('Form validation failed, preventing submission');
      return;
    }
    
    setUnsetRadioInputs();
    
    form.action = '/form/submit-preview';
    await form.submit();
    
  });
});

// Client-side validation function
function validateForm() {
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
      const plateRegex = /^[A-Z]{2}[-]?[0-9]{3}[-]?[A-Z]{2}$/;
      const value = licensePlateInput.value.trim().toUpperCase();
      if (!plateRegex.test(value)) {
        console.error('Invalid license plate format');
        showError(licensePlateInput, 'Format d\'immatriculation invalide (ex: AB-123-CD)');
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
    .join(' ') // Join back with single spaces
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
}

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
  console.log('Handling search for:', immatriculation, id);

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

    if (data.success) {
      searchResult.innerHTML = `
        <div class="alert alert-success">
          <i class="fas fa-check-circle pr-1"></i> Véhicule trouvé ! Les informations ont été pré-remplies.
        </div>
      `;
      
      fillForm(data.vehicule);
      fillForm(data.customer);

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