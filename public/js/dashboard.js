document.addEventListener('DOMContentLoaded', function() {
  const pdfPreviewModal = document.getElementById('pdfPreviewModal');
  const pdfPreviewFrame = document.getElementById('pdfPreviewFrame');
  const deleteConfirmModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  let reportToDelete = null;

  // Event delegation for preview buttons
  document.addEventListener('click', function(event) {
    if (event.target.matches('.preview-btn')) {
      const reportId = event.target.getAttribute('data-report-id');
      console.log(`Preview requested for report ID: ${reportId}`);
      pdfPreviewFrame.src = `/report/preview/${reportId}`;
      $(pdfPreviewModal).modal('show');
    }
  });

  // Modal event listeners
  $(pdfPreviewModal).on('shown.bs.modal', () => console.log('PDF preview modal opened'));
  $(pdfPreviewModal).on('hidden.bs.modal', () => console.log('PDF preview modal closed'));

  // Event delegation for delete buttons
  document.addEventListener('click', function(event) {
    if (event.target.matches('.delete-btn')) {
      reportToDelete = event.target.getAttribute('data-report-id');
      deleteConfirmModal.show();
    }
  });

  // Confirm delete button click handler
  confirmDeleteBtn.addEventListener('click', function() {
    if (reportToDelete) {
      deleteReport(reportToDelete);
    }
  });

  // Function to delete a report
  const deleteReport = (reportId) => {
    fetch(`/report/delete/${reportId}`, { method: 'DELETE' })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          removeReportRow(reportId);
          createPopup({ message: 'Rapport supprimé avec succès', type: 'success' });
        } else {
          createPopup({ message: 'Erreur lors de la suppression du rapport', type: 'error' });
        }
      })
      .catch(error => {
        console.error('Error:', error);
        createPopup({ message: 'Une erreur est survenue lors de la suppression du rapport', type: 'error' });
      })
      .finally(() => {
        deleteConfirmModal.hide();
        reportToDelete = null;
      });
  };

  // Function to remove a report row from the table
  const removeReportRow = (reportId) => {
    const row = document.querySelector(`[data-report-id="${reportId}"]`).closest('tr');
    if (row) row.remove();
  };
});