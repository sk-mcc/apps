// Selection tool display, search, sort, editing, and autosave
import {
  loadSchedule, listSchedules, batchUpdateSections, deleteSchedule
} from './selection-firebase.js';
import { requireAuth, logout, getCurrentUser } from './auth.js';
import { exportSelectionExcel } from './selection-export.js';

// ===== STATE =====
let currentSchedule = null;  // { id, metadata, sections, bundles }
let filteredIndices = null;   // null = show all, otherwise array of section indices to show
let sortColumn = null;
let sortAscending = true;

// ===== AUTOSAVE STATE =====
const pendingChanges = new Map(); // sectionIndex -> {facultySelection?, notes?}
let saveTimer = null;
let isSaving = false;
const SAVE_DELAY = 500;

// ===== BUNDLE COLORS (matches Excel export) =====
const BUNDLE_COLORS = [
  '#E3F2FD', '#F3E5F5', '#E8F5E9', '#FFF8E1',
  '#FCE4EC', '#E0F7FA', '#FBE9E7', '#F1F8E9',
];

// ===== DOM REFERENCES =====
let tableBody, searchInput, saveStatusEl, scheduleTitle, scheduleInfo;
let schedulePicker, scheduleListEl, exportBtn, deleteBtn, logoutBtn;

// ===== INITIALIZATION =====
export async function initSelectionTool() {
  // Auth guard
  const user = await requireAuth();
  if (!user) return;

  // Cache DOM references
  tableBody = document.getElementById('selection-table-body');
  searchInput = document.getElementById('search-input');
  saveStatusEl = document.getElementById('save-status');
  scheduleTitle = document.getElementById('schedule-title');
  scheduleInfo = document.getElementById('schedule-info');
  schedulePicker = document.getElementById('schedule-picker');
  scheduleListEl = document.getElementById('schedule-list');
  exportBtn = document.getElementById('export-btn');
  deleteBtn = document.getElementById('delete-btn');
  logoutBtn = document.getElementById('logout-btn');

  // Event listeners
  searchInput.addEventListener('input', handleSearch);
  exportBtn.addEventListener('click', handleExport);
  deleteBtn.addEventListener('click', handleDelete);
  logoutBtn.addEventListener('click', async () => {
    await logout();
    window.location.href = 'login.html';
  });

  // Column header sorting
  document.querySelectorAll('[data-sort-key]').forEach(th => {
    th.addEventListener('click', () => handleSort(th.dataset.sortKey));
  });

  // beforeunload: flush pending saves
  window.addEventListener('beforeunload', (e) => {
    if (pendingChanges.size > 0) {
      flushSaves();
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Check URL for schedule ID
  const params = new URLSearchParams(window.location.search);
  const scheduleId = params.get('id');

  if (scheduleId) {
    await loadAndDisplay(scheduleId);
  } else {
    await showSchedulePicker();
  }
}

// ===== SCHEDULE PICKER =====
async function showSchedulePicker() {
  schedulePicker.style.display = 'block';
  document.getElementById('schedule-view').style.display = 'none';

  const schedules = await listSchedules();

  if (schedules.length === 0) {
    scheduleListEl.innerHTML = `
      <div class="picker-empty">
        <p>No schedules found.</p>
        <p>Upload a schedule in the <a href="sort.html">Clean-Up Tool</a> and push it here, or use the direct upload below.</p>
      </div>
    `;
    return;
  }

  scheduleListEl.innerHTML = schedules.map(s => {
    const date = new Date(s.metadata.createdAt);
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
    return `
      <button class="picker-item" data-schedule-id="${s.id}">
        <span class="picker-item-title">${s.metadata.campus} Campus - ${s.metadata.semester || 'Unknown'}</span>
        <span class="picker-item-meta">${s.metadata.sectionCount} sections | ${dateStr}</span>
        <span class="picker-item-file">${s.metadata.sourceFilename || ''}</span>
      </button>
    `;
  }).join('');

  scheduleListEl.querySelectorAll('.picker-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.scheduleId;
      window.history.replaceState(null, '', `?id=${id}`);
      loadAndDisplay(id);
    });
  });
}

