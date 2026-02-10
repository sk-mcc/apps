// Excel generation for campus sorter

// Bundle colors for selection sheet styling
const sortBundleColors = [
  'FFE3F2FD', 'FFF3E5F5', 'FFE8F5E9', 'FFFFF8E1',
  'FFFCE4EC', 'FFE0F7FA', 'FFFBE9E7', 'FFF1F8E9',
];

const sortBundleBorderColor = { argb: 'FF4472C4' };

async function downloadAllFiles() {
  if (!sortedData) return;

  downloadAllBtn.disabled = true;
  downloadAllBtn.textContent = 'Downloading...';

  // Download combined spreadsheet first
  await downloadCombinedSpreadsheet(true);

  // Small delay between downloads
  await new Promise(resolve => setTimeout(resolve, 400));

  // Download Center if it has data
  if (sortedData.centerRows.length > 0) {
    await downloadCenterOnly();
    await new Promise(resolve => setTimeout(resolve, 400));
  }

  // Download South if it has data
  if (sortedData.southRows.length > 0) {
    await downloadSouthOnly();
    await new Promise(resolve => setTimeout(resolve, 400));
  }

  // Download Online if it has data
  if (sortedData.onlineRows.length > 0) {
    await downloadOnlineOnly();
  }

  downloadAllBtn.disabled = false;
  downloadAllBtn.textContent = 'Download All 4 Files';
}

async function downloadCombinedSpreadsheet(silent = false) {
  if (!sortedData) return;

  if (!silent) {
    downloadCombinedBtn.disabled = true;
    downloadCombinedBtn.textContent = 'Downloading...';
  }

  const workbook = new ExcelJS.Workbook();

  // Add Center sheets (Selection Sheet + Original Sorted)
  if (sortedData.centerRows.length > 0) {
    addSelectionSheet(workbook, 'Center Selection', sortedData.centerProcessed, 'Center');
    addCampusSheet(workbook, 'Center Sorted', sortedData.rawHeaders, sortedData.centerRows);
  }

  // Add South sheets (Selection Sheet + Original Sorted)
  if (sortedData.southRows.length > 0) {
    addSelectionSheet(workbook, 'South Selection', sortedData.southProcessed, 'South');
    addCampusSheet(workbook, 'South Sorted', sortedData.rawHeaders, sortedData.southRows);
  }

  // Add Online sheets (Selection Sheet + Original Sorted)
  if (sortedData.onlineRows.length > 0) {
    addSelectionSheet(workbook, 'Online Selection', sortedData.onlineProcessed, 'Online');
    addCampusSheet(workbook, 'Online Sorted', sortedData.rawHeaders, sortedData.onlineRows);
  }

  // Add Unknown sheet if there are any (no selection sheet processing for unknown)
  if (sortedData.unknownRows.length > 0) {
    addCampusSheet(workbook, 'Unknown', sortedData.rawHeaders, sortedData.unknownRows);
  }

  const filename = generateFilename('All_Campuses');
  await downloadWorkbook(workbook, filename);

  if (!silent) {
    downloadCombinedBtn.disabled = false;
    downloadCombinedBtn.textContent = 'Single Spreadsheet Export';
  }
}

async function downloadCenterOnly() {
  if (!sortedData || sortedData.centerRows.length === 0) return;

  const workbook = new ExcelJS.Workbook();

  // Sheet 1: Selection Sheet (filtered/processed, no EAPP)
  addSelectionSheet(workbook, 'Selection Sheet', sortedData.centerProcessed, 'Center');

  // Sheet 2: Original Sorted (raw sorted data with EAPP)
  addCampusSheet(workbook, 'Original Sorted', sortedData.rawHeaders, sortedData.centerRows);

  const filename = generateFilename('Center_Campus');
  await downloadWorkbook(workbook, filename);
}

async function downloadSouthOnly() {
  if (!sortedData || sortedData.southRows.length === 0) return;

  const workbook = new ExcelJS.Workbook();

  // Sheet 1: Selection Sheet (filtered/processed, no EAPP)
  addSelectionSheet(workbook, 'Selection Sheet', sortedData.southProcessed, 'South');

  // Sheet 2: Original Sorted (raw sorted data with EAPP)
  addCampusSheet(workbook, 'Original Sorted', sortedData.rawHeaders, sortedData.southRows);

  const filename = generateFilename('South_Campus');
  await downloadWorkbook(workbook, filename);
}

