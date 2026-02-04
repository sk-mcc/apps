// Quiz Creator functionality
import { db, ref, push, set, get, remove, serverTimestamp } from './firebase-config.js';
import { generateId, QUESTION_TYPES, getQuestionTypeName, sanitizeInput } from './utils.js';

// State
let currentQuiz = {
  id: null,
  title: '',
  questions: []
};

// DOM Elements
const questionText = document.getElementById('questionText');
const questionType = document.getElementById('questionType');
const choiceFields = document.getElementById('choiceFields');
const ratingFields = document.getElementById('ratingFields');
const optionsList = document.getElementById('optionsList');
const addOptionBtn = document.getElementById('addOptionBtn');
const addQuestionBtn = document.getElementById('addQuestionBtn');
const toggleImportBtn = document.getElementById('toggleImportBtn');
const quickAddMode = document.getElementById('quickAddMode');
const importMode = document.getElementById('importMode');
const jsonImport = document.getElementById('jsonImport');
const importBtn = document.getElementById('importBtn');
const cancelImportBtn = document.getElementById('cancelImportBtn');
const importError = document.getElementById('importError');
const quizTitle = document.getElementById('quizTitle');
const existingQuizzes = document.getElementById('existingQuizzes');
const questionList = document.getElementById('questionList');
const saveQuizBtn = document.getElementById('saveQuizBtn');
const deleteQuizBtn = document.getElementById('deleteQuizBtn');
const newQuizBtn = document.getElementById('newQuizBtn');
const quizError = document.getElementById('quizError');
const quizSuccess = document.getElementById('quizSuccess');

// Rating scale fields
const minLabel = document.getElementById('minLabel');
const maxLabel = document.getElementById('maxLabel');
const scaleSize = document.getElementById('scaleSize');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadExistingQuizzes();
  setupEventListeners();
  updateTypeFields();
});

function setupEventListeners() {
  // Question type change
  questionType.addEventListener('change', updateTypeFields);

  // Add option button
  addOptionBtn.addEventListener('click', addOption);

  // Remove option buttons (delegated)
  optionsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-option')) {
      const optionItem = e.target.closest('.option-item');
      if (optionsList.children.length > 2) {
        optionItem.remove();
      }
    }
  });

  // Add question
  addQuestionBtn.addEventListener('click', addQuestion);

  // Toggle import mode
  toggleImportBtn.addEventListener('click', () => {
    quickAddMode.classList.add('hidden');
    importMode.classList.remove('hidden');
    toggleImportBtn.classList.add('hidden');
  });

  // Import JSON
  importBtn.addEventListener('click', importFromJSON);

  // Cancel import
  cancelImportBtn.addEventListener('click', () => {
    importMode.classList.add('hidden');
    quickAddMode.classList.remove('hidden');
    toggleImportBtn.classList.remove('hidden');
    jsonImport.value = '';
    importError.classList.add('hidden');
  });

  // Load existing quiz
  existingQuizzes.addEventListener('change', loadSelectedQuiz);

  // Save quiz
  saveQuizBtn.addEventListener('click', saveQuiz);

  // Delete quiz
  deleteQuizBtn.addEventListener('click', deleteQuiz);

  // New quiz
  newQuizBtn.addEventListener('click', resetQuiz);

  // Question list actions (delegated)
  questionList.addEventListener('click', handleQuestionAction);
}

function updateTypeFields() {
  const type = questionType.value;

  choiceFields.classList.remove('active');
  ratingFields.classList.remove('active');

  if (type === QUESTION_TYPES.CHOICE) {
    choiceFields.classList.add('active');
  } else if (type === QUESTION_TYPES.RATING) {
    ratingFields.classList.add('active');
  }
}

function addOption() {
  const optionCount = optionsList.children.length + 1;
  const optionItem = document.createElement('div');
  optionItem.className = 'option-item';
  optionItem.innerHTML = `
    <input type="text" class="form-input option-input" placeholder="Option ${optionCount}">
    <button type="button" class="btn btn--small btn--ghost remove-option" title="Remove option">&times;</button>
  `;
  optionsList.appendChild(optionItem);
}

function getQuestionFormData() {
  const type = questionType.value;
  const text = sanitizeInput(questionText.value);

  if (!text) {
    return { error: 'Please enter question text.' };
  }

  const question = {
    id: generateId('q'),
    type,
    text
  };

  if (type === QUESTION_TYPES.CHOICE) {
    const options = Array.from(optionsList.querySelectorAll('.option-input'))
      .map(input => sanitizeInput(input.value))
      .filter(opt => opt.length > 0);

    if (options.length < 2) {
      return { error: 'Multiple choice questions require at least 2 options.' };
    }
    question.options = options;
  }

  if (type === QUESTION_TYPES.RATING) {
    const min = sanitizeInput(minLabel.value);
    const max = sanitizeInput(maxLabel.value);
    const size = parseInt(scaleSize.value, 10);

    if (!min || !max) {
      return { error: 'Rating scale requires both min and max labels.' };
    }
    question.minLabel = min;
    question.maxLabel = max;
    question.scaleSize = size;
  }

  return { question };
}

