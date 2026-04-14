const STORAGE_KEYS = {
  whiteKeyWidth: "pocket-piano-white-key-width",
  octaveCount: "pocket-piano-octave-count",
};

const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const whitePattern = [0, 2, 4, 5, 7, 9, 11];
const blackPattern = [
  { whiteIndex: 0, semitone: 1 },
  { whiteIndex: 1, semitone: 3 },
  { whiteIndex: 3, semitone: 6 },
  { whiteIndex: 4, semitone: 8 },
  { whiteIndex: 5, semitone: 10 },
];
const firstMidiNote = 24;

const ui = {
  audioToggle: document.getElementById("audioToggle"),
  keySize: document.getElementById("keySize"),
  sizeValue: document.getElementById("sizeValue"),
  octaveDown: document.getElementById("octaveDown"),
  octaveUp: document.getElementById("octaveUp"),
  octaveValue: document.getElementById("octaveValue"),
  keyboard: document.getElementById("keyboard"),
  keyboardViewport: document.getElementById("keyboardViewport"),
};

const state = {
  whiteKeyWidth: loadNumber(STORAGE_KEYS.whiteKeyWidth, 52),
  octaveCount: clamp(loadNumber(STORAGE_KEYS.octaveCount, 4), 3, 6),
  audioReady: false,
};

const audio = {
  context: null,
  masterGain: null,
  activeNotes: new Map(),
};

function init() {
  ui.keySize.value = String(state.whiteKeyWidth);
  renderSettings();
  renderKeyboard();
  bindEvents();
}

function bindEvents() {
  ui.audioToggle.addEventListener("click", enableAudio);
  ui.keySize.addEventListener("input", (event) => {
    state.whiteKeyWidth = Number(event.target.value);
    saveNumber(STORAGE_KEYS.whiteKeyWidth, state.whiteKeyWidth);
    renderSettings();
    renderKeyboard();
  });

  ui.octaveDown.addEventListener("click", () => updateOctaves(-1));
  ui.octaveUp.addEventListener("click", () => updateOctaves(1));
}

function renderSettings() {
  document.documentElement.style.setProperty("--white-key-width", `${state.whiteKeyWidth}px`);
  document.documentElement.style.setProperty("--black-key-width", `${Math.round(state.whiteKeyWidth * 0.62)}px`);
  ui.sizeValue.textContent = `${state.whiteKeyWidth} px`;
  ui.octaveValue.textContent = `${state.octaveCount} octaves`;
}

function renderKeyboard() {
  ui.keyboard.innerHTML = "";

  const whiteKeyHeight = calculateWhiteKeyHeight();
  const blackKeyHeight = Math.round(whiteKeyHeight * 0.6);
  document.documentElement.style.setProperty("--white-key-height", `${whiteKeyHeight}px`);
  document.documentElement.style.setProperty("--black-key-height", `${blackKeyHeight}px`);

  const whiteKeys = buildWhiteKeys(state.octaveCount, state.whiteKeyWidth);
  const blackKeys = buildBlackKeys(state.octaveCount, state.whiteKeyWidth);
  const keyboardWidth = whiteKeys.length * state.whiteKeyWidth;

  ui.keyboard.style.width = `${keyboardWidth}px`;

  whiteKeys.forEach((key) => {
    const keyElement = document.createElement("button");
    keyElement.type = "button";
    keyElement.className = "white-key";
    keyElement.style.left = `${key.left}px`;
    keyElement.dataset.note = String(key.midiNote);
    keyElement.innerHTML = `<span class="white-key-label">${key.label}</span>`;
    attachKeyEvents(keyElement, key.midiNote);
    ui.keyboard.appendChild(keyElement);
  });

  blackKeys.forEach((key) => {
    const keyElement = document.createElement("button");
    keyElement.type = "button";
    keyElement.className = "black-key";
    keyElement.style.left = `${key.left}px`;
    keyElement.dataset.note = String(key.midiNote);
    attachKeyEvents(keyElement, key.midiNote);
    ui.keyboard.appendChild(keyElement);
  });
}

