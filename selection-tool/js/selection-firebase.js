// Firebase CRUD operations for selection schedules
import {
  db, ref, push, set, get, update, onValue, off
} from './firebase-config.js';
import { getCurrentUser } from './auth.js';

const SCHEDULES_PATH = 'selection-schedules';

/**
 * Push processed schedule data to Firebase
 * @param {object} params
 * @param {object} params.processedData - Output of processRowsForSelectionSheet()
 * @param {string} params.campus - Campus name (e.g., "South")
 * @param {string} params.semesterCode - Semester code (e.g., "F26")
 * @param {string} params.sourceFilename - Original uploaded filename
 * @param {Array} params.rawHeaders - Raw header row for export
 * @param {Array} params.campusRows - Raw campus rows for export [{row, isEAPP, originalIndex}]
 * @returns {Promise<string>} Schedule ID
 */
export async function pushScheduleToFirebase({
  processedData, campus, semesterCode, sourceFilename, rawHeaders, campusRows
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { processedSections, detectedBundles, detectedFlags, assignedSections } = processedData;

  // Build lookup maps for pre-computed display fields (same logic as addSelectionSheet)
  const sectionToBundleIndex = {};
  detectedBundles.forEach((b, idx) => {
    b.sections.forEach((s) => {
      sectionToBundleIndex[s.id] = idx;
    });
  });

  // Determine which eq hours should be in parentheses
  const eqHoursInParensSet = new Set();
  detectedBundles.forEach((bundle) => {
    const bundleSectionIds = new Set(bundle.sections.map(s => s.id));
    const non1170InOrder = processedSections.filter(s =>
      bundleSectionIds.has(s.id) && s.course !== 'ENGL 1170'
    );
    non1170InOrder.slice(1).forEach(s => {
      eqHoursInParensSet.add(s.id);
    });
  });

  // Build bundle lookup for borders
  const bundleLookup = {};
  processedSections.forEach((s, rowIdx) => {
    const bundleIdx = sectionToBundleIndex[s.id];
    if (bundleIdx === undefined) return;

    const bundle = detectedBundles[bundleIdx];
    const prevSection = processedSections[rowIdx - 1];
    const prevInSameBundle = prevSection && sectionToBundleIndex[prevSection.id] === bundleIdx;
    const nextSection = processedSections[rowIdx + 1];
    const nextInSameBundle = nextSection && sectionToBundleIndex[nextSection.id] === bundleIdx;

    bundleLookup[s.id] = {
      id: bundle.id,
      colorIndex: bundleIdx % 8,
      isFirst: !prevInSameBundle,
      isLast: !nextInSameBundle,
      bundleIndex: bundleIdx
    };
  });

  // Build flag lookup
  const flagLookup = {};
  detectedFlags.forEach(f => {
    const flagMsg = '\u26A0\uFE0F ' + f.message;
    if (flagLookup[f.section.id]) {
      flagLookup[f.section.id] += '\n' + flagMsg;
    } else {
      flagLookup[f.section.id] = flagMsg;
    }
  });

  // Build sections array with pre-computed display fields
  const sections = processedSections.map((s, idx) => {
    const bundleInfo = bundleLookup[s.id] || null;
    const eqHoursValue = typeof window.getEquatedHours === 'function' ? window.getEquatedHours(s.course) : '';
    const eqHoursInParens = eqHoursInParensSet.has(s.id);
    const eqHoursDisplay = eqHoursInParens && eqHoursValue ? `(${eqHoursValue})` : eqHoursValue;

    let notesDefault = '';
    if (s.mode === 'Hybrid') notesDefault = '[HYBRID]';
    if (s.mode === 'Remote') notesDefault = '[REMOTE]';

    return {
      // Section data
      id: s.id,
      sectionName: s.sectionName || '',
      subject: s.subject || '',
      courseNum: s.courseNum || '',
      modeCode: s.modeCode || '',
      sequence: s.sequence || '',
      section: s.section || '',
      course: s.course || '',
      mode: s.mode || '',
      campus: s.campus || '',
      dept: s.dept || '',
      days: s.days || '',
      timeRange: s.timeRange || '',
      building: s.building || '',
      room: s.room || '',
      startDate: s.startDate || '',
      endDate: s.endDate || '',
      dateRange: s.dateRange || '',
      capacity: s.capacity || 0,
      weeks: s.weeks || 16,
      primaryFaculty: s.primaryFaculty || '',
      // Pre-computed display fields
      bundleId: bundleInfo ? bundleInfo.id : '',
      bundleColorIndex: bundleInfo ? bundleInfo.colorIndex : -1,
      isFirstInBundle: bundleInfo ? bundleInfo.isFirst : false,
      isLastInBundle: bundleInfo ? bundleInfo.isLast : false,
      eqHours: eqHoursDisplay,
      eqHoursInParens: eqHoursInParens,
      notesDefault: notesDefault,
      flagsText: flagLookup[s.id] || '',
      // Editable fields (coordinator fills in during meeting)
      facultySelection: '',
      notes: notesDefault,
    };
  });

  // Build bundles array
  const bundles = detectedBundles.map((b, idx) => ({
    id: b.id,
    type: b.type,
    sectionIds: b.sections.map(s => {
      // Find the index in processedSections
      return processedSections.findIndex(ps => ps.id === s.id);
    }),
  }));

  // Build rawRows for export
  const rawRows = {
    headers: rawHeaders,
    rows: campusRows.map((r, idx) => ({
      data: r.row,
      isEAPP: r.isEAPP || false,
    })),
  };

  // Create the schedule entry
  const scheduleRef = push(ref(db, SCHEDULES_PATH));
  const scheduleId = scheduleRef.key;

  const scheduleData = {
    metadata: {
      campus,
      semester: semesterCode,
      createdAt: Date.now(),
      createdBy: user.email,
      updatedAt: Date.now(),
      status: 'active',
      sourceFilename: sourceFilename || '',
      sectionCount: sections.length,
    },
    sections,
    bundles,
    rawRows,
  };

  await set(scheduleRef, scheduleData);
  return scheduleId;
}

/**
 * List all schedules (metadata only)
 * @returns {Promise<Array<{id, metadata}>>}
 */
export async function listSchedules() {
  const snapshot = await get(ref(db, SCHEDULES_PATH));
  if (!snapshot.exists()) return [];

  const data = snapshot.val();
  return Object.entries(data).map(([id, schedule]) => ({
    id,
    metadata: schedule.metadata,
  })).sort((a, b) => (b.metadata.createdAt || 0) - (a.metadata.createdAt || 0));
}

/**
 * Load a schedule (sections + bundles + metadata, no rawRows)
 * @param {string} scheduleId
 * @returns {Promise<object>}
 */
export async function loadSchedule(scheduleId) {
  const metadataSnap = await get(ref(db, `${SCHEDULES_PATH}/${scheduleId}/metadata`));
  const sectionsSnap = await get(ref(db, `${SCHEDULES_PATH}/${scheduleId}/sections`));
  const bundlesSnap = await get(ref(db, `${SCHEDULES_PATH}/${scheduleId}/bundles`));

  if (!metadataSnap.exists()) throw new Error('Schedule not found');

  return {
    id: scheduleId,
    metadata: metadataSnap.val(),
    sections: sectionsSnap.exists() ? sectionsSnap.val() : [],
    bundles: bundlesSnap.exists() ? bundlesSnap.val() : [],
  };
}

/**
 * Load rawRows for export
 * @param {string} scheduleId
 * @returns {Promise<object>}
 */
export async function loadRawRows(scheduleId) {
  const snapshot = await get(ref(db, `${SCHEDULES_PATH}/${scheduleId}/rawRows`));
  if (!snapshot.exists()) return null;
  return snapshot.val();
}

/**
 * Update editable fields for a section
 * @param {string} scheduleId
 * @param {number} sectionIndex
 * @param {object} fields - {facultySelection?, notes?}
 */
export async function updateSectionFields(scheduleId, sectionIndex, fields) {
  const updates = {};
  if (fields.facultySelection !== undefined) {
    updates[`${SCHEDULES_PATH}/${scheduleId}/sections/${sectionIndex}/facultySelection`] = fields.facultySelection;
  }
  if (fields.notes !== undefined) {
    updates[`${SCHEDULES_PATH}/${scheduleId}/sections/${sectionIndex}/notes`] = fields.notes;
  }
  updates[`${SCHEDULES_PATH}/${scheduleId}/metadata/updatedAt`] = Date.now();
  await update(ref(db), updates);
}

/**
 * Batch update multiple sections at once
 * @param {string} scheduleId
 * @param {Array<{index, fields}>} sectionUpdates
 */
export async function batchUpdateSections(scheduleId, sectionUpdates) {
  const updates = {};
  sectionUpdates.forEach(({ index, fields }) => {
    if (fields.facultySelection !== undefined) {
      updates[`${SCHEDULES_PATH}/${scheduleId}/sections/${index}/facultySelection`] = fields.facultySelection;
    }
    if (fields.notes !== undefined) {
      updates[`${SCHEDULES_PATH}/${scheduleId}/sections/${index}/notes`] = fields.notes;
    }
  });
  updates[`${SCHEDULES_PATH}/${scheduleId}/metadata/updatedAt`] = Date.now();
  await update(ref(db), updates);
}

/**
 * Subscribe to real-time section updates
 * @param {string} scheduleId
 * @param {function} callback - Called with sections array
 * @returns {function} Unsubscribe function
 */
export function onSectionsChange(scheduleId, callback) {
  const sectionsRef = ref(db, `${SCHEDULES_PATH}/${scheduleId}/sections`);
  onValue(sectionsRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : []);
  });
  return () => off(sectionsRef);
}

/**
 * Delete a schedule
 * @param {string} scheduleId
 */
export async function deleteSchedule(scheduleId) {
  await set(ref(db, `${SCHEDULES_PATH}/${scheduleId}`), null);
}
