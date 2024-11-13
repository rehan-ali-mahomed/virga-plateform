document.addEventListener('DOMContentLoaded', () => {
  let reportToDelete = null;
  const deleteConfirmModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));

  // Handle delete button clicks
  document.querySelectorAll('.delete-report').forEach(button => {
    button.addEventListener('click', function() {
      reportToDelete = this.dataset.reportId;
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
});