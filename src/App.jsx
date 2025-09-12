import React, { useEffect, useMemo, useState } from "react";
import {
  X, Upload, Download, Volume2, Settings, BookOpen, MessageSquare,
  ChevronLeft, ChevronRight, Play
} from "lucide-react";

/* =========================
   Content version (AUTO-REFRESH)
   ========================= */
const CONTENT_VERSION = 2;

/* =========================
   Load course JSONs
   ========================= */
import esEn from "./content/es-en.json";
import jaKo from "./content/ja-ko.json";

/* =========================
   LocalStorage helpers
   ========================= */
const LS_KEYS = {
  DATA: "polyglot_trainer_data_v1",
  STATE: "polyglot_trainer_state_v1",
  MASTERY: "polyglot_trainer_mastery_v1",
};
const saveLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const loadLS = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };

/* =========================
   Built-in curriculum
   ========================= */
const DEFAULT_DATA = {
  contentVersion: CONTENT_VERSION,
  courses: [esEn, jaKo],
};

/* =========================
   Speech (TTS)
   ========================= */
function pickVoice(langHint) {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  if (!voices.length) return null;
  if (langHint) {
    const exact = voices.find(v => v.lang === langHint);
    if (exact) return exact;
    const prefCode = langHint.split("-")[0];
    const pref = voices.find(v => v.lang?.startsWith(prefCode));
    if (pref) return pref;
  }
  return voices[0] || null;
}
function speak(text, langHint) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(langHint);
    if (v) u.voice = v;
    u.lang = langHint || v?.lang || "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}

/* =========================
   String helpers
   ========================= */
function stripDiacritics(s = "") {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function sameAnswer(a = "", b = "") {
  const ca = stripDiacritics(a).toLowerCase().replace(/\s+/g, " ").trim();
  const cb = stripDiacritics(b).toLowerCase().replace(/\s+/g, " ").trim();
  return ca === cb;
}
function capitalize(s) { return (s || "").charAt(0).toUpperCase() + (s || "").slice(1); }
function labelize(s) {
  if (!s) return s;
  const map = { tu: "tú", el: "él", ella: "ella", usted: "usted", vosotros: "vosotros" };
  const base = map[s] || s;
  return base.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }
function extractLemma(topic = "") {
  const m = topic.match(/[:：]\s*([^(]+)/);
  return m ? m[1].trim() : topic.trim();
}

/* =========================
   App
   ========================= */
export default function App() {
  const initialData = useMemo(() => {
    const saved = loadLS(LS_KEYS.DATA, null);
    if (saved && saved.contentVersion === CONTENT_VERSION) return saved;
    return DEFAULT_DATA;
  }, []);
  const [data, setData] = useState(initialData);
  const initialSel = loadLS(LS_KEYS.STATE, { course: null, chapter: null, mode: "learn" });
  const [sel, setSel] = useState(initialSel);
  const [mastery, setMastery] = useState(() => loadLS(LS_KEYS.MASTERY, {}));

  useEffect(() => saveLS(LS_KEYS.DATA, data), [data]);
  useEffect(() => saveLS(LS_KEYS.STATE, sel), [sel]);
  useEffect(() => saveLS(LS_KEYS.MASTERY, mastery), [mastery]);

  const openData = () => window.openDataModal && window.openDataModal();

  const currentCourse = sel.course == null ? null : data.courses[sel.course];
  const safeChapterIndex =
    currentCourse && sel.chapter != null && sel.chapter < (currentCourse.chapters?.length || 0)
      ? sel.chapter
      : null;
  const currentChapter = currentCourse && safeChapterIndex != null
    ? currentCourse.chapters[safeChapterIndex]
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-gray-700" />
          <div className="font-semibold">My Polyglot Trainer</div>
          <div className="ml-auto">
            <button
              onClick={openData}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-white hover:shadow"
            >
              <Settings className="w-4 h-4" /> Data
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Dashboard */}
        {sel.course === null && (
          <>
            <h2 className="text-lg font-semibold mb-3">Welcome back</h2>
            <p className="text-sm text-gray-600 mb-4">
              Choose a chapter and jump into <b>Learn</b>, <b>Quiz</b>, or <b>Talk</b>.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {data.courses.map((course, ci) => {
                const chapters = course.chapters || [];
                return (
                  <div key={course.id} className="p-4 rounded-2xl border bg-white">
                    <div className="text-base font-medium mb-2">{course.label}</div>
                    <div className="grid gap-3">
                      {chapters.map((ch, idx) => {
                        const m = mastery?.[course.id]?.[ch.id] ?? 0;
                        return (
                          <div key={ch.id} className="p-3 rounded-2xl border">
                            <div className="flex items-center justify-between">
                              <div className="font-medium">{ch.title}</div>
                              <div className="text-xs text-gray-500">{m}% mastered</div>
                            </div>
                            <div className="mt-2 h-2 w-32 rounded-full bg-gradient-to-r from-gray-200 to-gray-50" />
                            <div className="mt-3 grid grid-cols-3 gap-2">
                              <button onClick={() => setSel({ course: ci, chapter: idx, mode: "learn" })}>Learn</button>
                              <button onClick={() => setSel({ course: ci, chapter: idx, mode: "quiz" })}>Quiz</button>
                              <button onClick={() => setSel({ course: ci, chapter: idx, mode: "talk" })}>Talk</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Course Chapters */}
        {currentCourse && sel.chapter === null && sel.course !== null && (
          <CourseChapters
            course={currentCourse}
            mastery={mastery}
            onBack={() => setSel({ course: null, chapter: null, mode: "learn" })}
            onOpen={(chapterIdx, mode) => setSel({ course: sel.course, chapter: chapterIdx, mode })}
          />
        )}

        {/* Learn / Quiz / Talk */}
        {currentCourse && currentChapter && sel.mode === "learn" && (
          <LessonView course={currentCourse} chapter={currentChapter} onBack={() => setSel({ course: sel.course, chapter: null, mode: "learn" })} />
        )}
        {currentCourse && currentChapter && sel.mode === "quiz" && (
          <QuizView
            course={currentCourse}
            chapter={currentChapter}
            onBack={() => setSel({ course: sel.course, chapter: null, mode: "learn" })}
            onFinish={(percent) => {
              setMastery(prev => {
                const copy = { ...prev };
                copy[currentCourse.id] = copy[currentCourse.id] || {};
                copy[currentCourse.id][currentChapter.id] = Math.max(percent, copy[currentCourse.id][currentChapter.id] || 0);
                return copy;
              });
              setSel({ course: sel.course, chapter: null, mode: "learn" });
            }}
          />
        )}
        {currentCourse && currentChapter && sel.mode === "talk" && (
          <TalkView course={currentCourse} chapter={currentChapter} onBack={() => setSel({ course: sel.course, chapter: null, mode: "learn" })} />
        )}
      </main>

      <DataModal data={data} setData={setData} />
    </div>
  );
}

/* ========== Other components (CourseChapters, LessonView, QuizView, MCQQuiz, FillQuiz, GrammarQuiz, TalkView, DataModal, etc.) remain unchanged from the previous version except the corrected line in FillQuiz ========== */

/* Corrected FillQuiz */
function FillQuiz({ course, chapter, onFinish }) {
  const vocab = chapter.vocab || chapter.items || [];
  const pool = vocab.filter(v => v.source && v.target);
  // ... rest of FillQuiz code from previous version ...
}
