const STORAGE_KEY = "jwds-settings-v2";
const DEFAULTS = {
  notifyEnabled: false,
  notifyTime: "07:00",
  autoPlay: true,
  voiceId: "it-IT-IsabellaNeural",
  voiceURI: "",
  useDeviceVoice: false,
  rate: 1,
};

const els = {
  dateLabel: document.getElementById("dateLabel"),
  scripture: document.getElementById("scripture"),
  status: document.getElementById("status"),
  playBtn: document.getElementById("playBtn"),
  stopBtn: document.getElementById("stopBtn"),
  reading: document.getElementById("reading"),
  bodyText: document.getElementById("bodyText"),
  sourceLink: document.getElementById("sourceLink"),
  settingsBtn: document.getElementById("settingsBtn"),
  settingsDialog: document.getElementById("settingsDialog"),
  settingsForm: document.getElementById("settingsForm"),
  notifyTime: document.getElementById("notifyTime"),
  autoPlay: document.getElementById("autoPlay"),
  notifyEnabled: document.getElementById("notifyEnabled"),
  voiceSelect: document.getElementById("voiceSelect"),
  rate: document.getElementById("rate"),
  useDeviceVoice: document.getElementById("useDeviceVoice"),
  previewVoiceBtn: document.getElementById("previewVoiceBtn"),
  testNotifyBtn: document.getElementById("testNotifyBtn"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  notifyHelp: document.getElementById("notifyHelp"),
  siriLink: document.getElementById("siriLink"),
  copySiriLinkBtn: document.getElementById("copySiriLinkBtn"),
  siriHelp: document.getElementById("siriHelp"),
  tapGate: document.getElementById("tapGate"),
  tapGateBtn: document.getElementById("tapGateBtn"),
};

let daily = null;
let speaking = false;
let audioEl = null;
let neuralVoices = [];
let settings = loadSettings();

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(next) {
  settings = { ...settings, ...next };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

function launchSource() {
  return (qs("source") || "").toLowerCase();
}

function shouldAutoPlay() {
  const source = launchSource();
  return (
    qs("play") === "1" ||
    source === "notification" ||
    source === "siri" ||
    source === "shortcut" ||
    source === "assistant"
  );
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isInstalledPwa() {
  return window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
}

function showTapGate(message) {
  if (message) els.status.textContent = message;
  els.tapGate.hidden = false;
}

function hideTapGate() {
  els.tapGate.hidden = true;
}

function dailyAudioUrl(voiceId = settings.voiceId) {
  return `${location.origin}/api/daily-audio?voice=${encodeURIComponent(voiceId || "it-IT-IsabellaNeural")}`;
}

async function ensureSW() {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return reg;
}

async function loadNeuralVoices() {
  try {
    const data = await fetchJson("/api/voices", 10000);
    neuralVoices = data.voices || [];
    if (data.defaultVoice && !settings.voiceId) {
      settings.voiceId = data.defaultVoice;
    }
  } catch {
    neuralVoices = [
      {
        id: "it-IT-IsabellaNeural",
        name: "Isabella",
        gender: "Donna",
        style: "Naturale",
        recommended: true,
      },
      { id: "it-IT-DiegoNeural", name: "Diego", gender: "Uomo", style: "Naturale" },
    ];
  }
  populateVoiceSelect();
}

function populateVoiceSelect() {
  if (settings.useDeviceVoice) {
    populateDeviceVoices();
    return;
  }
  els.voiceSelect.innerHTML = "";
  for (const voice of neuralVoices) {
    const opt = document.createElement("option");
    opt.value = voice.id;
    const star = voice.recommended ? " ★" : "";
    opt.textContent = `${voice.name} — ${voice.gender}, ${voice.style}${star}`;
    if (voice.id === settings.voiceId) opt.selected = true;
    els.voiceSelect.appendChild(opt);
  }
  if (!els.voiceSelect.value && neuralVoices[0]) {
    els.voiceSelect.value = neuralVoices[0].id;
  }
}

function populateDeviceVoices() {
  if (!("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices();
  const italian = voices.filter((v) => (v.lang || "").toLowerCase().startsWith("it"));
  const list = italian.length ? italian : voices;
  els.voiceSelect.innerHTML = '<option value="">Automatica (italiano dispositivo)</option>';
  for (const voice of list) {
    const opt = document.createElement("option");
    opt.value = voice.voiceURI;
    opt.textContent = `${voice.name} (${voice.lang})`;
    if (voice.voiceURI === settings.voiceURI) opt.selected = true;
    els.voiceSelect.appendChild(opt);
  }
}

function pickDeviceVoice() {
  const voices = speechSynthesis.getVoices();
  if (settings.voiceURI) {
    const chosen = voices.find((v) => v.voiceURI === settings.voiceURI);
    if (chosen) return chosen;
  }
  return (
    voices.find((v) => (v.lang || "").toLowerCase() === "it-it") ||
    voices.find((v) => (v.lang || "").toLowerCase().startsWith("it")) ||
    null
  );
}

function stopSpeech() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  if (audioEl) {
    audioEl.pause();
    audioEl.src = "";
    audioEl = null;
  }
  speaking = false;
  els.stopBtn.hidden = true;
  els.playBtn.hidden = false;
  els.playBtn.textContent = "Ascolta";
}

function markSpeaking(on) {
  speaking = on;
  els.playBtn.hidden = on;
  els.stopBtn.hidden = !on;
  if (!on) els.playBtn.hidden = false;
}

async function speakNeural({ fromGate = false, preview = false } = {}) {
  stopSpeech();
  const voiceId = els.voiceSelect?.value || settings.voiceId || "it-IT-IsabellaNeural";
  const url = dailyAudioUrl(voiceId) + `&t=${Date.now()}`;
  els.status.textContent = preview ? "Anteprima voce…" : "Sto preparando la voce naturale…";

  let objectUrl = "";
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    if (!blob.size) throw new Error("Audio vuoto");
    objectUrl = URL.createObjectURL(blob);
  } catch (error) {
    console.error(error);
    els.status.textContent = `Errore audio neurale: ${error.message || error}`;
    if (shouldAutoPlay() && !fromGate && !preview) {
      showTapGate("Tocca per riprovare l’ascolto.");
    }
    return;
  }

  audioEl = new Audio();
  audioEl.preload = "auto";
  audioEl.playsInline = true;
  audioEl.src = objectUrl;

  let started = false;
  const failSafe = setTimeout(() => {
    if (!started && shouldAutoPlay() && !fromGate && !preview) {
      showTapGate("Tocca per avviare l’audio.");
    }
  }, 2500);

  const cleanup = () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = "";
    }
  };

  audioEl.onplay = () => {
    started = true;
    clearTimeout(failSafe);
    hideTapGate();
    markSpeaking(true);
    els.status.textContent = preview
      ? "Anteprima in corso…"
      : "Lettura con voce neurale gratuita.";
  };
  audioEl.onended = () => {
    clearTimeout(failSafe);
    markSpeaking(false);
    cleanup();
    if (!preview) els.status.textContent = "Lettura completata.";
  };
  audioEl.onerror = () => {
    clearTimeout(failSafe);
    markSpeaking(false);
    cleanup();
    els.status.textContent = "Errore riproduzione. Riprova o usa voci del dispositivo.";
    if (shouldAutoPlay() && !fromGate && !preview) {
      showTapGate("Tocca per riprovare l’ascolto.");
    }
  };

  try {
    await audioEl.play();
  } catch (error) {
    clearTimeout(failSafe);
    markSpeaking(false);
    if (!fromGate) {
      showTapGate("Tocca per ascoltare con la voce scelta.");
    } else {
      els.status.textContent = `Impossibile avviare l’audio: ${error.message || error}`;
    }
  }
}

function speakDevice(text, { fromGate = false } = {}) {
  if (!("speechSynthesis" in window)) {
    els.status.textContent = "Il browser non supporta le voci del dispositivo.";
    return;
  }
  stopSpeech();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "it-IT";
  utter.rate = Number(settings.rate) || 1;
  const voice = pickDeviceVoice();
  if (voice) utter.voice = voice;

  let started = false;
  const failSafe = setTimeout(() => {
    if (!started && shouldAutoPlay() && !fromGate) {
      showTapGate("Tocca per avviare l’audio.");
    }
  }, 1200);

  utter.onstart = () => {
    started = true;
    clearTimeout(failSafe);
    hideTapGate();
    markSpeaking(true);
  };
  utter.onend = () => {
    clearTimeout(failSafe);
    markSpeaking(false);
  };
  utter.onerror = () => {
    clearTimeout(failSafe);
    markSpeaking(false);
    if (shouldAutoPlay() && !fromGate) showTapGate("Tocca per ascoltare.");
  };
  speechSynthesis.speak(utter);
}

async function speak(text, opts = {}) {
  if (settings.useDeviceVoice) {
    speakDevice(text, opts);
    return;
  }
  await speakNeural(opts);
}

function renderDaily(data) {
  daily = data;
  els.dateLabel.textContent = data.title || data.date;
  els.scripture.textContent = data.scripture || "Testo del giorno";
  els.bodyText.textContent = data.body || "";
  els.reading.hidden = !data.body;
  els.sourceLink.href = data.sourceUrl || "https://wol.jw.org/it/wol/h/r6/lp-i";
  els.playBtn.disabled = !data.speakText;
  const source = launchSource();
  if (source === "siri") {
    els.status.textContent = "Apertura da Siri — avvio la lettura…";
  } else if (data.body) {
    els.status.textContent =
      "Pronto. Scegli una voce naturale in Impostazioni, poi Ascolta oppure usa Siri.";
  } else {
    els.status.textContent = "Contenuto incompleto: riprova tra poco.";
  }
}

async function loadDaily() {
  els.playBtn.disabled = true;
  els.status.textContent = "Sto scaricando il testo del giorno…";
  const data = await fetchJson("/api/daily-text", 20000);
  renderDaily(data);
  return data;
}

function nextTriggerDate(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const when = new Date();
  when.setSeconds(0, 0);
  when.setHours(h, m, 0, 0);
  if (when.getTime() <= Date.now() + 5000) {
    when.setDate(when.getDate() + 1);
  }
  return when;
}

async function scheduleMorningNotification() {
  const reg = await ensureSW();
  if (!reg) {
    els.notifyHelp.textContent = "Questo browser non supporta i service worker.";
    return;
  }

  if (!settings.notifyEnabled) {
    reg.active?.postMessage({ type: "clear-schedules" });
    els.notifyHelp.textContent = "Notifiche disattivate.";
    return;
  }

  if (isIos() && !isInstalledPwa()) {
    els.notifyHelp.textContent =
      "Su iPhone installa prima l’app sulla Home: Condividi → Aggiungi alla schermata Home.";
  }

  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      saveSettings({ notifyEnabled: false });
      els.notifyEnabled.checked = false;
      els.notifyHelp.textContent =
        "Permesso notifiche negato. Puoi riattivarlo dalle impostazioni del browser.";
      return;
    }
  }

  const when = nextTriggerDate(settings.notifyTime);
  reg.active?.postMessage({
    type: "schedule",
    when: when.getTime(),
    title: "JW Daily Scripture",
    body: "Tocca per ascoltare la scrittura di oggi",
    notifyTime: settings.notifyTime,
  });

  const label = when.toLocaleString("it-IT", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  els.notifyHelp.textContent = `Prossima notifica: ${label}.`;
  if (isIos() && !isInstalledPwa()) {
    els.notifyHelp.textContent += " Apri l’app dalla Home per mantenerla attiva.";
  }
}

