import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, X, Volume2, Mic, Upload, Download, Shuffle, Play,
  RotateCcw, ListTodo, MessageSquare, BookOpen, Settings,
  Sparkles, LayoutGrid, ChevronRight
} from "lucide-react";

const LS_KEYS = { DATA: "polyglot_trainer_data_v1", STATE: "polyglot_trainer_state_v1" };
const saveLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const loadLS = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };

// ---------- Curriculum ----------
const DEFAULT_DATA = {
  courses: [
    {
      id: "es-en",
      label: "Spanish → English",
      learnLang: "es-ES",
      uiLang: "en-US",
      translateLang: "en",
chapters: [
  {
    id: "es1",
    title: "Chapter 1: Greetings",
    color: "from-brand-100 to-brand-50",
    tips: [
      { title: "¿Cómo estás? vs ¿Cómo va todo?", text: "Both ask how someone is. '¿Cómo estás?' is general; '¿Cómo va todo?' asks how everything is going." },
      { title: "Bien vs Estoy bien", text: "Use 'Estoy bien' for 'I am fine' (with verb). 'Bien, gracias' is a short response." }
    ],
    items: [
      { id:"p1", type:"phrase", source:"Mucho tiempo sin verte.", target:"Long time no see." },
      { id:"p2", type:"phrase", source:"¿Cómo estás?", target:"How are you?" },
      { id:"p3", type:"phrase", source:"¿Cómo va todo?", target:"How's everything going?" },
      { id:"p4", type:"phrase", source:"Estoy bien.", target:"I am fine." },
      { id:"p5", type:"phrase", source:"Bien, gracias.", target:"Fine, thank you." },
      { id:"p6", type:"phrase", source:"¿Y tú?", target:"And you?" },
      { id:"p7", type:"phrase", source:"¿Y qué hay de ti?", target:"And what about you?" },
      { id:"p8", type:"phrase", source:"Nada mal.", target:"Not bad." },
      { id:"p9", type:"phrase", source:"No tan bien.", target:"Not so well." },
      { id:"p10", type:"phrase", source:"Lo siento escuchar eso.", target:"I’m sorry to hear that." }
    ],
    dialogs: [
      {
        id:"esd_greetings1",
        title:"First meeting",
        roles:[
          { who:"A", lines:["¡Mucho tiempo sin verte!","¿Cómo estás?"] },
          { who:"B", lines:["¡Hola!","Estoy bien, gracias. ¿Y tú?"] },
          { who:"A", lines:["Nada mal. ¿Y qué hay de ti?"] },
          { who:"B", lines:["No tan bien...","Lo siento escuchar eso."] }
        ],
        translation:[
          "Long time no see!","How are you?",
          "Hello!","I’m fine, thank you. And you?",
          "Not bad. And what about you?",
          "Not so well...","I’m sorry to hear that."
        ]
      }
    ]
  },
  {
    id: "es2",
    title: "Chapter 2: Everyday Phrases",
    color: "from-pink-200 to-pink-50",
    tips: [
      { title: "Buenos días vs Buenas tardes", text: "Use 'Buenos días' in the morning, 'Buenas tardes' in the afternoon, and 'Buenas noches' in the evening." },
      { title: "Por favor & Gracias", text: "'Por favor' means please, and 'Gracias' means thank you. Common politeness words you'll use daily." }
    ],
    items: [
      { id: "e1", type: "phrase", source: "Buenos días.", target: "Good morning." },
      { id: "e2", type: "phrase", source: "Buenas tardes.", target: "Good afternoon." },
      { id: "e3", type: "phrase", source: "Buenas noches.", target: "Good evening / Good night." },
      { id: "e4", type: "phrase", source: "Por favor.", target: "Please." },
      { id: "e5", type: "phrase", source: "Gracias.", target: "Thank you." },
      { id: "e6", type: "phrase", source: "De nada.", target: "You’re welcome." },
      { id: "e7", type: "phrase", source: "Perdón.", target: "Excuse me." },
      { id: "e8", type: "phrase", source: "Disculpe.", target: "Sorry (formal)." },
      { id: "e9", type: "phrase", source: "Hasta luego.", target: "See you later." },
      { id: "e10", type: "phrase", source: "Nos vemos.", target: "See you." }
    ],
    dialogs: [
      {
        id: "esd_everyday1",
        title: "Polite exchange",
        roles: [
          { who: "A", lines: ["¡Buenos días!", "¿Cómo va tu día?"] },
          { who: "B", lines: ["Muy bien, gracias. ¿Y tú?"] },
          { who: "A", lines: ["Todo bien, gracias. ¡Hasta luego!"] },
          { who: "B", lines: ["Nos vemos."] }
        ],
        translation: [
          "Good morning!", "How’s your day going?",
          "Very well, thank you. And you?",
          "All good, thank you. See you later!",
          "See you."
        ]
      }
    ]
  }
]

// ---------- Speech ----------
function pickVoice(langHint) {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return voices.find(v => v.lang === langHint)
      || voices.find(v => v.lang?.startsWith(langHint.split("-")[0]))
      || voices[0];
}
function speak(text, langHint) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(langHint);
    if (v) u.voice = v;
    u.lang = v?.lang || langHint || "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}
function useSpeechRecognizer(lang = "en-US") {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const controllerRef = useRef(null);
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!SR);
    if (!SR) return;
    const rec = new SR();
    rec.lang = lang; rec.interimResults = false; rec.continuous = false; rec.maxAlternatives = 1;
    controllerRef.current = rec;
  }, [lang]);
  const listen = () => new Promise((resolve, reject) => {
    const rec = controllerRef.current; if (!rec) return reject(new Error("No recognizer"));
    setListening(true);
    rec.onresult = (e) => { setListening(false); resolve(e.results?.[0]?.[0]?.transcript || ""); };
    rec.onerror = (e) => { setListening(false); reject(e.error || "error"); };
    rec.onend = () => setListening(false);
    rec.start();
  });
  return { supported, listening, listen };
}