async function downloadOnlineOnly() {
  if (!sortedData || sortedData.onlineRows.length === 0) return;

  const workbook = new ExcelJS.Workbook();

  // Sheet 1: Selection Sheet (filtered/processed, no EAPP)
  addSelectionSheet(workbook, 'Selection Sheet', sortedData.onlineProcessed, 'Online');

  // Sheet 2: Original Sorted (raw sorted data with EAPP)
  addCampusSheet(workbook, 'Original Sorted', sortedData.rawHeaders, sortedData.onlineRows);

  const filename = generateFilename('Online');
  await downloadWorkbook(workbook, filename);
}

function addCampusSheet(workbook, sheetName, headers, rowsData) {
  const ws = workbook.addWorksheet(sheetName);

  // Grey background color for EAPP rows
  const eappFillColor = { argb: 'FFE0E0E0' };

  // Add header row
  const headerRow = ws.addRow(headers);
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  // Add data rows
  rowsData.forEach((rowData) => {
    const { row, isEAPP } = rowData;
    const dataRow = ws.addRow(row);
    // Calculate row height based on content
    let maxCellLines = 1;
    row.forEach((cellValue, colIdx) => {
      if (cellValue) {
        const cellStr = String(cellValue);
        const lines = cellStr.split('\n').length;
        const colWidth = headers[colIdx] ? Math.min(String(headers[colIdx]).length + 2, 40) : 15;
        const wrappedLines = Math.ceil(cellStr.length / colWidth);
        maxCellLines = Math.max(maxCellLines, lines, wrappedLines > 2 ? wrappedLines : 1);
      }
    });
    dataRow.height = Math.max(18, 15 * maxCellLines);
    dataRow.eachCell((cell) => {
      // Apply grey background for EAPP rows
      if (isEAPP) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: eappFillColor
        };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
      };
    });
  });

  // Auto-fit column widths
  ws.columns.forEach((column, colIndex) => {
    let maxLength = 5;
    // Check header
    if (headers[colIndex]) {
      maxLength = Math.max(maxLength, String(headers[colIndex]).length);
    }
    // Check data rows (sample first 50)
    rowsData.slice(0, 50).forEach(rowData => {
      const cellValue = rowData.row[colIndex];
      if (cellValue) {
        const cellLength = String(cellValue).length;
        if (cellLength > maxLength) {
          maxLength = Math.min(cellLength, 40);
        }
      }
    });
    column.width = maxLength + 2;
  });
}

