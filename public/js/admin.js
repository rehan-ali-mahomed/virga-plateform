// File: public/js/admin.js

var searchTimeout;

// Input formatting configurations
const inputsToFormat = [
  // User form
  {input: 'first_name', type: 'camel'},
  {input: 'last_name', type: 'upper'},
  {input: 'username', type: 'lower'},
  {input: 'email', type: 'lower'},
  
  // Customer form
  {input: 'customerName', type: 'first_letter_only'},
  {input: 'customerEmail', type: 'lower'},
  {input: 'customerPhone', type: 'phone'},
  
  // Vehicle form
  {input: 'brand', type: 'camel'},
  {input: 'model', type: 'first_letter_only'},
  {input: 'engine_code', type: 'upper'},
  {input: 'revision_oil_type', type: 'upper'},
  {input: 'brake_disc_thickness_front', type: 'brake_thicknesses'},
  {input: 'brake_disc_thickness_rear', type: 'brake_thicknesses'}
];

// Format input based on type
const formatInput = (input, type) => {
  let value = input.value;
  
  switch(type) {
  case 'sentence': 
    value = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    break;
      
  case 'upper': 
    value = value.toUpperCase();
    break;
      
  case 'camel': 
    value = value.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    break;
      
  case 'first_letter_only': {
    // Split into words while preserving cursor position
    const cursorPos = input.selectionStart;
    const words = value.split(' ');
    let currentPos = 0;
      
    // Find which word the cursor is in
    const formattedWords = words.map((word) => {
      const wordStart = currentPos;
      const wordEnd = wordStart + word.length;
      currentPos = wordEnd + 1; // +1 for the space
        
      // If this is the word being typed (cursor is in or at the end of this word)
      if (cursorPos > wordStart && cursorPos <= wordEnd) {
        return word; // Leave the current word as is
      }
        
      // Format completed words
      if (word) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return '';
    });
      
    value = formattedWords.join(' ');
      
    // Restore cursor position
    input.value = value;
    input.setSelectionRange(cursorPos, cursorPos);
    return; // Early return since we've already set the value
  }
      
  case 'lower': 
    value = value.toLowerCase();
    break;
      
  case 'phone':
    value = value.replace(/\D/g, '').slice(0, 10);
    break;
      
  case 'brake_thicknesses': 
    if (value.includes('/')) {
      value = value.replace(/\//g, ' / ').replace(/\s+/g, ' ').replace(/\s+$/, '');
    }
    break;
  }
  
  input.value = value;
};

// Show error message
const showError = (input, message) => {
  try {
    if (!input) {
      console.error('Cannot show error: input is null');
      return;
    }

    const formGroup = input.closest('.form-group');
    if (!formGroup) {
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
};

// Clear error message
const clearError = (input) => {
  const formGroup = input.closest('.form-group');
  if (formGroup) {
    const errorDiv = formGroup.querySelector('.error-message');
    if (errorDiv) {
      errorDiv.remove();
    }
    input.classList.remove('is-invalid');
  }
};

// Validate form based on type
const validateForm = (type) => {
  let isValid = true;
  console.log(`Starting validation for type: ${type}`);

  // Clear all previous errors
  document.querySelectorAll('.error-message').forEach(error => error.remove());
  document.querySelectorAll('.is-invalid').forEach(input => input.classList.remove('is-invalid'));

  if (type === 'user') {
    const userId = document.getElementById('userId')?.value;
    console.log(`User ID: ${userId ? 'Editing user ' + userId : 'Creating new user'}`);

    // For new users, validate all fields. For edits, only validate modified fields
    const form = document.getElementById('userForm');
    const originalData = form.getAttribute('data-original');
    const original = originalData ? JSON.parse(originalData) : {};
    const formData = new FormData(form);
    
    // Log the original data and current form data
    console.log('Original data:', original);
    console.log('Current form data:', Object.fromEntries(formData));

    // For new users, check all required fields
    if (!userId) {
      console.log('Validating new user - checking all required fields');
      const requiredFields = ['first_name', 'last_name', 'username', 'email', 'role', 'password'];
      requiredFields.forEach(field => {
        const input = document.getElementById(field);
        if (!input?.value?.trim()) {
          console.log(`Required field missing: ${field}`);
          showError(input, 'Ce champ est requis');
          isValid = false;
        }
      });
    } else {
      // For edits, only validate fields that have been modified
      console.log('Validating user edit - checking modified fields');
      const modifiedFields = [];
      
      if (formData.get('first_name') !== original.first_name) modifiedFields.push('first_name');
      if (formData.get('last_name') !== original.last_name) modifiedFields.push('last_name');
      if (formData.get('email') !== original.email) modifiedFields.push('email');
      if (formData.get('username') !== original.username) modifiedFields.push('username');
      if (formData.get('role') !== original.role) modifiedFields.push('role');
      if (formData.get('password')) modifiedFields.push('password');
      
      console.log('Modified fields:', modifiedFields);
    }

    // Validate email format if provided or modified
    const emailInput = document.getElementById('email');
    if (emailInput?.value.trim() && (!userId || emailInput.value !== original.email)) {
      console.log('Validating email format');
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailInput.value.trim())) {
        console.log('Invalid email format');
        showError(emailInput, 'Format d\'email invalide');
        isValid = false;
      }
    }

    // Validate role if it's a new user or if role is being changed
    const roleInput = document.getElementById('role');
    if (roleInput?.value.trim() && (!userId || roleInput.value !== original.role)) {
      console.log('Validating role');
      const validRoles = ['admin', 'mechanic', 'user'];
      if (!validRoles.includes(roleInput.value.trim().toLowerCase())) {
        console.log('Invalid role');
        showError(roleInput, 'Rôle invalide');
        isValid = false;
      }
    }

    // Username format validation if provided or modified
    const usernameInput = document.getElementById('username');
    if (usernameInput?.value.trim()) {
      console.log('Validating username format');
      console.log('Current username:', usernameInput.value);
      
      // Allow letters, numbers, dots, underscores, and hyphens
      const usernameRegex = /^[a-zA-Z0-9._-]+$/;
      const username = usernameInput.value.trim().toLowerCase();
      
      console.log('Lowercase username:', username);
      console.log('Regex test result:', usernameRegex.test(username));
      
      if (!usernameRegex.test(username)) {
        console.log('Invalid username format');
        showError(usernameInput, 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, points, tirets et underscores');
        isValid = false;
      } else if (username.length < 3) {
        console.log('Username too short');
        showError(usernameInput, 'Le nom d\'utilisateur doit contenir au moins 3 caractères');
        isValid = false;
      } else if (username.length > 50) {
        console.log('Username too long');
        showError(usernameInput, 'Le nom d\'utilisateur ne peut pas dépasser 50 caractères');
        isValid = false;
      }
    }

    // Password validation
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    if (passwordInput?.value) {
      console.log('Validating password');
      if (passwordInput.value.length < 6) {
        console.log('Password too short');
        showError(passwordInput, 'Le mot de passe doit contenir au moins 6 caractères');
        isValid = false;
      }
      if (passwordInput.value !== confirmPasswordInput?.value) {
        console.log('Passwords do not match');
        showError(confirmPasswordInput, 'Les mots de passe ne correspondent pas');
        isValid = false;
      }
    } else if (!userId) {
      console.log('Password required for new user');
      showError(passwordInput, 'Le mot de passe est requis pour un nouvel utilisateur');
      isValid = false;
    }
  }

  else if (type === 'customer') {
    // Validate customer form
    const nameInput = document.getElementById('customerName');
    if (!nameInput.value.trim()) {
      showError(nameInput, 'Le nom est requis');
      isValid = false;
    }

    // Validate phone if provided
    const phoneInput = document.getElementById('customerPhone');
    if (phoneInput && phoneInput.value.trim()) {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(phoneInput.value.trim())) {
        showError(phoneInput, 'Format de téléphone invalide (10 chiffres requis)');
        isValid = false;
      }
    }

    // Validate email if provided
    const emailInput = document.getElementById('customerEmail');
    if (emailInput && emailInput.value.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailInput.value.trim())) {
        showError(emailInput, 'Format d\'email invalide');
        isValid = false;
      }
    }
  }

  else if (type === 'vehicule') {
    // Validate vehicle form
    const requiredFields = ['license_plate', 'brand', 'model'];
    requiredFields.forEach(field => {
      const input = document.getElementById(field);
      if (!input.value.trim()) {
        showError(input, 'Ce champ est requis');
        isValid = false;
      }
    });

    // Validate license plate format
    const licensePlateInput = document.getElementById('license_plate');
    if (licensePlateInput && licensePlateInput.value.trim()) {
      const plateRegex = /^[A-Z]{2}[-]?[0-9]{3}[-]?[A-Z]{2}$/;
      const value = licensePlateInput.value.trim().toUpperCase();
      if (!plateRegex.test(value)) {
        showError(licensePlateInput, 'Format d\'immatriculation invalide (ex: AB-123-CD)');
        isValid = false;
      }
    }

    // Validate customer selection
    const customerIdInput = document.getElementById('vehicule_customer_id');
    if (!customerIdInput.value.trim()) {
      showError(document.getElementById('customer_search'), 'La sélection d\'un client est requise');
      isValid = false;
    }
  }

  console.log(`Validation ${isValid ? 'passed' : 'failed'}`);
  return isValid;
};

