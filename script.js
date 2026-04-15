const STORAGE_KEYS = {
  whiteKeyWidth: "pocket-piano-white-key-width",
  octaveCount: "pocket-piano-octave-count",
  tone: "pocket-piano-tone",
  volume: "pocket-piano-volume",
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
  toneSelect: document.getElementById("toneSelect"),
  volumeLevel: document.getElementById("volumeLevel"),
  volumeValue: document.getElementById("volumeValue"),
  keySize: document.getElementById("keySize"),
  sizeValue: document.getElementById("sizeValue"),
  octaveDown: document.getElementById("octaveDown"),
  octaveUp: document.getElementById("octaveUp"),
  octaveValue: document.getElementById("octaveValue"),
  keyboard: document.getElementById("keyboard"),
  keyboardViewport: document.getElementById("keyboardViewport"),
};

const tonePresets = {
  classicGrand: {
    label: "Classic Grand",
    harmonics: [
      { type: "triangle", gain: 0.9, detune: 0 },
      { type: "sine", gain: 0.26, detune: 12 },
      { type: "triangle", gain: 0.16, detune: -5 },
    ],
    lowpass: 4300,
    attack: 0.01,
    decay: 0.2,
    sustain: 0.08,
    release: 0.48,
  },
  brightStage: {
    label: "Bright Stage",
    harmonics: [
      { type: "sawtooth", gain: 0.5, detune: 0 },
      { type: "triangle", gain: 0.34, detune: 4 },
      { type: "sine", gain: 0.12, detune: 0 },
    ],
    lowpass: 6200,
    attack: 0.008,
    decay: 0.16,
    sustain: 0.09,
    release: 0.4,
  },
  warmUpright: {
    label: "Warm Upright",
    harmonics: [
      { type: "triangle", gain: 0.78, detune: 0 },
      { type: "sine", gain: 0.3, detune: -3 },
      { type: "triangle", gain: 0.12, detune: 7 },
    ],
    lowpass: 2900,
    attack: 0.015,
    decay: 0.22,
    sustain: 0.07,
    release: 0.58,
  },
  softBallad: {
    label: "Soft Ballad",
    harmonics: [
      { type: "sine", gain: 0.72, detune: 0 },
      { type: "triangle", gain: 0.22, detune: 2 },
      { type: "sine", gain: 0.14, detune: 12 },
    ],
    lowpass: 2400,
    attack: 0.02,
    decay: 0.28,
    sustain: 0.06,
    release: 0.72,
  },
  honkyTonk: {
    label: "Honky Tonk",
    harmonics: [
      { type: "triangle", gain: 0.65, detune: -7 },
      { type: "triangle", gain: 0.55, detune: 7 },
      { type: "sawtooth", gain: 0.14, detune: 0 },
    ],
    lowpass: 3800,
    attack: 0.009,
    decay: 0.14,
    sustain: 0.08,
    release: 0.36,
  },
  dreamEP: {
    label: "Dream EP",
    harmonics: [
      { type: "sine", gain: 0.62, detune: 0 },
      { type: "triangle", gain: 0.34, detune: 12 },
      { type: "sine", gain: 0.18, detune: 19 },
    ],
    lowpass: 5200,
    attack: 0.014,
    decay: 0.24,
    sustain: 0.1,
    release: 0.86,
    tremoloDepth: 0.18,
    tremoloRate: 4.6,
  },
};

const state = {
  whiteKeyWidth: loadNumber(STORAGE_KEYS.whiteKeyWidth, 52),
  octaveCount: clamp(loadNumber(STORAGE_KEYS.octaveCount, 4), 3, 6),
  tone: loadTone(STORAGE_KEYS.tone, "classicGrand"),
  volume: clamp(loadNumber(STORAGE_KEYS.volume, 400), 0, 400),
  audioReady: false,
};

const audio = {
  context: null,
  compressor: null,
  masterGain: null,
  activeNotes: new Map(),
};

const BASE_MASTER_GAIN = 2.8;

