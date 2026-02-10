// Excel generation functions for the Selection Sheet Tool

async function downloadAll() {
  downloadAllBtn.disabled = true;
  downloadAllBtn.textContent = 'Downloading...';

  for (const fileData of processedFiles) {
    await generateAndDownloadExcel(fileData);
    // Small delay between downloads
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  downloadAllBtn.disabled = false;
  downloadAllBtn.textContent = 'Download All Spreadsheets';
}

async function generateAndDownloadExcel(fileData) {
  const {
    processedSections,
    detectedBundles,
    detectedFlags,
    assignedSections,
    rawOriginalData,
    semesterCode,
    campusName,
    headerRow,
  } = fileData;

  const workbook = new ExcelJS.Workbook();
  const ws1 = workbook.addWorksheet('Selection Sheet');

  const bundleColors = [
    { bg: '#2d3748', text: '#90cdf4' },
    { bg: '#3d2f5c', text: '#d6bcfa' },
    { bg: '#2d4a3e', text: '#9ae6b4' },
    { bg: '#4a3728', text: '#fbd38d' },
    { bg: '#3b3058', text: '#fbb6ce' },
    { bg: '#1e4a5a', text: '#81e6d9' },
    { bg: '#4a2c3b', text: '#feb2b2' },
    { bg: '#2a3f2a', text: '#c6f6d5' },
  ];

  const sectionToBundleIndex = {};
  detectedBundles.forEach((b, idx) => {
    b.sections.forEach((s) => {
      sectionToBundleIndex[s.id] = idx;
    });
  });

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
      colorIndex: bundleIdx % bundleColors.length,
      isFirst: !prevInSameBundle,
      isLast: !nextInSameBundle,
      bundleIndex: bundleIdx
    };
  });

  const flagLookup = {};
  detectedFlags.forEach(f => {
    const flagMsg = '⚠️ ' + f.message;
    if (flagLookup[f.section.id]) {
      flagLookup[f.section.id] += '\n' + flagMsg;
    } else {
      flagLookup[f.section.id] = flagMsg;
    }
  });

  const excelBundleColors = [
    'FFE3F2FD', 'FFF3E5F5', 'FFE8F5E9', 'FFFFF8E1',
    'FFFCE4EC', 'FFE0F7FA', 'FFFBE9E7', 'FFF1F8E9',
  ];

  const bundleBorderColor = { argb: 'FF4472C4' };

  const onlineCount = processedSections.filter(s => s.modeCode === 'O').length;
  const isOnlineSchedule = onlineCount > processedSections.length / 2;

  const sectionsToExport = isOnlineSchedule
    ? processedSections.filter(s => s.modeCode !== 'H')
    : processedSections;

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

  ws1.columns = activeColumns;
  const totalColumns = activeColumns.length;

  const headerRowEl = ws1.getRow(1);
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

    const row = ws1.addRow({
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
      ? excelBundleColors[bundleInfo.colorIndex % excelBundleColors.length]
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
          cell.border.top = { style: 'medium', color: bundleBorderColor };
        }
        if (bundleInfo.isLast) {
          cell.border.bottom = { style: 'medium', color: bundleBorderColor };
        }
        if (colNumber === 1) {
          cell.border.left = { style: 'medium', color: bundleBorderColor };
        }
        if (colNumber === totalColumns) {
          cell.border.right = { style: 'medium', color: bundleBorderColor };
        }
      }
    });
  });

  // Sheet 2: Original Data
  const ws2 = workbook.addWorksheet('Original Data');
  rawOriginalData.forEach((row, rowIndex) => {
    const excelRow = ws2.addRow(row);
    excelRow.height = 18;
  });

  const dataRows = rawOriginalData.slice(headerRow || 0);
  ws2.columns.forEach((column, colIndex) => {
    let maxLength = 5;
    dataRows.forEach(row => {
      const cellValue = row[colIndex];
      if (cellValue) {
        const cellLength = String(cellValue).length;
        if (cellLength > maxLength) {
          maxLength = Math.min(cellLength, 40);
        }
      }
    });
    column.width = maxLength + 1;
  });

  // Generate filename
  let filename = 'Faculty_Selection_Sheet.xlsx';
  if (semesterCode && campusName) {
    filename = `${semesterCode}_${campusName}_Faculty_Selection_Sheet.xlsx`;
  } else if (semesterCode) {
    filename = `${semesterCode}_Faculty_Selection_Sheet.xlsx`;
  } else if (campusName) {
    filename = `${campusName}_Faculty_Selection_Sheet.xlsx`;
  }

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
