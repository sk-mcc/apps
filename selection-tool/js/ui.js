// UI functions for the Selection Sheet Tool

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

function renderResults() {
  uploadArea.style.display = 'none';
  resultsEl.classList.add('visible');

  // Render file list
  fileListEl.innerHTML = processedFiles.map(f => {
    const displayName = f.semesterCode && f.campusName
      ? `${f.semesterCode}_${f.campusName}`
      : f.semesterCode || f.filename;
    return `
      <div class="file-item" role="listitem">
        <span class="file-check" aria-hidden="true">✓</span>
        <span class="file-name">${displayName}</span>
        <span class="file-status">— Ready (${f.processedSections.length} sections)</span>
      </div>
    `;
  }).join('');

  // Render flagged items
  const allFlags = [];
  processedFiles.forEach(f => {
    const displayName = f.semesterCode && f.campusName
      ? `${f.semesterCode}_${f.campusName}`
      : f.filename;
    f.detectedFlags.forEach(flag => {
      allFlags.push({
        file: displayName,
        section: flag.section,
        message: flag.message,
      });
    });
  });

  if (allFlags.length > 0) {
    flaggedToggle.textContent = `Preview flagged items (${allFlags.length})`;
    flaggedList.innerHTML = allFlags.map(f => `
      <li class="flagged-item">
        <span class="flagged-file">${f.file}</span> —
        ${f.section.course} ${f.section.section}: ${f.message}
      </li>
    `).join('');
  } else {
    flaggedToggle.style.display = 'none';
  }
}

function resetApp() {
  processedFiles.length = 0;
  resultsEl.classList.remove('visible');
  uploadArea.style.display = 'block';
  errorEl.classList.remove('visible');
  flaggedDetails.classList.remove('visible');
  flaggedToggle.setAttribute('aria-expanded', 'false');
  flaggedToggle.textContent = 'Preview flagged items';
  fileInput.value = '';
}
