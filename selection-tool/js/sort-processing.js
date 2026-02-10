// Campus sorting processing functions

// ===== UTILITY FUNCTIONS (shared with main tool) =====

function parseSectionNameForSort(name) {
  if (!name) return null;
  const match = String(name).match(/^([A-Z]+)-(\d+)-([A-Z])(\d+)$/i);
  if (!match) return null;

  return {
    subject: match[1].toUpperCase(),
    courseNum: match[2],
    modeCode: match[3].toUpperCase(),
    sequence: match[4],
    section: match[3].toUpperCase() + match[4],
  };
}

function getModeForSort(code) {
  const modes = { 'C': 'In-Person', 'S': 'In-Person', 'O': 'Online', 'H': 'Hybrid', 'R': 'Remote' };
  return modes[code] || 'Unknown';
}

function getCampusForSort(code, dept) {
  if (code === 'H') {
    const deptUpper = (dept || '').toUpperCase().trim();
    if (deptUpper === 'COMMC') return 'Center';
    if (deptUpper === 'COMMS') return 'South';
    return 'Unknown';
  }
  const campuses = { 'C': 'Center', 'S': 'South', 'O': 'Online', 'R': 'Online' };
  return campuses[code] || 'Unknown';
}

function formatDateForSort(date) {
  if (!date) return '';
  if (date instanceof Date) {
    return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)}`;
  }
  return String(date);
}

function formatTimeRangeForSort(start, end) {
  const formatTime = (time) => {
    if (!time) return null;
    let hours, minutes;

    if (typeof time === 'number') {
      const totalMinutes = Math.round(time * 24 * 60);
      hours = Math.floor(totalMinutes / 60);
      minutes = totalMinutes % 60;
    } else if (time instanceof Date) {
      hours = time.getHours();
      minutes = time.getMinutes();
    } else if (typeof time === 'string' && time.includes(':')) {
      const parts = time.split(':');
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
    } else {
      return null;
    }

    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : '';
    return `${displayHours}${displayMinutes} ${period}`;
  };

  const startStr = formatTime(start);
  const endStr = formatTime(end);

  if (startStr && endStr) {
    return `${startStr} - ${endStr}`;
  }
  return '';
}

function parseDateForSort(str) {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[0], 10) - 1;
  const day = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);
  year = year < 50 ? 2000 + year : 1900 + year;
  return new Date(year, month, day);
}

function toMinutesForSort(time) {
  if (typeof time === 'number') {
    return Math.round(time * 24 * 60);
  }
  if (time instanceof Date) {
    return time.getHours() * 60 + time.getMinutes();
  }
  if (typeof time === 'string' && time.includes(':')) {
    const parts = time.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  return null;
}

function countMeetingDaysForSort(daysStr) {
  if (!daysStr) return 0;
  const days = daysStr.toUpperCase().trim();

  const patterns = {
    'MTWTHF': 5, 'MTWRF': 5, 'MTWHF': 5,
    'MTWTH': 4, 'MTWF': 4, 'MTWR': 4, 'MWRF': 4,
    'MWF': 3, 'TWR': 3, 'TWF': 3, 'MTW': 3, 'WRF': 3,
    'MW': 2, 'TTH': 2, 'TR': 2, 'MF': 2, 'WF': 2, 'TW': 2, 'MR': 2, 'WTH': 2,
    'M': 1, 'T': 1, 'W': 1, 'R': 1, 'F': 1, 'TH': 1, 'S': 1, 'U': 1,
  };

  if (patterns[days] !== undefined) {
    return patterns[days];
  }

  let count = 0;
  if (days.includes('M')) count++;
  if (days.includes('W')) count++;
  if (days.includes('F')) count++;
  if (days.includes('S') && !days.includes('SU')) count++;
  if (days.includes('U')) count++;
  if (days.includes('R')) count++;
  if (days.includes('TH') && !days.includes('R')) count++;
  const withoutTH = days.replace(/TH/g, '');
  if (withoutTH.includes('T')) count++;

  return Math.max(count, 1);
}

// ===== HEADER DETECTION =====

function detectHeaderRowForSort(data) {
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (!row) continue;

    const rowText = row.map(cell => String(cell || '').trim().toLowerCase()).join(' ');
    let matches = 0;

    for (const keyword of HEADER_KEYWORDS) {
      if (rowText.includes(keyword.toLowerCase())) {
        matches++;
      }
    }

    if (matches >= 3) {
      return i;
    }
  }
  return -1;
}

function determineCampus(modeCode, dept) {
  // S sections are South Campus
  if (modeCode === 'S') {
    return 'South';
  }

  // C sections are Center Campus
  if (modeCode === 'C') {
    return 'Center';
  }

  // O sections are Online
  if (modeCode === 'O') {
    return 'Online';
  }

  // H (Hybrid) and R (Remote) depend on department
  if (modeCode === 'H' || modeCode === 'R') {
    const deptUpper = (dept || '').toUpperCase().trim();
    if (deptUpper === 'COMMS') {
      return 'South';
    }
    if (deptUpper === 'COMMC') {
      return 'Center';
    }
    // If department doesn't match, default to Online for H/R
    return 'Online';
  }

  return 'Unknown';
}

// ===== SELECTION SHEET PROCESSING =====

function filterDuplicateHybridRowsForSort(processedSections) {
  // Group sections by section identifier (course + section)
  const sectionGroups = {};
  processedSections.forEach(s => {
    const key = `${s.course}-${s.section}`;
    if (!sectionGroups[key]) {
      sectionGroups[key] = [];
    }
    sectionGroups[key].push(s);
  });

  // For hybrid sections with multiple rows, keep only the one with meeting info
  const filteredSections = [];
  const processedKeys = new Set();

  processedSections.forEach(s => {
    const key = `${s.course}-${s.section}`;

    // If already processed this section group, skip
    if (processedKeys.has(key)) return;

    const group = sectionGroups[key];

    // If only one row for this section, keep it
    if (group.length === 1) {
      filteredSections.push(s);
      processedKeys.add(key);
      return;
    }

    // For hybrid sections (modeCode === 'H') with multiple rows,
    // keep the one with meeting days/time info
    if (s.modeCode === 'H') {
      // Find the row with meeting info (has days and time)
      const rowWithMeetingInfo = group.find(row => row.days && row.timeRange);
      if (rowWithMeetingInfo) {
        filteredSections.push(rowWithMeetingInfo);
      } else {
        // If no row has meeting info, keep the first one
        filteredSections.push(group[0]);
      }
      processedKeys.add(key);
    } else {
      // For non-hybrid sections, keep all rows (they may be split schedules)
      group.forEach(row => filteredSections.push(row));
      processedKeys.add(key);
    }
  });

  return filteredSections;
}

function processRowsForSelectionSheet(rows, data, colIndex, headerRow, targetCampus) {
  // Convert raw rows to processed sections (similar to main tool's processData)
  let processedSections = rows.map((rowData, idx) => {
    const row = data[headerRow + 1 + rowData.originalIndex];
    if (!row) return null;

    const sectionName = row[colIndex['Section Name']];
    const parsed = parseSectionNameForSort(sectionName);
    if (!parsed) return null;

    // Skip EAPP for selection sheet
    if (parsed.subject === 'EAPP') return null;

    // Only include ENGL
    if (parsed.subject !== 'ENGL') return null;

    const startTime = row[colIndex['Start Time']];
    const endTime = row[colIndex['End Time']];
    const startDate = row[colIndex['Start Date']];
    const endDate = row[colIndex['End Date']];
    const capacity = parseInt(row[colIndex['Section Capacity']], 10) || 0;
    const dept = row[colIndex['Dept']] || '';

    return {
      id: rowData.originalIndex,
      raw: row,
      sectionName,
      ...parsed,
      course: `${parsed.subject} ${parsed.courseNum}`,
      mode: getModeForSort(parsed.modeCode),
      campus: getCampusForSort(parsed.modeCode, dept),
      dept: dept,
      days: row[colIndex['Days']] || '',
      startTime: startTime,
      endTime: endTime,
      timeRange: formatTimeRangeForSort(startTime, endTime),
      building: row[colIndex['Bldg']] || '',
      room: row[colIndex['Room']] || '',
      startDate: formatDateForSort(startDate),
      endDate: formatDateForSort(endDate),
      dateRange: startDate && endDate ? `${formatDateForSort(startDate)} - ${formatDateForSort(endDate)}` : '',
      capacity,
      weeks: parseInt(row[colIndex['Weeks']], 10) || 16,
      primaryFaculty: row[colIndex['Primary Faculty Name']] || '',
    };
  }).filter(Boolean);

  // Filter out duplicate hybrid rows - keep only the one with meeting time/days info
  processedSections = filterDuplicateHybridRowsForSort(processedSections);

  // Detect bundles and flags (only within same campus)
  const { detectedBundles, detectedFlags, assignedSections } = detectBundlesForSort(processedSections, targetCampus);

  // Add more validation flags
  detectSchedulingConflictsForSort(processedSections, detectedBundles, assignedSections, detectedFlags);
  detectCapacityIssuesForSort(processedSections, detectedFlags);
  detectSchedulingTimeIssuesForSort(processedSections, detectedFlags);

  // Sort sections
  processedSections = sortSectionsForSort(processedSections, detectedBundles, assignedSections);

  return {
    processedSections,
    detectedBundles,
    detectedFlags,
    assignedSections,
  };
}

function detectBundlesForSort(processedSections, targetCampus) {
  const detectedBundles = [];
  const assignedSections = new Set();
  const detectedFlags = [];
  let bundleId = 1;

  function datesAlign(s1, s2) {
    const start1 = parseDateForSort(s1.startDate);
    const start2 = parseDateForSort(s2.startDate);
    if (!start1 || !start2) return false;
    const diffMs = Math.abs(start1 - start2);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= 14;
  }

  // Only bundle sections within the same campus
  function sameCampusCheck(s1, s2) {
    // For Center/South campuses, ensure sections are from the same campus
    if (targetCampus === 'Center' || targetCampus === 'South') {
      return s1.campus === s2.campus && s1.campus === targetCampus;
    }
    // For Online, allow normal bundling
    return true;
  }

  const engl1170 = processedSections.filter(s => s.course === 'ENGL 1170');
  const engl1181 = processedSections.filter(s => s.course === 'ENGL 1181');

  // 1170 + 1181 bundles
  engl1170.forEach(s1170 => {
    if (assignedSections.has(s1170.id)) return;

    const matching1181 = engl1181.filter(s1181 => {
      if (assignedSections.has(s1181.id)) return false;
      if (s1181.capacity >= 26) return false;
      if (!sameCampusCheck(s1170, s1181)) return false;

      if (s1170.modeCode !== s1181.modeCode) {
        const campus1170 = ['C', 'S'].includes(s1170.modeCode) ? s1170.modeCode : 'online';
        const campus1181 = ['C', 'S'].includes(s1181.modeCode) ? s1181.modeCode : 'online';
        if (campus1170 !== campus1181 && campus1170 !== 'online' && campus1181 !== 'online') return false;
      }

      if (s1170.weeks !== s1181.weeks) return false;
      if (!datesAlign(s1170, s1181)) return false;

      if (['C', 'S'].includes(s1181.modeCode)) {
        if (s1170.building && s1181.building && s1170.building === s1181.building &&
            s1170.room && s1181.room && s1170.room === s1181.room) {
          return true;
        }
      }

      if (s1170.primaryFaculty && s1170.primaryFaculty.includes(s1181.sectionName)) return true;
      if (s1181.primaryFaculty && s1181.primaryFaculty.includes(s1170.sectionName)) return true;

      const seq1170 = parseInt(s1170.sequence, 10);
      const seq1181 = parseInt(s1181.sequence, 10);
      if (s1181.modeCode === s1170.modeCode && s1181.weeks === s1170.weeks) {
        if (Math.abs(seq1181 - seq1170) <= 2) return true;
      }

      return false;
    });

    if (matching1181.length >= 2) {
      const bundle1181 = matching1181.slice(0, 2);
      detectedBundles.push({
        id: `Bundle-${String(bundleId).padStart(2, '0')}`,
        type: '1181+1170',
        sections: [s1170, ...bundle1181],
      });
      assignedSections.add(s1170.id);
      bundle1181.forEach(s => assignedSections.add(s.id));
      bundleId++;
    }
  });

  // 2410 + 2420 bundles
  const engl2410 = processedSections.filter(s => s.course === 'ENGL 2410' && !assignedSections.has(s.id));
  const engl2420 = processedSections.filter(s => s.course === 'ENGL 2420' && !assignedSections.has(s.id));

  engl2410.forEach(s2410 => {
    if (assignedSections.has(s2410.id)) return;

    const matching2420 = engl2420.find(s2420 => {
      if (assignedSections.has(s2420.id)) return false;
      if (!sameCampusCheck(s2410, s2420)) return false;
      if (s2410.modeCode !== s2420.modeCode) return false;
      if (s2410.weeks !== s2420.weeks) return false;
      if (!datesAlign(s2410, s2420)) return false;

      if (['C', 'S'].includes(s2410.modeCode)) {
        return s2410.building === s2420.building &&
               s2410.room === s2420.room &&
               s2410.days === s2420.days;
      }

      if (s2410.capacity < 26 && s2420.capacity < 26) {
        const seq2410 = parseInt(s2410.sequence, 10);
        const seq2420 = parseInt(s2420.sequence, 10);
        return Math.abs(seq2410 - seq2420) <= 2;
      }

      return false;
    });

    if (matching2420) {
      detectedBundles.push({
        id: `Bundle-${String(bundleId).padStart(2, '0')}`,
        type: '2410+2420',
        sections: [s2410, matching2420],
      });
      assignedSections.add(s2410.id);
      assignedSections.add(matching2420.id);
      bundleId++;
    }
  });

  // Online 1181 pairs (only for Online campus)
  if (targetCampus === 'Online') {
    const unassignedOnline1181 = engl1181.filter(s =>
      !assignedSections.has(s.id) &&
      s.modeCode === 'O' &&
      s.capacity < 26 &&
      s.capacity > 0
    );

    const pairedOnline1181 = new Set();
    for (let i = 0; i < unassignedOnline1181.length; i++) {
      if (pairedOnline1181.has(unassignedOnline1181[i].id)) continue;

      const s1 = unassignedOnline1181[i];

      const matchingPartner = unassignedOnline1181.find((s2, j) => {
        if (i === j) return false;
        if (pairedOnline1181.has(s2.id)) return false;
        if (s1.weeks !== s2.weeks) return false;
        if (!datesAlign(s1, s2)) return false;

        const seq1 = parseInt(s1.sequence, 10);
        const seq2 = parseInt(s2.sequence, 10);
        return Math.abs(seq1 - seq2) <= 2;
      });

      if (matchingPartner) {
        detectedBundles.push({
          id: `Bundle-${String(bundleId).padStart(2, '0')}`,
          type: 'online-1181-pair',
          sections: [s1, matchingPartner],
        });
        assignedSections.add(s1.id);
        assignedSections.add(matchingPartner.id);
        pairedOnline1181.add(s1.id);
        pairedOnline1181.add(matchingPartner.id);

        detectedFlags.push({
          section: s1,
          message: 'Appears bundled with in-person 1170 - please verify',
        });
        detectedFlags.push({
          section: matchingPartner,
          message: 'Appears bundled with in-person 1170 - please verify',
        });

        bundleId++;
      }
    }
  }

  // Flag unassigned 1181s and 1170s
  engl1181.forEach(s => {
    if (!assignedSections.has(s.id) && s.capacity < 26 && s.capacity > 0) {
      detectedFlags.push({
        section: s,
        message: 'Capacity suggests co-req but no matching 1170 found',
      });
    }
  });

  engl1170.forEach(s => {
    if (!assignedSections.has(s.id)) {
      detectedFlags.push({
        section: s,
        message: 'Missing paired 1181 sections - needs review',
      });
    }
  });

  return { detectedBundles, detectedFlags, assignedSections };
}

function detectSchedulingConflictsForSort(processedSections, detectedBundles, assignedSections, detectedFlags) {
  const inPersonSections = processedSections.filter(s =>
    ['C', 'S'].includes(s.modeCode) && s.building && s.room && s.days
  );

  function datesOverlap(s1, s2) {
    if (!s1.startDate || !s1.endDate || !s2.startDate || !s2.endDate) return false;
    const start1 = parseDateForSort(s1.startDate);
    const end1 = parseDateForSort(s1.endDate);
    const start2 = parseDateForSort(s2.startDate);
    const end2 = parseDateForSort(s2.endDate);
    if (!start1 || !end1 || !start2 || !end2) return false;
    return start1 <= end2 && start2 <= end1;
  }

  function timesOverlap(s1, s2) {
    if (!s1.startTime || !s1.endTime || !s2.startTime || !s2.endTime) return false;
    const start1 = toMinutesForSort(s1.startTime);
    const end1 = toMinutesForSort(s1.endTime);
    const start2 = toMinutesForSort(s2.startTime);
    const end2 = toMinutesForSort(s2.endTime);
    if (start1 === null || end1 === null || start2 === null || end2 === null) return false;
    return start1 < end2 && start2 < end1;
  }

  const sectionToBundleIndex = {};
  detectedBundles.forEach((b, idx) => {
    b.sections.forEach(s => {
      sectionToBundleIndex[s.id] = idx;
    });
  });

  const flaggedIssues = new Set();

  for (let i = 0; i < inPersonSections.length; i++) {
    for (let j = i + 1; j < inPersonSections.length; j++) {
      const s1 = inPersonSections[i];
      const s2 = inPersonSections[j];

      if (assignedSections.has(s1.id) && assignedSections.has(s2.id)) {
        if (sectionToBundleIndex[s1.id] === sectionToBundleIndex[s2.id]) continue;
      }

      const sameSection = s1.section === s2.section;

      if (s1.building === s2.building &&
          s1.room === s2.room &&
          timesOverlap(s1, s2) &&
          datesOverlap(s1, s2)) {

        const issueKey = [s1.id, s2.id].sort().join('-');
        if (!flaggedIssues.has(issueKey)) {
          flaggedIssues.add(issueKey);

          if (sameSection) {
            detectedFlags.push({
              section: s1,
              message: `Same section appears on multiple rows (${s2.days}) - please review/consolidate`,
            });
            detectedFlags.push({
              section: s2,
              message: `Same section appears on multiple rows (${s1.days}) - please review/consolidate`,
            });
          } else {
            const d1 = s1.days?.toUpperCase() || '';
            const d2 = s2.days?.toUpperCase() || '';
            const dayChars = ['M', 'W', 'F', 'S', 'U'];
            let daysShareDay = false;
            for (const day of dayChars) {
              if (d1.includes(day) && d2.includes(day)) {
                daysShareDay = true;
                break;
              }
            }
            if (d1.includes('TH') && d2.includes('TH')) daysShareDay = true;
            if (!daysShareDay) {
              const d1HasT = d1.replace(/TH/g, '').includes('T');
              const d2HasT = d2.replace(/TH/g, '').includes('T');
              if (d1HasT && d2HasT) daysShareDay = true;
            }

            if (daysShareDay) {
              detectedFlags.push({
                section: s1,
                message: `Room conflict with ${s2.sectionName} (${s2.days} ${s2.timeRange})`,
              });
              detectedFlags.push({
                section: s2,
                message: `Room conflict with ${s1.sectionName} (${s1.days} ${s1.timeRange})`,
              });
            }
          }
        }
      }
    }
  }
}

function detectCapacityIssuesForSort(processedSections, detectedFlags) {
  const maxCap28Courses = [
    'ENGL 1181', 'ENGL 1190', 'ENGL 1191',
    'ENGL 1210', 'ENGL 1220', 'ENGL 1211', 'ENGL 1221'
  ];
  const maxCap10Courses = ['ENGL 1170'];

  processedSections.forEach(s => {
    if (maxCap28Courses.includes(s.course) && s.capacity > 28) {
      detectedFlags.push({
        section: s,
        message: `Capacity ${s.capacity} exceeds max of 28 for writing courses`,
      });
    }
    if (maxCap10Courses.includes(s.course) && s.capacity > 10) {
      detectedFlags.push({
        section: s,
        message: `Capacity ${s.capacity} exceeds max of 10 for ENGL 1170`,
      });
    }
  });
}

function detectSchedulingTimeIssuesForSort(processedSections, detectedFlags) {
  const sectionsToCheck = processedSections.filter(s =>
    ['C', 'S', 'R'].includes(s.modeCode) && s.startTime && s.endTime && s.days
  );

  const sectionCounts = {};
  sectionsToCheck.forEach(s => {
    sectionCounts[s.section] = (sectionCounts[s.section] || 0) + 1;
  });
  const splitSections = new Set(
    Object.keys(sectionCounts).filter(sec => sectionCounts[sec] > 1)
  );

  sectionsToCheck.forEach(s => {
    if (splitSections.has(s.section)) return;

    const startMins = toMinutesForSort(s.startTime);
    const endMins = toMinutesForSort(s.endTime);

    if (startMins === null || endMins === null) return;

    const minsPerMeeting = endMins - startMins;
    if (minsPerMeeting <= 0) return;

    const daysPerWeek = countMeetingDaysForSort(s.days);
    if (daysPerWeek === 0) return;

    const hoursPerWeek = (minsPerMeeting * daysPerWeek) / 60;
    const credits = getCreditHours(s.course);
    const expectedHoursPerWeek = credits * (16 / s.weeks);
    const tolerance = 0.5;

    if (hoursPerWeek < expectedHoursPerWeek - tolerance || hoursPerWeek > expectedHoursPerWeek + tolerance) {
      detectedFlags.push({
        section: s,
        message: `Scheduled ${hoursPerWeek.toFixed(1)} hrs/wk, expected ~${expectedHoursPerWeek.toFixed(1)} hrs/wk for ${credits}-credit ${s.weeks}-week course`,
      });
    }
  });
}

function sortSectionsForSort(processedSections, detectedBundles, assignedSections) {
  const modeOrder = { 'Online': 0, 'Hybrid': 1, 'Remote': 2, 'In-Person': 3 };

  const bundleLookup = {};
  detectedBundles.forEach((b, idx) => {
    b.sections.forEach(s => {
      bundleLookup[s.id] = { bundle: b, index: idx };
    });
  });

  return [...processedSections].sort((a, b) => {
    const aBundle = bundleLookup[a.id];
    const bBundle = bundleLookup[b.id];

    if (aBundle && !bBundle) return -1;
    if (!aBundle && bBundle) return 1;

    if (aBundle && bBundle) {
      if (aBundle.index !== bBundle.index) return aBundle.index - bBundle.index;
      const aCourse = a.course;
      const bCourse = b.course;
      if (aCourse.includes('1181') && bCourse.includes('1170')) return -1;
      if (aCourse.includes('1170') && bCourse.includes('1181')) return 1;
      if (aCourse.includes('2410') && bCourse.includes('2420')) return -1;
      if (aCourse.includes('2420') && bCourse.includes('2410')) return 1;
      return a.id - b.id;
    }

    const modeA = modeOrder[a.mode] ?? 99;
    const modeB = modeOrder[b.mode] ?? 99;
    if (modeA !== modeB) return modeA - modeB;

    if (a.weeks !== b.weeks) return a.weeks - b.weeks;
    if (a.course !== b.course) return a.course.localeCompare(b.course);
    return a.section.localeCompare(b.section);
  });
}

// ===== MAIN PROCESSING =====

function processFileForSort(data, rawData) {
  const headerRow = detectHeaderRowForSort(data);
  if (headerRow === -1) {
    throw new Error('Could not detect header row');
  }

  const headers = data[headerRow];
  const colIndex = {};

  // Build comprehensive column index for processing
  headers.forEach((header, idx) => {
    const h = String(header).trim();
    if (h.includes('Section ID')) colIndex['Section ID'] = idx;
    if (h.includes('Dept')) colIndex['Dept'] = idx;
    if (h.includes('Section Name')) colIndex['Section Name'] = idx;
    if (h.includes('Start Date')) colIndex['Start Date'] = idx;
    if (h.includes('End Date')) colIndex['End Date'] = idx;
    if (h.includes('Bldg')) colIndex['Bldg'] = idx;
    if (h.includes('Room')) colIndex['Room'] = idx;
    if (h.includes('Days')) colIndex['Days'] = idx;
    if (h.includes('Start Time')) colIndex['Start Time'] = idx;
    if (h.includes('End Time')) colIndex['End Time'] = idx;
    if (h.includes('# of Weeks') || h.includes('Weeks')) colIndex['Weeks'] = idx;
    if (h.includes('Section Capacity') || h.includes('Capacity')) colIndex['Section Capacity'] = idx;
    if (h.includes('Primary Faculty')) colIndex['Primary Faculty Name'] = idx;
  });

  if (colIndex['Section Name'] === undefined) {
    throw new Error('Could not find Section Name column');
  }

  // Get header row from raw data for output
  const rawHeaders = rawData[headerRow];

  // Process each row and determine campus
  const rows = data.slice(headerRow + 1);
  const rawRows = rawData.slice(headerRow + 1);

  const centerRows = [];
  const southRows = [];
  const onlineRows = [];
  const unknownRows = [];

  rows.forEach((row, idx) => {
    const sectionName = row[colIndex['Section Name']];
    const parsed = parseSectionNameForSort(sectionName);

    if (!parsed) {
      // Skip rows without valid section names
      return;
    }

    // Only include ENGL and EAPP classes
    if (parsed.subject !== 'ENGL' && parsed.subject !== 'EAPP') {
      return;
    }

    const dept = colIndex['Dept'] !== undefined ? row[colIndex['Dept']] : '';
    const campus = determineCampus(parsed.modeCode, dept);
    const rawRow = rawRows[idx];
    const isEAPP = parsed.subject === 'EAPP';

    // Store row with metadata and original index for processing
    const rowData = { row: rawRow, isEAPP, originalIndex: idx };

    switch (campus) {
      case 'Center':
        centerRows.push(rowData);
        break;
      case 'South':
        southRows.push(rowData);
        break;
      case 'Online':
        onlineRows.push(rowData);
        break;
      default:
        unknownRows.push(rowData);
    }
  });

  // Sort each campus: ENGL first, then EAPP at the bottom
  const sortBySubject = (a, b) => {
    if (a.isEAPP === b.isEAPP) return 0;
    return a.isEAPP ? 1 : -1;
  };

  centerRows.sort(sortBySubject);
  southRows.sort(sortBySubject);
  onlineRows.sort(sortBySubject);
  unknownRows.sort(sortBySubject);

  // Determine semester from dates
  const semesterCode = determineSemesterFromData(data, colIndex, headerRow);

  // Process each campus for selection sheet (filtering, bundles, flags) - ENGL only, no EAPP
  const centerProcessed = centerRows.length > 0
    ? processRowsForSelectionSheet(centerRows, data, colIndex, headerRow, 'Center')
    : { processedSections: [], detectedBundles: [], detectedFlags: [], assignedSections: new Set() };

  const southProcessed = southRows.length > 0
    ? processRowsForSelectionSheet(southRows, data, colIndex, headerRow, 'South')
    : { processedSections: [], detectedBundles: [], detectedFlags: [], assignedSections: new Set() };

  const onlineProcessed = onlineRows.length > 0
    ? processRowsForSelectionSheet(onlineRows, data, colIndex, headerRow, 'Online')
    : { processedSections: [], detectedBundles: [], detectedFlags: [], assignedSections: new Set() };

  return {
    headerRow,
    rawHeaders,
    rawData,
    data,
    colIndex,
    centerRows,
    southRows,
    onlineRows,
    unknownRows,
    semesterCode,
    // Processed data for selection sheets
    centerProcessed,
    southProcessed,
    onlineProcessed,
    counts: {
      center: centerRows.length,
      south: southRows.length,
      online: onlineRows.length,
      unknown: unknownRows.length,
      total: centerRows.length + southRows.length + onlineRows.length + unknownRows.length
    }
  };
}

function determineSemesterFromData(data, colIndex, headerRow) {
  if (colIndex['Start Date'] === undefined) {
    return '';
  }

  const rows = data.slice(headerRow + 1);

  // Collect all valid start dates
  const dates = [];
  rows.forEach(row => {
    const startDate = row[colIndex['Start Date']];
    const parsed = parseDateForSemester(startDate);
    if (parsed) {
      dates.push(parsed);
    }
  });

  if (dates.length === 0) {
    return '';
  }

  // Find the most common month to determine semester
  const monthCounts = {};
  dates.forEach(d => {
    const key = `${d.month}-${d.year}`;
    monthCounts[key] = (monthCounts[key] || 0) + 1;
  });

  // Get the most common month/year
  let mostCommon = null;
  let maxCount = 0;
  for (const [key, count] of Object.entries(monthCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = key;
    }
  }

  if (!mostCommon) {
    return '';
  }

  const [monthStr, yearStr] = mostCommon.split('-');
  const month = parseInt(monthStr, 10);
  const year = yearStr.slice(-2); // Get last 2 digits of year

  // Determine semester based on month
  // Fall: August (8) through December (12)
  // Winter: January (1) through April (4)
  // Spring/Summer: May (5) through July (7)
  if (month >= 8 && month <= 12) {
    return `F${year}`;
  } else if (month >= 1 && month <= 4) {
    return `W${year}`;
  } else {
    return `SS${year}`;
  }
}

function parseDateForSemester(date) {
  if (!date) return null;

  // Handle Date objects
  if (date instanceof Date) {
    return {
      month: date.getMonth() + 1,
      year: date.getFullYear()
    };
  }

  // Handle string dates like "1/13/25" or "8/25/2025"
  const str = String(date);
  const match = str.match(/^(\d{1,2})\/\d{1,2}\/(\d{2,4})/);
  if (match) {
    const month = parseInt(match[1], 10);
    let year = match[2];
    // Convert 2-digit year to 4-digit
    if (year.length === 2) {
      year = (parseInt(year, 10) < 50 ? '20' : '19') + year;
    }
    return {
      month,
      year
    };
  }

  return null;
}