const openModal = (type, id = null) => {
  console.log('Fetching data form entity', type, id);

  const modalContainer = document.getElementById('modalContainer');
  const modal = document.getElementById(`${type}Modal`);
  isModalOpen = true;

  if(isModalOpen) {
    closeModal();
  }
    
  // Reset form if it exists
  const form = modal.querySelector('form');
  if (form) {
    form.reset();
    // Reset password field requirement
    const passwordField = form.querySelector('#password');
    if (passwordField) {
      passwordField.required = !id; // Required for new users, optional for editing
    }
  }
    
  // Update modal title
  const titleElement = modal.querySelector('h3');
  if (titleElement && type !== 'carsReports') {
    let title;
    switch (type) {
    case 'user':
      title = id ? 'Modifier utilisateur' : 'Nouvel utilisateur';
      break;
    case 'customer':
      title = id ? 'Modifier client' : 'Nouveau client';
      break;
    case 'vehicule':
      title = id ? 'Modifier véhicule' : 'Nouveau véhicule';
      break;
    case 'inspectionItem':
      title = id ? 'Modifier item d\'inspection' : 'Nouvel item d\'inspection';
      break;
    default:
      title = id ? `Modifier ${type}` : `Nouveau ${type}`;
    }
    titleElement.textContent = title;
  }
    
  modalContainer.classList.remove('hidden');
  modal.classList.remove('hidden');

  if(type === 'user') {
    document.getElementById('is_active').checked = true;
  }
    
  if (id) {
    if(type === 'carsReports') {
      handleViewCustomerCars(id);
    } else {
      fetchEntityData(type, id);
    }
  }
};
  
const closeModal = () => {
  const modalContainer = document.getElementById('modalContainer');
  const modals = modalContainer.querySelectorAll('[id$="Modal"]');
  modalContainer.classList.add('hidden');
  modals.forEach(modal => modal.classList.add('hidden'));
  isModalOpen = false;
};
  
