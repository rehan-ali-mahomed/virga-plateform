document.addEventListener('DOMContentLoaded', function() {
  const previewButtons = document.querySelectorAll('.preview-btn');
  const pdfPreviewModal = document.getElementById('pdfPreviewModal');
  const pdfPreviewFrame = document.getElementById('pdfPreviewFrame');

  previewButtons.forEach(button => {
    button.addEventListener('click', function() {
      const reportId = this.getAttribute('data-report-id');
      console.log(`Preview requested for report ID: ${reportId}`);
      pdfPreviewFrame.src = `/report/${reportId}/preview`;
      $(pdfPreviewModal).modal('show');
    });
  });

  // Log when modal is shown and hidden
  $(pdfPreviewModal).on('shown.bs.modal', function () {
    console.log('PDF preview modal opened');
  });

  $(pdfPreviewModal).on('hidden.bs.modal', function () {
    console.log('PDF preview modal closed');
  });
});