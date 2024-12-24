// File: public/js/admin.js

// Modal handling
let isModalOpen = false;
const openModal = (type, id = null) => {
  console.log("Fetching data form entity ", type, id);

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
      titleElement.textContent = id ? `Edit ${capitalize(type)}` : `New ${capitalize(type)}`;
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
        document.getElementById('userId').value = user.user_id;
        document.getElementById('username').value = user.username;
        document.getElementById('email').value = user.email || '';
        document.getElementById('role').value = user.role;
        document.getElementById('password').required = false;
        document.getElementById('confirmPassword').required = false;
        
        if (user.is_active) {
          document.getElementById('is_active').checked = true;
        } else {
          document.getElementById('username').value = user.username.replace(/ \(D\)$/, '');
          document.getElementById('is_active').checked = false;
        }

      }

      if (type === 'customer') {
        const customer = data.customer;
        document.getElementById('customerId').value = customer.customer_id;
        document.getElementById('customerName').value = customer.name;
        document.getElementById('customerPhone').value = customer.phone || '';
        document.getElementById('customerEmail').value = customer.email || '';
        document.getElementById('customerAddress').value = customer.address || '';
        document.getElementById('isCompany').checked = customer.is_company || false;
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
    const form = event.target;
    const formData = new FormData(form);
    const id = formData.get(`${type}_id`);
    
    // Convert FormData to JSON
    const data = Object.fromEntries(formData.entries());
    
    // Handle boolean values
    if (type === 'customer') {
      data.is_company = data.is_company ? 1 : 0;
    }
    
    if (type === 'user') {
      data.is_active = data.is_active ? 1 : 0;
      // Remove empty password when editing
      if (id && !data.password) {
        delete data.password;
        delete data.confirmPassword;
      }
    }

    if (type === 'inspectionItem') {
      data.is_active = formData.has('is_active');
      // Handle category
      if (data.category === 'new') {
        data.is_active = true;
        data.category = formData.get('newCategory').trim();
      } else {
        // Get the count of items in the new category
        const categoryCount = document.getElementById('itemCategory').options[document.getElementById('itemCategory').selectedIndex].getAttribute('count');
        data.display_order = parseInt(categoryCount) + 1;
      }
    }

    try {
      const response = await fetch(`/admin/${type}s${id ? `/${id}` : ''}`, {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Operation failed');
      }
      
      showToast(id ? 'Updated successfully!' : 'Created successfully!', 'success');
      closeModal();
      location.reload();
    } catch (error) {
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
      if (!response.ok) throw new Error('Failed to deactivate');
      showToast('Deactivated successfully!', 'success');
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
  
  // Capitalize first letter
  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

  // Toggle password visibility
  const togglePasswordVisibility = (event) => {
    const passwordField = event.target.parentElement.querySelector('input[type="password"]');
    passwordField.type = passwordField.type === 'password' ? 'text' : 'password';
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
  
  // Customer search functionality for vehicle modal
  let searchTimeout = null;

  const handleCustomerSearch = async (searchTerm) => {
    try {
      // Use the customers endpoint
      const response = await fetch(`/admin/customers`);
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

  // Initialize Event Listeners
  const initEventListeners = () => {
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

    // Form Submissions
    const userForm = document.getElementById('userForm');
    if (userForm) {
      userForm.addEventListener('submit', (event) => handleSubmit(event, 'user'));
    }

    const customerForm = document.getElementById('customerForm');
    if (customerForm) {
      customerForm.addEventListener('submit', (event) => handleSubmit(event, 'customer'));
    }

    const vehiculeForm = document.getElementById('vehiculeForm');
    if (vehiculeForm) {
      vehiculeForm.addEventListener('submit', (event) => handleSubmit(event, 'vehicule'));
    }

    const inspectionItemForm = document.getElementById('inspectionItemForm');
    if (inspectionItemForm) {
      inspectionItemForm.addEventListener('submit', (event) => handleSubmit(event, 'inspectionItem'));
    }

    // Modal Close Handlers
    const modalContainer = document.getElementById('modalContainer');
    if (modalContainer) {
      modalContainer.addEventListener('click', (event) => {
        if (event.target === modalContainer) {
          if (confirm('Are you sure you want to close without saving?')) {
            closeModal();
          }
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
  
  // Form submission handlers
  document.getElementById('userForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const password = formData.get('password');
    
    if (password.length < 4) {
      showToast('Password must be at least 4 characters long', 'error');
      return;
    } 
    
    if(formData.get('confirmPassword') !== password) {
      showToast('Passwords do not match', 'error');
      return;
    }
    
    if (formData.get('email') instanceof EmailAddress) {
      showToast('Email is required', 'error');
      return;
    }

    try {
      // Check for duplicate username
      const username = formData.get('username');
      const response = await fetch(`/admin/users/check-username?username=${encodeURIComponent(username)}`);
      const data = await response.json();
      
      if (data.exists) {
        showToast('Username already exists', 'error');
        return;
      }
      
      // Submit the form
      const submitResponse = await fetch('/admin/users', {
        method: 'POST',
        body: formData
      });
      
      if (!submitResponse.ok) throw new Error('Failed to create user');
      
      showToast('User created successfully', 'success');
      closeModal();
      location.reload();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
  
  document.getElementById('inspectionItemForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    
    // Handle category
    if (formData.get('category') === 'new') {
      formData.set('category', formData.get('newCategory'));
    }
    
    // Handle options if type is 'options'
    if (formData.get('type') === 'options') {
      const options = [];
      const labels = formData.getAll('optionLabel[]');
      const icons = formData.getAll('optionIcon[]');
      
      for (let i = 0; i < labels.length; i++) {
        options.push({
          id: i,
          label: labels[i],
          icon: icons[i].name ? await handleIconUpload(icons[i]) : defaultOptions[i]?.icon
        });
      }
      
      formData.set('options', JSON.stringify(options));
    }
    
    try {
      const response = await fetch('/admin/inspectionItems', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Failed to create inspection item');
      
      showToast('Inspection item created successfully', 'success');
      closeModal();
      location.reload();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
  
  // Handle icon upload
  const handleIconUpload = async (file) => {
    const formData = new FormData();
    formData.append('icon', file);
    
    try {
      const response = await fetch('/admin/upload-icon', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Failed to upload icon');
      
      const data = await response.json();
      return data.iconPath;
    } catch (error) {
      throw new Error('Failed to upload icon');
    }
  };
  
  // Add event listeners for select changes
  document.getElementById('itemCategory').addEventListener('change', handleCategoryChange);
  document.getElementById('itemType').addEventListener('change', handleTypeChange);

  // Add form submission handler for vehicles
  document.getElementById('vehiculeForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const vehiculeId = formData.get('vehicule_id');
    
    try {
      const response = await fetch(`/admin/vehicules${vehiculeId ? `/${vehiculeId}` : ''}`, {
        method: vehiculeId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(Object.fromEntries(formData)),
      });
      
      if (!response.ok) throw new Error('Failed to save vehicle');
      
      showToast(`Vehicule ${vehiculeId ? 'updated' : 'created'} successfully`, 'success');
      closeModal();
      location.reload();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  // Add these constants at the top
  const REPORT_STATUS_CLASSES = {
    'pending': 'bg-yellow-100 text-yellow-800',
    'completed': 'bg-green-100 text-green-800'
  };

  const REPORT_STATUS_LABELS = {
    'pending': 'En attente',
    'completed': 'Terminé'
  };

  // Add these functions
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