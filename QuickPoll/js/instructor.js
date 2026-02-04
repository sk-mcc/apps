// Instructor Panel functionality
import { db, ref, push, set, get, update, onValue, off } from './firebase-config.js';
import {
  generateSessionCode,
  generateQRCode,
  buildJoinUrl,
  buildDisplayUrl,
  copyToClipboard
} from './utils.js';

// State
let currentSession = null;
let currentQuiz = null;
let sessionListener = null;
let presenceListener = null;

// DOM Elements
const sessionSetup = document.getElementById('sessionSetup');
const activeSession = document.getElementById('activeSession');
const quizSelect = document.getElementById('quizSelect');
const quizPreview = document.getElementById('quizPreview');
const previewTitle = document.getElementById('previewTitle');
const previewInfo = document.getElementById('previewInfo');
const startSessionBtn = document.getElementById('startSessionBtn');
const setupError = document.getElementById('setupError');

// Active session elements
const sessionCodeDisplay = document.getElementById('sessionCodeDisplay');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const qrCode = document.getElementById('qrCode');
const joinUrl = document.getElementById('joinUrl');
const connectedCount = document.getElementById('connectedCount');
const activeQuizTitle = document.getElementById('activeQuizTitle');
const currentQuestionNum = document.getElementById('currentQuestionNum');
const totalQuestions = document.getElementById('totalQuestions');
const sessionStatus = document.getElementById('sessionStatus');
const openDisplayBtn = document.getElementById('openDisplayBtn');
const endSessionBtn = document.getElementById('endSessionBtn');

// Modal elements
const endSessionModal = document.getElementById('endSessionModal');
const cancelEndBtn = document.getElementById('cancelEndBtn');
const confirmEndBtn = document.getElementById('confirmEndBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadQuizzes();
  setupEventListeners();
});

function setupEventListeners() {
  quizSelect.addEventListener('change', handleQuizSelect);
  startSessionBtn.addEventListener('click', startSession);
  copyCodeBtn.addEventListener('click', handleCopyCode);
  endSessionBtn.addEventListener('click', showEndModal);
  cancelEndBtn.addEventListener('click', hideEndModal);
  confirmEndBtn.addEventListener('click', confirmEndSession);
}

