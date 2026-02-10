// Utility functions for the Selection Sheet Tool

function parseSectionName(name) {
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

function getMode(code) {
  const modes = { 'C': 'In-Person', 'S': 'In-Person', 'O': 'Online', 'H': 'Hybrid', 'R': 'Remote' };
  return modes[code] || 'Unknown';
}

function getCampus(code, dept) {
  if (code === 'H') {
    const deptUpper = (dept || '').toUpperCase().trim();
    if (deptUpper === 'COMMC') return 'Center';
    if (deptUpper === 'COMMS') return 'South';
    return 'Unknown';
  }
  const campuses = { 'C': 'Center', 'S': 'South', 'O': 'Online', 'R': 'Online' };
  return campuses[code] || 'Unknown';
}

function formatDate(date) {
  if (!date) return '';
  if (date instanceof Date) {
    return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)}`;
  }
  return String(date);
}

function formatTimeRange(start, end) {
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

function parseDate(str) {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[0], 10) - 1;
  const day = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);
  year = year < 50 ? 2000 + year : 1900 + year;
  return new Date(year, month, day);
}

function toMinutes(time) {
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

function countMeetingDays(daysStr) {
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
