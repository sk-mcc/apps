// Main entry point for Campus Sorter

// ===== STATE =====
let sortedData = null;
let originalFilename = '';

// ===== DOM ELEMENTS =====
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error-message');
const resultsEl = document.getElementById('results');
const fileInfoEl = document.getElementById('file-info');
const campusSummaryEl = document.getElementById('campus-summary');
const downloadAllBtn = document.getElementById('download-all-btn');
const downloadCombinedBtn = document.getElementById('download-combined-btn');
const downloadCenterBtn = document.getElementById('download-center-btn');
const downloadSouthBtn = document.getElementById('download-south-btn');
const downloadOnlineBtn = document.getElementById('download-online-btn');
const resetBtn = document.getElementById('reset-btn');

// ===== EVENT LISTENERS =====
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files).filter(f =>
    f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
  );
  if (files.length > 0) {
    handleFile(files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (files.length > 0) {
    handleFile(files[0]);
  }
});

downloadAllBtn.addEventListener('click', downloadAllFiles);
downloadCombinedBtn.addEventListener('click', () => downloadCombinedSpreadsheet(false));
downloadCenterBtn.addEventListener('click', downloadCenterOnly);
downloadSouthBtn.addEventListener('click', downloadSouthOnly);
downloadOnlineBtn.addEventListener('click', downloadOnlineOnly);

resetBtn.addEventListener('click', () => {
  sortedData = null;
  originalFilename = '';
  resultsEl.classList.remove('visible');
  uploadArea.style.display = 'block';
  errorEl.classList.remove('visible');
  fileInput.value = '';
});

// ===== FILE HANDLING =====
function showLoading(show) {
  loadingEl.classList.toggle('visible', show);
  if (show) {
    uploadArea.style.display = 'none';
  }
}

function showError(message) {
  if (message) {
    errorEl.textContent = message;
    errorEl.classList.add('visible');
  } else {
    errorEl.classList.remove('visible');
  }
}

async function handleFile(file) {
  showLoading(true);
  showError(null);
  originalFilename = file.name;

  try {
    await processUploadedFile(file);
    renderResults();
  } catch (err) {
    showError(`Error processing ${file.name}: ${err.message}`);
    uploadArea.style.display = 'block';
  }

  showLoading(false);
}

function processUploadedFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);

        // Read with dates parsed for processing
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const originalData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

        // Read again without date parsing for output
        const rawWorkbook = XLSX.read(data, { type: 'array', cellDates: false });
        const rawFirstSheet = rawWorkbook.Sheets[rawWorkbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(rawFirstSheet, { header: 1, defval: '', raw: false });

        // Process and sort by campus
        sortedData = processFileForSort(originalData, rawData);

        resolve();
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

function renderResults() {
  uploadArea.style.display = 'none';
  resultsEl.classList.add('visible');

  // File info
  fileInfoEl.innerHTML = `
    <div class="file-item" role="listitem">
      <span class="file-check" aria-hidden="true">✓</span>
      <span class="file-name">${originalFilename}</span>
      <span class="file-status">— ${sortedData.counts.total} sections found</span>
    </div>
  `;

  // Campus summary
  campusSummaryEl.innerHTML = `
    <div class="summary-grid">
      <div class="summary-item">
        <span class="summary-count">${sortedData.counts.center}</span>
        <span class="summary-label">Center Campus</span>
      </div>
      <div class="summary-item">
        <span class="summary-count">${sortedData.counts.south}</span>
        <span class="summary-label">South Campus</span>
      </div>
      <div class="summary-item">
        <span class="summary-count">${sortedData.counts.online}</span>
        <span class="summary-label">Online</span>
      </div>
      ${sortedData.counts.unknown > 0 ? `
        <div class="summary-item summary-warning">
          <span class="summary-count">${sortedData.counts.unknown}</span>
          <span class="summary-label">Unknown</span>
        </div>
      ` : ''}
    </div>
  `;

  // Update button states
  downloadCenterBtn.disabled = sortedData.counts.center === 0;
  downloadSouthBtn.disabled = sortedData.counts.south === 0;
  downloadOnlineBtn.disabled = sortedData.counts.online === 0;

  // Update button text with counts
  downloadCenterBtn.textContent = `Center Campus (${sortedData.counts.center})`;
  downloadSouthBtn.textContent = `South Campus (${sortedData.counts.south})`;
  downloadOnlineBtn.textContent = `Online (${sortedData.counts.online})`;
}
