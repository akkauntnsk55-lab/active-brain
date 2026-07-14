// Exercise Database is loaded from database.js

// Application State
let currentState = {
  currentExerciseType: null,
  questions: [],
  currentQuestionIndex: 0,
  correctCount: 0,
  selectedOption: null,
  // Chronology selections
  chronoSelections: [],
  // Letter game state
  lettersFoundCount: 0,
  totalLettersToFind: 0,
  clickedLetterIndexes: new Set(),
  // Word memory game state
  memoryPhase: 1, // 1 = memorize, 2 = select
  memorySelectedWords: new Set(),
  // Schulte table state
  schulteNextNumber: 1,
  // Memory grid state
  memoryGridRounds: 3,
  memoryGridCurrentRound: 1,
  memoryGridNumHighlights: 3,
  memoryGridHighlightedIndexes: [],
  memoryGridSelectedIndexes: new Set(),
  memoryGridState: 'memorizing'
};

// DOM Elements
const screenDashboard = document.getElementById('screen-dashboard');
const screenExercise = document.getElementById('screen-exercise');
const screenSuccess = document.getElementById('screen-success');

const backBtn = document.getElementById('back-btn');
const ttsGlobalBtn = document.getElementById('tts-global-btn');
const ttsInstructionBtn = document.getElementById('tts-instruction-btn');

const exerciseInstruction = document.getElementById('exercise-instruction');
const exerciseQuestionText = document.getElementById('exercise-question-text');
const exerciseWorkspace = document.getElementById('exercise-workspace');

const feedbackBox = document.getElementById('feedback-box');
const feedbackIcon = document.getElementById('feedback-icon');
const feedbackText = document.getElementById('feedback-text');
const feedbackSubtext = document.getElementById('feedback-subtext');

const nextQuestionBtn = document.getElementById('next-question-btn');
const finishExerciseBtn = document.getElementById('finish-exercise-btn');

const progressBarFill = document.getElementById('progress-bar-fill');
const progressText = document.getElementById('progress-text');

const successMessage = document.getElementById('success-message');
const successCorrect = document.getElementById('success-correct');
const successTotal = document.getElementById('success-total');

const completedCountEl = document.getElementById('completed-count');
const achievementsContainer = document.getElementById('achievements-container');
const resetProgressBtn = document.getElementById('reset-progress-btn');

const installBanner = document.getElementById('install-banner');
const installBtn = document.getElementById('install-btn');

let appSettings = {
  wordMemoryCount: 4
};

function loadSettings() {
  const savedVal = localStorage.getItem('active_brain_setting_word_count');
  if (savedVal) {
    appSettings.wordMemoryCount = parseInt(savedVal);
  }
  const selectEl = document.getElementById('settings-word-count');
  if (selectEl) {
    selectEl.value = appSettings.wordMemoryCount;
  }
}

function openSettings() {
  const modal = document.getElementById('settings-modal');
  const selectEl = document.getElementById('settings-word-count');
  if (selectEl) {
    selectEl.value = appSettings.wordMemoryCount;
  }
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function closeSettings() {
  const modal = document.getElementById('settings-modal');
  const selectEl = document.getElementById('settings-word-count');
  if (selectEl) {
    appSettings.wordMemoryCount = parseInt(selectEl.value);
    localStorage.setItem('active_brain_setting_word_count', appSettings.wordMemoryCount);
  }
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
  initTTS();
  loadSettings();
  loadProgress();
  setupEventListeners();
  setupPWAInstall();
});

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('Service Worker зарегистрирован', reg))
    .catch(err => console.error('Ошибка Service Worker', err));
}

// ----------------------------------------------------
// EVENT LISTENERS & SETUP
// ----------------------------------------------------
function setupEventListeners() {
  backBtn.addEventListener('click', confirmExitToDashboard);
  
  ttsGlobalBtn.addEventListener('click', () => {
    if (screenDashboard.classList.contains('active')) {
      speakText("Здравствуйте! Какое упражнение сделаем сегодня? Выберите из списка ниже.");
    } else if (screenExercise.classList.contains('active')) {
      speakCurrentQuestion();
    } else if (screenSuccess.classList.contains('active')) {
      speakText(document.getElementById('screen-success').innerText);
    }
  });

  ttsInstructionBtn.addEventListener('click', speakCurrentQuestion);

  const ttsFeedbackBtn = document.getElementById('tts-feedback-btn');
  if (ttsFeedbackBtn) {
    ttsFeedbackBtn.addEventListener('click', () => {
      const text = feedbackText.textContent + ". " + feedbackSubtext.textContent;
      speakText(text);
    });
  }

  nextQuestionBtn.addEventListener('click', handleNextQuestion);
  finishExerciseBtn.addEventListener('click', finishExercise);
  
  resetProgressBtn.addEventListener('click', () => {
    if (confirm("Вы уверены, что хотите сбросить сегодняшний прогресс?")) {
      const todayKey = getTodayKey();
      localStorage.removeItem(`active_brain_progress_${todayKey}`);
      loadProgress();
      speakText("Статистика сброшена.");
    }
  });
}

// Helper to get today's date string
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Text to Speech System Init
let ruVoice = null;
function initTTS() {
  if ('speechSynthesis' in window) {
    // Populate voices when loaded
    window.speechSynthesis.onvoiceschanged = () => {
      const voices = window.speechSynthesis.getVoices();
      ruVoice = voices.find(voice => voice.lang.includes('ru'));
    };
    // Trigger voice population immediately
    const voices = window.speechSynthesis.getVoices();
    ruVoice = voices.find(voice => voice.lang.includes('ru'));
  } else {
    ttsGlobalBtn.style.display = 'none';
    ttsInstructionBtn.style.display = 'none';
  }
}

