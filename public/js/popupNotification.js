// Reusable popup function
function createPopup(options = {}) {
    const {
      message = '',
      type = 'success',
      duration = 5000,
      position = 'bottom-right'
    } = options;
  
    // Create container if it doesn't exist
    let container = document.querySelector('.popup-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'popup-container';
      document.body.appendChild(container);
    }
  
    // Set container position
    switch (position) {
      case 'top-right':
        container.style.top = '20px';
        container.style.bottom = 'auto';
        break;
      case 'top-left':
        container.style.top = '20px';
        container.style.left = '20px';
        container.style.right = 'auto';
        container.style.bottom = 'auto';
        break;
      case 'bottom-left':
        container.style.left = '20px';
        container.style.right = 'auto';
        break;
      // 'bottom-right' is default, no need to change styles
    }
  
    // Create popup element
    const popup = document.createElement('div');
    popup.className = 'popup';
  
    // Set type-specific styles
    switch (type) {
      case 'error':
        popup.style.backgroundColor = '#ffebee';
        popup.style.borderLeftColor = '#f44336';
        popup.style.color = '#b71c1c';
        break;
      case 'warning':
        popup.style.backgroundColor = '#fff3e0';
        popup.style.borderLeftColor = '#ff9800';
        popup.style.color = '#e65100';
        break;
      case 'info':
        popup.style.backgroundColor = '#e3f2fd';
        popup.style.borderLeftColor = '#2196f3';
        popup.style.color = '#0d47a1';
        break;
      // 'success' is default, no need to change styles
    }
  
    // Set content
    popup.innerHTML = `
      <span class="popup-icon">${type === 'success' ? '✔️' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
      <span class="popup-content">${message}</span>
      <button class="popup-close">&times;</button>
    `;
  
    // Add to container
    container.appendChild(popup);
  
    // Show animation
    setTimeout(() => popup.classList.add('show'), 10);
  
    // Close function
    const close = () => {
      popup.classList.remove('show');
      popup.addEventListener('transitionend', () => {
        popup.remove();
        if (container.children.length === 0) {
          container.remove();
        }
      });
    };
  
    // Auto close after duration
    const autoCloseTimeout = setTimeout(close, duration);
  
    // Close button event
    popup.querySelector('.popup-close').addEventListener('click', () => {
      clearTimeout(autoCloseTimeout);
      close();
    });
  
    // Return close function for programmatic closing
    return close;
  }
  
  // Usage examples:
  // createPopup({ message: 'Rapport supprimé avec succès' });
  // createPopup({ message: 'Une erreur est survenue', type: 'error', duration: 3000 });
  // createPopup({ message: 'Attention!', type: 'warning', position: 'top-right' });
  // const closePopup = createPopup({ message: 'Chargement en cours...', type: 'info', duration: Infinity });
  // // Later, to close programmatically:
  // closePopup();