async function loadQuizzes() {
  try {
    const quizzesRef = ref(db, 'quizzes');
    const snapshot = await get(quizzesRef);

    quizSelect.innerHTML = '<option value="">-- Choose a quiz --</option>';

    if (snapshot.exists()) {
      const quizzes = snapshot.val();
      Object.entries(quizzes).forEach(([id, quiz]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = quiz.title || 'Untitled Quiz';
        quizSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error loading quizzes:', error);
    showSetupError('Failed to load quizzes. Please refresh the page.');
  }
}

async function handleQuizSelect() {
  const quizId = quizSelect.value;
  hideSetupError();

  if (!quizId) {
    quizPreview.classList.add('hidden');
    startSessionBtn.disabled = true;
    currentQuiz = null;
    return;
  }

  try {
    const quizRef = ref(db, `quizzes/${quizId}`);
    const snapshot = await get(quizRef);

    if (snapshot.exists()) {
      currentQuiz = { id: quizId, ...snapshot.val() };

      previewTitle.textContent = currentQuiz.title;
      previewInfo.textContent = `${currentQuiz.questions?.length || 0} questions`;

      quizPreview.classList.remove('hidden');
      startSessionBtn.disabled = false;
    }
  } catch (error) {
    console.error('Error loading quiz:', error);
    showSetupError('Failed to load quiz details.');
  }
}

async function startSession() {
  if (!currentQuiz) return;

  hideSetupError();
  startSessionBtn.disabled = true;
  startSessionBtn.textContent = 'Starting...';

  try {
    // Generate unique session code
    const code = await getUniqueSessionCode();

    // Create session in Firebase
    const sessionRef = ref(db, `sessions/${code}`);
    await set(sessionRef, {
      quizId: currentQuiz.id,
      quizTitle: currentQuiz.title,
      questions: currentQuiz.questions,
      createdAt: Date.now(),
      status: 'waiting',
      currentQuestion: -1, // -1 means not started
      questionStatus: 'closed'
    });

    currentSession = {
      code,
      ...currentQuiz
    };

    // Switch to active session view
    showActiveSession();

    // Start listening to session updates
    subscribeToSession(code);

  } catch (error) {
    console.error('Error starting session:', error);
    showSetupError('Failed to start session. Please try again.');
    startSessionBtn.disabled = false;
    startSessionBtn.textContent = 'Start Session';
  }
}

async function getUniqueSessionCode() {
  for (let i = 0; i < 5; i++) {
    const code = generateSessionCode();
    const sessionRef = ref(db, `sessions/${code}`);
    const snapshot = await get(sessionRef);

    if (!snapshot.exists()) {
      return code;
    }
  }
  throw new Error('Could not generate unique session code');
}

function showActiveSession() {
  sessionSetup.classList.add('hidden');
  activeSession.classList.remove('hidden');

  // Update session info
  sessionCodeDisplay.textContent = currentSession.code;
  activeQuizTitle.textContent = currentSession.title;
  totalQuestions.textContent = currentSession.questions?.length || 0;

  // Generate QR code
  const joinUrlStr = buildJoinUrl(currentSession.code);
  generateQRCode(joinUrlStr, qrCode, { width: 200, height: 200 });
  joinUrl.textContent = joinUrlStr;

  // Set display page link
  const displayUrlStr = buildDisplayUrl(currentSession.code);
  openDisplayBtn.href = displayUrlStr;
}

function subscribeToSession(code) {
  // Listen to session state
  const sessionRef = ref(db, `sessions/${code}`);
  sessionListener = onValue(sessionRef, (snapshot) => {
    if (!snapshot.exists()) return;

    const session = snapshot.val();
    updateSessionDisplay(session);
  });

  // Listen to presence (connected count)
  const connectedRef = ref(db, `sessions/${code}/connected`);
  presenceListener = onValue(connectedRef, (snapshot) => {
    const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
    connectedCount.textContent = count;
  });
}

function updateSessionDisplay(session) {
  // Update question progress
  const questionNum = session.currentQuestion >= 0 ? session.currentQuestion + 1 : 0;
  currentQuestionNum.textContent = questionNum;

  // Update status
  if (session.status === 'ended') {
    sessionStatus.textContent = 'Session ended';
    sessionStatus.className = 'text-lg text-error';
  } else if (session.currentQuestion < 0) {
    sessionStatus.textContent = 'Waiting to begin';
    sessionStatus.className = 'text-lg text-muted';
  } else if (session.questionStatus === 'open') {
    sessionStatus.textContent = 'Collecting responses';
    sessionStatus.className = 'text-lg text-success';
  } else {
    sessionStatus.textContent = 'Responses closed';
    sessionStatus.className = 'text-lg text-warning';
  }
}

async function handleCopyCode() {
  if (!currentSession) return;

  const success = await copyToClipboard(currentSession.code);
  if (success) {
    copyCodeBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyCodeBtn.textContent = 'Copy Code';
    }, 2000);
  }
}

function showEndModal() {
  endSessionModal.classList.add('active');
}

function hideEndModal() {
  endSessionModal.classList.remove('active');
}

async function confirmEndSession() {
  if (!currentSession) return;

  hideEndModal();
  endSessionBtn.disabled = true;

  try {
    const sessionRef = ref(db, `sessions/${currentSession.code}`);
    await update(sessionRef, {
      status: 'ended'
    });

    // Cleanup listeners
    if (sessionListener) {
      off(ref(db, `sessions/${currentSession.code}`));
    }
    if (presenceListener) {
      off(ref(db, `sessions/${currentSession.code}/connected`));
    }

    // Reset state
    currentSession = null;
    currentQuiz = null;

    // Return to setup view
    sessionSetup.classList.remove('hidden');
    activeSession.classList.add('hidden');
    startSessionBtn.disabled = false;
    startSessionBtn.textContent = 'Start Session';
    quizSelect.value = '';
    quizPreview.classList.add('hidden');

  } catch (error) {
    console.error('Error ending session:', error);
    endSessionBtn.disabled = false;
  }
}

function showSetupError(message) {
  setupError.textContent = message;
  setupError.classList.remove('hidden');
}

function hideSetupError() {
  setupError.classList.add('hidden');
}