function speakText(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // Cancel any ongoing speech
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    if (ruVoice) {
      utterance.voice = ruVoice;
    }
    
    // Slow, clear rate for rehabilitation support
    utterance.rate = 0.82; 
    utterance.pitch = 1.0;
    
    window.speechSynthesis.speak(utterance);
  }
}

// Speak the instruction and current question out loud
function speakCurrentQuestion() {
  const qData = currentState.questions[currentState.currentQuestionIndex];
  if (!qData) return;

  let textToSpeak = qData.instruction + ". ";
  
  if (currentState.currentExerciseType === 'wordMemory') {
    const N = currentState.memoryTargets.length;
    let wordForm = "слов";
    if (N === 3 || N === 4) {
      wordForm = "слова";
    }
    if (currentState.memoryPhase === 1) {
      textToSpeak = `Запомните и закройте. Внимательно посмотрите на ${N} ${wordForm} ниже и постарайтесь их запомнить. Слова для запоминания: ` + currentState.memoryTargets.join(", ");
    } else {
      textToSpeak = `Выберите ${N} ${wordForm}, которые вы запомнили.`;
    }
  } else if (currentState.currentExerciseType === 'chronology') {
    textToSpeak += qData.question + ". Действия: " + qData.items.join(". ");
  } else if (currentState.currentExerciseType === 'letters') {
    textToSpeak += "Найдите все буквы " + qData.targetLetter + " в строке букв.";
  } else {
    // Standard multiple choice questions
    if (qData.question) {
      textToSpeak += qData.question + ". ";
    }
    if (qData.options) {
      textToSpeak += "Варианты ответов: " + qData.options.join(", ");
    }
  }
  
  speakText(textToSpeak);
}

// ----------------------------------------------------
// PROGRESS TRACKING
// ----------------------------------------------------
function loadProgress() {
  const todayKey = getTodayKey();
  const savedData = localStorage.getItem(`active_brain_progress_${todayKey}`);
  let completed = [];
  if (savedData) {
    try {
      completed = JSON.parse(savedData);
    } catch(e) {
      completed = [];
    }
  }

  completedCountEl.textContent = completed.length;
  
  // Fill achievements circles
  achievementsContainer.innerHTML = '';
  const totalExercises = Object.keys(EXERCISES_DATA).length;
  for (let i = 0; i < totalExercises; i++) {
    const dot = document.createElement('div');
    dot.className = 'achievement-dot';
    if (i < completed.length) {
      dot.className = 'achievement-dot completed';
      dot.innerHTML = '✓';
    } else {
      dot.textContent = i + 1;
    }
    achievementsContainer.appendChild(dot);
  }
}

function recordProgress(exerciseType) {
  const todayKey = getTodayKey();
  const savedData = localStorage.getItem(`active_brain_progress_${todayKey}`);
  let completed = [];
  if (savedData) {
    try {
      completed = JSON.parse(savedData);
    } catch(e) {
      completed = [];
    }
  }

  if (!completed.includes(exerciseType)) {
    completed.push(exerciseType);
    localStorage.setItem(`active_brain_progress_${todayKey}`, JSON.stringify(completed));
  }
  loadProgress();
}

// ----------------------------------------------------
// GAME ROUTINES
// ----------------------------------------------------
function startExercise(type) {
  currentState.currentExerciseType = type;
  
  // Get all questions for this type, shuffle them, and pick 3
  const allQs = EXERCISES_DATA[type];
  currentState.questions = shuffleArray([...allQs]).slice(0, 3); // 3 questions per session
  
  currentState.currentQuestionIndex = 0;
  currentState.correctCount = 0;
  
  // Show screen
  showScreen(screenExercise);
  backBtn.classList.remove('hidden');
  
  loadQuestion();
}

function loadQuestion() {
  // Reset scroll to top
  window.scrollTo(0, 0);

  // Cancel any active speech when loading a new question
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  // Reset buttons
  nextQuestionBtn.classList.add('hidden');
  finishExerciseBtn.classList.add('hidden');
  feedbackBox.classList.add('hidden');
  feedbackBox.className = 'feedback-box hidden';
  
  const qIndex = currentState.currentQuestionIndex;
  const qTotal = currentState.questions.length;
  
  // Update footer progress
  progressText.textContent = `Задание ${qIndex + 1} из ${qTotal}`;
  progressBarFill.style.width = `${((qIndex) / qTotal) * 100}%`;

  const qData = currentState.questions[qIndex];
  
  // Clear workspace
  exerciseWorkspace.innerHTML = '';

  // Set up question and instruction depending on mode
  if (currentState.currentExerciseType === 'categorySorting') {
    exerciseInstruction.textContent = qData.instruction;
    exerciseQuestionText.textContent = qData.word;
    exerciseQuestionText.parentElement.classList.remove('hidden');
  } else if (currentState.currentExerciseType === 'textComprehension') {
    // For textComprehension, instruction changes dynamically based on phase
    exerciseInstruction.textContent = "Чтение и понимание. Прочитайте текст ниже и постарайтесь его запомнить:";
    exerciseQuestionText.parentElement.classList.add('hidden');
  } else if (qData.question && currentState.currentExerciseType !== 'letters') {
    exerciseInstruction.textContent = qData.instruction;
    exerciseQuestionText.textContent = qData.question;
    exerciseQuestionText.parentElement.classList.remove('hidden');
  } else {
    exerciseInstruction.textContent = qData.instruction;
    exerciseQuestionText.parentElement.classList.add('hidden');
  }
  
  // Set up workspace based on type
  if (currentState.currentExerciseType === 'letters') {
    setupLettersWorkspace(qData);
  } else if (currentState.currentExerciseType === 'chronology') {
    setupChronologyWorkspace(qData);
  } else if (currentState.currentExerciseType === 'wordMemory') {
    setupMemoryWorkspace(qData);
  } else if (currentState.currentExerciseType === 'schulte') {
    setupSchulteWorkspace(qData);
  } else if (currentState.currentExerciseType === 'memoryGrid') {
    setupMemoryGridWorkspace(qData);
  } else if (currentState.currentExerciseType === 'categorySorting') {
    setupCategorySortingWorkspace(qData);
  } else if (currentState.currentExerciseType === 'textComprehension') {
    setupTextComprehensionWorkspace(qData);
  } else {
    // standard multiple choice (oddWord, sequence, matching, math, logic)
    setupStandardWorkspace(qData);
  }

}

