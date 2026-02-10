// Main entry point for the Selection Sheet Tool

// ===== STATE =====
const processedFiles = []; // Array of { filename, semesterCode, campusName, processedSections, detectedBundles, detectedFlags, rawOriginalData, originalData }

// ===== DOM ELEMENTS =====
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error-message');
const resultsEl = document.getElementById('results');
const fileListEl = document.getElementById('file-list');
const downloadAllBtn = document.getElementById('download-all-btn');
const flaggedToggle = document.getElementById('flagged-toggle');
const flaggedDetails = document.getElementById('flagged-details');
const flaggedList = document.getElementById('flagged-list');
const addMoreBtn = document.getElementById('add-more-btn');
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
    handleFiles(files);
  }
});

fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (files.length > 0) {
    handleFiles(files);
  }
});

downloadAllBtn.addEventListener('click', downloadAll);

flaggedToggle.addEventListener('click', () => {
  const isExpanded = flaggedDetails.classList.toggle('visible');
  flaggedToggle.setAttribute('aria-expanded', isExpanded);
  flaggedToggle.textContent = isExpanded ? 'Hide flagged items' : 'Preview flagged items';
});

addMoreBtn.addEventListener('click', () => {
  fileInput.click();
});

resetBtn.addEventListener('click', resetApp);

// ===== FILE HANDLING =====
async function handleFiles(files) {
  showLoading(true);
  showError(null);

  for (const file of files) {
    try {
      await processFile(file);
    } catch (err) {
      showError(`Error processing ${file.name}: ${err.message}`);
    }
  }

  showLoading(false);
  if (processedFiles.length > 0) {
    renderResults();
  }
}

function processFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);

        // Read with dates parsed for processing
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const originalData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

        // Read again without date parsing for Original Data sheet
        const rawWorkbook = XLSX.read(data, { type: 'array', cellDates: false });
        const rawFirstSheet = rawWorkbook.Sheets[rawWorkbook.SheetNames[0]];
        const rawOriginalData = XLSX.utils.sheet_to_json(rawFirstSheet, { header: 1, defval: '', raw: false });

        // Detect header row
        const headerRow = detectHeaderRow(originalData);
        if (headerRow === -1) {
          throw new Error('Could not detect header row');
        }

        // Process sections
        const result = processData(originalData, rawOriginalData, headerRow);

        // Check if already have this file
        const existingIndex = processedFiles.findIndex(f => f.filename === file.name);
        if (existingIndex >= 0) {
          processedFiles[existingIndex] = { filename: file.name, ...result };
        } else {
          processedFiles.push({ filename: file.name, ...result });
        }

        resolve();
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