// ===== LOAD & DISPLAY =====
async function loadAndDisplay(scheduleId) {
  try {
    schedulePicker.style.display = 'none';
    document.getElementById('schedule-view').style.display = 'block';
    document.getElementById('loading').classList.add('visible');

    currentSchedule = await loadSchedule(scheduleId);

    // Ensure sections is an array (Firebase may return object with numeric keys)
    if (currentSchedule.sections && !Array.isArray(currentSchedule.sections)) {
      currentSchedule.sections = Object.values(currentSchedule.sections);
    }
    if (currentSchedule.bundles && !Array.isArray(currentSchedule.bundles)) {
      currentSchedule.bundles = Object.values(currentSchedule.bundles);
    }

    const m = currentSchedule.metadata;
    scheduleTitle.textContent = `${m.campus} Campus - ${m.semester || ''}`;
    scheduleInfo.textContent = `${m.sectionCount} sections | ${m.sourceFilename || ''}`;

    filteredIndices = null;
    sortColumn = null;
    renderTable();
    updateSaveStatus('saved');

    document.getElementById('loading').classList.remove('visible');
  } catch (err) {
    document.getElementById('loading').classList.remove('visible');
    document.getElementById('schedule-view').style.display = 'none';
    schedulePicker.style.display = 'block';
    alert(`Failed to load schedule: ${err.message}`);
    await showSchedulePicker();
  }
}

// ===== TABLE RENDERING =====
function renderTable() {
  if (!currentSchedule || !currentSchedule.sections) {
    tableBody.innerHTML = '<tr><td colspan="16" class="table-empty">No sections to display</td></tr>';
    return;
  }

  const sections = currentSchedule.sections;
  const indicesToShow = filteredIndices || sections.map((_, i) => i);

  // If search is active, expand to include full bundles
  const expandedIndices = expandBundleIndices(indicesToShow, sections);

  if (expandedIndices.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="16" class="table-empty">No matching sections</td></tr>';
    return;
  }

  const html = expandedIndices.map(idx => {
    const s = sections[idx];
    if (!s) return '';

    const bundleColor = s.bundleColorIndex >= 0
      ? BUNDLE_COLORS[s.bundleColorIndex % BUNDLE_COLORS.length]
      : '';

    const rowClasses = [];
    if (s.isFirstInBundle) rowClasses.push('bundle-first');
    if (s.isLastInBundle) rowClasses.push('bundle-last');
    if (s.bundleId) rowClasses.push('bundle-member');

    const style = bundleColor ? `style="--bundle-color: ${bundleColor}"` : '';

    return `<tr class="${rowClasses.join(' ')}" ${style} data-index="${idx}">
      <td>${esc(s.course)}</td>
      <td>${esc(s.section)}</td>
      <td>${esc(s.mode)}</td>
      <td>${esc(s.campus)}</td>
      <td class="text-center">${esc(String(s.weeks))}</td>
      <td>${esc(s.days)}</td>
      <td>${esc(s.timeRange)}</td>
      <td>${esc(s.building)}</td>
      <td>${esc(s.room)}</td>
      <td>${esc(s.dateRange)}</td>
      <td class="text-center">${esc(String(s.capacity))}</td>
      <td class="text-center">${esc(String(s.eqHours || ''))}</td>
      <td>${esc(s.bundleId)}</td>
      <td class="cell-editable"><input type="text" class="cell-input cell-notes" value="${escAttr(s.notes || '')}" data-field="notes" data-index="${idx}" aria-label="Notes for ${s.course} ${s.section}"></td>
      <td class="cell-editable"><input type="text" class="cell-input cell-faculty" value="${escAttr(s.facultySelection || '')}" data-field="facultySelection" data-index="${idx}" aria-label="Faculty selection for ${s.course} ${s.section}"></td>
      <td class="cell-flags">${esc(s.flagsText || '').replace(/\n/g, '<br>')}</td>
    </tr>`;
  }).join('');

  tableBody.innerHTML = html;

  // Attach input listeners for autosave
  tableBody.querySelectorAll('.cell-input').forEach(input => {
    input.addEventListener('input', handleCellInput);
  });
}