// --- WORKSPACE BUILDERS ---

// Standard Multiple Choice
function setupStandardWorkspace(qData) {
  // Shuffle options so correct answer is not always first
  const options = shuffleArray([...qData.options]);
  
  options.forEach(option => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `<span class="option-bullet"></span><span style="flex-grow:1;">${option}</span>`;
    btn.onclick = () => selectStandardAnswer(btn, option, qData);
    exerciseWorkspace.appendChild(btn);
  });
}

function setupTextComprehensionWorkspace(qData) {
  currentState.readingPhase = 1;
  exerciseWorkspace.innerHTML = '';
  
  // 1. Text display box
  const textBox = document.createElement('div');
  textBox.className = 'comprehension-text-box';
  textBox.style.display = 'flex';
  textBox.style.alignItems = 'flex-start';
  textBox.style.gap = '16px';

  const speakBtn = document.createElement('button');
  speakBtn.className = 'tts-btn-icon';
  speakBtn.style.width = '52px';
  speakBtn.style.height = '52px';
  speakBtn.style.marginTop = '4px';
  speakBtn.setAttribute('aria-label', 'Озвучить текст');
  speakBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    </svg>
  `;
  speakBtn.onclick = () => speakText(qData.text);
  textBox.appendChild(speakBtn);

  const textContent = document.createElement('div');
  textContent.style.flexGrow = '1';
  textContent.textContent = qData.text;
  textBox.appendChild(textContent);

  exerciseWorkspace.appendChild(textBox);
  
  // 2. Button to transit to questions phase
  const okBtn = document.createElement('button');
  okBtn.className = 'primary-btn btn-large';
  okBtn.style.marginTop = '24px';
  okBtn.textContent = 'Я прочитала текст';
  okBtn.onclick = () => {
    currentState.readingPhase = 2;
    transitionToComprehensionTesting(qData);
  };
  
  exerciseWorkspace.appendChild(okBtn);
}

function transitionToComprehensionTesting(qData) {
  // Cancel speech from phase 1
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  
  exerciseWorkspace.innerHTML = '';
  
  // Update Instruction
  exerciseInstruction.textContent = "Чтение и понимание. Ответьте на вопрос по тексту:";
  
  // 1. Text display box (hidden initially)
  const textBox = document.createElement('div');
  textBox.className = 'comprehension-text-box hidden';
  textBox.id = 'comprehension-testing-text-box';
  textBox.style.display = 'flex';
  textBox.style.alignItems = 'flex-start';
  textBox.style.gap = '16px';
  textBox.style.marginBottom = '20px';

  const speakBtn = document.createElement('button');
  speakBtn.className = 'tts-btn-icon';
  speakBtn.style.width = '52px';
  speakBtn.style.height = '52px';
  speakBtn.style.marginTop = '4px';
  speakBtn.setAttribute('aria-label', 'Озвучить текст');
  speakBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    </svg>
  `;
  speakBtn.onclick = () => speakText(qData.text);
  textBox.appendChild(speakBtn);

  const textContent = document.createElement('div');
  textContent.style.flexGrow = '1';
  textContent.textContent = qData.text;
  textBox.appendChild(textContent);

  exerciseWorkspace.appendChild(textBox);

  // 2. Toggle button "Вернуться к тексту"
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'secondary-btn';
  toggleBtn.id = 'comprehension-toggle-text-btn';
  toggleBtn.style.marginBottom = '24px';
  toggleBtn.style.width = '100%';
  toggleBtn.style.fontSize = '20px';
  toggleBtn.style.padding = '12px';
  toggleBtn.textContent = '📖 Вернуться к тексту';
  toggleBtn.onclick = () => {
    if (textBox.classList.contains('hidden')) {
      textBox.classList.remove('hidden');
      toggleBtn.textContent = '🙈 Скрыть текст';
    } else {
      textBox.classList.add('hidden');
      toggleBtn.textContent = '📖 Вернуться к тексту';
    }
  };
  exerciseWorkspace.appendChild(toggleBtn);
  
  // 3. Question box
  const qBox = document.createElement('div');
  qBox.className = 'question-box';
  qBox.style.marginBottom = '24px';
  qBox.innerHTML = `<div class="question-text" style="font-size: 26px; font-weight: bold; text-align: center;">${qData.question}</div>`;
  exerciseWorkspace.appendChild(qBox);
  
  // 4. Multiple Choice Options
  const options = shuffleArray([...qData.options]);
  options.forEach(option => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `<span class="option-bullet"></span><span style="flex-grow:1;">${option}</span>`;
    btn.onclick = () => selectStandardAnswer(btn, option, qData);
    exerciseWorkspace.appendChild(btn);
  });
}

