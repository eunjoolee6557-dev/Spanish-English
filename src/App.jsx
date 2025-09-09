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
        }
      ]
    }
  ]
};

// ✅ Helper functions: speech, recognition, quiz utils
function pickVoice(langHint) {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return voices.find(v => v.lang === langHint) ||
         voices.find(v => v.lang?.startsWith(langHint.split("-")[0])) ||
         voices[0];
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
function nextItemQueue(items, history, proficiency) {
  const avoid = new Set(history);
  const scored = items.map(it => ({ it, score: proficiency[it.id] ?? 0 }));
  scored.sort((a,b)=>a.score-b.score);
  const candidates = scored.map(s=>s.it).filter(it=>!avoid.has(it.id));
  return candidates[0] || scored[0]?.it || items[0];
}
function normalize(s){ return (s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").trim(); }
function shuffle(arr){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function shuffleOptions(items, correct){ const others=items.filter(i=>i.id!==correct.id); const take=others.slice(0,3); return shuffle([correct, ...take]); }

export default function App(){
  const [data, setData] = useState(()=>loadLS(LS_KEYS.DATA, DEFAULT_DATA));
  const [courseId, setCourseId] = useState("es-en");
  const [chapterId, setChapterId] = useState("es1");
  const [mode, setMode] = useState("home");
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(1);
  const [history, setHistory] = useState([]);
  const [proficiency, setProficiency] = useState({});
  const [toast, setToast] = useState(null);

  const course = data.courses.find(c=>c.id===courseId);
  const chapter = course.chapters.find(ch=>ch.id===chapterId);
  const items = chapter.items;

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-sky-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 backdrop-blur border-b border-white/60 bg-white/60">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-ink text-white grid place-items-center font-semibold shadow-soft">PL</div>
            <div>
              <div className="text-sm text-inksoft">Polyglot Trainer</div>
              <div className="text-xs text-inksoft/70">Elegant UI – Spanish · English</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-white border shadow-soft">XP {xp}</span>
            <span className="text-xs px-2 py-1 rounded-full bg-white border shadow-soft">🔥 {streak} days</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 grid gap-6">
        {mode === "home" && (
          <div className="rounded-3xl border bg-white/70 glass shadow-soft p-6">
            <h1 className="text-2xl font-semibold">Welcome back 👋</h1>
            <p className="text-sm text-inksoft/80 mt-1">Pick a mode below:</p>
            <div className="mt-5 flex gap-3">
              <button onClick={()=>setMode("learn")} className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft"><BookOpen className="inline w-4 h-4 mr-1" /> Learn</button>
              <button onClick={()=>setMode("quiz")} className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft"><ListTodo className="inline w-4 h-4 mr-1" /> Quiz</button>
              <button onClick={()=>setMode("dialog")} className="px-3 py-2 rounded-xl border bg-white hover:shadow-soft"><MessageSquare className="inline w-4 h-4 mr-1" /> Dialog</button>
            </div>
          </div>
        )}

        {mode === "learn" && (
          <div className="rounded-3xl border bg-white/70 glass shadow-soft p-6">
            <h2 className="text-xl font-semibold mb-4">{chapter.title}</h2>
            {items.map(it => (
              <div key={it.id} className="flex items-center justify-between mb-2 bg-white/60 p-3 rounded-xl border">
                <span>{it.source} → {it.target}</span>
                <button className="px-2 py-1 border rounded-lg bg-white" onClick={()=>speak(it.source, course.learnLang)}><Volume2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}

        {mode === "quiz" && (
          <div className="rounded-3xl border bg-white/70 glass shadow-soft p-6">
            <h2 className="text-xl font-semibold mb-4">Quiz Mode</h2>
            <p className="text-sm">We’ll add the interactive quiz logic here</p>
          </div>
        )}

        {mode === "dialog" && (
          <div className="rounded-3xl border bg-white/70 glass shadow-soft p-6">
            <h2 className="text-xl font-semibold mb-4">Dialog Mode</h2>
            {chapter.dialogs[0].roles.map((r, i) => (
              <div key={i} className="mb-2">
                <span className="font-semibold">{r.who}: </span>{r.lines.join(" ")}
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}} className="fixed bottom-6 inset-x-0 flex justify-center">
            <div className="px-4 py-2 rounded-full shadow-soft bg-ink text-white text-sm">{toast}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
