// Data processing functions for the Selection Sheet Tool

function detectHeaderRow(data) {
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

function processData(originalData, rawOriginalData, headerRow) {
  const headers = originalData[headerRow];
  const colIndex = {};

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

  const rows = originalData.slice(headerRow + 1);

  let processedSections = rows.map((row, idx) => {
    const sectionName = row[colIndex['Section Name']];
    const parsed = parseSectionName(sectionName);
    if (!parsed) return null;

    const startTime = row[colIndex['Start Time']];
    const endTime = row[colIndex['End Time']];
    const startDate = row[colIndex['Start Date']];
    const endDate = row[colIndex['End Date']];
    const capacity = parseInt(row[colIndex['Section Capacity']], 10) || 0;
    const dept = row[colIndex['Dept']] || '';

    return {
      id: idx,
      raw: row,
      sectionName,
      ...parsed,
      course: `${parsed.subject} ${parsed.courseNum}`,
      mode: getMode(parsed.modeCode),
      campus: getCampus(parsed.modeCode, dept),
      dept: dept,
      days: row[colIndex['Days']] || '',
      startTime: startTime,
      endTime: endTime,
      timeRange: formatTimeRange(startTime, endTime),
      building: row[colIndex['Bldg']] || '',
      room: row[colIndex['Room']] || '',
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      dateRange: startDate && endDate ? `${formatDate(startDate)} - ${formatDate(endDate)}` : '',
      capacity,
      weeks: parseInt(row[colIndex['Weeks']], 10) || 16,
      primaryFaculty: row[colIndex['Primary Faculty Name']] || '',
    };
  }).filter(Boolean);

  // Filter out duplicate hybrid rows - keep only the one with meeting time/days info
  processedSections = filterDuplicateHybridRows(processedSections);

  // Detect bundles and flags
  const { detectedBundles, detectedFlags, assignedSections } = detectBundles(processedSections);

  // Add more validation flags
  detectSchedulingConflicts(processedSections, detectedBundles, assignedSections, detectedFlags);
  detectCapacityIssues(processedSections, detectedFlags);
  detectSchedulingTimeIssues(processedSections, detectedFlags);

  // Sort sections
  processedSections = sortSections(processedSections, detectedBundles, assignedSections);

  // Determine semester and campus
  const { semesterCode, campusName } = determineSemesterAndCampus(processedSections);

  return {
    processedSections,
    detectedBundles,
    detectedFlags,
    assignedSections,
    rawOriginalData,
    originalData,
    headerRow,
    semesterCode,
    campusName,
  };
}

function filterDuplicateHybridRows(processedSections) {
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

function detectBundles(processedSections) {
  const detectedBundles = [];
  const assignedSections = new Set();
  const detectedFlags = [];
  let bundleId = 1;

  function datesAlign(s1, s2) {
    const start1 = parseDate(s1.startDate);
    const start2 = parseDate(s2.startDate);
    if (!start1 || !start2) return false;
    const diffMs = Math.abs(start1 - start2);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= 14;
  }

  const engl1170 = processedSections.filter(s => s.course === 'ENGL 1170');
  const engl1181 = processedSections.filter(s => s.course === 'ENGL 1181');

  // 1170 + 1181 bundles
  engl1170.forEach(s1170 => {
    if (assignedSections.has(s1170.id)) return;

    const matching1181 = engl1181.filter(s1181 => {
      if (assignedSections.has(s1181.id)) return false;
      if (s1181.capacity >= 26) return false;

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

  // Online 1181 pairs
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

function detectSchedulingConflicts(processedSections, detectedBundles, assignedSections, detectedFlags) {
  const inPersonSections = processedSections.filter(s =>
    ['C', 'S'].includes(s.modeCode) && s.building && s.room && s.days
  );

  function datesOverlap(s1, s2) {
    if (!s1.startDate || !s1.endDate || !s2.startDate || !s2.endDate) return false;
    const start1 = parseDate(s1.startDate);
    const end1 = parseDate(s1.endDate);
    const start2 = parseDate(s2.startDate);
    const end2 = parseDate(s2.endDate);
    if (!start1 || !end1 || !start2 || !end2) return false;
    return start1 <= end2 && start2 <= end1;
  }

  function timesOverlap(s1, s2) {
    if (!s1.startTime || !s1.endTime || !s2.startTime || !s2.endTime) return false;
    const start1 = toMinutes(s1.startTime);
    const end1 = toMinutes(s1.endTime);
    const start2 = toMinutes(s2.startTime);
    const end2 = toMinutes(s2.endTime);
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

function detectCapacityIssues(processedSections, detectedFlags) {
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

function detectSchedulingTimeIssues(processedSections, detectedFlags) {
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

    const startMins = toMinutes(s.startTime);
    const endMins = toMinutes(s.endTime);

    if (startMins === null || endMins === null) return;

    const minsPerMeeting = endMins - startMins;
    if (minsPerMeeting <= 0) return;

    const daysPerWeek = countMeetingDays(s.days);
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

function sortSections(processedSections, detectedBundles, assignedSections) {
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

function determineSemesterAndCampus(processedSections) {
  let semesterCode = '';
  let campusName = '';

  if (processedSections.length > 0) {
    const firstSection = processedSections[0];
    let startMonth = null;
    let startYear = null;

    if (firstSection.dateRange) {
      const match = firstSection.dateRange.match(/^(\d{1,2})\/\d{1,2}\/(\d{2})/);
      if (match) {
        startMonth = parseInt(match[1], 10);
        startYear = match[2];
      }
    }

    if (startMonth && startYear) {
      if (startMonth >= 8 && startMonth <= 12) {
        semesterCode = `F${startYear}`;
      } else if (startMonth >= 1 && startMonth <= 4) {
        semesterCode = `W${startYear}`;
      } else {
        semesterCode = `SS${startYear}`;
      }
    }

    const onlineCount = processedSections.filter(s => s.modeCode === 'O').length;
    const isOnlineSchedule = onlineCount > processedSections.length / 2;

    if (isOnlineSchedule) {
      campusName = 'Online';
    } else {
      const nonOnlineSections = processedSections.filter(s => s.modeCode !== 'O');
      const deptCounts = {};
      nonOnlineSections.forEach(s => {
        const dept = s.dept.toUpperCase().trim();
        deptCounts[dept] = (deptCounts[dept] || 0) + 1;
      });

      let mostCommonDept = '';
      let maxCount = 0;
      for (const [dept, count] of Object.entries(deptCounts)) {
        if (count > maxCount) {
          maxCount = count;
          mostCommonDept = dept;
        }
      }

      if (mostCommonDept === 'COMMC') {
        campusName = 'Center';
      } else if (mostCommonDept === 'COMMS') {
        campusName = 'South';
      }
    }
  }

  return { semesterCode, campusName };
}
