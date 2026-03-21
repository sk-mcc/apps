// Excel export from Firebase data for selection tool
import { loadRawRows } from './selection-firebase.js';

// Bundle colors matching sort-excel.js
const BUNDLE_COLORS_ARGB = [
  'FFE3F2FD', 'FFF3E5F5', 'FFE8F5E9', 'FFFFF8E1',
  'FFFCE4EC', 'FFE0F7FA', 'FFFBE9E7', 'FFF1F8E9',
];
const BUNDLE_BORDER_COLOR = { argb: 'FF4472C4' };

/**
 * Export a two-tab Excel workbook from Firebase schedule data
 * Tab 1: Selection Sheet (with faculty selections, bundle colors, flags)
 * Tab 2: Original Sorted (raw data with EAPP rows)
 * @param {object} schedule - { id, metadata, sections, bundles }
 */
export async function exportSelectionExcel(schedule) {
  const { id, metadata, sections, bundles } = schedule;

  // Fetch raw rows for the second tab
  const rawRowsData = await loadRawRows(id);

  const workbook = new ExcelJS.Workbook();

  // Tab 1: Selection Sheet
  addSelectionSheetFromFirebase(workbook, 'Selection Sheet', sections, bundles, metadata.campus);

  // Tab 2: Original Sorted (if raw data available)
  if (rawRowsData && rawRowsData.headers && rawRowsData.rows) {
    const rows = Array.isArray(rawRowsData.rows) ? rawRowsData.rows : Object.values(rawRowsData.rows);
    addOriginalSortedSheet(workbook, 'Original Sorted', rawRowsData.headers, rows);
  }

  // Generate filename
  const prefix = metadata.semester ? `${metadata.semester}_` : '';
  const campusLabel = metadata.campus === 'South' ? 'South_Campus' : metadata.campus;
  const filename = `${prefix}${campusLabel}_Selection_Schedule.xlsx`;

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function addSelectionSheetFromFirebase(workbook, sheetName, sections, bundles, campusName) {
  const ws = workbook.addWorksheet(sheetName);

  // Determine if online schedule
  const onlineCount = sections.filter(s => s.modeCode === 'O').length;
  const isOnlineSchedule = campusName === 'Online' || onlineCount > sections.length / 2;

  // Filter out hybrid from online
  const sectionsToExport = isOnlineSchedule
    ? sections.filter(s => s.modeCode !== 'H')
    : sections;

  // Column definitions (same as sort-excel.js)
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
  const headerRow = ws.getRow(1);
  headerRow.height = 24;
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

  // Helper to find column number
  const getColNum = (key) => activeColumns.findIndex(c => c.key === key) + 1;
  const weeksCol = getColNum('weeks');
  const capacityCol = getColNum('capacity');
  const eqHoursCol = getColNum('eqHours');
  const flagsCol = getColNum('flags');

  // Add data rows
  sectionsToExport.forEach((s) => {
    const flagsText = s.flagsText || '';

    const row = ws.addRow({
      course: s.course || '',
      section: s.section || '',
      mode: s.mode || '',
      campus: s.campus || '',
      weeks: s.weeks || '',
      days: s.days || '',
      time: s.timeRange || '',
      building: s.building || '',
      room: s.room || '',
      dates: s.dateRange || '',
      capacity: s.capacity || '',
      eqHours: s.eqHours || '',
      bundleId: s.bundleId || '',
      notes: s.notes || '',
      faculty: s.facultySelection || '',
      flags: flagsText,
    });

    // Row height based on flags content
    const flagLineCount = flagsText ? flagsText.split('\n').length : 0;
    let maxWrappedLines = flagLineCount;
    if (flagsText) {
      flagsText.split('\n').forEach(line => {
        const wrappedLines = Math.ceil(line.length / 45);
        maxWrappedLines = Math.max(maxWrappedLines, wrappedLines);
      });
      maxWrappedLines = Math.max(maxWrappedLines, flagLineCount);
    }
    row.height = Math.max(20, 16 * (maxWrappedLines || 1));

    // Fill color from bundle
    const fillColor = s.bundleColorIndex >= 0
      ? BUNDLE_COLORS_ARGB[s.bundleColorIndex % BUNDLE_COLORS_ARGB.length]
      : 'FFFFFFFF';

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

      // Default borders
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
      };

      // Bundle borders
      if (s.bundleId) {
        if (s.isFirstInBundle) {
          cell.border.top = { style: 'medium', color: BUNDLE_BORDER_COLOR };
        }
        if (s.isLastInBundle) {
          cell.border.bottom = { style: 'medium', color: BUNDLE_BORDER_COLOR };
        }
        if (colNumber === 1) {
          cell.border.left = { style: 'medium', color: BUNDLE_BORDER_COLOR };
        }
        if (colNumber === totalColumns) {
          cell.border.right = { style: 'medium', color: BUNDLE_BORDER_COLOR };
        }
      }
    });
  });
}

function addOriginalSortedSheet(workbook, sheetName, headers, rowsData) {
  const ws = workbook.addWorksheet(sheetName);

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
    const data = rowData.data || rowData;
    const isEAPP = rowData.isEAPP || false;
    const dataRow = ws.addRow(data);

    let maxCellLines = 1;
    (Array.isArray(data) ? data : []).forEach((cellValue, colIdx) => {
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
    if (headers[colIndex]) {
      maxLength = Math.max(maxLength, String(headers[colIndex]).length);
    }
    rowsData.slice(0, 50).forEach(rowData => {
      const data = rowData.data || rowData;
      const cellValue = Array.isArray(data) ? data[colIndex] : undefined;
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