function addQuestion() {
  hideMessages();

  const result = getQuestionFormData();
  if (result.error) {
    showError(result.error);
    return;
  }

  currentQuiz.questions.push(result.question);
  renderQuestionList();
  clearQuestionForm();
  showSuccess('Question added!');
}

function clearQuestionForm() {
  questionText.value = '';
  questionType.value = QUESTION_TYPES.OPEN;
  updateTypeFields();

  // Reset options to 2
  optionsList.innerHTML = `
    <div class="option-item">
      <input type="text" class="form-input option-input" placeholder="Option 1">
      <button type="button" class="btn btn--small btn--ghost remove-option" title="Remove option">&times;</button>
    </div>
    <div class="option-item">
      <input type="text" class="form-input option-input" placeholder="Option 2">
      <button type="button" class="btn btn--small btn--ghost remove-option" title="Remove option">&times;</button>
    </div>
  `;

  minLabel.value = '';
  maxLabel.value = '';
  scaleSize.value = '5';
}

function renderQuestionList() {
  if (currentQuiz.questions.length === 0) {
    questionList.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__title">No questions yet</p>
        <p class="text-muted text-sm">Add questions using the form on the left</p>
      </div>
    `;
    return;
  }

  questionList.innerHTML = currentQuiz.questions.map((q, index) => `
    <div class="question-item" data-index="${index}">
      <span class="question-item__number">${index + 1}</span>
      <div class="question-item__content">
        <p class="question-item__text">${escapeHtml(q.text)}</p>
        <p class="question-item__type">${getQuestionTypeName(q.type)}${getQuestionDetails(q)}</p>
      </div>
      <div class="question-item__actions">
        <button type="button" class="btn btn--small btn--ghost move-up" ${index === 0 ? 'disabled' : ''} title="Move up">&#9650;</button>
        <button type="button" class="btn btn--small btn--ghost move-down" ${index === currentQuiz.questions.length - 1 ? 'disabled' : ''} title="Move down">&#9660;</button>
        <button type="button" class="btn btn--small btn--ghost delete-question" title="Delete">&times;</button>
      </div>
    </div>
  `).join('');
}

function getQuestionDetails(question) {
  if (question.type === QUESTION_TYPES.CHOICE) {
    return ` - ${question.options.length} options`;
  }
  if (question.type === QUESTION_TYPES.RATING) {
    return ` - 1-${question.scaleSize}`;
  }
  return '';
}

function handleQuestionAction(e) {
  const questionItem = e.target.closest('.question-item');
  if (!questionItem) return;

  const index = parseInt(questionItem.dataset.index, 10);

  if (e.target.classList.contains('move-up')) {
    moveQuestion(index, -1);
  } else if (e.target.classList.contains('move-down')) {
    moveQuestion(index, 1);
  } else if (e.target.classList.contains('delete-question')) {
    deleteQuestion(index);
  }
}

function moveQuestion(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= currentQuiz.questions.length) return;

  const temp = currentQuiz.questions[index];
  currentQuiz.questions[index] = currentQuiz.questions[newIndex];
  currentQuiz.questions[newIndex] = temp;

  renderQuestionList();
}

function deleteQuestion(index) {
  currentQuiz.questions.splice(index, 1);
  renderQuestionList();
}

function importFromJSON() {
  importError.classList.add('hidden');

  const jsonStr = jsonImport.value.trim();
  if (!jsonStr) {
    importError.textContent = 'Please paste JSON content.';
    importError.classList.remove('hidden');
    return;
  }

  try {
    const data = JSON.parse(jsonStr);

    // Validate structure
    if (!data.questions || !Array.isArray(data.questions)) {
      throw new Error('JSON must contain a "questions" array.');
    }

    // Validate each question
    const validatedQuestions = data.questions.map((q, i) => {
      if (!q.type || !q.text) {
        throw new Error(`Question ${i + 1} missing required fields (type, text).`);
      }

      if (!Object.values(QUESTION_TYPES).includes(q.type)) {
        throw new Error(`Question ${i + 1} has invalid type "${q.type}".`);
      }

      const question = {
        id: generateId('q'),
        type: q.type,
        text: sanitizeInput(q.text)
      };

      if (q.type === QUESTION_TYPES.CHOICE) {
        if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
          throw new Error(`Question ${i + 1} (choice) requires at least 2 options.`);
        }
        question.options = q.options.map(opt => sanitizeInput(opt));
      }

      if (q.type === QUESTION_TYPES.RATING) {
        if (!q.minLabel || !q.maxLabel || !q.scaleSize) {
          throw new Error(`Question ${i + 1} (rating) requires minLabel, maxLabel, and scaleSize.`);
        }
        question.minLabel = sanitizeInput(q.minLabel);
        question.maxLabel = sanitizeInput(q.maxLabel);
        question.scaleSize = parseInt(q.scaleSize, 10);
      }

      return question;
    });

    // Success - update state
    if (data.title) {
      currentQuiz.title = sanitizeInput(data.title);
      quizTitle.value = currentQuiz.title;
    }

    currentQuiz.questions = validatedQuestions;
    renderQuestionList();

    // Return to quick add mode
    importMode.classList.add('hidden');
    quickAddMode.classList.remove('hidden');
    toggleImportBtn.classList.remove('hidden');
    jsonImport.value = '';

    showSuccess(`Imported ${validatedQuestions.length} questions!`);

  } catch (err) {
    importError.textContent = err.message || 'Invalid JSON format.';
    importError.classList.remove('hidden');
  }
}

async function loadExistingQuizzes() {
  try {
    const quizzesRef = ref(db, 'quizzes');
    const snapshot = await get(quizzesRef);

    existingQuizzes.innerHTML = '<option value="">-- Select a quiz --</option>';

    if (snapshot.exists()) {
      const quizzes = snapshot.val();
      Object.entries(quizzes).forEach(([id, quiz]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = quiz.title || 'Untitled Quiz';
        existingQuizzes.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error loading quizzes:', error);
  }
}

async function loadSelectedQuiz() {
  const quizId = existingQuizzes.value;
  if (!quizId) return;

  hideMessages();

  try {
    const quizRef = ref(db, `quizzes/${quizId}`);
    const snapshot = await get(quizRef);

    if (snapshot.exists()) {
      const quiz = snapshot.val();
      currentQuiz = {
        id: quizId,
        title: quiz.title || '',
        questions: quiz.questions || []
      };

      quizTitle.value = currentQuiz.title;
      renderQuestionList();
      deleteQuizBtn.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error loading quiz:', error);
    showError('Failed to load quiz.');
  }
}

function validateQuiz() {
  const title = sanitizeInput(quizTitle.value);

  if (!title) {
    return { error: 'Please enter a quiz title.' };
  }

  if (currentQuiz.questions.length === 0) {
    return { error: 'Please add at least one question.' };
  }

  return { valid: true, title };
}

async function saveQuiz() {
  hideMessages();

  const validation = validateQuiz();
  if (validation.error) {
    showError(validation.error);
    return;
  }

  saveQuizBtn.disabled = true;
  saveQuizBtn.textContent = 'Saving...';

  try {
    const quizData = {
      title: validation.title,
      questions: currentQuiz.questions,
      updatedAt: serverTimestamp()
    };

    if (currentQuiz.id) {
      // Update existing quiz
      const quizRef = ref(db, `quizzes/${currentQuiz.id}`);
      await set(quizRef, {
        ...quizData,
        createdAt: (await get(quizRef)).val()?.createdAt || serverTimestamp()
      });
    } else {
      // Create new quiz
      quizData.createdAt = serverTimestamp();
      const quizzesRef = ref(db, 'quizzes');
      const newQuizRef = push(quizzesRef);
      await set(newQuizRef, quizData);
      currentQuiz.id = newQuizRef.key;
    }

    showSuccess('Quiz saved successfully!');
    deleteQuizBtn.classList.remove('hidden');
    loadExistingQuizzes();

  } catch (error) {
    console.error('Error saving quiz:', error);
    showError('Failed to save quiz. Please try again.');
  } finally {
    saveQuizBtn.disabled = false;
    saveQuizBtn.textContent = 'Save Quiz';
  }
}

async function deleteQuiz() {
  if (!currentQuiz.id) return;

  if (!confirm('Are you sure you want to delete this quiz? This cannot be undone.')) {
    return;
  }

  try {
    const quizRef = ref(db, `quizzes/${currentQuiz.id}`);
    await remove(quizRef);

    showSuccess('Quiz deleted.');
    resetQuiz();
    loadExistingQuizzes();

  } catch (error) {
    console.error('Error deleting quiz:', error);
    showError('Failed to delete quiz.');
  }
}

function resetQuiz() {
  currentQuiz = {
    id: null,
    title: '',
    questions: []
  };

  quizTitle.value = '';
  existingQuizzes.value = '';
  deleteQuizBtn.classList.add('hidden');
  renderQuestionList();
  clearQuestionForm();
  hideMessages();
}

// Helper functions
function showError(message) {
  quizError.textContent = message;
  quizError.classList.remove('hidden');
  quizSuccess.classList.add('hidden');
}

function showSuccess(message) {
  quizSuccess.textContent = message;
  quizSuccess.classList.remove('hidden');
  quizError.classList.add('hidden');

  setTimeout(() => {
    quizSuccess.classList.add('hidden');
  }, 3000);
}

function hideMessages() {
  quizError.classList.add('hidden');
  quizSuccess.classList.add('hidden');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
