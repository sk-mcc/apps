// Fallback direct upload for selection tool
// Reuses processFileForSort() from sort-processing.js (loaded via script tag)
import { pushScheduleToFirebase } from './selection-firebase.js';

/**
 * Process an uploaded Excel file and push South Campus data to Firebase
 * Requires sort-processing.js and config.js to be loaded as global scripts
 * @param {File} file
 * @returns {Promise<string>} Schedule ID
 */
export async function processAndPushUpload(file) {
  if (typeof processFileForSort !== 'function') {
    throw new Error('Processing library not loaded');
  }

  const { data, rawData } = await readExcelFile(file);
  const sortedData = processFileForSort(data, rawData);

  if (!sortedData.southProcessed || sortedData.counts.south === 0) {
    throw new Error('No South Campus sections found in the uploaded file');
  }

  const scheduleId = await pushScheduleToFirebase({
    processedData: sortedData.southProcessed,
    campus: 'South',
    semesterCode: sortedData.semesterCode,
    sourceFilename: file.name,
    rawHeaders: sortedData.rawHeaders,
    campusRows: sortedData.southRows,
  });

  return scheduleId;
}

function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileData = new Uint8Array(e.target.result);

        // Read with dates parsed for processing
        const workbook = XLSX.read(fileData, { type: 'array', cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

        // Read again without date parsing for output
        const rawWorkbook = XLSX.read(fileData, { type: 'array', cellDates: false });
        const rawFirstSheet = rawWorkbook.Sheets[rawWorkbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(rawFirstSheet, { header: 1, defval: '', raw: false });

        resolve({ data, rawData });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