function selectStandardAnswer(clickedBtn, selectedOption, qData) {
  // Disable all buttons in workspace
  const btns = exerciseWorkspace.querySelectorAll('.option-btn');
  btns.forEach(btn => btn.disabled = true);
  
  const isCorrect = (selectedOption === qData.correct);
  
  // For textComprehension, show text when answer is selected so they can read and learn
  const textComprBox = document.getElementById('comprehension-testing-text-box');
  if (textComprBox) {
    textComprBox.classList.remove('hidden');
    const toggleBtn = document.getElementById('comprehension-toggle-text-btn');
    if (toggleBtn) {
      toggleBtn.textContent = '📖 Текст рассказа';
      toggleBtn.disabled = true;
    }
  }

  if (isCorrect) {
    clickedBtn.classList.add('correct');
    currentState.correctCount++;
    showFeedback(true, "Отлично! Всё правильно.", qData.explanation);
  } else {
    clickedBtn.classList.add('wrong');
    // Highlight correct answer
    btns.forEach(btn => {
      if (btn.textContent === qData.correct) {
        btn.classList.add('correct');
      }
    });
    showFeedback(false, "Не совсем верно.", qData.explanation);
  }
  
  showControlButtons();
}

// Letter Search Game ("Find Letter A")
function setupLettersWorkspace(qData) {
  // Parse letters, space separated
  const letters = qData.question.split(' ');
  const target = qData.targetLetter;
  
  currentState.totalLettersToFind = letters.filter(l => l === target).length;
  currentState.lettersFoundCount = 0;
  currentState.clickedLetterIndexes.clear();
  
  const grid = document.createElement('div');
  grid.className = 'letters-grid';
  
  letters.forEach((letter, index) => {
    const btn = document.createElement('button');
    btn.className = 'letter-btn';
    btn.textContent = letter;
    btn.onclick = () => clickLetter(btn, letter, index, qData);
    grid.appendChild(btn);
  });
  
  exerciseWorkspace.appendChild(grid);
  
  // Show counter below
  const counterText = document.createElement('div');
  counterText.id = 'letter-counter';
  counterText.style.textAlign = 'center';
  counterText.style.fontSize = '24px';
  counterText.style.fontWeight = 'bold';
  counterText.style.marginTop = '10px';
  counterText.textContent = `Найдено букв ${target}: 0 из ${currentState.totalLettersToFind}`;
  exerciseWorkspace.appendChild(counterText);
}

function clickLetter(btn, letter, index, qData) {
  if (currentState.clickedLetterIndexes.has(index)) return; // Already clicked
  
  const target = qData.targetLetter;
  
  if (letter === target) {
    btn.classList.add('revealed-correct');
    currentState.lettersFoundCount++;
    currentState.clickedLetterIndexes.add(index);
    
    // Update counter
    const counterText = document.getElementById('letter-counter');
    counterText.textContent = `Найдено букв ${target}: ${currentState.lettersFoundCount} из ${currentState.totalLettersToFind}`;
    
    // Check if all found
    if (currentState.lettersFoundCount === currentState.totalLettersToFind) {
      // Disable all letters
      const btns = exerciseWorkspace.querySelectorAll('.letter-btn');
      btns.forEach(b => b.disabled = true);
      
      currentState.correctCount++;
      showFeedback(true, "Прекрасно! Вы нашли все буквы «А»!", qData.explanation);
      showControlButtons();
    }
  } else {
    // clicked wrong letter. Let's briefly show it as selected/greyed out
    btn.classList.add('selected');
    // Don't count as complete failure, just let them keep searching
  }
}

// Chronology Ordering Task
function setupChronologyWorkspace(qData) {
  currentState.chronoSelections = [];
  
  const listDiv = document.createElement('div');
  listDiv.className = 'chrono-list';
  
  // Shuffle items initially
  const itemsWithIndices = qData.items.map((text, i) => ({ text, originalIndex: i }));
  const shuffledItems = shuffleArray([...itemsWithIndices]);
  
  shuffledItems.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'chrono-item';
    itemDiv.innerHTML = `
      <span>${item.text}</span>
      <div class="chrono-badge">-</div>
    `;
    itemDiv.onclick = () => toggleChronoItem(itemDiv, item.originalIndex, qData);
    listDiv.appendChild(itemDiv);
  });
  
  exerciseWorkspace.appendChild(listDiv);
  
  // Add submit button
  const checkBtn = document.createElement('button');
  checkBtn.className = 'primary-btn';
  checkBtn.style.marginTop = '20px';
  checkBtn.textContent = 'Проверить ответ';
  checkBtn.id = 'chrono-check-btn';
  checkBtn.disabled = true; // Enabled when all 4 are numbered
  checkBtn.onclick = () => verifyChronology(qData);
  exerciseWorkspace.appendChild(checkBtn);
}

