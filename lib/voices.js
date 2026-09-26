const ITALIAN_NEURAL_VOICES = [
  {
    id: "it-IT-IsabellaNeural",
    name: "Isabella",
    gender: "Donna",
    style: "Naturale, chiara",
    recommended: true,
  },
  {
    id: "it-IT-ElsaNeural",
    name: "Elsa",
    gender: "Donna",
    style: "Naturale, morbida",
  },
  {
    id: "it-IT-DiegoNeural",
    name: "Diego",
    gender: "Uomo",
    style: "Naturale, calda",
    recommended: true,
  },
  {
    id: "it-IT-GiuseppeNeural",
    name: "Giuseppe",
    gender: "Uomo",
    style: "Naturale, posata",
  },
  {
    id: "it-IT-GiuseppeMultilingualNeural",
    name: "Giuseppe Multilingue",
    gender: "Uomo",
    style: "Naturale, internazionale",
  },
];

const DEFAULT_VOICE = "it-IT-IsabellaNeural";

function resolveVoice(voiceId) {
  const found = ITALIAN_NEURAL_VOICES.find((v) => v.id === voiceId);
  return found ? found.id : DEFAULT_VOICE;
}

module.exports = {
  ITALIAN_NEURAL_VOICES,
  DEFAULT_VOICE,
  resolveVoice,
};
