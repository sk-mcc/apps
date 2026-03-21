// Student Response Page functionality
import { db, ref, set, get, onValue, off, onDisconnect } from './firebase-config.js';
import {
  getUrlParam,
  getVisitorId,
  hasSubmitted,
  markAsSubmitted,
  sanitizeInput,
  QUESTION_TYPES
} from './utils.js';

// State
let sessionCode = null;
let visitorId = null;
let currentSession = null;
let currentQuestionIndex = -1;
let sessionListener = null;

// DOM Elements
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const waitingState = document.getElementById('waitingState');
const waitingSessionCode = document.getElementById('waitingSessionCode');
const questionState = document.getElementById('questionState');
const questionNumber = document.getElementById('questionNumber');
const questionText = document.getElementById('questionText');
const openResponse = document.getElementById('openResponse');
const openInput = document.getElementById('openInput');
const submitOpenBtn = document.getElementById('submitOpenBtn');
const choiceResponse = document.getElementById('choiceResponse');
const ratingResponse = document.getElementById('ratingResponse');
const ratingMinLabel = document.getElementById('ratingMinLabel');
const ratingMaxLabel = document.getElementById('ratingMaxLabel');
const ratingOptions = document.getElementById('ratingOptions');
const submittedState = document.getElementById('submittedState');
const endedState = document.getElementById('endedState');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  sessionCode = getUrlParam('session');
  visitorId = getVisitorId();

  if (!sessionCode) {
    showError('No session code provided. Please use the join page.');
    return;
  }

  await joinSession();
});

async function joinSession() {
  try {
    // Validate session exists
    const sessionRef = ref(db, `sessions/${sessionCode}`);
    const snapshot = await get(sessionRef);

    if (!snapshot.exists()) {
      showError('Session not found. Please check the code and try again.');
      return;
    }

    const session = snapshot.val();

    if (session.status === 'ended') {
      showState('ended');
      return;
    }

    currentSession = session;

    // Register presence
    await registerPresence();

    // Subscribe to session updates
    subscribeToSession();

    // Show initial state based on session status
    handleSessionState(session);

  } catch (error) {
    console.error('Error joining session:', error);
    showError('Unable to connect. Please try again.');
  }
}

async function registerPresence() {
  const presenceRef = ref(db, `sessions/${sessionCode}/connected/${visitorId}`);
  const connectedRef = ref(db, '.info/connected');

  onValue(connectedRef, async (snapshot) => {
    if (snapshot.val() === true) {
      // Set presence
      await set(presenceRef, true);
      // Remove on disconnect
      onDisconnect(presenceRef).remove();
    }
  });
}

function subscribeToSession() {
  const sessionRef = ref(db, `sessions/${sessionCode}`);

  sessionListener = onValue(sessionRef, (snapshot) => {
    if (!snapshot.exists()) {
      showError('Session no longer exists.');
      return;
    }

    const session = snapshot.val();
    currentSession = session;
    handleSessionState(session);
  });
}

function handleSessionState(session) {
  // Session ended
  if (session.status === 'ended') {
    showState('ended');
    return;
  }

  // Waiting to start
  if (session.currentQuestion < 0) {
    waitingSessionCode.textContent = sessionCode;
    showState('waiting');
    return;
  }

  const questionIndex = session.currentQuestion;
  const question = session.questions[questionIndex];

  // Check if already submitted for this question
  if (hasSubmitted(sessionCode, question.id)) {
    showState('submitted');
    return;
  }

  // Question is active and accepting responses
  if (session.questionStatus === 'open') {
    // Only re-render if question changed
    if (currentQuestionIndex !== questionIndex) {
      currentQuestionIndex = questionIndex;
      renderQuestion(question, questionIndex);
    }
    showState('question');
  } else {
    // Responses closed, show waiting
    if (hasSubmitted(sessionCode, question.id)) {
      showState('submitted');
    } else {
      // Missed the window - still show submitted state
      showState('submitted');
    }
  }
}

function renderQuestion(question, index) {
  questionNumber.textContent = index + 1;
  questionText.textContent = question.text;

  // Hide all response types
  openResponse.classList.add('hidden');
  choiceResponse.classList.add('hidden');
  ratingResponse.classList.add('hidden');

  // Render appropriate response type
  switch (question.type) {
    case QUESTION_TYPES.OPEN:
      renderOpenResponse();
      break;
    case QUESTION_TYPES.CHOICE:
      renderChoiceResponse(question);
      break;
    case QUESTION_TYPES.RATING:
      renderRatingResponse(question);
      break;
  }
}

function renderOpenResponse() {
  openInput.value = '';
  openResponse.classList.remove('hidden');

  // Setup submit handler
  submitOpenBtn.onclick = async () => {
    const response = sanitizeInput(openInput.value);
    if (!response) {
      openInput.focus();
      return;
    }
    await submitResponse(response);
  };
}

function renderChoiceResponse(question) {
  choiceResponse.innerHTML = question.options.map((option, index) => `
    <button type="button" class="choice-option" data-value="${index}">
      ${escapeHtml(option)}
    </button>
  `).join('');

  choiceResponse.classList.remove('hidden');

  // Setup click handlers
  choiceResponse.querySelectorAll('.choice-option').forEach(btn => {
    btn.onclick = async () => {
      const value = btn.dataset.value;
      await submitResponse(question.options[parseInt(value, 10)]);
    };
  });
}

function renderRatingResponse(question) {
  ratingMinLabel.textContent = question.minLabel;
  ratingMaxLabel.textContent = question.maxLabel;

  ratingOptions.innerHTML = '';
  for (let i = 1; i <= question.scaleSize; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rating-option';
    btn.textContent = i;
    btn.dataset.value = i;
    btn.onclick = async () => {
      await submitResponse(i);
    };
    ratingOptions.appendChild(btn);
  }

  ratingResponse.classList.remove('hidden');
}

async function submitResponse(value) {
  const question = currentSession.questions[currentQuestionIndex];

  // Disable all inputs during submission
  setSubmitting(true);

  try {
    const responseRef = ref(db, `sessions/${sessionCode}/responses/${visitorId}/${question.id}`);
    await set(responseRef, value);

    // Mark as submitted locally
    markAsSubmitted(sessionCode, question.id);

    // Show confirmation
    showState('submitted');

  } catch (error) {
    console.error('Error submitting response:', error);
    setSubmitting(false);
    alert('Failed to submit response. Please try again.');
  }
}

function setSubmitting(submitting) {
  // Disable open response
  submitOpenBtn.disabled = submitting;
  openInput.disabled = submitting;

  // Disable choice options
  choiceResponse.querySelectorAll('.choice-option').forEach(btn => {
    btn.disabled = submitting;
  });

  // Disable rating options
  ratingOptions.querySelectorAll('.rating-option').forEach(btn => {
    btn.disabled = submitting;
  });
}

function showState(state) {
  // Hide all states
  loadingState.classList.add('hidden');
  errorState.classList.add('hidden');
  waitingState.classList.add('hidden');
  questionState.classList.add('hidden');
  submittedState.classList.add('hidden');
  endedState.classList.add('hidden');

  // Show requested state
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
    case 'submitted':
      submittedState.classList.remove('hidden');
      break;
    case 'ended':
      endedState.classList.remove('hidden');
      break;
  }
}

function showError(message) {
  errorMessage.textContent = message;
  showState('error');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (sessionListener) {
    off(ref(db, `sessions/${sessionCode}`));
  }
});