function carPlayPlayerUrl(voiceId = settings.voiceId) {
  // Direct MP3: Safari/Chrome start playback automatically (web pages are blocked without a tap).
  return `${location.origin}/api/daily-audio?voice=${encodeURIComponent(voiceId || "it-IT-IsabellaNeural")}`;
}

function refreshSiriLink() {
  const voiceId = els.voiceSelect?.value || settings.voiceId || "it-IT-IsabellaNeural";
  if (els.siriLink) els.siriLink.value = carPlayPlayerUrl(voiceId);
  if (els.siriHelp) {
    els.siriHelp.textContent =
      "Comandi: solo «Apri URL» (Safari/Chrome) con questo link MP3. Parte da sola con voce neurale (anche CarPlay).";
  }
}

function openSettings() {
  fillSettingsForm();
  if (els.settingsDialog) {
    els.settingsDialog.hidden = false;
    document.body.style.overflow = "hidden";
  }
}

function closeSettings() {
  if (els.settingsDialog) {
    els.settingsDialog.hidden = true;
    document.body.style.overflow = "";
  }
}

function fillSettingsForm() {
  if (!els.notifyTime) return;
  els.notifyTime.value = settings.notifyTime;
  els.autoPlay.checked = settings.autoPlay;
  els.notifyEnabled.checked = settings.notifyEnabled;
  els.rate.value = String(settings.rate);
  if (els.useDeviceVoice) els.useDeviceVoice.checked = settings.useDeviceVoice;
  populateVoiceSelect();
  refreshSiriLink();
}