function toggleChronoItem(itemDiv, originalIndex, qData) {
  const badge = itemDiv.querySelector('.chrono-badge');
  const selIndex = currentState.chronoSelections.indexOf(originalIndex);
  
  if (selIndex > -1) {
    // Deselect
    currentState.chronoSelections.splice(selIndex, 1);
    itemDiv.classList.remove('selected');
    badge.textContent = '-';
  } else {
    // Select
    if (currentState.chronoSelections.length >= qData.items.length) return; // already selected all
    
    currentState.chronoSelections.push(originalIndex);
    itemDiv.classList.add('selected');
  }
  
  // Refresh all badges numbers
  const items = exerciseWorkspace.querySelectorAll('.chrono-item');
  items.forEach(div => {
    // Find matching element
    // Let's store originalIndex in a dataset parameter
  });
  
  // Simpler way: rebuild badge texts
  const chronoItems = exerciseWorkspace.querySelectorAll('.chrono-item');
  // Re-map items based on state
  // We can attach the click logic with closure, so we just update DOM elements directly:
  updateChronoBadges();
}

function updateChronoBadges() {
  const items = exerciseWorkspace.querySelectorAll('.chrono-item');
  const checkBtn = document.getElementById('chrono-check-btn');
  
  // To update badges reliably, we scan the elements
  const chronoItems = Array.from(items);
  // Actually, let's keep it robust by storing references or searching
  // Let's do a simple approach: We clear badges and recount based on state
  // Since we did it dynamically, let's look at the DOM again
}

// Let's rewrite toggleChronoItem to be extremely robust:
function toggleChronoItem(itemDiv, originalIndex, qData) {
  const badge = itemDiv.querySelector('.chrono-badge');
  const indexInSelection = currentState.chronoSelections.indexOf(originalIndex);
  
  if (indexInSelection > -1) {
    // Item is already selected, so deselect it
    currentState.chronoSelections.splice(indexInSelection, 1);
    itemDiv.classList.remove('selected');
    badge.textContent = '-';
  } else {
    // Item is not selected, add it to selection list
    currentState.chronoSelections.push(originalIndex);
    itemDiv.classList.add('selected');
  }
  
  // Update numbers on all selected items
  const items = exerciseWorkspace.querySelectorAll('.chrono-item');
  items.forEach(el => {
    // We need to know which originalIndex this item corresponds to. 
    // Let's read it from a custom attribute.
  });
  
  // Let's make sure we write index as data-index on creation! Let's check below.
}

// Let's make Chronology Setup clean and clear
function setupChronologyWorkspace(qData) {
  currentState.chronoSelections = [];
  
  const listDiv = document.createElement('div');
  listDiv.className = 'chrono-list';
  
  // Shuffle items initially
  const itemsWithIndices = qData.items.map((text, i) => ({ text, originalIndex: i }));
  const shuffledItems = shuffleArray([...itemsWithIndices]);
  
  shuffledItems.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'chrono-item';
    itemDiv.dataset.originalIndex = item.originalIndex;
    itemDiv.innerHTML = `
      <span>${item.text}</span>
      <div class="chrono-badge">-</div>
    `;
    itemDiv.onclick = () => {
      const oIndex = parseInt(itemDiv.dataset.originalIndex);
      const selIndex = currentState.chronoSelections.indexOf(oIndex);
      
      if (selIndex > -1) {
        // Deselect
        currentState.chronoSelections.splice(selIndex, 1);
        itemDiv.classList.remove('selected');
      } else {
        // Select
        if (currentState.chronoSelections.length < qData.items.length) {
          currentState.chronoSelections.push(oIndex);
          itemDiv.classList.add('selected');
        }
      }
      
      // Update badge numbers
      const allChronoItems = listDiv.querySelectorAll('.chrono-item');
      allChronoItems.forEach(child => {
        const childOIndex = parseInt(child.dataset.originalIndex);
        const pos = currentState.chronoSelections.indexOf(childOIndex);
        const childBadge = child.querySelector('.chrono-badge');
        
        if (pos > -1) {
          child.classList.add('selected');
          childBadge.textContent = pos + 1; // 1-based order
        } else {
          child.classList.remove('selected');
          childBadge.textContent = '-';
        }
      });
      
      // Enable or disable verification button
      const checkBtn = document.getElementById('chrono-check-btn');
      checkBtn.disabled = (currentState.chronoSelections.length < qData.items.length);
    };
    
    listDiv.appendChild(itemDiv);
  });
  
  exerciseWorkspace.appendChild(listDiv);
  
  const checkBtn = document.createElement('button');
  checkBtn.className = 'primary-btn';
  checkBtn.style.marginTop = '20px';
  checkBtn.textContent = 'Проверить порядок';
  checkBtn.id = 'chrono-check-btn';
  checkBtn.disabled = true;
  checkBtn.onclick = () => verifyChronology(qData);
  exerciseWorkspace.appendChild(checkBtn);
}

function verifyChronology(qData) {
  const checkBtn = document.getElementById('chrono-check-btn');
  checkBtn.classList.add('hidden');
  
  // Disable clicks on all items
  const allChronoItems = exerciseWorkspace.querySelectorAll('.chrono-item');
  allChronoItems.forEach(item => {
    item.style.pointerEvents = 'none';
  });
  
  // Compare selections arrays
  let isCorrect = true;
  for (let i = 0; i < qData.correctOrder.length; i++) {
    if (currentState.chronoSelections[i] !== qData.correctOrder[i]) {
      isCorrect = false;
      break;
    }
  }
  
  if (isCorrect) {
    currentState.correctCount++;
    showFeedback(true, "Правильно! Идеальный порядок.", qData.explanation);
  } else {
    // Show correct ordering visually or explain it
    showFeedback(false, "Неверно. Посмотрите правильный порядок.", qData.explanation);
    
    // Rearrange or highlight items to show correct sequence
    // Let's just highlight wrong positions
    allChronoItems.forEach(item => {
      const idx = parseInt(item.dataset.originalIndex);
      const correctPos = qData.correctOrder.indexOf(idx);
      const userPos = currentState.chronoSelections.indexOf(idx);
      const badge = item.querySelector('.chrono-badge');
      
      if (correctPos === userPos) {
        item.style.borderColor = 'var(--success-color)';
      } else {
        item.style.borderColor = 'var(--error-color)';
        // show corrected index
        badge.innerHTML = `<span style="text-decoration:line-through;color:var(--error-color);">${userPos+1}</span> ${correctPos+1}`;
      }
    });
  }
  
  showControlButtons();
}

