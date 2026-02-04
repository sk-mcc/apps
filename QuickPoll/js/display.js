// Display Page functionality
import { db, ref, get, update, onValue, off } from './firebase-config.js';
import {
  getUrlParam,
  generateQRCode,
  buildJoinUrl,
  debounce,
  buildWordFrequency,
  getChartColor,
  QUESTION_TYPES
} from './utils.js';

// State
let sessionCode = null;
let currentSession = null;
let sessionListener = null;
let responsesListener = null;
let connectedListener = null;

// DOM Elements - States
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const displayError = document.getElementById('displayError');
const waitingState = document.getElementById('waitingState');
const questionState = document.getElementById('questionState');
const completeState = document.getElementById('completeState');

// Waiting state elements
const joinUrlDisplay = document.getElementById('joinUrlDisplay');
const displayQrCode = document.getElementById('displayQrCode');
const displaySessionCode = document.getElementById('displaySessionCode');
const waitingConnectedCount = document.getElementById('waitingConnectedCount');

// Question state elements
const displayQuestionNum = document.getElementById('displayQuestionNum');
const displayTotalQuestions = document.getElementById('displayTotalQuestions');
const responseCount = document.getElementById('responseCount');
const connectedCountQuestion = document.getElementById('connectedCountQuestion');
const displayQuestionText = document.getElementById('displayQuestionText');

// Visualization elements
const wordCloudViz = document.getElementById('wordCloudViz');
const wordCloudCanvas = document.getElementById('wordCloudCanvas');
const barChartViz = document.getElementById('barChartViz');
const histogramViz = document.getElementById('histogramViz');
const ratingAverage = document.getElementById('ratingAverage');
const histogramBars = document.getElementById('histogramBars');
const noResponsesYet = document.getElementById('noResponsesYet');

// Control elements
const controlBar = document.getElementById('controlBar');
const beginBtn = document.getElementById('beginBtn');
const closeResponsesBtn = document.getElementById('closeResponsesBtn');
const nextQuestionBtn = document.getElementById('nextQuestionBtn');
const endSessionBtn = document.getElementById('endSessionBtn');

// Modal elements
const endSessionModal = document.getElementById('endSessionModal');
const cancelEndBtn = document.getElementById('cancelEndBtn');
const confirmEndBtn = document.getElementById('confirmEndBtn');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  sessionCode = getUrlParam('session');

  if (!sessionCode) {
    showError('No session code provided.');
    return;
  }

  await loadSession();
  setupEventListeners();
});

function setupEventListeners() {
  beginBtn.addEventListener('click', beginSession);
  closeResponsesBtn.addEventListener('click', closeResponses);
  nextQuestionBtn.addEventListener('click', nextQuestion);
  endSessionBtn.addEventListener('click', showEndModal);
  cancelEndBtn.addEventListener('click', hideEndModal);
  confirmEndBtn.addEventListener('click', confirmEndSession);

  // Auto-hide controls
  setupControlVisibility();
}

function setupControlVisibility() {
  let hideTimeout;

  const showControls = () => {
    controlBar.classList.add('visible');
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      if (!controlBar.classList.contains('always-visible')) {
        controlBar.classList.remove('visible');
      }
    }, 3000);
  };

  document.addEventListener('mousemove', showControls);
  document.addEventListener('touchstart', showControls);
  document.addEventListener('keydown', showControls);
}

async function loadSession() {
  try {
    const sessionRef = ref(db, `sessions/${sessionCode}`);
    const snapshot = await get(sessionRef);

    if (!snapshot.exists()) {
      showError('Session not found.');
      return;
    }

    currentSession = snapshot.val();

    // Setup display based on initial state
    setupDisplay();

    // Subscribe to updates
    subscribeToSession();
    subscribeToResponses();
    subscribeToConnected();

  } catch (error) {
    console.error('Error loading session:', error);
    showError('Failed to load session.');
  }
}

function setupDisplay() {
  const joinUrl = buildJoinUrl(sessionCode);
  joinUrlDisplay.textContent = joinUrl;
  displaySessionCode.textContent = sessionCode;
  displayTotalQuestions.textContent = currentSession.questions?.length || 0;

  // Generate QR code
  generateQRCode(joinUrl, displayQrCode, { width: 256, height: 256 });

  // Initial state
  handleSessionState(currentSession);
}

function subscribeToSession() {
  const sessionRef = ref(db, `sessions/${sessionCode}`);
  sessionListener = onValue(sessionRef, (snapshot) => {
    if (!snapshot.exists()) return;
    currentSession = snapshot.val();
    handleSessionState(currentSession);
  });
}

