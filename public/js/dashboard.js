document.addEventListener('DOMContentLoaded', () => {
  let reportToDelete = null;
  const deleteConfirmModal = new bootstrap.Modal(document.getElementById('deleteModal'));

  document.querySelectorAll('button.action-btn.delete').forEach(button => {
    button.addEventListener('click', function() {
      reportToDelete = this.dataset.reportId;
      deleteConfirmModal.show();
    });
  });
  
  // Handle delete confirmation
  document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (!reportToDelete) return;

    try {
      const response = await fetch(`/report/delete/${reportToDelete}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      deleteConfirmModal.hide();

      const data = await response.json();

      if (data.success) {
        // Remove the row from the table
        const row = document.querySelector(`[data-report-id="${reportToDelete}"]`).closest('tr');
        row.remove();

        // Show success message
        showNotification('Rapport supprimé avec succès', 'success');
      } else {
        showNotification('Erreur lors de la suppression du rapport', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showNotification('Erreur lors de la suppression du rapport', 'error');
    } finally {
      deleteConfirmModal.hide();
      reportToDelete = null;
    }
  });

  // Notification helper function
  const showNotification = (message, type) => {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'success' ? 'success' : 'danger'} notification`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  };

  // Search functionality
  const searchInput = document.getElementById('searchReports');
  let searchTimeout;

  const updateTable = (reports) => {
    const tbody = document.querySelector('.reports-table tbody');
    if (!reports.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="no-reports">
            <i class="fas fa-info-circle"></i>
            <p>Aucun rapport trouvé</p>
            <a href="/form" class="btn btn-primary mt-3">
              <i class="fas fa-plus"></i>
              Créer un nouveau rapport
            </a>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = reports.map(report => `
      <tr class="report-row" data-report='${JSON.stringify(report)}'>
        <td class="license-plate">${report.license_plate}</td>
        <td>${report.client_name}</td>
        <td>${report.brand && report.model ? `${report.brand} | ${report.model}` : 'N/A'}</td>
        <td>${new Date(report.created_at).toLocaleDateString('fr-FR')}</td>
        <td>
          <div class="action-buttons">
            <a href="/report/${report.report_id}" 
               class="action-btn view" 
               title="Voir le rapport">
              <i class="fas fa-eye"></i>
            </a>
            <a href="/report/preview/${report.report_id}" 
               class="action-btn preview" 
               title="Prévisualiser PDF"
               target="_blank">
              <i class="fas fa-file-pdf"></i>
            </a>
            <a href="/report/download/${report.report_id}" 
               class="action-btn download" 
               title="Télécharger">
              <i class="fas fa-download"></i>
            </a>  
            <a href="/form/${report.report_id}"
               class="action-btn edit"
               title="Modifier">
              <i class="fa-regular fa-pen-to-square"></i>
            </a>
            <button class="action-btn delete"
                    data-report-id="${report.report_id}"
                    title="Supprimer">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Reattach delete event listeners
    attachDeleteListeners();
  };

  const handleSearch = async () => {
    const searchValue = searchInput.value.trim();
    try {
      const response = await fetch(`/dashboard?search=${encodeURIComponent(searchValue)}`, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      const data = await response.json();
      updateTable(data.reports);
    } catch (error) {
      console.error('Search error:', error);
      showNotification('Erreur lors de la recherche', 'error');
    }
  };

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(handleSearch, 300);
  });

  const attachDeleteListeners = () => {
    document.querySelectorAll('button.action-btn.delete').forEach(button => {
      button.addEventListener('click', function() {
        reportToDelete = this.dataset.reportId;
        deleteConfirmModal.show();
      });
    });
  };
});