/**
 * Given a set of matching indices, expand to include all members of any matched bundle
 */
function expandBundleIndices(indices, sections) {
  if (!currentSchedule.bundles || currentSchedule.bundles.length === 0) {
    return indices;
  }

  const indexSet = new Set(indices);
  const expandedSet = new Set(indices);

  // For each matched section, if it's in a bundle, add all bundle members
  for (const idx of indexSet) {
    const s = sections[idx];
    if (s && s.bundleId) {
      // Find all sections with the same bundleId
      sections.forEach((other, otherIdx) => {
        if (other.bundleId === s.bundleId) {
          expandedSet.add(otherIdx);
        }
      });
    }
  }

  // Return sorted to preserve display order
  return [...expandedSet].sort((a, b) => a - b);
}

// ===== SEARCH =====
function handleSearch() {
  const query = searchInput.value.trim().toLowerCase();

  if (!query) {
    filteredIndices = null;
    renderTable();
    return;
  }

  const sections = currentSchedule.sections;
  const matchingIndices = [];

  sections.forEach((s, idx) => {
    const searchFields = [
      s.course, s.section, s.mode, s.campus, s.days, s.timeRange,
      s.building, s.room, s.dateRange, s.bundleId, s.notes,
      s.facultySelection, s.flagsText, s.primaryFaculty, s.sectionName,
      String(s.capacity), String(s.weeks)
    ].map(f => (f || '').toLowerCase());

    if (searchFields.some(f => f.includes(query))) {
      matchingIndices.push(idx);
    }
  });

  filteredIndices = matchingIndices;
  renderTable();
}

// ===== COLUMN SORTING =====
function handleSort(key) {
  if (sortColumn === key) {
    sortAscending = !sortAscending;
  } else {
    sortColumn = key;
    sortAscending = true;
  }

  // Update header indicators
  document.querySelectorAll('[data-sort-key]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sortKey === key) {
      th.classList.add(sortAscending ? 'sort-asc' : 'sort-desc');
    }
  });

  const sections = currentSchedule.sections;

  // Build sorted indices, keeping bundles grouped
  const bundleGroups = new Map(); // bundleId -> [indices]
  const unbundled = [];

  sections.forEach((s, idx) => {
    if (s.bundleId) {
      if (!bundleGroups.has(s.bundleId)) {
        bundleGroups.set(s.bundleId, []);
      }
      bundleGroups.get(s.bundleId).push(idx);
    } else {
      unbundled.push(idx);
    }
  });

  // Sort function for a section by the selected column
  const getValue = (idx) => {
    const s = sections[idx];
    switch (key) {
      case 'course': return s.course || '';
      case 'section': return s.section || '';
      case 'mode': return s.mode || '';
      case 'campus': return s.campus || '';
      case 'weeks': return s.weeks || 0;
      case 'days': return s.days || '';
      case 'time': return s.timeRange || '';
      case 'building': return s.building || '';
      case 'room': return s.room || '';
      case 'dates': return s.dateRange || '';
      case 'capacity': return s.capacity || 0;
      case 'eqHours': return s.eqHours || '';
      case 'bundleId': return s.bundleId || '';
      case 'notes': return s.notes || '';
      case 'faculty': return s.facultySelection || '';
      case 'flags': return s.flagsText || '';
      default: return '';
    }
  };

  const compare = (a, b) => {
    const va = getValue(a);
    const vb = getValue(b);
    if (typeof va === 'number' && typeof vb === 'number') {
      return sortAscending ? va - vb : vb - va;
    }
    const cmp = String(va).localeCompare(String(vb));
    return sortAscending ? cmp : -cmp;
  };

  // Sort unbundled sections
  unbundled.sort(compare);

  // Sort bundle groups by their first section's value
  const bundleEntries = [...bundleGroups.entries()];
  bundleEntries.sort((a, b) => compare(a[1][0], b[1][0]));

  // Merge: bundles first (matching original convention), then unbundled
  const sortedIndices = [];
  bundleEntries.forEach(([, indices]) => {
    // Keep bundle internal order
    sortedIndices.push(...indices);
  });
  sortedIndices.push(...unbundled);

  // Apply filter if search is active
  if (filteredIndices) {
    const filterSet = new Set(filteredIndices);
    filteredIndices = sortedIndices.filter(i => filterSet.has(i));
  } else {
    filteredIndices = sortedIndices;
  }

  renderTable();
}

