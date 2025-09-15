import React, { useEffect, useMemo, useState } from "react";
import {
  X, Upload, Download, Volume2, Settings, BookOpen, MessageSquare,
  ChevronLeft, ChevronRight, Play
} from "lucide-react";

/* =========================
   Content version (AUTO-REFRESH)
   ========================= */
const CONTENT_VERSION = 6;

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
  // Load data (respect version)
  const initialData = useMemo(() => {
    const saved = loadLS(LS_KEYS.DATA, null);
    if (saved && saved.contentVersion === CONTENT_VERSION) return saved;
    return DEFAULT_DATA;
  }, []);
  const [data, setData] = useState(initialData);

  // Selection (course, chapter, mode)
  const initialSel = loadLS(LS_KEYS.STATE, { course: null, chapter: null, mode: "learn" });
  const [sel, setSel] = useState(initialSel);

  // Mastery map: { [courseId]: { [chapterId]: percent } }
  const [mastery, setMastery] = useState(() => loadLS(LS_KEYS.MASTERY, {}));

  useEffect(() => saveLS(LS_KEYS.DATA, data), [data]);
  useEffect(() => saveLS(LS_KEYS.STATE, sel), [sel]);
  useEffect(() => saveLS(LS_KEYS.MASTERY, mastery), [mastery]);

  const openData = () => window.openDataModal && window.openDataModal();

  // Safe selection
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
              aria-label="Open data settings"
            >
              <Settings className="w-4 h-4" /> Data
            </button>
          </div>
        </div>
      </div>

      {/* Main body */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Dashboard: all courses with chapter tiles */}
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
                            <div className={`mt-2 h-2 w-32 rounded-full bg-gradient-to-r ${ch.color || "from-gray-200 to-gray-50"}`} />
                            <div className="mt-3 grid grid-cols-3 gap-2">
                              <button
                                className="px-3 py-1.5 rounded-xl border bg-white hover:shadow text-sm"
                                onClick={() => setSel({ course: ci, chapter: idx, mode: "learn" })}
                              >
                                Learn
                              </button>
                              <button
                                className="px-3 py-1.5 rounded-xl border bg-white hover:shadow text-sm"
                                onClick={() => setSel({ course: ci, chapter: idx, mode: "quiz" })}
                              >
                                Quiz
                              </button>
                              <button
                                className="px-3 py-1.5 rounded-xl border bg-white hover:shadow text-sm"
                                onClick={() => setSel({ course: ci, chapter: idx, mode: "talk" })}
                              >
                                Talk
                              </button>
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

        {/* Course -> Chapters screen (Back target) */}
        {currentCourse && sel.chapter === null && sel.course !== null && (
          <CourseChapters
            course={currentCourse}
            mastery={mastery}
            onBack={() => setSel({ course: null, chapter: null, mode: "learn" })}
            onOpen={(chapterIdx, mode) => setSel({ course: sel.course, chapter: chapterIdx, mode })}
          />
        )}

        {/* Learn / Quiz / Talk views */}
        {currentCourse && currentChapter && sel.mode === "learn" && (
          <LessonView
            course={currentCourse}
            chapter={currentChapter}
            onBack={() => setSel({ course: sel.course, chapter: null, mode: "learn" })}
          />
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
                copy[currentCourse.id][currentChapter.id] = Math.max(
                  percent,
                  copy[currentCourse.id][currentChapter.id] || 0
                );
                return copy;
              });
              setSel({ course: sel.course, chapter: null, mode: "learn" });
            }}
          />
        )}
        {currentCourse && currentChapter && sel.mode === "talk" && (
          <TalkView
            course={currentCourse}
            chapter={currentChapter}
            onBack={() => setSel({ course: sel.course, chapter: null, mode: "learn" })}
          />
        )}
      </main>

      {/* Modals */}
      <DataModal data={data} setData={setData} />
    </div>
  );
}

/* =========================
   Course -> Chapters screen
   ========================= */
