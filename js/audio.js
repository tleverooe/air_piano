// Salamander Grand Piano samples, hosted by the Tone.js project.
// One sample every minor third; Tone.Sampler pitch-shifts the notes in between.
const BASE_URL = 'https://tonejs.github.io/audio/salamander/';

function sampleUrls() {
  const urls = { A0: 'A0.mp3', C8: 'C8.mp3' };
  for (let octave = 1; octave <= 7; octave++) {
    for (const note of ['C', 'D#', 'F#', 'A']) {
      urls[`${note}${octave}`] = `${note.replace('#', 's')}${octave}.mp3`;
    }
  }
  return urls;
}

// Must be called from a click, so the browser lets audio start.
export function unlockAudio() {
  return window.Tone.start();
}

export function createPiano() {
  const Tone = window.Tone;
  return new Promise((resolve, reject) => {
    const sampler = new Tone.Sampler({
      urls: sampleUrls(),
      baseUrl: BASE_URL,
      release: 1.2,
      onload: () => resolve(sampler),
      onerror: reject,
    }).toDestination();
  });
}