// Word Memory Game Workspace Builder
function setupMemoryWorkspace(qData) {
  currentState.memoryPhase = 1;
  currentState.memorySelectedWords.clear();
  
  // Dynamically select target words count from settings
  const N = appSettings.wordMemoryCount || 4;
  const fullPool = shuffleArray([...qData.options]);
  
  currentState.memoryTargets = fullPool.slice(0, N);
  currentState.memoryOptions = shuffleArray([...fullPool]); // shuffle full 8 words grid
  
  // Set instruction text with correct count and grammar
  let wordForm = "слов";
  if (N === 3 || N === 4) {
    wordForm = "слова";
  }
  exerciseInstruction.textContent = `Запомните и закройте. Внимательно посмотрите на ${N} ${wordForm} ниже и постарайтесь их запомнить:`;
  
  // Phase 1: Memorization Display
  const container = document.createElement('div');
  container.className = 'memory-word-display';
  
  const wordsUl = document.createElement('div');
  wordsUl.style.display = 'flex';
  wordsUl.style.flexDirection = 'column';
  wordsUl.style.gap = '15px';
  wordsUl.style.margin = '20px 0';
  
  currentState.memoryTargets.forEach(word => {
    const wordEl = document.createElement('span');
    wordEl.textContent = word;
    wordsUl.appendChild(wordEl);
  });
  
  container.appendChild(wordsUl);
  
  const okBtn = document.createElement('button');
  okBtn.className = 'primary-btn btn-large';
  okBtn.textContent = 'Я запомнила слова';
  okBtn.onclick = () => {
    currentState.memoryPhase = 2;
    transitionToMemoryTesting(qData);
  };
  
  container.appendChild(okBtn);
  exerciseWorkspace.appendChild(container);
}

function transitionToMemoryTesting(qData) {
  exerciseWorkspace.innerHTML = '';
  const N = currentState.memoryTargets.length;
  exerciseQuestionText.textContent = `Выберите ${N} слов, которые вы запомнили:`;
  exerciseQuestionText.parentElement.classList.remove('hidden');
  
  // Shuffle options from memoryOptions
  const options = currentState.memoryOptions;
  
  const grid = document.createElement('div');
  grid.className = 'memory-words-check-grid';
  
  options.forEach(word => {
    const btn = document.createElement('button');
    btn.className = 'memory-check-btn';
    btn.textContent = word;
    btn.onclick = () => {
      if (currentState.memorySelectedWords.has(word)) {
        currentState.memorySelectedWords.delete(word);
        btn.classList.remove('selected');
      } else {
        if (currentState.memorySelectedWords.size < N) {
          currentState.memorySelectedWords.add(word);
          btn.classList.add('selected');
        }
      }
      
      // Update check button state
      const checkBtn = document.getElementById('memory-check-btn');
      checkBtn.disabled = (currentState.memorySelectedWords.size < N);
    };
    grid.appendChild(btn);
  });
  
  exerciseWorkspace.appendChild(grid);
  
  const checkBtn = document.createElement('button');
  checkBtn.className = 'primary-btn';
  checkBtn.id = 'memory-check-btn';
  checkBtn.style.marginTop = '20px';
  checkBtn.textContent = 'Проверить слова';
  checkBtn.disabled = true;
  checkBtn.onclick = () => verifyMemoryAnswers(qData);
  exerciseWorkspace.appendChild(checkBtn);
}

function verifyMemoryAnswers(qData) {
  const checkBtn = document.getElementById('memory-check-btn');
  checkBtn.classList.add('hidden');
  
  const btns = exerciseWorkspace.querySelectorAll('.memory-check-btn');
  btns.forEach(btn => {
    btn.disabled = true;
    const word = btn.textContent;
    const wasTarget = currentState.memoryTargets.includes(word);
    const wasSelected = currentState.memorySelectedWords.has(word);
    
    if (wasTarget && wasSelected) {
      btn.classList.remove('selected');
      btn.classList.add('correct');
    } else if (!wasTarget && wasSelected) {
      btn.classList.remove('selected');
      btn.classList.add('wrong');
    } else if (wasTarget && !wasSelected) {
      btn.classList.add('correct'); // Highlight what should have been selected
      btn.style.opacity = '0.6';
    }
  });
  
  // Check if they matched all correctly
  let matchCount = 0;
  currentState.memorySelectedWords.forEach(word => {
    if (currentState.memoryTargets.includes(word)) {
      matchCount++;
    }
  });
  
  const isPerfect = (matchCount === currentState.memoryTargets.length);
  const correctListStr = currentState.memoryTargets.join(', ');
  
  if (isPerfect) {
    currentState.correctCount++;
    showFeedback(true, "Отличная память! Все слова верны.", `Правильные слова: ${correctListStr}.`);
  } else {
    showFeedback(false, `Вспомнили: ${matchCount} из ${currentState.memoryTargets.length}.`, `Правильные слова были: ${correctListStr}.`);
  }
  
  showControlButtons();
}