// ===== AUTOSAVE =====
function handleCellInput(e) {
  const input = e.target;
  const index = parseInt(input.dataset.index, 10);
  const field = input.dataset.field;
  const value = input.value;

  // Update local state immediately
  if (currentSchedule.sections[index]) {
    currentSchedule.sections[index][field] = value;
  }

  // Track pending change
  if (!pendingChanges.has(index)) {
    pendingChanges.set(index, {});
  }
  pendingChanges.get(index)[field] = value;

  // Debounce save
  updateSaveStatus('pending');
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSaves, SAVE_DELAY);
}

async function flushSaves() {
  if (pendingChanges.size === 0 || isSaving) return;

  isSaving = true;
  updateSaveStatus('saving');

  const updates = [];
  pendingChanges.forEach((fields, index) => {
    updates.push({ index, fields });
  });
  pendingChanges.clear();

  try {
    await batchUpdateSections(currentSchedule.id, updates);
    updateSaveStatus('saved');
  } catch (err) {
    console.error('Save failed:', err);
    // Re-queue failed updates
    updates.forEach(({ index, fields }) => {
      if (!pendingChanges.has(index)) {
        pendingChanges.set(index, {});
      }
      Object.assign(pendingChanges.get(index), fields);
    });
    updateSaveStatus('error');
  } finally {
    isSaving = false;
  }

  // If more changes came in while saving, flush again
  if (pendingChanges.size > 0) {
    saveTimer = setTimeout(flushSaves, SAVE_DELAY);
  }
}

function updateSaveStatus(status) {
  if (!saveStatusEl) return;
  saveStatusEl.className = 'save-status';
  switch (status) {
    case 'saved':
      saveStatusEl.textContent = 'All changes saved';
      saveStatusEl.classList.add('save-saved');
      break;
    case 'saving':
      saveStatusEl.textContent = 'Saving...';
      saveStatusEl.classList.add('save-saving');
      break;
    case 'pending':
      saveStatusEl.textContent = 'Unsaved changes';
      saveStatusEl.classList.add('save-pending');
      break;
    case 'error':
      saveStatusEl.textContent = 'Save failed - retrying...';
      saveStatusEl.classList.add('save-error');
      break;
  }
}

// ===== EXPORT =====
async function handleExport() {
  if (!currentSchedule) return;
  exportBtn.disabled = true;
  exportBtn.textContent = 'Exporting...';

  try {
    await exportSelectionExcel(currentSchedule);
  } catch (err) {
    alert(`Export failed: ${err.message}`);
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = 'Export Excel';
  }
}

// ===== DELETE =====
async function handleDelete() {
  if (!currentSchedule) return;
  if (!confirm(`Delete "${currentSchedule.metadata.campus} Campus - ${currentSchedule.metadata.semester}"? This cannot be undone.`)) {
    return;
  }

  try {
    await deleteSchedule(currentSchedule.id);
    currentSchedule = null;
    window.history.replaceState(null, '', 'south.html');
    await showSchedulePicker();
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
  }
}

// ===== BACK TO PICKER =====
export function backToPicker() {
  // Flush any pending saves first
  if (pendingChanges.size > 0) {
    flushSaves();
  }
  currentSchedule = null;
  filteredIndices = null;
  sortColumn = null;
  window.history.replaceState(null, '', 'south.html');
  showSchedulePicker();
}

// ===== HELPERS =====
function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
