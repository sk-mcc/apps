// Configuration constants for the Selection Sheet Tool

const HEADER_KEYWORDS = [
  'Section ID', 'Dept', 'Section Name', 'Start Date', 'End Date',
  'Bldg', 'Room', 'Days', 'Start Time', 'End Time', '# of Weeks',
  'Section Capacity', 'Primary Faculty Name', 'Instr Method'
];

const equatedHours = {
  'ENGL 1170': 2,
  'ENGL 1181': 5,
  'ENGL 1190': 5,
  'ENGL 1191': 5,
  'ENGL 1210': 4,
  'ENGL 1220': 4,
  'ENGL 1211': 4,
  'ENGL 1221': 4,
};

const creditHours = {
  'ENGL 1170': 1,
  'ENGL 1181': 4,
  'ENGL 1190': 4,
  'ENGL 1191': 4,
  'ENGL 1210': 3,
  'ENGL 1220': 3,
  'ENGL 1211': 3,
  'ENGL 1221': 3,
  'ENGL 1730': 3,
  'ENGL 2410': 3,
  'ENGL 2420': 3,
  'ENGL 2740': 3,
};

function getEquatedHours(course) {
  return equatedHours[course] || '';
}

function getCreditHours(course) {
  // Check explicit mapping first
  if (creditHours[course]) {
    return creditHours[course];
  }
  // All 2000-level courses default to 3 credit hours
  if (course && course.match(/ENGL 2\d{3}/)) {
    return 3;
  }
  // Default fallback
  return 3;
}