// Fetch entity data for editing
const fetchEntityData = async (type, id) => {
  try {
    const response = await fetch(`/admin/${type}s/${id}`);
    if (!response.ok) throw new Error('Failed to fetch data');
    
    const data = await response.json();
    
    if (type === 'user') {
      const user = data.user;
      user.username = user.is_active === 0 ? user.username.replace(/ \(Désactivé\)$/, '') : user.username;

      // Store original data for comparison
      const form = document.getElementById('userForm');
      const originalData = {
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        email: user.email || '',
        role: user.role,
        is_active: user.is_active ? 1 : 0
      };
      form.setAttribute('data-original', JSON.stringify(originalData));

      // Fill form fields
      document.getElementById('first_name').value = user.first_name;
      document.getElementById('last_name').value = user.last_name;
      document.getElementById('userId').value = user.user_id;
      document.getElementById('username').value = user.username;
      document.getElementById('email').value = user.email || '';
      document.getElementById('role').value = user.role;
      document.getElementById('password').required = false;
      document.getElementById('confirmPassword').required = false;
      document.getElementById('is_active').checked = user.is_active ? true : false;

    }

    if (type === 'customer') {
      const customer = data.customer;
      document.getElementById('customerId').value = customer.customer_id;
      document.getElementById('customerName').value = customer.name;
      document.getElementById('customerPhone').value = customer.phone || '';
      document.getElementById('customerEmail').value = customer.email || '';
      document.getElementById('customerAddress').value = customer.address || '';
      document.getElementById('isCompany').checked = customer.is_company ? true : false;

      // Format customer name based on company status
      const customerNameInput = document.getElementById('customerName');
      if (customerNameInput && customerNameInput.value) {
        formatInput(customerNameInput, customer.is_company ? 'upper' : 'first_letter_only');
      }
    }

    if (type === 'vehicule') {
      const vehicule = data.vehicule;
      document.getElementById('vehicule_customer_id').value = vehicule.customer_id;
      selectCustomerFromID(vehicule.customer_id);

      document.getElementById('vehiculeId').value = vehicule.vehicule_id;
      document.getElementById('license_plate').value = vehicule.license_plate;
      document.getElementById('brand').value = vehicule.brand;
      document.getElementById('model').value = vehicule.model;
      document.getElementById('engine_code').value = vehicule.engine_code || '';
      document.getElementById('revision_oil_type').value = vehicule.revision_oil_type || '';
      document.getElementById('revision_oil_volume').value = vehicule.revision_oil_volume || '';
      document.getElementById('brake_disc_thickness_front').value = vehicule.brake_disc_thickness_front || '';
      document.getElementById('brake_disc_thickness_rear').value = vehicule.brake_disc_thickness_rear || '';
      document.getElementById('first_registration_date').value = vehicule.first_registration_date || '';
      document.getElementById('drain_plug_torque').value = vehicule.drain_plug_torque || '';

      // Handle customer info if present
      if (vehicule.customer) {
        document.getElementById('customer_id').value = vehicule.customer.customer_id;
        document.getElementById('customer_search').value = vehicule.customer.name;
        
        const customerInfo = document.getElementById('selected_customer_info');
        customerInfo.innerHTML = `
          <div class="flex items-center justify-between">
            <div>
              <div><i class="fas fa-user mr-3"></i>${vehicule.customer.name}</div>
              ${vehicule.customer.phone ? `<div><i class="fas fa-phone mr-3"></i>${vehicule.customer.phone}</div>` : ''}
              ${vehicule.customer.address ? `<div><i class="fas fa-map-marker-alt mr-3"></i>${vehicule.customer.address}</div>` : ''}
            </div>
            <button type="button" id="clear_customer" class="text-red-500 hover:text-red-700">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `;
        customerInfo.classList.remove('hidden');
      }
    }

    if (type === 'inspectionItem') {
      document.getElementById('itemName').value = data.inspectionItem.name;
      document.getElementById('itemType').value = data.inspectionItem.type;
      document.getElementById('itemCategory').value = data.inspectionItem.category;
      document.getElementById('itemActive').checked = data.inspectionItem.is_active;
      document.getElementById('itemDisplayOrder').value = data.inspectionItem.display_order;
    }
  } catch (error) {
    showToast(error.message, 'error');
    console.error(error);
  }
};
  