function subscribeToResponses() {
  const responsesRef = ref(db, `sessions/${sessionCode}/responses`);
  responsesListener = onValue(responsesRef, (snapshot) => {
    updateVisualization(snapshot.val());
  });
}

function subscribeToConnected() {
  const connectedRef = ref(db, `sessions/${sessionCode}/connected`);
  connectedListener = onValue(connectedRef, (snapshot) => {
    const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
    waitingConnectedCount.textContent = count;
    connectedCountQuestion.textContent = count;
  });
}

function handleSessionState(session) {
  // Update controls visibility
  updateControls(session);

  // Session ended
  if (session.status === 'ended') {
    showState('complete');
    return;
  }

  // Waiting to start
  if (session.currentQuestion < 0) {
    showState('waiting');
    return;
  }

  // Show question
  const question = session.questions[session.currentQuestion];
  renderQuestion(question, session.currentQuestion);
  showState('question');
}

function updateControls(session) {
  // Hide all controls first
  beginBtn.classList.add('hidden');
  closeResponsesBtn.classList.add('hidden');
  nextQuestionBtn.classList.add('hidden');
  endSessionBtn.classList.add('hidden');

  if (session.status === 'ended') {
    return;
  }

  // Waiting state - show Begin button
  if (session.currentQuestion < 0) {
    beginBtn.classList.remove('hidden');
    endSessionBtn.classList.remove('hidden');
    return;
  }

  // Question active
  if (session.questionStatus === 'open') {
    closeResponsesBtn.classList.remove('hidden');
  } else {
    // Responses closed
    const isLastQuestion = session.currentQuestion >= session.questions.length - 1;
    if (!isLastQuestion) {
      nextQuestionBtn.classList.remove('hidden');
    }
  }

  endSessionBtn.classList.remove('hidden');
}

function renderQuestion(question, index) {
  displayQuestionNum.textContent = index + 1;
  displayQuestionText.textContent = question.text;

  // Hide all visualizations
  wordCloudViz.classList.add('hidden');
  barChartViz.classList.add('hidden');
  histogramViz.classList.add('hidden');
  noResponsesYet.classList.add('hidden');

  // Show appropriate visualization placeholder
  showVisualizationPlaceholder(question.type);
}

function showVisualizationPlaceholder(type) {
  switch (type) {
    case QUESTION_TYPES.OPEN:
      wordCloudViz.classList.remove('hidden');
      break;
    case QUESTION_TYPES.CHOICE:
      barChartViz.classList.remove('hidden');
      break;
    case QUESTION_TYPES.RATING:
      histogramViz.classList.remove('hidden');
      break;
  }
}

// Debounced visualization update
const updateVisualization = debounce((responses) => {
  if (!currentSession || currentSession.currentQuestion < 0) return;

  const question = currentSession.questions[currentSession.currentQuestion];
  const questionResponses = getResponsesForQuestion(responses, question.id);

  // Update response count
  responseCount.textContent = questionResponses.length;

  if (questionResponses.length === 0) {
    noResponsesYet.classList.remove('hidden');
    return;
  }

  noResponsesYet.classList.add('hidden');

  switch (question.type) {
    case QUESTION_TYPES.OPEN:
      renderWordCloud(questionResponses);
      break;
    case QUESTION_TYPES.CHOICE:
      renderBarChart(questionResponses, question.options);
      break;
    case QUESTION_TYPES.RATING:
      renderHistogram(questionResponses, question.scaleSize);
      break;
  }
}, 250);

function getResponsesForQuestion(responses, questionId) {
  if (!responses) return [];

  const values = [];
  Object.values(responses).forEach(userResponses => {
    if (userResponses && userResponses[questionId] !== undefined) {
      values.push(userResponses[questionId]);
    }
  });
  return values;
}

function renderWordCloud(responses) {
  const wordFrequency = buildWordFrequency(responses);

  if (wordFrequency.length === 0) {
    noResponsesYet.classList.remove('hidden');
    return;
  }

  // Clear canvas
  const ctx = wordCloudCanvas.getContext('2d');
  ctx.clearRect(0, 0, wordCloudCanvas.width, wordCloudCanvas.height);

  // Set canvas size
  const container = wordCloudViz;
  wordCloudCanvas.width = container.offsetWidth || 800;
  wordCloudCanvas.height = container.offsetHeight || 400;

  // Find max weight for scaling
  const maxWeight = Math.max(...wordFrequency.map(w => w[1]));

  // Render word cloud
  if (typeof WordCloud !== 'undefined') {
    WordCloud(wordCloudCanvas, {
      list: wordFrequency,
      gridSize: 16,
      weightFactor: (size) => Math.max(20, (size / maxWeight) * 80),
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: () => {
        const colors = ['#7c9cb0', '#a3c4bc', '#c9a86c', '#9b8bb8', '#8cb87d'];
        return colors[Math.floor(Math.random() * colors.length)];
      },
      rotateRatio: 0.3,
      backgroundColor: 'transparent',
      shuffle: false
    });
  }

  wordCloudViz.classList.remove('hidden');
}

