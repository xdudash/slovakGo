import baseCopy from "../data/home.json";
import offerCopy from "../../../shared/offerCopy.json";
const copy = Object.fromEntries(Object.entries(baseCopy).map(([lang, strings]) => [lang, {
  ...strings,
  freeText: offerCopy[lang].free,
  trialNoticeText: offerCopy[lang].trial,
  faqA5: `${offerCopy[lang].free} ${offerCopy[lang].trial}`,
}]));
const supported = Object.keys(copy);
let currentLang = document.documentElement.lang;
let step = 0,
  selected = null,
  finished = false,
  topic = 2,
  level = 0,
  started = false,
  audioTimer;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const phrases = [
  "Hľadám si prácu.",
  "Je byt ešte voľný?",
  "Čo vás bolí?",
  "Aké doklady potrebujem?",
  "Prosím si kávu.",
  "Dobrý deň, som váš nový sused.",
  "Kedy sa začína prednáška?",
  "Kde je zastávka?",
];
const levelCodes = ["A1 — A2", "B1 — B2", "C1 — C2"];
const levelKeys = [
  "levelBasicText",
  "levelIndependentText",
  "levelAdvancedText",
];
const s = (key) => copy[currentLang][key];
function track(name, detail = {}) {
  const payload = { lang: currentLang, ...detail };
  window.dispatchEvent(
    new CustomEvent("slovakgo:conversion", {
      detail: { event: name, ...payload },
    }),
  );
  // Use existing analytics and consent setup; don't add a new tracker.
  if (typeof window.gtag === "function") window.gtag("event", name, payload);
}
function markStarted() {
  if (!started) {
    started = true;
    track("demo_start");
  }
}
function updateTopic() {
  $(".daily-slovak").textContent = phrases[topic];
  $(".daily-translation").textContent = s("translations")[topic];
  $$("[data-topic]").forEach((button) => {
    const active = Number(button.dataset.topic) === topic;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}
function updateLevel() {
  $(".level-detail-code").textContent = levelCodes[level];
  $(".level-detail p").textContent = s(levelKeys[level]);
  $(".level-availability").hidden = level !== 2;
  $$("[data-level]").forEach((button) => {
    const active = Number(button.dataset.level) === level;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}
function stopAudio() {
  clearTimeout(audioTimer);
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  $(".audio").removeAttribute("aria-busy");
  $(".audio-status").textContent = "";
}
function slovakVoice() {
  return "speechSynthesis" in window
    ? window.speechSynthesis
        .getVoices()
        .find((voice) => /^sk(?:-|_|$)/i.test(voice.lang))
    : null;
}
function syncAudio() {
  const available = !!slovakVoice(),
    button = $(".audio");
  button.disabled = !available;
  button.title = s(available ? "listen" : "noAudio");
  button.setAttribute("aria-label", button.title);
  if (!available) $(".audio-status").textContent = s("noAudio");
  else if ($(".audio-status").textContent === s("noAudio"))
    $(".audio-status").textContent = "";
}
function renderLesson() {
  $(".demo-body").hidden = finished;
  $(".demo-complete").hidden = !finished;
  const progress = finished ? 2 : step + (selected === 1 ? 1 : 0);
  $(".progress-track").setAttribute("aria-valuenow", String(progress));
  $(".progress-track").setAttribute("aria-label", s("previewLive"));
  $(".progress-track>span").style.width = `${finished ? 100 : progress * 50}%`;
  $(".progress-count").textContent = `${finished ? 2 : step + 1} / 2`;
  $("#exercise-title").textContent = step
    ? "Chcel by som sa objednať."
    : "Čo vás bolí?";
  $(".lesson-meaning").textContent = s(
    step ? "secondMeaning" : "lessonMeaning",
  );
  $(".lesson-prompt").textContent = s(step ? "secondPrompt" : "lessonPrompt");
  $(".lesson-options").setAttribute("aria-label", s("questionLabel"));
  const options = step
    ? ["Mám otázku.", "Chcel by som sa objednať."]
    : ["Som hladný.", "Bolí ma hlava."];
  $$(".lesson-option").forEach((button, i) => {
    button.querySelector(".option-text").textContent = options[i];
    button.classList.toggle("selected", selected === i && i === 1);
    button.classList.toggle("wrong", selected === i && i !== 1);
    button.setAttribute("aria-pressed", String(selected === i));
    button.querySelector(".option-mark").textContent =
      selected === i ? (i === 1 ? "✓" : "×") : "";
  });
  $(".lesson-feedback").textContent =
    selected === null
      ? ""
      : s(
          step
            ? selected === 1
              ? "secondCorrect"
              : "secondWrong"
            : selected === 1
              ? "correct"
              : "incorrect",
        );
  $(".lesson-feedback").classList.toggle("error", selected === 0);
  $(".lesson-explanation").hidden = selected !== 1;
  $(".lesson-explanation p").textContent = s(
    step ? "secondExplain" : "explanation",
  );
  $(".lesson-next").hidden = selected !== 1;
  syncAudio();
}
function setLang(lang, updateUrl = false) {
  stopAudio();
  currentLang = supported.includes(lang) ? lang : "uk";
  document.documentElement.lang = currentLang;
  const title = `SlovakGO — ${s("eyebrow")}`;
  document.title = title;
  $('meta[name="description"]').content = s("lead");
  $('meta[property="og:title"]').content = title;
  $('meta[property="og:description"]').content = s("lead");
  $$("[data-t]").forEach((el) => {
    const value = s(el.dataset.t);
    if (typeof value === "string") el.innerHTML = value;
  });
  $$("[data-list]").forEach((el) => {
    el.textContent = s(el.dataset.list)[Number(el.dataset.index)];
  });
  $$("[data-screen]").forEach((el) => {
    el.alt = s("screens")[Number(el.dataset.screen)];
  });
  $("#language").value = currentLang;
  $$('a[href^="https://app.slovakgo.sk"]').forEach((a) => {
    const url = new URL(a.href);
    url.searchParams.set("lang", currentLang);
    a.href = url.toString();
  });
  $$(".brand").forEach((a) => (a.href = `/${currentLang}/`));
  if (updateUrl) {
    const url = new URL(location.href);
    url.pathname = `/${currentLang}/`;
    url.searchParams.delete("lang");
    history.replaceState(null, "", url);
  }
  const canonical = `https://www.slovakgo.sk/${currentLang}/`;
  $('link[rel="canonical"]').href = canonical;
  $('meta[property="og:url"]').content = canonical;
  try {
    localStorage.setItem("slovakgo-site-lang", currentLang);
  } catch {
    /* Storage may be disabled. */
  }
  updateTopic();
  updateLevel();
  renderLesson();
}
$("#language").addEventListener("change", (event) =>
  setLang(event.target.value, true),
);
$$("[data-topic]").forEach((button) =>
  button.addEventListener("click", () => {
    topic = Number(button.dataset.topic);
    updateTopic();
  }),
);
$$("[data-level]").forEach((button) =>
  button.addEventListener("click", () => {
    level = Number(button.dataset.level);
    updateLevel();
  }),
);
$$("[data-start]").forEach((link) =>
  link.addEventListener("click", () => {
    markStarted();
    if (finished) {
      step = 0;
      selected = null;
      finished = false;
      renderLesson();
    }
    $("#exercise").focus({ preventScroll: true });
  }),
);
$$(".lesson-option").forEach((button) =>
  button.addEventListener("click", () => {
    markStarted();
    selected = Number(button.dataset.answer);
    renderLesson();
    if (selected === 1) track("demo_answer_correct", { step: step + 1 });
  }),
);
$(".lesson-next").addEventListener("click", () => {
  stopAudio();
  $(".lesson-explanation").open = false;
  if (step === 0) {
    step = 1;
    selected = null;
    renderLesson();
    $(".lesson-option").focus({ preventScroll: true });
  } else {
    finished = true;
    renderLesson();
    track("demo_complete");
    $(".demo-complete h2").focus({ preventScroll: true });
  }
});
$(".restart").addEventListener("click", () => {
  stopAudio();
  step = 0;
  selected = null;
  finished = false;
  started = false;
  $(".lesson-explanation").open = false;
  renderLesson();
  $(".lesson-option").focus({ preventScroll: true });
});
$$("[data-register]").forEach((link) =>
  link.addEventListener("click", () =>
    track("registration_click", {
      source: link.dataset.plan || (finished ? "demo" : "page"),
    }),
  ),
);
$("[data-placement]").addEventListener("click", () => track("placement_click"));
$(".audio").addEventListener("click", () => {
  const voice = slovakVoice();
  if (!voice) {
    syncAudio();
    return;
  }
  stopAudio();
  const button = $(".audio");
  button.setAttribute("aria-busy", "true");
  $(".audio-status").textContent = s("audioLoading");
  const speech = new SpeechSynthesisUtterance($("#exercise-title").textContent);
  speech.lang = "sk-SK";
  speech.voice = voice;
  speech.rate = 0.85;
  const done = () => {
    clearTimeout(audioTimer);
    button.removeAttribute("aria-busy");
    $(".audio-status").textContent = "";
  };
  speech.onstart = () => {
    $(".audio-status").textContent = s("audioPlaying");
  };
  speech.onend = done;
  speech.onerror = (event) => {
    done();
    if (!["canceled", "interrupted"].includes(event.error))
      $(".audio-status").textContent = s("audioError");
  };
  audioTimer = setTimeout(() => {
    window.speechSynthesis.cancel();
    done();
    $(".audio-status").textContent = s("audioError");
  }, 15000);
  try {
    window.speechSynthesis.speak(speech);
  } catch {
    done();
    $(".audio-status").textContent = s("audioError");
  }
});
if ("speechSynthesis" in window)
  window.speechSynthesis.addEventListener("voiceschanged", syncAudio);
window.addEventListener("pagehide", stopAudio);
const requested = new URLSearchParams(location.search).get("lang");
let saved;
try {
  saved = localStorage.getItem("slovakgo-site-lang");
} catch {
  /* Use document language. */
}
const initial = supported.includes(requested)
  ? requested
  : location.pathname === "/" && supported.includes(saved)
    ? saved
    : currentLang;
setLang(initial, initial !== document.documentElement.lang);
