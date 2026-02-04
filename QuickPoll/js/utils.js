// Shared utility functions for QuickPoll

// Valid characters for session codes (excludes 0, O, I, L, 1)
const SESSION_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Generate a random 4-character session code
 * @returns {string} 4-character uppercase session code
 */
export function generateSessionCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    const randomIndex = Math.floor(Math.random() * SESSION_CODE_CHARS.length);
    code += SESSION_CODE_CHARS[randomIndex];
  }
  return code;
}

/**
 * Validate session code format (4 uppercase alphanumeric, excluding ambiguous chars)
 * @param {string} code - Session code to validate
 * @returns {boolean} True if valid format
 */
export function validateSessionCodeFormat(code) {
  if (!code || typeof code !== 'string') return false;
  if (code.length !== 4) return false;

  const validPattern = new RegExp(`^[${SESSION_CODE_CHARS}]{4}$`);
  return validPattern.test(code.toUpperCase());
}

/**
 * Normalize session code input (uppercase, trim whitespace)
 * @param {string} code - Raw session code input
 * @returns {string} Normalized session code
 */
export function normalizeSessionCode(code) {
  if (!code || typeof code !== 'string') return '';
  return code.trim().toUpperCase();
}

// Visitor ID management
const VISITOR_ID_KEY = 'quickpoll_visitor_id';

/**
 * Get or create a unique visitor ID
 * @returns {string} Visitor ID
 */
export function getVisitorId() {
  let visitorId = localStorage.getItem(VISITOR_ID_KEY);
  if (!visitorId) {
    visitorId = generateVisitorId();
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
  }
  return visitorId;
}

/**
 * Generate a unique visitor ID
 * @returns {string} New visitor ID
 */
function generateVisitorId() {
  return 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Generate a unique ID for questions, etc.
 * @param {string} prefix - Prefix for the ID (e.g., 'q' for question)
 * @returns {string} Unique ID
 */
export function generateId(prefix = 'id') {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

// QR Code generation
/**
 * Generate a QR code and render it to an element
 * @param {string} url - URL to encode
 * @param {HTMLElement} element - Container element for QR code
 * @param {object} options - Optional QR code options
 */
export function generateQRCode(url, element, options = {}) {
  // Clear existing content
  element.innerHTML = '';

  // Check if QRCode library is loaded
  if (typeof QRCode === 'undefined') {
    console.error('QRCode library not loaded');
    element.innerHTML = '<p class="text-error">QR Code library not available</p>';
    return;
  }

  // Default options for dark mode display
  const defaultOptions = {
    text: url,
    width: 200,
    height: 200,
    colorDark: '#0d0d0d',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  };

  new QRCode(element, { ...defaultOptions, ...options });
}

/**
 * Build the join URL for a session
 * @param {string} sessionCode - Session code
 * @returns {string} Full join URL
 */
export function buildJoinUrl(sessionCode) {
  const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
  return `${baseUrl}/join.html?code=${sessionCode}`;
}

/**
 * Build the display URL for a session
 * @param {string} sessionCode - Session code
 * @returns {string} Full display URL
 */
export function buildDisplayUrl(sessionCode) {
  const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
  return `${baseUrl}/display.html?session=${sessionCode}`;
}

// Debounce utility
/**
 * Debounce a function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// URL parameter helpers
/**
 * Get a URL parameter value
 * @param {string} name - Parameter name
 * @returns {string|null} Parameter value or null
 */
export function getUrlParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// Submission tracking (prevent duplicate responses)
/**
 * Check if user has already submitted for a question in a session
 * @param {string} sessionCode - Session code
 * @param {string} questionId - Question ID
 * @returns {boolean} True if already submitted
 */
export function hasSubmitted(sessionCode, questionId) {
  const key = `submitted_${sessionCode}_${questionId}`;
  return localStorage.getItem(key) === 'true';
}

/**
 * Mark a question as submitted
 * @param {string} sessionCode - Session code
 * @param {string} questionId - Question ID
 */
export function markAsSubmitted(sessionCode, questionId) {
  const key = `submitted_${sessionCode}_${questionId}`;
  localStorage.setItem(key, 'true');
}

/**
 * Clear all submission tracking for a session
 * @param {string} sessionCode - Session code
 */
export function clearSessionSubmissions(sessionCode) {
  const prefix = `submitted_${sessionCode}_`;
  const keysToRemove = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
}

// Text processing utilities
/**
 * Sanitize user input (basic XSS prevention, trim)
 * @param {string} input - User input
 * @returns {string} Sanitized string
 */
export function sanitizeInput(input) {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .substring(0, 1000); // Limit length
}

/**
 * Process text for word cloud (lowercase, normalize whitespace, preserve emojis)
 * @param {string} text - Input text
 * @returns {string} Processed text
 */
export function normalizeForWordCloud(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '') // Remove punctuation but keep emojis
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Build word frequency map from an array of responses
 * @param {string[]} responses - Array of text responses
 * @returns {Array} Array of [word, count] pairs for word cloud
 */
export function buildWordFrequency(responses) {
  const frequency = {};

  responses.forEach(response => {
    const normalized = normalizeForWordCloud(String(response));
    const words = normalized.split(' ');
    words.forEach(word => {
      if (word) { // Allow any non-empty word including single chars/emojis
        frequency[word] = (frequency[word] || 0) + 1;
      }
    });
  });

  // Convert to array format for wordcloud2
  return Object.entries(frequency).map(([word, count]) => [word, count]);
}

// Question type helpers
export const QUESTION_TYPES = {
  OPEN: 'open',
  CHOICE: 'choice',
  RATING: 'rating'
};

/**
 * Get display name for question type
 * @param {string} type - Question type
 * @returns {string} Human-readable type name
 */
export function getQuestionTypeName(type) {
  const names = {
    [QUESTION_TYPES.OPEN]: 'Open Response',
    [QUESTION_TYPES.CHOICE]: 'Multiple Choice',
    [QUESTION_TYPES.RATING]: 'Rating Scale'
  };
  return names[type] || type;
}

// Clipboard helper
/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}

// Chart color helper
const CHART_COLORS = [
  '#7c9cb0',
  '#a3c4bc',
  '#c9a86c',
  '#b87070',
  '#9b8bb8',
  '#8cb87d'
];

/**
 * Get chart color by index
 * @param {number} index - Color index
 * @returns {string} CSS color value
 */
export function getChartColor(index) {
  return CHART_COLORS[index % CHART_COLORS.length];
}