function attachKeyEvents(element, midiNote) {
  const begin = (event) => {
    event.preventDefault();
    element.classList.add("active");
    startNote(midiNote);
  };

  const end = (event) => {
    event.preventDefault();
    element.classList.remove("active");
    stopNote(midiNote);
  };

  element.addEventListener("pointerdown", begin);
  element.addEventListener("pointerup", end);
  element.addEventListener("pointerleave", () => {
    element.classList.remove("active");
    stopNote(midiNote);
  });
  element.addEventListener("pointercancel", () => {
    element.classList.remove("active");
    stopNote(midiNote);
  });
}

function updateOctaves(delta) {
  state.octaveCount = clamp(state.octaveCount + delta, 3, 6);
  saveNumber(STORAGE_KEYS.octaveCount, state.octaveCount);
  renderSettings();
  renderKeyboard();
}

function buildWhiteKeys(octaveCount, whiteKeyWidth) {
  const keys = [];
  for (let octave = 0; octave < octaveCount; octave += 1) {
    whitePattern.forEach((semitone, position) => {
      const midiNote = firstMidiNote + octave * 12 + semitone;
      const whiteIndex = octave * whitePattern.length + position;
      keys.push({
        midiNote,
        label: noteLabel(midiNote),
        left: whiteIndex * whiteKeyWidth,
      });
    });
  }
  return keys;
}

function buildBlackKeys(octaveCount, whiteKeyWidth) {
  const keys = [];
  for (let octave = 0; octave < octaveCount; octave += 1) {
    blackPattern.forEach(({ whiteIndex, semitone }) => {
      const absoluteWhiteIndex = octave * whitePattern.length + whiteIndex;
      keys.push({
        midiNote: firstMidiNote + octave * 12 + semitone,
        left: (absoluteWhiteIndex + 1) * whiteKeyWidth - whiteKeyWidth * 0.31,
      });
    });
  }
  return keys;
}

function noteLabel(midiNote) {
  const noteIndex = midiNote % 12;
  const octave = Math.floor(midiNote / 12) - 1;
  return `${noteNames[noteIndex]}${octave}`;
}

function calculateWhiteKeyHeight() {
  const viewportHeight = window.innerHeight || 720;
  return clamp(Math.round(viewportHeight * 0.4), 260, 360);
}

async function enableAudio() {
  if (!audio.context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      ui.audioToggle.textContent = "Audio unsupported";
      return;
    }

    audio.context = new AudioContextClass();
    audio.masterGain = audio.context.createGain();
    audio.masterGain.gain.value = 0.14;
    audio.masterGain.connect(audio.context.destination);
  }

  if (audio.context.state === "suspended") {
    await audio.context.resume();
  }

  state.audioReady = true;
  ui.audioToggle.textContent = "Sound ready";
  ui.audioToggle.classList.add("is-ready");
}

function startNote(midiNote) {
  if (!state.audioReady || !audio.context || audio.activeNotes.has(midiNote)) {
    return;
  }

  const frequency = 440 * 2 ** ((midiNote - 69) / 12);
  const now = audio.context.currentTime;
  const oscillator = audio.context.createOscillator();
  const gain = audio.context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.1, now + 0.08);

  oscillator.connect(gain);
  gain.connect(audio.masterGain);
  oscillator.start(now);

  audio.activeNotes.set(midiNote, { oscillator, gain });
}

function stopNote(midiNote) {
  const note = audio.activeNotes.get(midiNote);
  if (!note || !audio.context) {
    return;
  }

  const now = audio.context.currentTime;
  note.gain.gain.cancelScheduledValues(now);
  note.gain.gain.setValueAtTime(Math.max(note.gain.gain.value, 0.0001), now);
  note.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  note.oscillator.stop(now + 0.14);
  audio.activeNotes.delete(midiNote);
}

function loadNumber(key, fallback) {
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function saveNumber(key, value) {
  window.localStorage.setItem(key, String(value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

window.addEventListener("resize", renderKeyboard);
window.addEventListener("pagehide", () => {
  audio.activeNotes.forEach((_, midiNote) => stopNote(midiNote));
});

init();