function addSelectionSheet(workbook, sheetName, processedData, campusName) {
  const { processedSections, detectedBundles, detectedFlags, assignedSections } = processedData;

  const ws = workbook.addWorksheet(sheetName);

  // Build lookup maps
  const sectionToBundleIndex = {};
  detectedBundles.forEach((b, idx) => {
    b.sections.forEach((s) => {
      sectionToBundleIndex[s.id] = idx;
    });
  });

  // Determine which eq hours should be in parentheses (2nd+ non-1170 in bundle)
  const eqHoursInParens = new Set();
  detectedBundles.forEach((bundle) => {
    const bundleSectionIds = new Set(bundle.sections.map(s => s.id));
    const non1170InOrder = processedSections.filter(s =>
      bundleSectionIds.has(s.id) && s.course !== 'ENGL 1170'
    );
    non1170InOrder.slice(1).forEach(s => {
      eqHoursInParens.add(s.id);
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
      colorIndex: bundleIdx % sortBundleColors.length,
      isFirst: !prevInSameBundle,
      isLast: !nextInSameBundle,
      bundleIndex: bundleIdx
    };
  });

  // Build flag lookup with warning icon
  const flagLookup = {};
  detectedFlags.forEach(f => {
    const flagMsg = '⚠️ ' + f.message;
    if (flagLookup[f.section.id]) {
      flagLookup[f.section.id] += '\n' + flagMsg;
    } else {
      flagLookup[f.section.id] = flagMsg;
    }
  });

  // Determine if this is primarily online (affects columns shown)
  const onlineCount = processedSections.filter(s => s.modeCode === 'O').length;
  const isOnlineSchedule = campusName === 'Online' || onlineCount > processedSections.length / 2;

  // Filter out hybrid sections from online schedule
  const sectionsToExport = isOnlineSchedule
    ? processedSections.filter(s => s.modeCode !== 'H')
    : processedSections;

  // Define columns
  const allColumns = [
    { header: 'Course', key: 'course', width: 12 },
    { header: 'Section', key: 'section', width: 9 },
    { header: 'Mode', key: 'mode', width: 11 },
    { header: 'Campus', key: 'campus', width: 9 },
    { header: 'Weeks', key: 'weeks', width: 7 },
    { header: 'Days', key: 'days', width: 7, excludeOnline: true },
    { header: 'Time', key: 'time', width: 18, excludeOnline: true },
    { header: 'Building', key: 'building', width: 9, excludeOnline: true },
    { header: 'Room', key: 'room', width: 7, excludeOnline: true },
    { header: 'Dates', key: 'dates', width: 20 },
    { header: 'Capacity', key: 'capacity', width: 9 },
    { header: 'Hours/Eq. Hours', key: 'eqHours', width: 15 },
    { header: 'Bundle ID', key: 'bundleId', width: 11 },
    { header: 'Notes', key: 'notes', width: 15 },
    { header: 'Faculty Selection', key: 'faculty', width: 20 },
    { header: 'Flags/Issues', key: 'flags', width: 45 },
  ];

  const activeColumns = isOnlineSchedule
    ? allColumns.filter(col => !col.excludeOnline)
    : allColumns;

  ws.columns = activeColumns;
  const totalColumns = activeColumns.length;

  // Style header row
  const headerRowEl = ws.getRow(1);
  headerRowEl.height = 24;
  headerRowEl.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  // Add data rows
  sectionsToExport.forEach((s, idx) => {
    const bundleInfo = bundleLookup[s.id];
    const flag = flagLookup[s.id];

    let notesText = '';
    if (s.mode === 'Hybrid') notesText = '[HYBRID]';
    if (s.mode === 'Remote') notesText = '[REMOTE]';

    const flagsText = flag || '';

    const eqHoursValue = getEquatedHours(s.course);
    const eqHoursDisplay = eqHoursInParens.has(s.id)
      ? `(${eqHoursValue})`
      : eqHoursValue;

    const row = ws.addRow({
      course: s.course,
      section: s.section,
      mode: s.mode,
      campus: s.campus,
      weeks: s.weeks,
      days: s.days,
      time: s.timeRange,
      building: s.building,
      room: s.room,
      dates: s.dateRange,
      capacity: s.capacity,
      eqHours: eqHoursDisplay,
      bundleId: bundleInfo ? bundleInfo.id : '',
      notes: notesText,
      faculty: '',
      flags: flagsText,
    });

    // Calculate row height to fit content
    const flagLineCount = flagsText ? flagsText.split('\n').length : 0;
    // Also account for text wrapping in flags column (approx 45 chars per line)
    const flagsColWidth = 45;
    let maxWrappedLines = flagLineCount;
    if (flagsText) {
      flagsText.split('\n').forEach(line => {
        const wrappedLines = Math.ceil(line.length / flagsColWidth);
        maxWrappedLines = Math.max(maxWrappedLines, wrappedLines);
      });
      maxWrappedLines = Math.max(maxWrappedLines, flagLineCount);
    }
    row.height = Math.max(20, 16 * (maxWrappedLines || 1));

    const fillColor = bundleInfo
      ? sortBundleColors[bundleInfo.colorIndex % sortBundleColors.length]
      : 'FFFFFFFF';

    const getColNum = (key) => activeColumns.findIndex(c => c.key === key) + 1;
    const weeksCol = getColNum('weeks');
    const capacityCol = getColNum('capacity');
    const eqHoursCol = getColNum('eqHours');
    const notesCol = getColNum('notes');
    const flagsCol = getColNum('flags');

    row.eachCell((cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fillColor }
      };

      cell.alignment = { vertical: 'middle' };

      if ([weeksCol, capacityCol, eqHoursCol].includes(colNumber)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      if (colNumber === flagsCol) {
        cell.alignment = { vertical: 'top', wrapText: true };
      }


      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
      };

      if (bundleInfo) {
        if (bundleInfo.isFirst) {
          cell.border.top = { style: 'medium', color: sortBundleBorderColor };
        }
        if (bundleInfo.isLast) {
          cell.border.bottom = { style: 'medium', color: sortBundleBorderColor };
        }
        if (colNumber === 1) {
          cell.border.left = { style: 'medium', color: sortBundleBorderColor };
        }
        if (colNumber === totalColumns) {
          cell.border.right = { style: 'medium', color: sortBundleBorderColor };
        }
      }
    });
  });
}

function generateFilename(campusName) {
  // Use semester code detected from dates in the data
  let prefix = '';
  if (sortedData && sortedData.semesterCode) {
    prefix = sortedData.semesterCode + '_';
  }
  return `${prefix}${campusName}_Selection_Schedule.xlsx`;
}

async function downloadWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