function CourseChapters({ course, mastery, onBack, onOpen }) {
  const chapters = course.chapters || [];
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="px-3 py-1.5 rounded-xl border bg-white hover:shadow">
          <ChevronLeft className="w-4 h-4 inline -mt-0.5" /> Back
        </button>
        <h2 className="text-lg font-semibold">{course.label}</h2>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {chapters.map((ch, idx) => {
          const m = mastery?.[course.id]?.[ch.id] ?? 0;
          return (
            <div key={ch.id} className="p-3 rounded-2xl border bg-white">
              <div className="flex items-center justify-between">
                <div className="text-base font-medium">{ch.title}</div>
                <div className="text-xs text-gray-500">{m}% mastered</div>
              </div>
              <div className={`mt-2 h-2 w-24 rounded-full bg-gradient-to-r ${ch.color || "from-gray-200 to-gray-50"}`} />
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button className="px-3 py-1.5 rounded-xl border bg-white hover:shadow text-sm" onClick={() => onOpen(idx, "learn")}>Learn</button>
                <button className="px-3 py-1.5 rounded-xl border bg-white hover:shadow text-sm" onClick={() => onOpen(idx, "quiz")}>Quiz</button>
                <button className="px-3 py-1.5 rounded-xl border bg-white hover:shadow text-sm" onClick={() => onOpen(idx, "talk")}>Talk</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================
   Lesson View (Learn)
   ========================= */
function LessonView({ course, chapter, onBack }) {
  const phrases = chapter.vocab || chapter.items || [];
  const dialogs = chapter.dialogs || [];
  const tips = chapter.tips || [];
  const grammar = chapter.grammar || [];

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <button onClick={onBack} className="px-3 py-1.5 rounded-xl border bg-white hover:shadow">
          <ChevronLeft className="w-4 h-4 inline -mt-0.5" /> Back
        </button>
        <h2 className="text-lg font-semibold">
          {course.label} — {chapter.title}
        </h2>
      </div>

      {/* Tips */}
      {tips.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-gray-700" />
            <div className="text-sm font-semibold">Tips</div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {tips.map((t, i) => (
              <div key={i} className="p-3 rounded-2xl border bg-white">
                <div className="text-sm font-medium">{t.title}</div>
                <div className="text-sm text-gray-600 mt-1">{t.text}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Phrases */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-4 h-4 text-gray-700" />
          <div className="text-sm font-semibold">Phrases</div>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {phrases.map((p) => (
            <div key={p.id} className="p-3 rounded-2xl border bg-white flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{p.source}</div>
                <div className="text-sm text-gray-600">{p.target}</div>
              </div>
              <button
                className="p-2 rounded-xl border bg-white hover:shadow"
                onClick={() => speak(p.source, course.learnLang)}
                aria-label="Play pronunciation"
                title="Play"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Dialogs */}
      {dialogs.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-gray-700" />
            <div className="text-sm font-semibold">Dialogs</div>
          </div>
          {dialogs.map((d) => (
            <div key={d.id} className="p-3 rounded-2xl border bg-white mb-3">
              <div className="font-medium mb-2">{d.title}</div>
              {(d.roles || []).map((turn, i) => (
                <div key={i} className="flex items-start gap-2 mb-1">
                  <div className="text-xs font-semibold text-gray-500 w-5">{turn.who}:</div>
                  <div className="flex-1">
                    {turn.lines.map((line, li) => (
                      <div key={li} className="flex items-center gap-2">
                        <span>{line}</span>
                        <button
                          className="p-1 rounded-lg border bg-white hover:shadow"
                          onClick={() => speak(line, course.learnLang)}
                          aria-label="Play line"
                          title="Play"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {Array.isArray(d.translation) && d.translation.length > 0 && (
                <div className="mt-2 p-2 rounded-xl bg-gray-50 text-sm text-gray-600">
                  {d.translation.map((t, ti) => <div key={ti}>{t}</div>)}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Grammar */}
      {grammar.length > 0 && (
        <section className="mb-2">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-gray-700" />
            <div className="text-sm font-semibold">Grammar</div>
          </div>
          <div className="grid gap-3">
            {grammar.map((g, gi) => (
              <div key={gi} className="p-3 rounded-2xl border bg-white">
                <div className="font-medium">{g.topic}</div>
                {g.notes && <div className="text-sm text-gray-600 mt-1">{g.notes}</div>}
                {g.forms && (
                  <div className="mt-3 grid gap-3">
                    {Object.entries(g.forms).map(([tense, table], ti) => (
                      <div key={ti}>
                        <div className="text-xs font-semibold text-gray-500 mb-1">{capitalize(tense)}</div>
                        <div className="overflow-auto">
                          <table className="min-w-[320px] text-sm"><tbody>{renderFormsRows(table)}</tbody></table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {Array.isArray(g.examples) && g.examples.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-gray-500 mb-1">Examples</div>
                    <div className="grid gap-2">
                      {g.examples.map((ex, ei) => (
                        <div key={ei} className="p-2 rounded-xl border bg-white">
                          <div className="font-medium">{ex.source}</div>
                          <div className="text-sm text-gray-600">{ex.target}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* =========================
   Quiz View (Tabs: MCQ / Fill-in / Grammar)
   ========================= */
function QuizView({ course, chapter, onBack, onFinish }) {
  const [tab, setTab] = useState("mcq"); // "mcq" | "fill" | "grammar"

  const canGrammar = (chapter.grammar || []).some(g => g.forms && Object.keys(g.forms).length);
  const hasVocab = (chapter.vocab || chapter.items || []).length >= 4;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="px-3 py-1.5 rounded-xl border bg-white hover:shadow">
          <ChevronLeft className="w-4 h-4 inline -mt-0.5" /> Back
        </button>
        <h2 className="text-lg font-semibold">{course.label} — {chapter.title} · Quiz</h2>
      </div>

      {/* Tabs */}
      <div className="mb-3 flex gap-2">
        <TabButton active={tab==="mcq"} onClick={()=>setTab("mcq")}>Multiple Choice</TabButton>
        <TabButton active={tab==="fill"} onClick={()=>setTab("fill")} disabled={!hasVocab}>Fill-in</TabButton>
        <TabButton active={tab==="grammar"} onClick={()=>setTab("grammar")} disabled={!canGrammar}>Grammar</TabButton>
      </div>

      {tab === "mcq" && <MCQQuiz course={course} chapter={chapter} onFinish={onFinish} />}
      {tab === "fill" && <FillQuiz course={course} chapter={chapter} onFinish={onFinish} />}
      {tab === "grammar" && <GrammarQuiz course={course} chapter={chapter} onFinish={onFinish} />}
    </div>
  );
}
function TabButton({active, onClick, children, disabled}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={
        "px-3 py-1.5 rounded-xl border text-sm " +
        (disabled ? "opacity-50 cursor-not-allowed " : "hover:shadow ") +
        (active ? "bg-gray-900 text-white border-gray-900" : "bg-white")
      }
    >
      {children}
    </button>
  );
}

/* ---------- Multiple Choice ---------- */
function MCQQuiz({ course, chapter, onFinish }) {
  const vocab = chapter.vocab || chapter.items || [];
  const pool = vocab.filter(v => v.source && v.target);
  const questionCount = Math.min(8, Math.max(4, pool.length));
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [picked, setPicked] = useState(null);
  const [reveal, setReveal] = useState(false);

  const [questions, setQuestions] = useState(() => buildMCQ(pool, questionCount));
  function buildMCQ(pool, n) {
    const a = [...pool].sort(()=>Math.random()-0.5).slice(0, n);
    return a.map(item => {
      const distractors = [...pool].filter(x => x.target !== item.target).sort(()=>Math.random()-0.5).slice(0,3);
      const options = [...distractors.map(x=>x.target), item.target].sort(()=>Math.random()-0.5);
      return { prompt: item.source, answer: item.target, options };
    });
  }

  if (pool.length < 4) return <GuardPanel text="Not enough phrases to build a multiple choice quiz." />;

  const q = questions[qIndex];
  const percent = Math.round((score / questions.length) * 100);

  const submit = () => {
    if (picked == null) return;
    if (!reveal) {
      if (picked === q.answer) setScore(s => s + 1);
      setReveal(true);
    } else {
      if (qIndex + 1 < questions.length) {
        setQIndex(qIndex + 1); setPicked(null); setReveal(false);
      } else setDone(true);
    }
  };

  return !done ? (
    <QuizCard
      heading={`Question ${qIndex+1} / ${questions.length}`}
      prompt={q.prompt}
      body={
        <div className="grid gap-2">
          {q.options.map((opt, i) => {
            const isCorrect = reveal && opt === q.answer;
            const isWrongPick = reveal && picked === opt && opt !== q.answer;
            return (
              <button
                key={i}
                onClick={() => setPicked(opt)}
                className={
                  "text-left px-3 py-2 rounded-xl border " +
                  (isCorrect ? "bg-green-50 border-green-300" :
                   isWrongPick ? "bg-red-50 border-red-300" :
                   picked === opt ? "bg-gray-50" : "bg-white hover:shadow")
                }
              >
                {opt}
              </button>
            );
          })}
        </div>
      }
      footer={
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">Score: {score} / {questions.length}</div>
          <button className="px-4 py-2 rounded-xl border bg-white hover:shadow" onClick={submit}>
            {reveal ? "Next" : "Submit"}
          </button>
        </div>
      }
    />
  ) : (
    <ResultCard percent={percent} onFinish={onFinish} onRetry={()=>{
      const qs = buildMCQ(pool, questionCount);
      setQuestions(qs); setQIndex(0); setScore(0); setDone(false); setPicked(null); setReveal(false);
    }}/>
  );
}

/* ---------- Fill-in (type the answer) ---------- */
function FillQuiz({ course, chapter, onFinish }) {
  const vocab = chapter.vocab || chapter.items || [];
  const pool = vocab.filter(v => v.source && v.target);
  const questionCount = Math.min(8, Math.max(4, pool.length));
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [answer, setAnswer] = useState("");
  const [reveal, setReveal] = useState(false);

  const [questions, setQuestions] = useState(() => {
    // Prompt with translation (target), expect the learn-language phrase (source)
    return [...pool]
      .sort(() => Math.random() - 0.5)
      .slice(0, questionCount)
      .map(item => ({
        prompt: item.target,   // English/Korean
        expected: item.source, // Spanish/Japanese
      }));
  });

  if (pool.length < 4) return <GuardPanel text="Not enough phrases to build a fill-in quiz." />;

  const q = questions[qIndex];
  const percent = Math.round((score / questions.length) * 100);

  const submit = () => {
    if (!reveal) {
      if (sameAnswer(answer, q.expected)) setScore(s => s + 1);
      setReveal(true);
    } else {
      if (qIndex + 1 < questions.length) {
        setQIndex(qIndex + 1); setAnswer(""); setReveal(false);
      } else setDone(true);
    }
  };

  return !done ? (
    <QuizCard
      heading={`Type the translation ${qIndex + 1} / ${questions.length}`}
      prompt={q.prompt}
      body={
        <>
          <input
            className="w-full px-3 py-2 rounded-xl border bg-white"
            placeholder={`Type in ${course.learnLang?.startsWith("es") ? "Spanish" : course.learnLang?.startsWith("ja") ? "Japanese" : "target language"}...`}
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submit(); }}
          />
          {reveal && (
            <div className="mt-2 text-sm">
              {sameAnswer(answer, q.expected) ? (
                <span className="text-green-700">Correct!</span>
              ) : (
                <span className="text-red-700">Answer: {q.expected}</span>
              )}
            </div>
          )}
        </>
      }
      footer={
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">Score: {score} / {questions.length}</div>
          <button className="px-4 py-2 rounded-xl border bg-white hover:shadow" onClick={submit}>
            {reveal ? "Next" : "Submit"}
          </button>
        </div>
      }
    />
  ) : (
    <ResultCard
      percent={percent}
      onFinish={onFinish}
      onRetry={() => {
        const next = [...pool]
          .sort(() => Math.random() - 0.5)
          .slice(0, questionCount)
          .map(item => ({ prompt: item.target, expected: item.source }));
        setQIndex(0); setScore(0); setDone(false); setAnswer(""); setReveal(false);
        questions.splice(0, questions.length, ...next);
      }}
    />
  );
}

/* ---------- Grammar (from chapter.grammar[].forms) ---------- */
function GrammarQuiz({ course, chapter, onFinish }) {
  const bank = buildGrammarBank(chapter.grammar || []);
  const questionCount = Math.min(10, Math.max(4, bank.length));
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [answer, setAnswer] = useState("");
  const [reveal, setReveal] = useState(false);
  const [questions, setQuestions] = useState(()=> shuffle(bank).slice(0, questionCount));

  if (bank.length < 4) return <GuardPanel text="Not enough grammar forms found in this chapter." />;

  const q = questions[qIndex];
  const percent = Math.round((score / questions.length) * 100);

  const submit = () => {
    if (!reveal) {
      if (sameAnswer(answer, q.expected)) setScore(s => s + 1);
      setReveal(true);
    } else {
      if (qIndex + 1 < questions.length) {
        setQIndex(qIndex + 1); setAnswer(""); setReveal(false);
      } else setDone(true);
    }
  };

  return !done ? (
    <QuizCard
      heading={`Grammar ${qIndex+1} / ${questions.length}`}
      prompt={`${capitalize(q.tense)} • ${q.lemma} — ${labelize(q.person)}`}
      body={
        <>
          <input
            className="w-full px-3 py-2 rounded-xl border bg-white"
            placeholder="Type the form..."
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submit(); }}
          />
          {reveal && (
            <div className="mt-2 text-sm">
              {sameAnswer(answer, q.expected) ? (
                <span className="text-green-700">Correct!</span>
              ) : (
                <span className="text-red-700">Answer: {q.expected}</span>
              )}
            </div>
          )}
        </>
      }
      footer={
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">Score: {score} / {questions.length}</div>
          <button className="px-4 py-2 rounded-xl border bg-white hover:shadow" onClick={submit}>
            {reveal ? "Next" : "Submit"}
          </button>
        </div>
      }
    />
  ) : (
    <ResultCard percent={percent} onFinish={onFinish} onRetry={()=>{
      const next = shuffle(bank).slice(0, questionCount);
      setQIndex(0); setScore(0); setDone(false); setAnswer(""); setReveal(false);
      questions.splice(0, questions.length, ...next);
    }}/>
  );
}
function buildGrammarBank(grams) {
  // Create flat questions: { lemma, tense, person, expected }
  const out = [];
  for (const g of grams) {
    if (!g.forms) continue;
    for (const [tense, table] of Object.entries(g.forms)) {
      const values = Object.values(table);
      const isLeaf = values.every(v => typeof v === "string");
      if (isLeaf) {
        // Spanish-like person table
        for (const [person, form] of Object.entries(table)) {
          out.push({ lemma: extractLemma(g.topic), tense, person, expected: form });
        }
      } else {
        // Japanese-like: lemma -> { plain/polite/... }
        for (const [lemma, sub] of Object.entries(table)) {
          for (const [person, form] of Object.entries(sub)) {
            out.push({ lemma, tense, person, expected: form });
          }
        }
      }
    }
  }
  return out;
}

/* =========================
   Talk View (Dialog player)
   ========================= */
function TalkView({ course, chapter, onBack }) {
  const dialogs = chapter.dialogs || [];
  const [idx, setIdx] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);

  // Flatten current dialog into [ { who, text } ... ]
  const current = dialogs[idx] || { roles: [] };
  const script = [];
  (current.roles || []).forEach(r => (r.lines || []).forEach(text => script.push({ who: r.who, text })));

  useEffect(() => { setLineIndex(0); }, [idx]);

  const play = () => {
    const l = script[lineIndex];
    if (l) speak(l.text, course.learnLang);
  };
  const prev = () => setLineIndex(i => Math.max(0, i - 1));
  const next = () => setLineIndex(i => Math.min(script.length - 1, i + 1));

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="px-3 py-1.5 rounded-xl border bg-white hover:shadow">
          <ChevronLeft className="w-4 h-4 inline -mt-0.5" /> Back
        </button>
        <h2 className="text-lg font-semibold">{course.label} — {chapter.title} · Talk</h2>
      </div>

      {dialogs.length === 0 ? (
        <div className="p-4 rounded-2xl border bg-white">No dialogs in this chapter yet.</div>
      ) : (
        <div className="p-4 rounded-2xl border bg-white">
          <div className="mb-3">
            <label className="text-sm text-gray-600 mr-2">Dialog:</label>
            <select
              className="px-3 py-2 rounded-xl border bg-white"
              value={idx}
              onChange={e => setIdx(Number(e.target.value))}
            >
              {dialogs.map((d, i) => <option key={d.id} value={i}>{d.title}</option>)}
            </select>
          </div>

          <div className="border rounded-xl p-3 bg-gray-50">
            {script.length > 0 ? (
              <>
                <div className="text-sm text-gray-500 mb-2">
                  Line {lineIndex + 1} / {script.length} — <b>{script[lineIndex].who}</b>
                </div>
                <div className="text-lg">{script[lineIndex].text}</div>

                <div className="flex items-center gap-2 mt-3">
                  <button className="px-3 py-2 rounded-xl border bg-white hover:shadow" onClick={prev}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button className="px-3 py-2 rounded-xl border bg-white hover:shadow" onClick={play}>
                    <Play className="w-4 h-4" /> 
                  </button>
                  <button className="px-3 py-2 rounded-xl border bg-white hover:shadow" onClick={next}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div>No lines.</div>
            )}
          </div>

          {Array.isArray(current.translation) && current.translation.length > 0 && (
            <div className="mt-3 p-2 rounded-xl bg-white border text-sm text-gray-600">
              {current.translation.map((t, i) => <div key={i}>{t}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================
   Grammar table renderer
   ========================= */
function renderFormsRows(table) {
  const isLeaf = (v) => typeof v === "string";
  const rows = [];
  if (Object.values(table).every(isLeaf)) {
    for (const [k, v] of Object.entries(table)) {
      rows.push(
        <tr key={k}>
          <td className="pr-4 py-1 text-gray-600">{labelize(k)}</td>
          <td className="py-1">{v}</td>
        </tr>
      );
    }
    return rows;
  }
  for (const [k, sub] of Object.entries(table)) {
    rows.push(
      <tr key={k}>
        <td className="pr-4 py-1 align-top text-gray-600">{labelize(k)}</td>
        <td className="py-1">
          {typeof sub === "string" ? sub : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {Object.entries(sub).map(([kk, vv]) => (
                <div key={kk} className="flex justify-between gap-3">
                  <span className="text-gray-500">{labelize(kk)}</span>
                  <span>{vv}</span>
                </div>
              ))}
            </div>
          )}
        </td>
      </tr>
    );
  }
  return rows;
}

/* =========================
   Reusable quiz UI blocks
   ========================= */
function QuizCard({ heading, prompt, body, footer }) {
  return (
    <div className="p-4 rounded-2xl border bg-white">
      <div className="text-sm text-gray-500 mb-2">{heading}</div>
      <div className="text-lg font-medium mb-4">{prompt}</div>
      {body}
      <div className="mt-4">{footer}</div>
    </div>
  );
}
function ResultCard({ percent, onFinish, onRetry }) {
  return (
    <div className="p-4 rounded-2xl border bg-white">
      <div className="text-lg font-semibold mb-1">Quiz complete</div>
      <div className="text-gray-700 mb-3">Your score: {percent}%</div>
      <div className="flex gap-2">
        <button className="px-4 py-2 rounded-xl border bg-white hover:shadow" onClick={onFinish}>Save & Back</button>
        <button className="px-4 py-2 rounded-xl border bg-white hover:shadow" onClick={onRetry}>Retry</button>
      </div>
    </div>
  );
}
function GuardPanel({ text }) {
  return <div className="p-4 rounded-2xl border bg-white">{text}</div>;
}

/* =========================
   Data Modal (Import / Export / Reset)
   ========================= */
function DataModal({ data, setData }) {
  const [show, setShow] = useState(false);
  const [raw, setRaw] = useState(JSON.stringify(data, null, 2));
  useEffect(() => { setRaw(JSON.stringify(data, null, 2)); }, [show, data]);
  useEffect(() => { window.openDataModal = () => setShow(true); }, []);

  return (
    <>
      {show && (
        <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50" onClick={()=>setShow(false)}>
          <div className="max-w-3xl w-full bg-white rounded-2xl border p-4 shadow-xl" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Your Curriculum JSON</div>
              <button className="px-3 py-2 rounded-xl border bg-white hover:shadow" onClick={()=>setShow(false)} aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">Paste/edit your data. Progress stays on this device.</p>
            <textarea className="w-full h-80 font-mono text-sm border rounded-xl p-3" value={raw} onChange={e=>setRaw(e.target.value)} />
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button className="px-3 py-2 rounded-xl border bg-white hover:shadow" onClick={()=>{
                try { const parsed = JSON.parse(raw); setData(parsed); alert("Imported!"); }
                catch(e){ alert("Invalid JSON: "+e.message); }
              }}>
                <Upload className="inline w-4 h-4 mr-1" /> Import JSON
              </button>
              <button className="px-3 py-2 rounded-xl border bg-white hover:shadow" onClick={()=>{
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob); const a = document.createElement("a");
                a.href = url; a.download = "polyglot_data.json"; a.click(); URL.revokeObjectURL(url);
              }}>
                <Download className="inline w-4 h-4 mr-1" /> Export JSON
              </button>
              <button className="px-3 py-2 rounded-xl border bg-white hover:shadow" onClick={()=>{
                localStorage.removeItem(LS_KEYS.DATA);
                localStorage.removeItem(LS_KEYS.STATE);
                localStorage.removeItem(LS_KEYS.MASTERY);
                location.reload();
              }}>
                Reset to built-in
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