// --- CONTROLS AND NAVIGATION ---

function showFeedback(isCorrect, heading, explanation) {
  feedbackBox.classList.remove('hidden');
  feedbackBox.className = 'feedback-box ' + (isCorrect ? 'correct-style' : 'wrong-style');
  feedbackIcon.textContent = isCorrect ? '🎉' : '💡';
  feedbackText.textContent = heading;
  feedbackSubtext.textContent = explanation;
}

function showControlButtons() {
  const isLast = (currentState.currentQuestionIndex >= currentState.questions.length - 1);
  if (isLast) {
    finishExerciseBtn.classList.remove('hidden');
  } else {
    nextQuestionBtn.classList.remove('hidden');
  }
  
  // Smoothly scroll down to buttons if needed
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: 'smooth'
  });
}

function handleNextQuestion() {
  if (currentState.currentQuestionIndex >= currentState.questions.length - 1) {
    finishExercise();
    return;
  }
  currentState.currentQuestionIndex++;
  loadQuestion();
}

function finishExercise() {
  // Update achievements
  recordProgress(currentState.currentExerciseType);
  
  // Load success statistics
  successCorrect.textContent = currentState.correctCount;
  const qTotal = currentState.questions.length;
  successTotal.textContent = qTotal;
  
  // Set custom congrats message based on score
  if (currentState.correctCount === qTotal) {
    successMessage.textContent = "Потрясающий результат! Вы ответили правильно на все вопросы. Мозг работает на полную мощность!";
  } else if (currentState.correctCount > 0) {
    successMessage.textContent = "Отличная тренировка! Регулярные занятия помогают восстановить функции памяти и мышления.";
  } else {
    successMessage.textContent = "Главное не результат, а сам процесс тренировки. Попробуйте еще раз или выберите другое задание!";
  }
  
  showScreen(screenSuccess);
}

// Schulte Tables Workspace
function setupSchulteWorkspace(qData) {
  currentState.schulteNextNumber = 1;

  // Generate numbers 1 to 25 and shuffle
  const numbers = [];
  for (let i = 1; i <= 25; i++) numbers.push(i);
  shuffleArray(numbers);

  // Create grid
  const grid = document.createElement('div');
  grid.className = 'schulte-grid';

  numbers.forEach(num => {
    const btn = document.createElement('button');
    btn.className = 'schulte-btn';
    btn.textContent = num;
    btn.onclick = () => clickSchulteNumber(btn, num, qData);
    grid.appendChild(btn);
  });

  exerciseWorkspace.appendChild(grid);
}

function clickSchulteNumber(clickedBtn, num, qData) {
  if (clickedBtn.classList.contains('correct')) return;

  if (num === currentState.schulteNextNumber) {
    // Correct number!
    clickedBtn.classList.add('correct');
    currentState.schulteNextNumber++;

    if (currentState.schulteNextNumber > 25) {
      // Completed!
      currentState.correctCount++;
      showFeedback(true, "Отлично!", qData.explanation);
      showControlButtons();
    }
  } else {
    // Wrong number!
    clickedBtn.classList.add('wrong');
    setTimeout(() => {
      clickedBtn.classList.remove('wrong');
    }, 500);
  }
}

// Memory Grid Workspace
function setupMemoryGridWorkspace(qData) {
  currentState.memoryGridCurrentRound = 1;
  currentState.memoryGridNumHighlights = 3; // Start with 3 tiles highlighted
  runMemoryGridRound(qData);
}

function runMemoryGridRound(qData) {
  exerciseWorkspace.innerHTML = '';
  currentState.memoryGridSelectedIndexes.clear();
  currentState.memoryGridState = 'memorizing';

  // Create round/instruction helper label
  const helper = document.createElement('div');
  helper.id = 'memory-grid-helper';
  helper.style.fontSize = '26px';
  helper.style.fontWeight = 'bold';
  helper.style.textAlign = 'center';
  helper.style.color = 'var(--text-primary)';
  helper.style.marginBottom = '15px';
  helper.textContent = `Раунд ${currentState.memoryGridCurrentRound} из 3. Запомните синие ячейки...`;
  exerciseWorkspace.appendChild(helper);

  // Generate grid
  const gridContainer = document.createElement('div');
  gridContainer.className = 'memory-grid-container';

  const cells = [];
  for (let i = 0; i < 16; i++) {
    const cell = document.createElement('div');
    cell.className = 'memory-grid-cell';
    cell.dataset.index = i;
    gridContainer.appendChild(cell);
    cells.push(cell);
  }
  exerciseWorkspace.appendChild(gridContainer);

  // Randomly select highlights
  const indexes = [];
  for (let i = 0; i < 16; i++) indexes.push(i);
  shuffleArray(indexes);
  
  currentState.memoryGridHighlightedIndexes = indexes.slice(0, currentState.memoryGridNumHighlights);
  
  // Highlight cells
  currentState.memoryGridHighlightedIndexes.forEach(idx => {
    cells[idx].classList.add('highlighted');
  });

  // Wait 2.2 seconds, then hide and allow clicking
  setTimeout(() => {
    // If user changed screens while waiting, do nothing
    if (currentState.currentExerciseType !== 'memoryGrid' || currentState.memoryGridState !== 'memorizing') return;

    cells.forEach(cell => cell.classList.remove('highlighted'));
    currentState.memoryGridState = 'clicking';
    helper.textContent = 'Повторите: нажмите на ячейки, которые светились!';
    
    // Bind click events
    cells.forEach(cell => {
      const idx = parseInt(cell.dataset.index);
      cell.onclick = () => clickMemoryGridCell(cell, idx, cells, qData);
    });
  }, 2200);
}