// ---------- Quiz helpers & progress ----------
function nextItemQueue(items, history, proficiency) {
  const avoid = new Set(history);
  const scored = items.map(it => ({ it, score: proficiency[it.id] ?? 0 }))
                      .sort((a,b)=>a.score-b.score)
                      .map(s=>s.it);
  const candidates = scored.filter(it=>!avoid.has(it.id));
  return candidates[0] || scored[0] || items[0];
}
function percentMastered(items, proficiency) {
  if (!items?.length) return 0;
  const mastered = items.filter(i => (proficiency[i.id] ?? 0) >= 3).length;
  return Math.round((mastered / items.length) * 100);
}
function normalize(s){ return (s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").trim(); }
function shuffle(arr){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function sample(arr, n){ const c=[...arr]; const out=[]; while(n-- > 0 && c.length){ out.push(c.splice(Math.floor(Math.random()*c.length),1)[0]); } return out; }
function mcOptions(items, correct){ return shuffle([correct, ...sample(items.filter(i=>i.id!==correct.id), Math.min(3, items.length-1))]); }

// ---------- App ----------
export default function App(){
  const [data, setData] = useState(()=>loadLS(LS_KEYS.DATA, DEFAULT_DATA));
  const [courseId, setCourseId] = useState("es-en");
  const [chapterId, setChapterId] = useState("es1");
  const [mode, setMode] = useState("home"); // home | learn | quiz | dialog
  const [xp, setXp] = useState(()=>loadLS(LS_KEYS.STATE, { xp: 0 })?.xp || 0);
  const [streak, setStreak] = useState(()=>loadLS(LS_KEYS.STATE, { streak: 1 })?.streak || 1);
  const [lastDay, setLastDay] = useState(()=>loadLS(LS_KEYS.STATE, { lastDay: null })?.lastDay || null);
  const [proficiency, setProficiency] = useState(()=>loadLS(LS_KEYS.STATE, { proficiency: {} })?.proficiency || {});
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState(null);

  // streak day rollover
  useEffect(()=>{
    const today = new Date().toISOString().slice(0,10);
    if (lastDay !== today){
      const y = new Date(); y.setDate(new Date().getDate()-1);
      const yesterday = y.toISOString().slice(0,10);
      setStreak(s => (lastDay === yesterday ? s+1 : 1));
      setLastDay(today);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist
  useEffect(()=>{ saveLS(LS_KEYS.DATA, data); }, [data]);
  useEffect(()=>{ saveLS(LS_KEYS.STATE, { courseId, chapterId, xp, streak, lastDay, proficiency }); }, [courseId, chapterId, xp, streak, lastDay, proficiency]);

  const course = useMemo(()=>data.courses.find(c=>c.id===courseId) || data.courses[0],[data, courseId]);
  const chapter = useMemo(()=>course.chapters.find(ch=>ch.id===chapterId) || course.chapters[0],[course, chapterId]);
  const items = chapter.items;

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-sky-50">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 backdrop-blur border-b border-white/60 bg-white/60">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-ink text-white grid place-items-center font-semibold shadow-soft">PL</div>
            <div>
              <div className="text-sm text-inksoft">Polyglot Trainer</div>
              <div className="text-xs text-inksoft/70">Elegant · Colorful — Spanish · English</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge>XP {xp}</Badge>
            <Badge>🔥 {streak} days</Badge>
            <button className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft" onClick={()=>setMode("home")}>
              <LayoutGrid className="inline w-4 h-4 mr-1" /> Dashboard
            </button>
            <button className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft" onClick={()=>openDataModal()}>
              <Settings className="inline w-4 h-4 mr-1" /> Data
            </button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-6xl mx-auto px-4 py-6 grid gap-6">
        {mode === "home" && (
          <Home
            data={data}
            courseId={courseId}
            setCourseId={setCourseId}
            chapterId={chapterId}
            setChapterId={setChapterId}
            setMode={setMode}
            proficiency={proficiency}
          />
        )}

        {mode === "learn" && (
          <LearnPanel items={items} course={course} chapter={chapter} setMode={setMode} />
        )}

        {mode === "quiz" && (
          <QuizPanel
            items={items}
            course={course}
            chapter={chapter}
            setMode={setMode}
            proficiency={proficiency}
            setProficiency={setProficiency}
            history={history}
            setHistory={setHistory}
            xp={xp}
            setXp={setXp}
            setToast={setToast}
          />
        )}

        {mode === "dialog" && (
          <DialogPanel chapter={chapter} course={course} setMode={setMode} />
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:20}} className="fixed bottom-6 inset-x-0 flex justify-center">
            <div className="px-4 py-2 rounded-full shadow-soft bg-ink text-white text-sm">{toast}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data modal */}
      <DataModal data={data} setData={setData} />
    </div>
  );
}

// ---------- UI blocks ----------
function Badge({children}) {
  return <span className="text-xs px-2 py-1 rounded-full bg-white border shadow-soft">{children}</span>;
}

function Home({ data, courseId, setCourseId, chapterId, setChapterId, setMode, proficiency }){
  const course = data.courses.find(c=>c.id===courseId) || data.courses[0];

  return (
    <div className="grid gap-6">
      {/* Welcome */}
      <div className="rounded-3xl border bg-white/70 glass shadow-soft p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Welcome back</h1>
            <p className="text-inksoft/80 text-sm mt-1">Choose a chapter and jump into Learn, Quiz, or Dialogue.</p>
          </div>
          <div className="hidden md:block px-4 py-2 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-500 text-white shadow-soft">
            <Sparkles className="inline w-4 h-4 mr-1" /> Modern & Colorful
          </div>
        </div>

        {/* Course selector */}
        <div className="mt-5 flex gap-2 flex-wrap">
          {data.courses.map(c => (
            <button
              key={c.id}
              className={`px-3 py-2 rounded-xl border bg-white hover:shadow-soft ${courseId===c.id?"ring-2 ring-brand-300":""}`}
              onClick={()=>{ setCourseId(c.id); setChapterId(c.chapters[0].id); }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chapter cards grid (colorful) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {course.chapters.map(ch => {
          const pct = percentMastered(ch.items, proficiency);
          return (
            <div key={ch.id} className={`rounded-3xl border bg-gradient-to-br ${ch.color || "from-slate-100 to-slate-50"} p-1 shadow-soft`}>
              <div className="rounded-3xl bg-white/80 glass p-5 h-full flex flex-col">
                <div className="text-sm text-inksoft">Chapter</div>
                <div className="text-xl font-semibold text-ink">{ch.title}</div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-inksoft/70 mt-1">{pct}% mastered</div>
                </div>

                {/* Actions */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft" onClick={()=>{ setChapterId(ch.id); setMode("learn"); }}>
                    <BookOpen className="inline w-4 h-4 mr-1" /> Learn
                  </button>
                  <button className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft" onClick={()=>{ setChapterId(ch.id); setMode("quiz"); }}>
                    <ListTodo className="inline w-4 h-4 mr-1" /> Quiz
                  </button>
                  <button className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft" onClick={()=>{ setChapterId(ch.id); setMode("dialog"); }}>
                    <MessageSquare className="inline w-4 h-4 mr-1" /> Talk
                  </button>
                </div>

                {/* Tips */}
                {ch.tips?.length ? (
                  <details className="mt-4 rounded-xl border bg-white p-3 text-sm text-inksoft/90">
                    <summary className="cursor-pointer select-none">Grammar & usage tips</summary>
                    <ul className="mt-2 list-disc pl-5 space-y-1">
                      {ch.tips.map((t,i)=>(<li key={i}><span className="font-medium text-ink">{t.title}:</span> {t.text}</li>))}
                    </ul>
                  </details>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LearnPanel({ items, course, chapter, setMode }){
  const [idx, setIdx] = useState(0);
  const current = items[idx % items.length];

  return (
    <div className="rounded-3xl border bg-white/70 glass shadow-soft p-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs text-inksoft">Learn</div>
          <div className="text-2xl font-semibold text-ink">{chapter.title}</div>
        </div>
        <button className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft" onClick={()=>setMode("home")}>
          Back <ChevronRight className="inline w-4 h-4 ml-1 -scale-x-100" />
        </button>
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-6">
        <div className="rounded-3xl border bg-gradient-to-br from-white to-brand-50 p-6">
          <div className="text-xs text-inksoft mb-2">Source</div>
          <div className="text-3xl font-semibold">{current.source}</div>
          <div className="mt-3">
            <button className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft" onClick={()=>speak(current.source, course.learnLang)}>
              <Volume2 className="inline w-4 h-4 mr-1" /> Play
            </button>
          </div>
        </div>
        <div className="rounded-3xl border bg-white p-6">
          <div className="text-xs text-inksoft mb-2">Translation</div>
          <div className="text-xl">{current.target}</div>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <button className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft" onClick={()=>setIdx(i=>(i-1+items.length)%items.length)}>
          <RotateCcw className="inline w-4 h-4 mr-1" /> Prev
        </button>
        <button className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft" onClick={()=>setIdx(Math.floor(Math.random()*items.length))}>
          <Shuffle className="inline w-4 h-4 mr-1" /> Shuffle
        </button>
        <button className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft" onClick={()=>setIdx(i=>(i+1)%items.length)}>
          Next
        </button>
      </div>
    </div>
  );
}

function QuizPanel({ items, course, chapter, setMode, proficiency, setProficiency, history, setHistory, xp, setXp, setToast }){
  const [quizItem, setQuizItem] = useState(null);
  const [quizType, setQuizType] = useState("mix"); // mix | mc | type | speak
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const sr = useSpeechRecognizer(course.learnLang);

  useEffect(()=>{
    const it = nextItemQueue(items, history.slice(-5), proficiency);
    setQuizItem(it); setInput(""); setResult(null);
  }, [items, proficiency]); // eslint-disable-line

  const mark = (it, ok) => {
    setProficiency(p => ({ ...p, [it.id]: Math.max(0, (p[it.id] ?? 0) + (ok ? 1 : -1)) }));
    setHistory(h => [...h.slice(-4), it.id]);
    if (ok) { setXp(x => x + 10); setToast("Correct! +10 XP"); setTimeout(()=>setToast(null), 1200); }
  };

  const checkTyped = () => {
    if (!quizItem) return;
    const ok = (input||"").trim().toLowerCase() === (quizItem.target||"").trim().toLowerCase();
    setResult(ok ? "correct" : `Expected: ${quizItem.target}`);
    mark(quizItem, ok);
  };

  const newQuiz = () => {
    const it = nextItemQueue(items, history.slice(-5), proficiency);
    setQuizItem(it); setInput(""); setResult(null);
  };

  return (
    <div className="rounded-3xl border bg-white/70 glass shadow-soft p-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs text-inksoft">Quiz</div>
          <div className="text-2xl font-semibold text-ink">{chapter.title}</div>
        </div>
        <div className="flex gap-2">
          <select className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft" value={quizType} onChange={e=>setQuizType(e.target.value)}>
            <option value="mix">Mixed</option>
            <option value="mc">Multiple Choice</option>
            <option value="type">Type Answer</option>
            <option value="speak">Speak</option>
          </select>
          <button className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft" onClick={()=>setMode("home")}>
            Back <ChevronRight className="inline w-4 h-4 ml-1 -scale-x-100" />
          </button>
        </div>
      </div>

      {quizItem && (
        <div className="mt-6 grid gap-6">
          <div className="rounded-3xl border bg-gradient-to-br from-white to-brand-50 p-6">
            <div className="text-xs text-inksoft mb-2">Translate to {course.translateLang.toUpperCase()}</div>
            <div className="text-3xl font-semibold mb-2">{quizItem.source}</div>
            <button className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft" onClick={()=>speak(quizItem.source, course.learnLang)}>
              <Volume2 className="inline w-4 h-4 mr-1" /> Play
            </button>
          </div>

          <AnimatePresence mode="wait">
            {(quizType === "mc" || quizType === "mix") && (
              <motion.div key="mc" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mcOptions(items, quizItem).map(opt => (
                  <button
                    key={opt.id}
                    className="px-3 py-3 rounded-xl border bg-white hover:shadow-soft text-left"
                    onClick={()=>{ const ok = opt.id===quizItem.id; setResult(ok?"correct":`Expected: ${quizItem.target}`); mark(quizItem, ok); }}
                  >
                    {opt.target}
                  </button>
                ))}
              </motion.div>
            )}

            {(quizType === "type" || quizType === "mix") && (
              <motion.div key="type" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} className="grid gap-3">
                <input
                  className="px-3 py-2 rounded-xl border bg-white"
                  placeholder="Type translation here"
                  value={input}
                  onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter') checkTyped(); }}
                />
                <div className="flex gap-2">
                  <button className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft" onClick={checkTyped}>
                    <Check className="inline w-4 h-4 mr-1" /> Check
                  </button>
                  <button className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft" onClick={()=>setResult(`Hint: ${(quizItem.target||'')[0]}...`)}>
                    Hint
                  </button>
                  <button className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft" onClick={newQuiz}>
                    <Shuffle className="inline w-4 h-4 mr-1" /> New
                  </button>
                </div>
              </motion.div>
            )}

            {(quizType === "speak" || quizType === "mix") && (
              <motion.div key="speak" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} className="grid gap-3">
                <div className="text-sm text-inksoft">Say the translation aloud</div>
                <button
                  disabled={!sr.supported || sr.listening}
                  className={`px-3 py-2 rounded-xl border bg-white hover:shadow-soft ${sr.listening?"opacity-60":""}`}
                  onClick={async()=>{
                    try {
                      const heard = await sr.listen();
                      const ok = normalize(heard) === normalize(quizItem.target);
                      setResult(ok?"correct":`Heard: ${heard}`);
                      mark(quizItem, ok);
                    } catch {
                      setResult("Speech error. Try again.");
                    }
                  }}
                >
                  <Mic className="inline w-4 h-4 mr-1" /> {sr.listening ? "Listening..." : "Speak"}
                </button>
                {!sr.supported && <div className="text-xs text-inksoft/70">Speech recognition not supported in this browser.</div>}
              </motion.div>
            )}
          </AnimatePresence>

          {result && (
            <div className={`rounded-xl border p-3 ${result==="correct"?"bg-green-50 border-green-300":"bg-amber-50 border-amber-300"}`}>
              {result==="correct" ? <span className="font-medium">Correct! +10 XP</span> : <span className="font-medium">{result}</span>}
              <div className="text-sm text-inksoft/80">Answer: {quizItem.target}</div>
              <div className="mt-2">
                <button className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft" onClick={newQuiz}>Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DialogPanel({ chapter, course, setMode }){
  const dialogs = chapter.dialogs || [];
  const currentDialog = dialogs[0] || null;
  if (!currentDialog) return (
    <div className="rounded-3xl border bg-white/70 glass shadow-soft p-6">No dialog in this chapter yet.</div>
  );
  const flat = currentDialog.roles.flatMap(r => r.lines.map(t => ({ who: r.who, text: t })));
  return (
    <div className="rounded-3xl border bg-white/70 glass shadow-soft p-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs text-inksoft">Conversation</div>
          <div className="text-2xl font-semibold text-ink">{currentDialog.title}</div>
        </div>
        <button className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft" onClick={()=>setMode("home")}>
          Back <ChevronRight className="inline w-4 h-4 ml-1 -scale-x-100" />
        </button>
      </div>

      <div className="mt-4 rounded-3xl border bg-gradient-to-br from-white to-brand-50 p-4">
        {flat.map((l, i) => (
          <div key={i} className="flex items-start gap-2 mb-2 bg-white/80 glass p-3 rounded-xl border">
            <span className="text-xs px-2 py-1 rounded-full bg-white border">{l.who}</span>
            <div className="flex-1">
              <div className="text-lg">{l.text}</div>
              <div className="text-xs text-inksoft/70">{currentDialog.translation[i]}</div>
            </div>
            <button className="px-2 py-1 rounded-lg border bg-white hover:shadow-soft" onClick={()=>speak(l.text, course.learnLang)}><Play className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataModal({ data, setData }){
  const [show, setShow] = useState(false);
  const [raw, setRaw] = useState(JSON.stringify(data, null, 2));

  useEffect(()=>{ setRaw(JSON.stringify(data, null, 2)); }, [show, data]);
  useEffect(()=>{ window.openDataModal = () => setShow(true); }, []);

  return (
    <>
      {show && (
        <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-20" onClick={()=>setShow(false)}>
          <div className="max-w-3xl w-full bg-white rounded-2xl border p-4 shadow-soft" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-ink">Your Curriculum JSON</div>
              <button
                className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft"
                onClick={()=>setShow(false)}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-inksoft/80 mb-3">
              Paste/edit your data. Progress stays on this device.
            </p>

            <textarea
              className="w-full h-80 font-mono text-sm border rounded-xl p-3"
              value={raw}
              onChange={e=>setRaw(e.target.value)}
            />

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button
                className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft"
                onClick={()=>{
                  try {
                    const parsed = JSON.parse(raw);
                    setData(parsed);
                    alert("Imported!");
                  } catch(e){
                    alert("Invalid JSON: " + e.message);
                  }
                }}
              >
                <Upload className="inline w-4 h-4 mr-1" /> Import JSON
              </button>

              <button
                className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft"
                onClick={()=>{
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "polyglot_data.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="inline w-4 h-4 mr-1" /> Export JSON
              </button>

              {/* RESET TO BUILT-IN */}
              <button
                className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft"
                onClick={()=>{
                  localStorage.removeItem('polyglot_trainer_data_v1');
                  localStorage.removeItem('polyglot_trainer_state_v1');
                  location.reload();
                }}
              >
                Reset to built-in
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// global opener for Data modal
function openDataModal(){ if (typeof window !== 'undefined' && window.openDataModal) window.openDataModal(); }
