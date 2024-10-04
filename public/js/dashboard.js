document.addEventListener('DOMContentLoaded', () => {
  const previewButtons = document.querySelectorAll('.preview-btn');
  const pdfPreviewFrame = document.getElementById('pdfPreviewFrame');

  previewButtons.forEach(button => {
    button.addEventListener('click', () => {
      const reportId = button.getAttribute('data-id');
      pdfPreviewFrame.src = `/preview/${reportId}`;
      $('#pdfPreviewModal').modal('show');
    });
  });
});