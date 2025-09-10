import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Upload, Download, Volume2, ChevronLeft, Settings, BookOpen, MessageSquare
} from "lucide-react";

/* =========================
   Content version (AUTO-REFRESH)
   - Bump this when built-in JSON changes
   ========================= */
const CONTENT_VERSION = 2;

/* =========================
   Load course JSONs (Spanish → English, Japanese → Korean)
   ========================= */
import esEn from "./content/es-en.json";
import jaKo from "./content/ja-ko.json";

/* =========================
   LocalStorage helpers
   ========================= */
const LS_KEYS = {
  DATA: "polyglot_trainer_data_v1",
  STATE: "polyglot_trainer_state_v1",
};
const saveLS = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
};
const loadLS = (k, d) => {
  try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; }
};

/* =========================
   Built-in curriculum (from JSON files)
   ========================= */
const DEFAULT_DATA = {
  contentVersion: CONTENT_VERSION,
  courses: [esEn, jaKo],
};

/* =========================
   Speech (TTS) helpers
   ========================= */
function pickVoice(langHint) {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  if (!langHint) return voices[0];
  // try full match, then prefix (e.g., "es-ES" → "es")
  const exact = voices.find(v => v.lang === langHint);
  if (exact) return exact;
  const prefix = langHint.split("-")[0];
  return voices.find(v => v.lang?.startsWith(prefix)) || voices[0];
}
function speak(text, langHint) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = pickVoice(langHint);
    u.lang = langHint || u.voice?.lang || "en-US";
    window.speechSynthesis.cancel(); // stop previous
    window.speechSynthesis.speak(u);
  } catch {}
}

/* =========================
   Main App
   ========================= */
export default function App() {
  // Load from LS if same version; otherwise fall back to built-in
  const initialData = useMemo(() => {
    const saved = loadLS(LS_KEYS.DATA, null);
    if (saved && saved.contentVersion === CONTENT_VERSION) return saved;
    return DEFAULT_DATA;
  }, []);
  const [data, setData] = useState(initialData);

  useEffect(() => { saveLS(LS_KEYS.DATA, data); }, [data]);

  // simple navigation state
  const [sel, setSel] = useState(() => loadLS(LS_KEYS.STATE, { course: null, chapter: null }));
  useEffect(() => { saveLS(LS_KEYS.STATE, sel); }, [sel]);

  // header helpers
  const openData = () => window.openDataModal && window.openDataModal();

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
        {/* Courses */}
        {sel.course === null && (
          <>
            <h2 className="text-lg font-semibold mb-3">Courses</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {data.courses.map((course, ci) => (
                <button
                  key={course.id}
                  onClick={() => setSel({ course: ci, chapter: null })}
                  className="text-left p-4 rounded-2xl border bg-white hover:shadow"
                >
                  <div className="text-base font-medium">{course.label}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {course.chapters?.length || 0} chapters
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Chapters */}
        {sel.course !== null && sel.chapter === null && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setSel({ course: null, chapter: null })}
                className="px-3 py-1.5 rounded-xl border bg-white hover:shadow"
              >
                <ChevronLeft className="w-4 h-4 inline -mt-0.5" /> Back
              </button>
              <h2 className="text-lg font-semibold">
                {data.courses[sel.course].label}
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {(data.courses[sel.course].chapters || []).map((ch, idx) => (
                <button
                  key={ch.id}
                  onClick={() => setSel({ course: sel.course, chapter: idx })}
                  className="text-left p-4 rounded-2xl border bg-white hover:shadow"
                >
                  <div className="text-base font-medium">{ch.title}</div>
                  <div className={`mt-2 h-2 w-24 rounded-full bg-gradient-to-r ${ch.color || "from-gray-200 to-gray-50"}`} />
                  <div className="text-xs text-gray-500 mt-2">
                    {(ch.vocab?.length ?? ch.items?.length ?? 0)} phrases • {ch.dialogs?.length || 0} dialogs
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Lesson */}
        {sel.course !== null && sel.chapter !== null && (
          <LessonView
            course={data.courses[sel.course]}
            chapter={data.courses[sel.course].chapters[sel.chapter]}
            onBack={() => setSel({ course: sel.course, chapter: null })}
          />
        )}
      </main>

      {/* Modals */}
      <DataModal data={data} setData={setData} />
    </div>
  );
}

/* =========================
   Lesson View
   - Tips cards
   - Phrases list w/ TTS
   - Dialogs with per-line translations
   - Grammar tables
   ========================= */
function LessonView({ course, chapter, onBack }) {
  const learnLang = course.learnLang || "en-US";
  const phrases = chapter.vocab || chapter.items || [];
  const dialogs = chapter.dialogs || [];
  const tips = chapter.tips || [];
  const grammar = chapter.grammar || [];

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={onBack}
          className="px-3 py-1.5 rounded-xl border bg-white hover:shadow"
        >
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
          <div className="grid gap-3">
            {dialogs.map((d) => (
              <div key={d.id} className="p-3 rounded-2xl border bg-white">
                <div className="font-medium mb-2">{d.title}</div>
                {(d.roles || []).map((turn, i) => (
                  <div key={i} className="flex items-start gap-2 mb-1">
                    <div className="text-xs font-semibold text-gray-500 w-5">
                      {turn.who}:
                    </div>
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
                    {d.translation.map((t, ti) => (
                      <div key={ti}>{t}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
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

                {/* Render forms (supports flexible structures) */}
                {g.forms && (
                  <div className="mt-3 grid gap-3">
                    {Object.entries(g.forms).map(([tense, table], ti) => (
                      <div key={ti}>
                        <div className="text-xs font-semibold text-gray-500 mb-1">
                          {capitalize(tense)}
                        </div>
                        {/* table can be: people map (es) OR nested objects (ja) */}
                        <div className="overflow-auto">
                          <table className="min-w-[320px] text-sm">
                            <tbody>
                              {renderFormsRows(table)}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {Array.isArray(g.examples) && g.examples.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-gray-500 mb-1">
                      Examples
                    </div>
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
   Grammar forms renderer (flexible)
   - Handles person maps (es) or plain/polite (ja) structures
   ========================= */
function renderFormsRows(table) {
  // If table is an object of strings: render key/value rows
  const isLeaf = (v) => typeof v === "string";
  const rows = [];

  // Spanish style: { yo: "soy", tú: "eres", ... }
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

  // Japanese style: { "する": { plain: "...", polite: "..." }, ... }
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

function capitalize(s) { return (s || "").charAt(0).toUpperCase() + (s || "").slice(1); }
function labelize(s) {
  // prettify keys like "yo", "tu", "plain", "polite"
  if (!s) return s;
  const map = { tu: "tú", el: "él", ella: "ella", usted: "usted", vosotros: "vosotros" };
  const base = map[s] || s;
  return base.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
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
        <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50" onClick={() => setShow(false)}>
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