function init() {
  if (ui.keySize) {
    ui.keySize.value = String(state.whiteKeyWidth);
  }
  if (ui.toneSelect) {
    ui.toneSelect.value = state.tone;
  }
  if (ui.volumeLevel) {
    ui.volumeLevel.value = String(state.volume);
  }
  renderSettings();
  renderKeyboard();
  bindEvents();
}

function bindEvents() {
  if (ui.audioToggle) {
    ui.audioToggle.addEventListener("click", enableAudio);
  }
  if (ui.toneSelect) {
    ui.toneSelect.addEventListener("change", (event) => {
      state.tone = event.target.value;
      saveTone(STORAGE_KEYS.tone, state.tone);
      stopAllNotes();
    });
  }
  if (ui.volumeLevel) {
    ui.volumeLevel.addEventListener("input", (event) => {
      state.volume = Number(event.target.value);
      saveNumber(STORAGE_KEYS.volume, state.volume);
      renderSettings();
      syncMasterVolume();
    });
  }
  if (ui.keySize) {
    ui.keySize.addEventListener("input", (event) => {
      state.whiteKeyWidth = Number(event.target.value);
      saveNumber(STORAGE_KEYS.whiteKeyWidth, state.whiteKeyWidth);
      renderSettings();
      renderKeyboard();
    });
  }

  if (ui.octaveDown) {
    ui.octaveDown.addEventListener("click", () => updateOctaves(-1));
  }
  if (ui.octaveUp) {
    ui.octaveUp.addEventListener("click", () => updateOctaves(1));
  }
}

function renderSettings() {
  document.documentElement.style.setProperty("--white-key-width", `${state.whiteKeyWidth}px`);
  document.documentElement.style.setProperty("--black-key-width", `${Math.round(state.whiteKeyWidth * 0.62)}px`);
  if (ui.sizeValue) {
    ui.sizeValue.textContent = `${state.whiteKeyWidth} px`;
  }
  if (ui.volumeValue) {
    ui.volumeValue.textContent = `${state.volume}%`;
  }
  if (ui.octaveValue) {
    ui.octaveValue.textContent = `${state.octaveCount} octaves`;
  }
}

function renderKeyboard() {
  if (!ui.keyboard) {
    return;
  }

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
  const begin = async (event) => {
    event.preventDefault();
    await ensureAudioReady();
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
  await ensureAudioReady();
}

async function ensureAudioReady() {
  if (!audio.context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      if (ui.audioToggle) {
        ui.audioToggle.textContent = "Audio unsupported";
      }
      return false;
    }

    audio.context = new AudioContextClass();
    audio.compressor = audio.context.createDynamicsCompressor();
    audio.masterGain = audio.context.createGain();
    audio.compressor.threshold.setValueAtTime(-24, audio.context.currentTime);
    audio.compressor.knee.setValueAtTime(24, audio.context.currentTime);
    audio.compressor.ratio.setValueAtTime(16, audio.context.currentTime);
    audio.compressor.attack.setValueAtTime(0.002, audio.context.currentTime);
    audio.compressor.release.setValueAtTime(0.16, audio.context.currentTime);
    syncMasterVolume();
    audio.masterGain.connect(audio.compressor);
    audio.compressor.connect(audio.context.destination);
  }

  if (audio.context.state === "suspended") {
    await audio.context.resume();
  }

  if (audio.context.state !== "running") {
    if (ui.audioToggle) {
      ui.audioToggle.textContent = "Tap again for sound";
    }
    return false;
  }

  state.audioReady = true;
  if (ui.audioToggle) {
    ui.audioToggle.textContent = "Sound ready";
    ui.audioToggle.classList.add("is-ready");
  }
  return true;
}