// Handle form submission
const handleSubmit = async (event, type) => {
  event.preventDefault();
  console.log('Starting form submission for type:', type);
  
  const form = event.target;
  const formData = new FormData(form);
  const id = formData.get(`${type}_id`);
  let data = {};
  
  try {
    if (type === 'user') {
      // Convert FormData to JSON
      const originalData = form.getAttribute('data-original');
      const original = originalData ? JSON.parse(originalData) : {};
      
      console.log('Original data:', original);
      console.log('Form data:', Object.fromEntries(formData));

      // For new users
      if (!id) {
        console.log('Creating new user');
        // Collect all required fields
        ['first_name', 'last_name', 'username', 'email', 'role', 'password'].forEach(field => {
          const value = formData.get(field)?.trim();
          if (!value) {
            throw new Error(`Le champ ${field} est requis`);
          }
          data[field] = value;
        });
        data.is_active = formData.has('is_active') ? 1 : 0;
      } 
      // For existing users
      else {
        console.log('Updating user:', id);
        // Check each field for changes
        const fields = ['first_name', 'last_name', 'email', 'username', 'role'];
        fields.forEach(field => {
          const newValue = formData.get(field)?.trim();
          const originalValue = original[field]?.trim();
          
          console.log(`Comparing ${field}:`, { original: originalValue, new: newValue });
          
          if (newValue !== originalValue) {
            data[field] = newValue;
            console.log(`Field ${field} changed from "${originalValue}" to "${newValue}"`);
          }
        });

        // Handle password separately
        const password = formData.get('password')?.trim();
        if (password) {
          data.password = password;
        }

        // Handle is_active checkbox
        const isActive = formData.has('is_active') ? 1 : 0;
        if (isActive !== original.is_active) {
          data.is_active = isActive;
        }
      }

      // Validate username if it's being set or changed
      const username = formData.get('username')?.trim();
      if (username !== original.username) {
        console.log('Validating username:', username);
        
        // Format validation
        const usernameRegex = /^[a-zA-Z0-9._-]+$/;
        if (!usernameRegex.test(username)) {
          throw new Error('Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, points, tirets et underscores');
        }
        
        // Length validation
        if (username.length < 3) {
          throw new Error('Le nom d\'utilisateur doit contenir au moins 3 caractères');
        }
        if (username.length > 50) {
          throw new Error('Le nom d\'utilisateur ne peut pas dépasser 50 caractères');
        }
      }

      // Validate password if it's being set
      if (data.password) {
        if (data.password.length < 6) {
          throw new Error('Le mot de passe doit contenir au moins 6 caractères');
        }
        if (data.password !== formData.get('confirmPassword')) {
          throw new Error('Les mots de passe ne correspondent pas');
        }
      }

      // If no fields were modified in edit mode
      if (id && Object.keys(data).length === 0) {
        showToast('Aucune modification détectée', 'info');
        return;
      }
    }

    else if (type === 'customer') {
      data = {
        name: formData.get('name'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        address: formData.get('address'),
        is_company: formData.get('is_company') === 'on'
      };
    }

    else {
      data = Object.fromEntries(formData.entries());
    }

    // Submit the form
    console.log('Submitting data:', data);
    
    const response = await fetch(`/admin/${type}s${id ? `/${id}` : ''}`, {
      method: id ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Operation failed');
    }

    showToast(id ? 'Modification effectuée avec succès!' : 'Création effectuée avec succès!', 'success');
    closeModal();
    location.reload();
    
  } catch (error) {
    console.error('Form submission error:', error);
    showToast(error.message, 'error');
  }
};

// Delete entity
const deleteEntity = async (type, id) => {
  if (!confirm('Êtes vous sur de vouloir supprimer cet élément ?')) return;
  
  try {
    const response = await fetch(`/admin/${type}s/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Delete failed');
    }
    
    showToast('Deleted successfully!', 'success');
    location.reload();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

// Deactivate entity
const deactivateUser = async (userId) => {
  try {
    const response = await fetch(`/admin/users/${userId}`, 
      { method: 'PUT', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: 0 }) 
      });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erreur lors de la désactivation de l\'utilisateur');
    }
    showToast('Désactivation effectuée avec succès!', 'success');
    location.reload();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

// Toast notification
const showToast = (message, type) => {
  const toast = document.createElement('div');
  toast.className = `${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-6 py-4 rounded shadow-lg mb-4`;
  toast.textContent = message;
  
  const container = document.getElementById('toast-container');
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
};

const generateUsername = () => {
  if(document.getElementById('username').value?.startsWith('admin.')) return;
  const firstName = document.getElementById('first_name').value.toLowerCase().trim();
  const lastName = document.getElementById('last_name').value.toLowerCase().trim();
  if (firstName && lastName) {
    document.getElementById('username').value = `${firstName}.${lastName}`;
  }
};

// Toggle username editability
const toggleUsernameEdit = () => {
  const usernameInput = document.getElementById('username');
  const toggleButton = document.getElementById('toggleUsernameEdit');
  
  // Prevent editing if user is the default admin
  if (usernameInput.value?.startsWith('admin.')) {
    showToast('Le nom d\'utilisateur de l\'administrateur par défaut ne peut pas être modifié', 'error');
    return;
  }
  
  const isLocked = toggleButton.querySelector('i').classList.contains('fa-lock');
  
  if (isLocked) {
    // Unlock the field
    usernameInput.classList.remove('bg-gray-200', 'cursor-not-allowed');
    usernameInput.removeAttribute('readonly');
    toggleButton.querySelector('i').classList.replace('fa-lock', 'fa-lock-open');
    toggleButton.classList.replace('text-gray-400', 'text-blue-500');
  } else {
    // Lock the field and regenerate username
    usernameInput.classList.add('bg-gray-200', 'cursor-not-allowed');
    usernameInput.setAttribute('readonly', true);
    toggleButton.querySelector('i').classList.replace('fa-lock-open', 'fa-lock');
    toggleButton.classList.replace('text-blue-500', 'text-gray-400');
    // generateUsername();
  }
};

// Initialize username field as locked
const initUsernameField = () => {
  const usernameInput = document.getElementById('username');
  const toggleButton = document.getElementById('toggleUsernameEdit');
  if (usernameInput) {
    usernameInput.classList.add('bg-gray-200', 'cursor-not-allowed');
    usernameInput.setAttribute('readonly', true);
    toggleButton.querySelector('i').classList.replace('fa-lock-open', 'fa-lock');
    toggleButton.classList.replace('text-blue-500', 'text-gray-400');
  }
};

// Toggle password visibility
const togglePasswordVisibility = (event) => {
  event.preventDefault(); // Prevent default since we're using an <a> tag
  
  // Get the clicked element (either the button or the icon)
  const toggleButton = event.target.closest('[name="passwordToggle"]');
  if (!toggleButton) return;

  // Find the associated password input
  const passwordInput = toggleButton.closest('.relative').querySelector('input');
  if (!passwordInput) return;

  // Toggle the input type
  const newType = passwordInput.type === 'password' ? 'text' : 'password';
  passwordInput.type = newType;

  // Update the icon
  const icon = toggleButton.querySelector('i');
  icon.className = `fas fa-eye${newType === 'password' ? '' : '-slash'}`;
};

// Handle category selection for inspection items
const handleCategorySelection = () => {
  const categorySelect = document.getElementById('itemCategory');
  const newCategoryContainer = document.getElementById('newCategoryContainer');
  const newCategoryInput = document.getElementById('newCategory');

  if (categorySelect && newCategoryContainer && newCategoryInput) {
    categorySelect.addEventListener('change', (e) => {
      if (e.target.value === 'new') {
        newCategoryContainer.classList.remove('hidden');
        newCategoryInput.required = true;
      } else {
        newCategoryContainer.classList.add('hidden');
        newCategoryInput.required = false;
      }
    });
  }
};

const handleCustomerSearch = async (searchTerm) => {
  try {
    // Use the customers endpoint
    const response = await fetch('/admin/customers');
    if (!response.ok) throw new Error('Search failed');
    
    const data = await response.json();
    const customers = data.customers || [];
    
    // Filter customers based on search term
    const filteredCustomers = customers.filter(customer => 
      (customer.name && customer.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (customer.phone && customer.phone.includes(searchTerm)) ||
      (customer.address && customer.address.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    
    const resultsContainer = document.getElementById('customer_search_results');
    
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
        <div class="font-medium bold"><i class="fas fa-user mr-2"></i>${customer.name}</div>
        <div class="text-sm text-gray-600">
          ${customer.phone ? `<i class="fas fa-phone mr-2"></i>${customer.phone}` : ''}
          ${customer.address ? `<br><i class="fas fa-map-marker-alt mr-2"></i>${customer.address}` : ''}
        </div>
      </div>
      <div class="h-px w-full bg-gray-200"></div>
    `).join('');
    
    resultsContainer.classList.remove('hidden');
  } catch (error) {
    console.error('Search error:', error);
    showToast('Erreur lors de la recherche de clients', 'error');
  }
};

const selectCustomerFromID = async (customerId) => {
  if (!customerId) throw new Error('Customer ID is required');

  const response = await fetch(`/admin/customers/${customerId}`);
  if (!response.ok) throw new Error('Search failed');
    
  const data = await response.json();
  const customer = data.customer;

  document.getElementById('vehicule_customer_id').value = customer.customer_id;
  document.getElementById('customer_search').value = customer.name;
  
  const customerInfo = document.getElementById('selected_customer_info');
  customerInfo.innerHTML = `
  <div class="flex items-center justify-between gap-4">
    <div class="flex-grow">
      <div class="flex items-center gap-2">
        <i class="fas fa-user text-gray-600"></i>
        <span class="font-medium">${customer.name}</span>
      </div>
      ${customer.phone ? `
        <div class="flex items-center gap-2 text-gray-600 mt-1">
          <i class="fas fa-phone"></i>
          <span>${customer.phone}</span>
        </div>
      ` : ''}
      ${customer.address ? `
        <div class="flex items-center gap-2 text-gray-600 mt-1">
          <i class="fas fa-map-marker-alt"></i>
          <span>${customer.address}</span>
        </div>
      ` : ''}
    </div>
      <div class="flex gap-2">
        <button type="button" class="edit-customer-btn px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:ring-2 focus:ring-blue-400" 
          data-id="${customer.customer_id}" aria-label="Modifier" tabindex="0">
          <i class="fas fa-edit"></i>
      </button>
      <button type="button" name="clear_selected_customer" class="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 focus:ring-2 focus:ring-red-400" 
        aria-label="Supprimer" tabindex="0">
        <i class="fas fa-times fa-lg"></i>
      </button>
    </div>
  </div>
  `;

  customerInfo.classList.remove('hidden');
};

const clearCustomerSelection = () => {
  document.getElementById('vehicule_customer_id').value = '';
  document.getElementById('customer_search').value = '';
  document.getElementById('selected_customer_info').innerHTML = '';
  document.getElementById('selected_customer_info').classList.add('hidden');
};

// Database backup functionality
const handleDatabaseBackup = async () => {
  const button = document.getElementById('backupDatabaseBtn');
  const spinner = document.getElementById('backupLoadingSpinner');
  const statusDiv = document.getElementById('backupStatus');
  const buttonText = button.querySelector('span');
  
  const updateStatus = (message, type = 'info') => {
    const colorClasses = {
      info: 'text-blue-600',
      success: 'text-green-600',
      error: 'text-red-600'
    };
    
    // For mobile, we'll show shorter messages
    const isMobile = window.innerWidth < 640;
    const messages = {
      creating: {
        full: 'Création de la sauvegarde...',
        short: 'Création...'
      },
      downloading: {
        full: 'Téléchargement en cours...',
        short: 'Téléchargement...'
      },
      success: {
        full: 'Sauvegarde réussie !',
        short: 'Réussi !'
      }
    };

    let displayMessage = message;
    if (isMobile && messages[message.toLowerCase()]) {
      displayMessage = messages[message.toLowerCase()].short;
    } else if (!isMobile && messages[message.toLowerCase()]) {
      displayMessage = messages[message.toLowerCase()].full;
    }

    statusDiv.textContent = displayMessage;
    statusDiv.className = `absolute left-0 sm:left-1/2 sm:-translate-x-1/2 -bottom-7 text-sm font-medium transition-all duration-200 ${colorClasses[type]} whitespace-nowrap`;
    statusDiv.style.opacity = '1';

    // On mobile, also update the button text to show status
    if (isMobile) {
      buttonText.textContent = displayMessage;
    }
  };

  try {
    // Save original button text
    const originalButtonText = buttonText.textContent;

    // Disable button and show spinner
    button.disabled = true;
    spinner.classList.remove('hidden');
    button.classList.add('bg-opacity-75');
    updateStatus('creating', 'info');

    // Request the backup
    const response = await fetch('/admin/backup-database', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Erreur ${response.status}: ${response.statusText}`);
    }

    // Get the blob from the response
    const blob = await response.blob();
    
    // Create a date string for the filename
    const date = new Date().toISOString().split('T')[0];
    const filename = `database_backup_${date}.sqlite`;

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    
    // Trigger download
    updateStatus('downloading', 'info');
    a.click();
    
    // Cleanup
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    // Show success message
    updateStatus('success', 'success');
    
    // Reset status and button text after 3 seconds
    setTimeout(() => {
      statusDiv.style.opacity = '0';
      if (window.innerWidth < 640) {
        buttonText.textContent = originalButtonText;
      }
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 200);
    }, 3000);

  } catch (error) {
    console.error('Backup error:', error);
    const errorMessage = window.innerWidth < 640 ? 'Erreur !' : `Erreur: ${error.message}`;
    updateStatus(errorMessage, 'error');
    
    // Keep error message visible for 5 seconds
    setTimeout(() => {
      statusDiv.style.opacity = '0';
      if (window.innerWidth < 640) {
        buttonText.textContent = 'Sauvegarder BDD';
      }
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 200);
    }, 5000);
  } finally {
    // Re-enable button and hide spinner
    button.disabled = false;
    button.classList.remove('bg-opacity-75');
    spinner.classList.add('hidden');
  }
};

// Initialize Event Listeners
const initEventListeners = () => {
  // Add input formatting listeners
  inputsToFormat.forEach(({input, type}) => {
    const inputElement = document.getElementById(input);
    if (inputElement) {
      // Add input event listener for all types
      inputElement.addEventListener('input', (e) => {
        formatInput(e.target, type);
        clearError(e.target);
      });

      // Add blur event listener to ensure final formatting
      inputElement.addEventListener('blur', (e) => {
        // Trim on blur
        e.target.value = e.target.value.trim();
        formatInput(e.target, type);
        clearError(e.target);
      });
    }
  });

  // Format license plate input
  const licensePlateInput = document.getElementById('license_plate');
  if (licensePlateInput) {
    licensePlateInput.addEventListener('input', (e) => {
      let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (value.length > 4) {
        value = value.slice(0, 2) + '-' + value.slice(2, 5) + '-' + value.slice(5, 7);
      } else if (value.length > 2) {          
        value = value.slice(0, 2) + '-' + value.slice(2);
      }
      e.target.value = value;
      clearError(e.target);
    });
  }

  // Handle company name formatting
  const isCompanyCheckbox = document.getElementById('isCompany');
  const customerNameInput = document.getElementById('customerName');
  
  if (isCompanyCheckbox && customerNameInput) {
    // Format on input
    customerNameInput.addEventListener('input', (e) => {
      formatInput(e.target, isCompanyCheckbox.checked ? 'upper' : 'first_letter_only');
      clearError(e.target);
    });

    // Format on blur to ensure proper final format
    customerNameInput.addEventListener('blur', (e) => {
      e.target.value = e.target.value.trim();
      formatInput(e.target, isCompanyCheckbox.checked ? 'upper' : 'first_letter_only');
      clearError(e.target);
    });

    // Handle checkbox change
    isCompanyCheckbox.addEventListener('change', () => {
      if (customerNameInput.value) {
        formatInput(customerNameInput, isCompanyCheckbox.checked ? 'upper' : 'first_letter_only');
      }
    });
  }

  // Search functionality
  const searchInput = document.getElementById('searchTerm');
  const clearSearchBtn = document.getElementById('clearSearch');
  
  if (searchInput) {
    let debounceTimeout;
    let lastSearchTerm = '';

    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.trim();
      
      // Clear existing timeout
      clearTimeout(debounceTimeout);
      
      // If search is empty, reset to original page
      if (searchTerm.length === 0) {
        window.location.href = window.location.pathname;
        return;
      }
      
      // Ignore if search term hasn't changed
      if (searchTerm === lastSearchTerm) {
        return;
      }
      
      // Debounce the search
      debounceTimeout = setTimeout(() => {
        lastSearchTerm = searchTerm;
        const searchParams = new URLSearchParams(window.location.search);
        searchParams.set('searchTerm', searchTerm);
        const newUrl = `${window.location.pathname}?${searchParams}`;
        
        // Use fetch to get updated results
        fetch(newUrl)
          .then(response => response.text())
          .then(html => {
            // Update URL without reload
            window.history.replaceState({}, '', newUrl);
            
            // Parse and update only the necessary content
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            const contentGrid = document.querySelector('.grid.grid-cols-1.gap-6');
            const newContentGrid = doc.querySelector('.grid.grid-cols-1.gap-6');
            
            if (contentGrid && newContentGrid) {
              // Use requestAnimationFrame for smooth DOM updates
              requestAnimationFrame(() => {
                contentGrid.innerHTML = newContentGrid.innerHTML;
                // Reinitialize event listeners
                initEventListeners();
              });
            }
            
            searchInput.focus();
          })
          .catch(err => {
            console.error('Error fetching results:', err);
            // Only reload if absolutely necessary
            if (err.name === 'TypeError') {
              location.reload();
            }
          });
      }, 300); // Debounce delay of 300ms
    });
  }
  
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        window.location.href = window.location.pathname;
      }
    });
  }

  const firstNameInput = document.getElementById('first_name');
  const lastNameInput = document.getElementById('last_name');
  if (firstNameInput && lastNameInput) {
    firstNameInput.addEventListener('input', generateUsername);
    lastNameInput.addEventListener('input', generateUsername);
  }

  // User Management
  const newUserBtn = document.getElementById('new-user-btn');
  if (newUserBtn) {
    newUserBtn.addEventListener('click', () => openModal('user'));
  }

  const editUserButtons = document.querySelectorAll('.edit-user-btn');
  editUserButtons.forEach(button => {
    button.addEventListener('click', () => {
      const userId = button.getAttribute('data-id');
      openModal('user', userId);
      initUsernameField();
    });
  });

  const deactivateUserButtons = document.querySelectorAll('.deactivate-user-btn');
  deactivateUserButtons.forEach(button => {
    button.addEventListener('click', () => {
      const userId = button.getAttribute('data-id');
      deactivateUser(userId);
    });
  });

  const deleteUserButtons = document.querySelectorAll('.delete-user-btn');
  deleteUserButtons.forEach(button => {
    button.addEventListener('click', () => {
      const userId = button.getAttribute('data-id');
      deleteEntity('user', userId);
    });
  });

  // Customer Management
  const newCustomerBtn = document.getElementsByName('new-customer-btn');
  if (newCustomerBtn) {
    newCustomerBtn.forEach(button => {
      button.addEventListener('click', () => {
        openModal('customer');
      });
    });
  }

  document.addEventListener('click', (e) => {
    const editCustomerBtn = e.target.closest('.edit-customer-btn');
    if (editCustomerBtn) {
      const customerId = editCustomerBtn.getAttribute('data-id');
      openModal('customer', customerId);
    }
  });

  const deleteCustomerButtons = document.querySelectorAll('.delete-customer-btn');
  deleteCustomerButtons.forEach(button => {
    button.addEventListener('click', () => {
      const customerId = button.getAttribute('data-id');
      deleteEntity('customer', customerId);
    });
  });

  // Vehicule Management
  const newVehicleBtn = document.getElementById('new-vehicule-btn');
  if (newVehicleBtn) {
    newVehicleBtn.addEventListener('click', () => openModal('vehicule'));
  }

  const editVehicleButtons = document.querySelectorAll('.edit-vehicule-btn');
  editVehicleButtons.forEach(button => {
    button.addEventListener('click', () => {
      const vehicleId = button.getAttribute('data-id');
      openModal('vehicule', vehicleId);
    });
  });

  const deleteVehicleButtons = document.querySelectorAll('.delete-vehicule-btn');
  deleteVehicleButtons.forEach(button => {
    button.addEventListener('click', () => {
      const vehicleId = button.getAttribute('data-id');
      deleteEntity('vehicule', vehicleId);
    });
  });

  // Inspection Items
  const newInspectionItemBtn = document.getElementById('new-inspection-item-btn');
  if (newInspectionItemBtn) {
    newInspectionItemBtn.addEventListener('click', () => openModal('inspectionItem'));
  }

  const editInspectionItemButtons = document.querySelectorAll('.edit-inspection-item-btn');
  editInspectionItemButtons.forEach(button => {
    button.addEventListener('click', () => {
      const itemId = button.getAttribute('data-id');
      openModal('inspectionItem', itemId);
    });
  });

  const deleteInspectionItemButtons = document.querySelectorAll('.delete-inspection-item-btn');
  deleteInspectionItemButtons.forEach(button => {
    button.addEventListener('click', () => {
      const itemId = button.getAttribute('data-id');
      deleteEntity('inspectionItem', itemId);
    });
  });

  // Form Submissions - Single handlers
  const forms = {
    userForm: 'user',
    customerForm: 'customer',
    vehiculeForm: 'vehicule',
    inspectionItemForm: 'inspectionItem'
  };

  Object.entries(forms).forEach(([formId, type]) => {
    const form = document.getElementById(formId);
    if (form && !form.hasAttribute('data-handler-attached')) {
      form.setAttribute('data-handler-attached', 'true');
      form.addEventListener('submit', (event) => handleSubmit(event, type));
    }
  });

  // Modal Close Handlers
  const modalContainer = document.getElementById('modalContainer');
  if (modalContainer) {
    modalContainer.addEventListener('click', (event) => {
      if (event.target === modalContainer) {
        closeModal();
      }
    });
  }

  // Close modal
  const clearCustomerButtons = document.querySelectorAll('[data-dismiss="modal"]');
  clearCustomerButtons.forEach(button => {
    button.addEventListener('click', closeModal);
  });

  // Initialize category selection handler
  handleCategorySelection();

  // Customer search in vehicle modal
  const customerSearch = document.getElementById('customer_search');
  if (customerSearch) {
    customerSearch.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const searchTerm = e.target.value.trim();
      
      if (searchTerm.length < 2) {
        document.getElementById('customer_search_results').classList.add('hidden');
        return;
      }
      
      searchTimeout = setTimeout(() => handleCustomerSearch(searchTerm), 600);
    });

    customerSearch.addEventListener('blur', () => {
      // Delay hiding results to allow for result selection
      setTimeout(() => {
        document.getElementById('customer_search_results').classList.add('hidden');
      }, 200);
    });
  }

  // Customer search results delegation
  const searchResults = document.getElementById('customer_search_results');
  if (searchResults) {
    searchResults.addEventListener('click', (e) => {
      const customerResult = e.target.closest('.customer-result');
      if (customerResult) {
        const customerId = customerResult.dataset.id;
        selectCustomerFromID(customerId);
      }
    });
  }

  // Clear customer selection
  document.addEventListener('click', (e) => {
    if (e.target.closest('button[name="clear_selected_customer"]')) {
      clearCustomerSelection();
    }
  });

  document.getElementById('backupDatabaseBtn').addEventListener('click', () => {
    console.log('Backup button clicked');
    handleDatabaseBackup();
  });

  // Password visibility toggles
  document.addEventListener('click', (event) => {
    const toggleButton = event.target.closest('[name="passwordToggle"]');
    if (toggleButton) {
      togglePasswordVisibility(event);
    }
  });

  // Add username toggle event listener
  const toggleUsernameButton = document.getElementById('toggleUsernameEdit');
  if (toggleUsernameButton) {
    toggleUsernameButton.addEventListener('click', toggleUsernameEdit);
  }

  // Initialize username field when user modal opens
  document.getElementById('new-user-btn')?.addEventListener('click', () => {
    setTimeout(initUsernameField, 100); // Small delay to ensure DOM is ready
  });
};  

// Call initEventListeners when DOM is loaded
document.addEventListener('DOMContentLoaded', initEventListeners);

// Default options for inspection items
const defaultOptions = JSON.parse(JSON.stringify([
  { id: 0, label: 'Conforme', icon: '/static/img/icon_conforme.svg' },
  { id: 1, label: 'Non conforme', icon: '/static/img/icon_not_conforme.svg' },
  { id: 2, label: 'Non vérifié', icon: '/static/img/icon_unverified.svg' },
  { id: 3, label: 'À planifier', icon: '/static/img/icon_to_plan.svg' }
]));

// Handle category selection change
const handleCategoryChange = (event) => {
  const newCategoryInput = document.getElementById('newCategoryInput');
  if (event.target.value === 'new') {
    newCategoryInput.classList.remove('hidden');
    document.getElementById('newCategory').required = true;
  } else {
    newCategoryInput.classList.add('hidden');
    document.getElementById('newCategory').required = false;
  }
};

// Handle type selection change
const handleTypeChange = (event) => {
  const optionsSection = document.getElementById('optionsSection');
  if (event.target.value === 'options') {
    optionsSection.classList.remove('hidden');
    // Initialize with default options
    initializeOptions(defaultOptions);
  } else {
    optionsSection.classList.add('hidden');
  }
};

// Initialize options in the form
const initializeOptions = (options) => {
  const optionsList = document.getElementById('optionsList');
  optionsList.innerHTML = '';
  options.forEach((option) => {
    addOption(option);
  });
};

// Add new option input fields
const addOption = (option = null) => {
  const optionsList = document.getElementById('optionsList');
  const optionDiv = document.createElement('div');
  optionDiv.className = 'flex space-x-2 items-start';
  
  optionDiv.innerHTML = `
    <div class="flex-grow space-y-2">
      <input type="text" name="optionLabel[]" placeholder="Label" required
              value="${option ? option.label : ''}"
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
      <div class="flex items-center space-x-2">
        <input type="file" name="optionIcon[]" accept=".svg"
                class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100">
        ${option ? `<img src="${option.icon}" alt="Option icon" class="h-6 w-6">` : ''}
      </div>
    </div>
    <button type="button" onclick="this.parentElement.remove()"
            class="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400" aria-label="Remove option">
      ×
    </button>
  `;
  
  optionsList.appendChild(optionDiv);
};

// Add event listeners for select changes
document.getElementById('itemCategory').addEventListener('change', handleCategoryChange);
document.getElementById('itemType').addEventListener('change', handleTypeChange);

// Add event listener for toggle buttons
document.addEventListener('click', (e) => {
  const toggleBtn = e.target.closest('.toggle-reports-btn');
  if (toggleBtn) {
    const carItem = toggleBtn.closest('.car-item');
    const reportsContainer = carItem.querySelector('.reports-container');
    const icon = toggleBtn.querySelector('i');
    const isExpanded = toggleBtn.getAttribute('data-expanded') === 'true';
    
    // Toggle the expanded state
    toggleBtn.setAttribute('data-expanded', !isExpanded);
    
    // Animate the icon
    icon.style.transform = isExpanded ? '' : 'rotate(180deg)';
    
    // Toggle the reports container
    if (isExpanded) {
      reportsContainer.style.maxHeight = '0';
      reportsContainer.style.opacity = '0';
    } else {
      const height = reportsContainer.scrollHeight;
      reportsContainer.style.maxHeight = `${height}px`;
      reportsContainer.style.opacity = '1';
    }
  }
});

// Update the styles for the reports container
const style = document.createElement('style');
style.textContent = `
  .reports-container {
    transition: max-height 0.3s ease-in-out, opacity 0.2s ease-in-out;
  }
  
  .toggle-reports-btn i {
    display: inline-block;
    transition: transform 0.2s ease-in-out;
  }
`;
document.head.appendChild(style);

// Add event listener for the view cars button
document.addEventListener('click', (e) => {
  const viewCarsBtn = e.target.closest('.view-customer-cars-btn');
  if (viewCarsBtn) {
    const customerId = viewCarsBtn.getAttribute('data-id');
    openModal('carsReports', customerId);
  }
});

const handleViewCustomerCars = async (customerId) => {
    
  try {
    const response = await fetch(`/admin/customers/${customerId}/cars-reports`);
    if (!response.ok) throw new Error('Failed to fetch data');
    
    const data = await response.json();
    
    // Update modal content
    document.getElementById('modalCustomerName').textContent = data.customer.name;
    document.getElementById('carsReportsList').innerHTML = generateCarsReportsContent(data.cars);
    
    // Show modal
    // document.getElementById('carsReportsModal').classList.remove('hidden');
    
  } catch (error) {
    showToast('Erreur lors de la récupération des véhicules et rapports', 'error');
    console.error(error);
  }
};

const generateCarsReportsContent = (cars) => {
  console.log('Generating cars reports content for', cars);
  if (!cars || cars.length === 0) {
    return `
      <div class="col-span-full text-center py-8 text-gray-500">
        <i class="fas fa-car text-4xl mb-3"></i>
        <p>Aucun véhicule trouvé pour ce client</p>
      </div>
    `;
  }

  return `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
      ${cars.map(car => `
        <div class="car-item">
          <div class="bg-gray-50 rounded-lg shadow-sm">
            <div class="p-3 md:p-4">
              <div class="flex flex-col space-y-3">
                <div class="flex items-start justify-between">
                  <div class="flex items-center gap-3">
                    <i class="fas fa-car text-green-500 text-xl"></i>
                    <div>
                      <h4 class="font-semibold text-gray-900 text-lg">${car.license_plate}</h4>
                      <div class="text-sm text-gray-600">
                        <span class="font-medium">${car.brand} ${car.model}</span>
                        ${car.engine_code ? `<span class="hidden md:inline mx-2">|</span><span class="block md:inline mt-1 md:mt-0">${car.engine_code}</span>` : ''}
                      </div>
                    </div>
                  </div>
                  <button type="button" 
                          class="toggle-reports-btn p-2 hover:bg-gray-200 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
                          aria-label="Toggle reports"
                          data-expanded="false">
                    <i class="fas fa-chevron-down transform transition-transform duration-200"></i>
                  </button>
                </div>
                
                <div class="flex flex-wrap items-center gap-2 md:gap-3">
                  <span class="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    ${car.reports.length} rapport(s)
                  </span>
                  ${car.first_registration_date ? `
                    <span class="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-sm">
                      <span class="md:inline">Mise en circulation : </span>${new Date(car.first_registration_date).toLocaleDateString('fr-FR')}
                    </span>
                  ` : ''}
                </div>
              </div>
            </div>
            
            <div class="reports-container transition-all duration-300 ease-in-out overflow-hidden" style="max-height: 0; opacity: 0;">
              ${generateReportsList(car.reports)}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
};

const generateReportsList = (reports) => {
  if (!reports || reports.length === 0) {
    return `
      <div class="border-t border-gray-200">
        <p class="text-sm text-gray-500 italic p-4">Aucun rapport disponible</p>
      </div>
    `;
  }

  return `
    <div class="border-t border-gray-200">
      <div class="space-y-3 p-3 md:p-4 max-h-[300px] overflow-y-auto">
        ${reports.map(report => `
          <div class="flex flex-col md:flex-row md:items-center justify-between bg-white p-3 rounded-md shadow-sm hover:shadow-md transition-shadow duration-200 space-y-3 md:space-y-0">
            <div class="flex items-start md:items-center gap-3 md:gap-4">
              <i class="fas fa-file-alt text-lg text-blue-500 mt-1 md:mt-0"></i>
              <div class="flex-grow">
                <div class="flex flex-wrap items-center gap-2 md:gap-3">
                  <p class="text-md font-medium text-gray-900 rounded-full py-1 font-semibold">
                    ${report.mileage ? `${report.mileage} km` : '<i class="px-1 fas fa-exclamation-triangle text-yellow-500"></i> Kilométrage non renseigné'}
                  </p>
                  <span class="px-2.5 py-1 text-xs rounded-full font-medium bg-yellow-100 text-yellow-800">
                    ${new Date(report.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <div class="text-xs text-gray-500 mt-1.5 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                  <span><i class="fas fa-calendar-alt mr-1.5"></i> Créé le : ${new Date(report.created_at).toLocaleDateString('fr-FR')}</span>
                  ${report.next_technical_inspection ? 
    `<span><i class="fas fa-calendar-alt mr-1.5"></i> <span class="hidden md:inline">Prochaine </span>CT : ${new Date(report.next_technical_inspection).toLocaleDateString('fr-FR')}</span>` 
    : ''}
                </div>
              </div>
            </div>
            <div class="flex gap-2 md:gap-3 justify-end">
              <a href="/report/${report.report_id}" target="_blank" 
                 class="flex-1 md:flex-none px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 focus:ring-2 focus:ring-blue-400 transition-colors duration-200 text-center"
                 aria-label="Voir le rapport">
                <i class="fas fa-eye"></i>
                <span class="m-1 md:hidden">Afficher</span>
              </a>
              <a href="/report/preview/${report.report_id}" target="_blank"
                 class="flex-1 md:flex-none px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600 focus:ring-2 focus:ring-green-400 transition-colors duration-200 text-center"
                 aria-label="Télécharger le PDF">
                <i class="fas fa-file-pdf"></i>
                <span class="m-1 md:hidden">Prévisualiser</span>
              </a>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
};