function renderBarChart(responses, options) {
  // Count responses per option
  const counts = {};
  options.forEach(opt => counts[opt] = 0);
  responses.forEach(response => {
    if (counts[response] !== undefined) {
      counts[response]++;
    }
  });

  const maxCount = Math.max(...Object.values(counts), 1);

  barChartViz.innerHTML = options.map((option, index) => {
    const count = counts[option] || 0;
    const percentage = (count / maxCount) * 100;

    return `
      <div class="bar-chart__item">
        <div class="bar-chart__label">${escapeHtml(option)}</div>
        <div class="bar-chart__bar-container">
          <div class="bar-chart__bar" style="width: ${percentage}%; background: ${getChartColor(index)}">
            <span class="bar-chart__count">${count}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  barChartViz.classList.remove('hidden');
}

function renderHistogram(responses, scaleSize) {
  // Count responses per rating value
  const counts = {};
  for (let i = 1; i <= scaleSize; i++) {
    counts[i] = 0;
  }

  let sum = 0;
  responses.forEach(response => {
    const value = parseInt(response, 10);
    if (value >= 1 && value <= scaleSize) {
      counts[value]++;
      sum += value;
    }
  });

  const average = responses.length > 0 ? (sum / responses.length).toFixed(1) : '--';
  ratingAverage.textContent = average;

  const maxCount = Math.max(...Object.values(counts), 1);
  const maxHeight = 200;

  histogramBars.innerHTML = Object.entries(counts).map(([value, count]) => {
    const height = (count / maxCount) * maxHeight;

    return `
      <div class="histogram__bar-wrapper">
        <div class="histogram__bar-count">${count}</div>
        <div class="histogram__bar" style="height: ${Math.max(height, 4)}px"></div>
        <div class="histogram__bar-label">${value}</div>
      </div>
    `;
  }).join('');

  histogramViz.classList.remove('hidden');
}

// Session control functions
async function beginSession() {
  try {
    const sessionRef = ref(db, `sessions/${sessionCode}`);
    await update(sessionRef, {
      status: 'active',
      currentQuestion: 0,
      questionStatus: 'open'
    });
  } catch (error) {
    console.error('Error beginning session:', error);
  }
}

async function closeResponses() {
  try {
    const sessionRef = ref(db, `sessions/${sessionCode}`);
    await update(sessionRef, {
      questionStatus: 'closed'
    });
  } catch (error) {
    console.error('Error closing responses:', error);
  }
}

async function nextQuestion() {
  if (!currentSession) return;

  const nextIndex = currentSession.currentQuestion + 1;
  if (nextIndex >= currentSession.questions.length) return;

  try {
    const sessionRef = ref(db, `sessions/${sessionCode}`);
    await update(sessionRef, {
      currentQuestion: nextIndex,
      questionStatus: 'open'
    });
  } catch (error) {
    console.error('Error advancing question:', error);
  }
}

function showEndModal() {
  endSessionModal.classList.add('active');
}

function hideEndModal() {
  endSessionModal.classList.remove('active');
}

async function confirmEndSession() {
  hideEndModal();

  try {
    const sessionRef = ref(db, `sessions/${sessionCode}`);
    await update(sessionRef, {
      status: 'ended'
    });
  } catch (error) {
    console.error('Error ending session:', error);
  }
}

function showState(state) {
  loadingState.classList.add('hidden');
  errorState.classList.add('hidden');
  waitingState.classList.add('hidden');
  questionState.classList.add('hidden');
  completeState.classList.add('hidden');

  switch (state) {
    case 'loading':
      loadingState.classList.remove('hidden');
      break;
    case 'error':
      errorState.classList.remove('hidden');
      break;
    case 'waiting':
      waitingState.classList.remove('hidden');
      break;
    case 'question':
      questionState.classList.remove('hidden');
      break;
    case 'complete':
      completeState.classList.remove('hidden');
      break;
  }
}

function showError(message) {
  displayError.textContent = message;
  showState('error');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (sessionListener) off(ref(db, `sessions/${sessionCode}`));
  if (responsesListener) off(ref(db, `sessions/${sessionCode}/responses`));
  if (connectedListener) off(ref(db, `sessions/${sessionCode}/connected`));
});