function startNote(midiNote) {
  if (!state.audioReady || !audio.context || audio.activeNotes.has(midiNote)) {
    return;
  }

  const preset = tonePresets[state.tone] ?? tonePresets.classicGrand;
  const frequency = 440 * 2 ** ((midiNote - 69) / 12);
  const now = audio.context.currentTime;
  const noteGain = audio.context.createGain();
  const noteFilter = audio.context.createBiquadFilter();
  const harmonicGain = 0.18 / preset.harmonics.length;
  const oscillators = [];

  noteFilter.type = "lowpass";
  noteFilter.frequency.setValueAtTime(adjustCutoffForPitch(preset.lowpass, midiNote), now);
  noteFilter.Q.setValueAtTime(0.7, now);

  noteGain.gain.setValueAtTime(0.0001, now);
  noteGain.gain.exponentialRampToValueAtTime(0.18, now + preset.attack);
  noteGain.gain.exponentialRampToValueAtTime(Math.max(preset.sustain, 0.0001), now + preset.attack + preset.decay);

  preset.harmonics.forEach((partial, index) => {
    const oscillator = audio.context.createOscillator();
    const gain = audio.context.createGain();
    const ratio = index + 1;

    oscillator.type = partial.type;
    oscillator.frequency.setValueAtTime(frequency * ratio, now);
    oscillator.detune.setValueAtTime(partial.detune, now);

    gain.gain.setValueAtTime(partial.gain * harmonicGain, now);
    oscillator.connect(gain);
    gain.connect(noteFilter);
    oscillator.start(now);

    oscillators.push({ oscillator, gain });
  });

  let tremolo = null;
  if (preset.tremoloDepth && preset.tremoloRate) {
    const lfo = audio.context.createOscillator();
    const lfoGain = audio.context.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(preset.tremoloRate, now);
    lfoGain.gain.setValueAtTime(preset.tremoloDepth, now);
    lfo.connect(lfoGain);
    lfoGain.connect(noteGain.gain);
    lfo.start(now);
    tremolo = { lfo, lfoGain };
  }

  noteFilter.connect(noteGain);
  noteGain.connect(audio.masterGain);

  audio.activeNotes.set(midiNote, {
    oscillators,
    noteGain,
    noteFilter,
    tremolo,
    release: preset.release,
  });
}

function stopNote(midiNote) {
  const note = audio.activeNotes.get(midiNote);
  if (!note || !audio.context) {
    return;
  }

  const now = audio.context.currentTime;
  note.noteGain.gain.cancelScheduledValues(now);
  note.noteGain.gain.setValueAtTime(Math.max(note.noteGain.gain.value, 0.0001), now);
  note.noteGain.gain.exponentialRampToValueAtTime(0.0001, now + note.release);
  note.oscillators.forEach(({ oscillator }) => oscillator.stop(now + note.release + 0.02));
  if (note.tremolo) {
    note.tremolo.lfo.stop(now + note.release + 0.02);
  }
  audio.activeNotes.delete(midiNote);
}

function loadNumber(key, fallback) {
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function saveNumber(key, value) {
  window.localStorage.setItem(key, String(value));
}

function loadTone(key, fallback) {
  const value = window.localStorage.getItem(key);
  return value && tonePresets[value] ? value : fallback;
}

function saveTone(key, value) {
  window.localStorage.setItem(key, value);
}

function syncMasterVolume() {
  if (!audio.masterGain) {
    return;
  }

  const targetGain = BASE_MASTER_GAIN * (state.volume / 100);
  const now = audio.context ? audio.context.currentTime : 0;
  audio.masterGain.gain.setValueAtTime(targetGain, now);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function adjustCutoffForPitch(baseCutoff, midiNote) {
  if (midiNote <= 48) {
    return baseCutoff * 0.84;
  }
  if (midiNote >= 72) {
    return baseCutoff * 1.08;
  }
  return baseCutoff;
}

function stopAllNotes() {
  [...audio.activeNotes.keys()].forEach((midiNote) => stopNote(midiNote));
  document.querySelectorAll(".white-key.active, .black-key.active").forEach((element) => {
    element.classList.remove("active");
  });
}

window.addEventListener("resize", renderKeyboard);
window.addEventListener("pagehide", () => {
  stopAllNotes();
});

init();