function clickMemoryGridCell(cell, idx, cells, qData) {
  if (currentState.memoryGridState !== 'clicking') return;
  if (cell.classList.contains('correct') || cell.classList.contains('wrong')) return;

  const isTarget = currentState.memoryGridHighlightedIndexes.includes(idx);

  if (isTarget) {
    cell.classList.add('correct');
    currentState.memoryGridSelectedIndexes.add(idx);

    // Check if round won
    if (currentState.memoryGridSelectedIndexes.size === currentState.memoryGridHighlightedIndexes.length) {
      currentState.memoryGridState = 'done';
      
      if (currentState.memoryGridCurrentRound >= 3) {
        // Whole game finished!
        currentState.correctCount++;
        showFeedback(true, "Отлично!", qData.explanation);
        showControlButtons();
      } else {
        // Next round
        const helper = document.getElementById('memory-grid-helper');
        if (helper) helper.textContent = "Правильно! Переходим к следующему раунду...";
        currentState.memoryGridCurrentRound++;
        currentState.memoryGridNumHighlights = Math.min(6, currentState.memoryGridNumHighlights + 1);
        
        setTimeout(() => {
          if (currentState.currentExerciseType === 'memoryGrid') {
            runMemoryGridRound(qData);
          }
        }, 1500);
      }
    }
  } else {
    // Wrong cell selected!
    currentState.memoryGridState = 'done';
    cell.classList.add('wrong');

    // Reveal missing correct cells
    currentState.memoryGridHighlightedIndexes.forEach(correctIdx => {
      cells[correctIdx].classList.add('correct');
    });

    const helper = document.getElementById('memory-grid-helper');
    if (helper) helper.textContent = "Неверно. Запомните расположение.";

    if (currentState.memoryGridCurrentRound >= 3) {
      // End game
      showFeedback(false, "Попытка завершена.", "Продолжайте тренировки для улучшения результата!");
      showControlButtons();
    } else {
      // Try next round with lower difficulty
      currentState.memoryGridCurrentRound++;
      currentState.memoryGridNumHighlights = Math.max(3, currentState.memoryGridNumHighlights - 1);
      
      setTimeout(() => {
        if (currentState.currentExerciseType === 'memoryGrid') {
          runMemoryGridRound(qData);
        }
      }, 2500);
    }
  }
}

// Category Sorting Workspace
function setupCategorySortingWorkspace(qData) {
  // Show 3 large category buttons
  const categories = ["Продукты", "Одежда", "Мебель"];
  
  categories.forEach(category => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `<span class="option-bullet"></span><span style="flex-grow:1;">${category}</span>`;
    btn.onclick = () => selectCategoryAnswer(btn, category, qData);
    exerciseWorkspace.appendChild(btn);
  });
}

function selectCategoryAnswer(clickedBtn, selectedCategory, qData) {
  const btns = exerciseWorkspace.querySelectorAll('.option-btn');
  btns.forEach(btn => btn.disabled = true);
  
  const isCorrect = (selectedCategory === qData.correct);
  
  if (isCorrect) {
    clickedBtn.classList.add('correct');
    currentState.correctCount++;
    showFeedback(true, "Правильно!", qData.explanation);
  } else {
    clickedBtn.classList.add('wrong');
    // Highlight correct answer
    btns.forEach(btn => {
      if (btn.textContent.trim() === qData.correct) {
        btn.classList.add('correct');
      }
    });
    showFeedback(false, "Не совсем верно.", qData.explanation);
  }
  
  showControlButtons();
}

function goToDashboard() {
  showScreen(screenDashboard);
  backBtn.classList.add('hidden');
}

function confirmExitToDashboard() {
  goToDashboard();
}

function showScreen(screenToShow) {
  // Reset scroll to top
  window.scrollTo(0, 0);

  [screenDashboard, screenExercise, screenSuccess].forEach(screen => {
    screen.classList.remove('active');
    screen.classList.add('hidden');
  });
  screenToShow.classList.remove('hidden');
  screenToShow.classList.add('active');
  
  // Hide global TTS button in header unless on dashboard
  if (screenToShow === screenDashboard) {
    ttsGlobalBtn.classList.remove('hidden');
  } else {
    ttsGlobalBtn.classList.add('hidden');
  }
  
  // Cancel voice when screen changes
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// ----------------------------------------------------
// UTILITIES
// ----------------------------------------------------

// Fisher-Yates Shuffle
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// PWA Install prompt handling
let deferredPrompt = null;
function setupPWAInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent standard Chrome prompt
    e.preventDefault();
    deferredPrompt = e;
    // Show custom install banner
    installBanner.classList.remove('hidden');
  });

  installBtn.addEventListener('click', () => {
    if (deferredPrompt) {
      installBanner.classList.add('hidden');
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('Пользователь установил приложение');
        } else {
          console.log('Пользователь отклонил установку');
        }
        deferredPrompt = null;
      });
    }
  });

  window.addEventListener('appinstalled', (evt) => {
    console.log('Приложение успешно установлено на главный экран!');
    installBanner.classList.add('hidden');
  });
}