async function fetchJson(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || `HTTP ${res.status}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function init() {
  try {
    await loadNeuralVoices();
  } catch (error) {
    console.error(error);
  }
  fillSettingsForm();
  ensureSW().catch((error) => console.error(error));

  try {
    await loadDaily();
    if (settings.autoPlay && shouldAutoPlay() && daily?.speakText) {
      setTimeout(() => speak(daily.speakText), launchSource() === "siri" ? 350 : 0);
    }
  } catch (error) {
    console.error(error);
    els.dateLabel.textContent = "Oggi";
    els.scripture.textContent = "Non riesco a caricare il testo";
    els.status.textContent = String(error.message || error);
    els.playBtn.disabled = true;
  }

  if (settings.notifyEnabled) {
    scheduleMorningNotification().catch(console.error);
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && settings.notifyEnabled) {
    scheduleMorningNotification().catch(console.error);
  }
});

window.addEventListener("pageshow", () => {
  if (settings.notifyEnabled) scheduleMorningNotification().catch(console.error);
});

els.playBtn.addEventListener("click", () => {
  if (!daily?.speakText) return;
  hideTapGate();
  speak(daily.speakText, { fromGate: true });
});

els.stopBtn.addEventListener("click", stopSpeech);

els.tapGateBtn.addEventListener("click", () => {
  if (!daily?.speakText) return;
  hideTapGate();
  speak(daily.speakText, { fromGate: true });
});

els.settingsBtn.addEventListener("click", (event) => {
  event.preventDefault();
  openSettings();
});

els.closeSettingsBtn.addEventListener("click", (event) => {
  event.preventDefault();
  closeSettings();
});

els.settingsDialog.addEventListener("click", (event) => {
  if (event.target === els.settingsDialog) closeSettings();
});

els.voiceSelect.addEventListener("change", () => {
  if (settings.useDeviceVoice) {
    settings.voiceURI = els.voiceSelect.value;
  } else {
    settings.voiceId = els.voiceSelect.value;
  }
  refreshSiriLink();
});

els.useDeviceVoice.addEventListener("change", () => {
  settings.useDeviceVoice = els.useDeviceVoice.checked;
  populateVoiceSelect();
  refreshSiriLink();
});

els.previewVoiceBtn.addEventListener("click", async () => {
  saveSettings({
    voiceId: settings.useDeviceVoice ? settings.voiceId : els.voiceSelect.value,
    voiceURI: settings.useDeviceVoice ? els.voiceSelect.value : settings.voiceURI,
    useDeviceVoice: els.useDeviceVoice.checked,
    rate: Number(els.rate.value) || 1,
  });
  if (settings.useDeviceVoice) {
    speakDevice("Questa è l’anteprima della voce scelta per JW Daily Scripture.", {
      fromGate: true,
    });
  } else {
    await speakNeural({ fromGate: true, preview: true });
  }
});

els.copySiriLinkBtn.addEventListener("click", async () => {
  refreshSiriLink();
  try {
    await navigator.clipboard.writeText(els.siriLink.value);
    els.copySiriLinkBtn.textContent = "Copiato";
    setTimeout(() => {
      els.copySiriLinkBtn.textContent = "Copia link MP3";
    }, 1600);
  } catch {
    els.siriLink.select();
    els.copySiriLinkBtn.textContent = "Seleziona e copia";
  }
});

els.settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveSettings({
    notifyTime: els.notifyTime.value || "07:00",
    autoPlay: els.autoPlay.checked,
    notifyEnabled: els.notifyEnabled.checked,
    useDeviceVoice: els.useDeviceVoice.checked,
    voiceId: els.useDeviceVoice.checked ? settings.voiceId : els.voiceSelect.value,
    voiceURI: els.useDeviceVoice.checked ? els.voiceSelect.value : settings.voiceURI,
    rate: Number(els.rate.value) || 1,
  });
  refreshSiriLink();
  await scheduleMorningNotification();
  closeSettings();
});

els.testNotifyBtn.addEventListener("click", async () => {
  const reg = await ensureSW();
  if (!reg) return;
  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
  }
  reg.active?.postMessage({
    type: "notify-now",
    title: "JW Daily Scripture — prova",
    body: "Tocca per aprire e ascoltare la scrittura del giorno",
  });
});

if ("speechSynthesis" in window) {
  speechSynthesis.onvoiceschanged = () => {
    if (settings.useDeviceVoice) populateDeviceVoices();
  };
}

init();
