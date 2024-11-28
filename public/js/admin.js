// File: public/js/admin.js

// Modal handling
const openModal = (type, id = null) => {
    const modalContainer = document.getElementById('modalContainer');
    const modal = document.getElementById(`${type}Modal`);
    
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
    if (titleElement) {
      titleElement.textContent = id ? `Edit ${capitalize(type)}` : `New ${capitalize(type)}`;
    }
    
    modalContainer.classList.remove('hidden');
    modal.classList.remove('hidden');
    
    if (id) {
      fetchEntityData(type, id);
    }
  };
  
  const closeModal = () => {
    const modalContainer = document.getElementById('modalContainer');
    const modals = modalContainer.querySelectorAll('[id$="Modal"]');
    modalContainer.classList.add('hidden');
    modals.forEach(modal => modal.classList.add('hidden'));
  };
  
  // Fetch entity data for editing
  const fetchEntityData = async (type, id) => {
    try {
      const response = await fetch(`/admin/${type}s/${id}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      
      const data = await response.json();
      
      if (type === 'user') {
        document.getElementById('userId').value = data.user_id;
        document.getElementById('username').value = data.username;
        document.getElementById('email').value = data.email || '';
        document.getElementById('role').value = data.role;
        document.getElementById('password').required = false;
      }

      if (type === 'inspectionItem') {
        document.getElementById('itemName').value = data.inspectionItem.name;
        document.getElementById('itemType').value = data.inspectionItem.type;
        document.getElementById('itemCategory').value = data.inspectionItem.category;
        document.getElementById('itemActive').checked = data.inspectionItem.is_active;
        document.getElementById('itemDisplayOrder').value = data.inspectionItem.display_order;
      }
      // Handle other entity types...
    } catch (error) {
      //showToast(error.message, 'error');
      console.log(error);
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
    
    if (type === 'inspectionItem') {
      data.is_active = formData.has('is_active') ? 0 : 1;
      // Handle category
      if (data.category === 'new') {
        data.is_active = 1;
        data.category = formData.get('newCategory').trim();
      } else {
        // Get the count of items in the new category
        const categoryCount = document.getElementById('itemCategory').options[document.getElementById('itemCategory').selectedIndex].getAttribute('count');
        data.display_order = parseInt(categoryCount) + 1;
      }
    }
    
    // Remove empty password when editing
    if (id && !data.password) {
      delete data.password;
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
    if (!confirm('Are you sure you want to delete this item?')) return;
    
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
  
  // Initialize Event Listeners
  const initEventListeners = () => {
  
    // New User Button
    const newUserBtn = document.getElementById('new-user-btn');
    if (newUserBtn) {
      newUserBtn.addEventListener('click', () => openModal('user'));
    }

    // New Inspection Item Button
    const newInspectionItemBtn = document.getElementById('new-inspection-item-btn');
    if (newInspectionItemBtn) {
      newInspectionItemBtn.addEventListener('click', () => openModal('inspectionItem'));
    }

    // New Add Option Button
    const newOptionBtn = document.getElementById('new-option-btn');
    if (newOptionBtn) {
      newOptionBtn.addEventListener('click', () => addOption());
    }
  
    // Edit and Delete Buttons for Inspection Items
    const editInspectionItemButtons = document.querySelectorAll('.edit-inspection-item-btn');
    editInspectionItemButtons.forEach(button => {
      button.addEventListener('click', () => {
        const inspectionItemId = button.getAttribute('data-id');
        openModal('inspectionItem', inspectionItemId);
      });
    });
  
    const deleteInspectionItemButtons = document.querySelectorAll('.delete-inspection-item-btn');
    deleteInspectionItemButtons.forEach(button => {
      button.addEventListener('click', () => {
        const inspectionItemId = button.getAttribute('data-id');
        deleteEntity('inspectionItem', inspectionItemId);
      });
    });

    // Edit and Delete Buttons for Vehicles
    const editVehicleButtons = document.querySelectorAll('.edit-vehicule-btn');
    editVehicleButtons.forEach(button => {
      button.addEventListener('click', () => {
        const vehiculeId = button.getAttribute('data-id');
        openModal('vehicule', vehiculeId);
      });
    });

    const deleteVehicleButtons = document.querySelectorAll('.delete-vehicule-btn');
    deleteVehicleButtons.forEach(button => {
      button.addEventListener('click', () => {
        const vehiculeId = button.getAttribute('data-id');
        deleteEntity('vehicule', vehiculeId);
      });
    });
  
    // Edit and Delete Buttons for Users
    const editUserButtons = document.querySelectorAll('.edit-user-btn');
    editUserButtons.forEach(button => {
      button.addEventListener('click', () => {
        const userId = button.getAttribute('data-id');
        openModal('user', userId);
      });
    });
  
    const deleteUserButtons = document.querySelectorAll('.delete-user-btn');
    deleteUserButtons.forEach(button => {
      button.addEventListener('click', () => {
        const userId = button.getAttribute('data-id');
        deleteEntity('user', userId);
      });
    });
  
    // Handle Form Submissions
    const userForm = document.getElementById('userForm');
    if (userForm) {
      userForm.addEventListener('submit', (event) => handleSubmit(event, 'user'));
    }
  
    const inspectionItemForm = document.getElementById('inspectionItemForm');
    if (inspectionItemForm) {
      inspectionItemForm.addEventListener('submit', (event) => handleSubmit(event, 'inspectionItem'));
    }
  
    // Cancel Modal Button
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    if (cancelModalBtn) {
      cancelModalBtn.addEventListener('click', closeModal);
    }

    const cancelInspectionItemModalBtn = document.getElementById('cancelInspectionItemModalBtn');
    if (cancelInspectionItemModalBtn) {
      cancelInspectionItemModalBtn.addEventListener('click', closeModal);
    }
  
    // Click outside modal to close
    const modalContainer = document.getElementById('modalContainer');
    if (modalContainer) {
      modalContainer.addEventListener('click', (event) => {
        if (event.target === event.currentTarget) {
          closeModal();
        }
      });
    }
  };
  
  // View Report Function (Assuming it's defined elsewhere)
  const viewReport = (reportId) => {
    // Implement viewReport functionality
  };
  
  // Initialize after DOM is fully loaded
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