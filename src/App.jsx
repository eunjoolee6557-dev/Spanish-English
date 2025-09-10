
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Download } from "lucide-react";

// =========================
//   Content version (AUTO-REFRESH)
//   - Bump when you change built-in content
// =========================
const CONTENT_VERSION = 2;

// 👉 Load your JSON course files
import esEn from "./content/es-en.json";
import jaKo from "./content/ja-ko.json";

// =========================
//   Built-in curriculum (DEFAULT_DATA)
// =========================
const DEFAULT_DATA = {
  contentVersion: CONTENT_VERSION,
  courses: [esEn, jaKo],
};

// =========================
//   Main App Component
// =========================
function App() {
  // Load built-in data (you can extend this to merge with localStorage if you wish)
  const [data, setData] = useState(() => DEFAULT_DATA);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 text-gray-900">
      {/* Simple header with quick-open buttons (optional; keep your existing header if you have one) */}
      <div className="p-4 border-b bg-white flex items-center gap-2">
        <h1 className="text-xl font-semibold">My Polyglot Trainer</h1>
        <div className="ml-auto flex gap-2">
          <button
            className="px-3 py-2 rounded-xl border bg-white hover:shadow"
            onClick={() => window.openDataModal && window.openDataModal()}
          >
            Open Data
          </button>
          <button
            className="px-3 py-2 rounded-xl border bg-white hover:shadow"
            onClick={() => window.openContentEditor && window.openContentEditor()}
          >
            Open Content Editor
          </button>
        </div>
      </div>

      {/* Your main app UI would go here (dashboard, lessons, etc.) */}
      <div className="p-4">
        <p className="text-sm text-gray-600">
          Courses loaded:{" "}
          <span className="font-medium">
            {data.courses.map((c) => c.label).join(" · ")}
          </span>
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Use <b>Open Data</b> to import/export/reset JSON, or <b>Open Content
          Editor</b> to edit chapters directly in the app.
        </p>
      </div>

      {/* Modals */}
      <DataModal data={data} setData={setData} />
      <ContentEditor data={data} setData={setData} />
    </div>
  );
}

export default App;

// =========================
//   DataModal component
// =========================
function DataModal({ data, setData }) {
  const [show, setShow] = useState(false);
  const [raw, setRaw] = useState(JSON.stringify(data, null, 2));

  useEffect(() => {
    setRaw(JSON.stringify(data, null, 2));
  }, [show, data]);

  // expose global opener for buttons elsewhere (e.g., header)
  useEffect(() => {
    window.openDataModal = () => setShow(true);
  }, []);

  return (
    <>
      {show && (
        <div
          className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50"
          onClick={() => setShow(false)}
        >
          <div
            className="max-w-3xl w-full bg-white rounded-2xl border p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-gray-900">Your Curriculum JSON</div>
              <button
                className="px-3 py-2 rounded-xl border bg-white hover:shadow"
                onClick={() => setShow(false)}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-3">
              Paste/edit your data. Progress stays on this device.
            </p>

            <textarea
              className="w-full h-80 font-mono text-sm border rounded-xl p-3"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button
                className="px-3 py-2 rounded-xl border bg-white hover:shadow"
                onClick={() => {
                  try {
                    const parsed = JSON.parse(raw);
                    setData(parsed);
                    alert("Imported!");
                  } catch (e) {
                    alert("Invalid JSON: " + e.message);
                  }
                }}
              >
                <Upload className="inline w-4 h-4 mr-1" /> Import JSON
              </button>

              <button
                className="px-3 py-2 rounded-xl border bg-white hover:shadow"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: "application/json",
                  });
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

              {/* One-tap RESET to built-in */}
              <button
                className="px-3 py-2 rounded-xl border bg-white hover:shadow"
                onClick={() => {
                  // use the same keys you used previously
                  localStorage.removeItem("polyglot_trainer_data_v1");
                  localStorage.removeItem("polyglot_trainer_state_v1");
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

// =========================
//   ContentEditor component (beta)
//   - Minimal editor for chapters, phrases, a single dialog with A/B lines,
//     and a tips block. Bumps contentVersion on save.
// =========================
function ContentEditor({ data, setData }) {
  const [show, setShow] = useState(false);
  const [courseIdx, setCourseIdx] = useState(0);
  const [chapterIdx, setChapterIdx] = useState(0);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState("from-brand-200 to-brand-50");
  const [items, setItems] = useState([]);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogLinesA, setDialogLinesA] = useState("Hola.\n¿Cómo estás?");
  const [dialogLinesB, setDialogLinesB] = useState("Hola.\nEstoy bien, gracias.");
  const [tips, setTips] = useState("Title: Note text");

  // expose global opener
  useEffect(() => {
    window.openContentEditor = () => setShow(true);
  }, []);

  // adapt to new schema: vocab key vs items key
  const getChapter = (course, index) => {
    const ch = (course?.chapters || [])[index] || course?.chapters?.[0];
    if (!ch) return null;

    // normalize content keys
    const phrases =
      ch.items || ch.vocab || []; // support both "items" and "vocab"
    return {
      ...ch,
      items: phrases,
    };
  };

  useEffect(() => {
    if (!show) return;
    const course = data.courses[courseIdx] || data.courses[0];
    const ch = getChapter(course, chapterIdx);
    if (!ch) return;

    setTitle(ch.title || "");
    setColor(ch.color || "from-brand-200 to-brand-50");
    setItems((ch.items || []).map((it) => ({ ...it })));

    const dlg = (ch.dialogs || [])[0];
    setDialogTitle(dlg?.title || "");
    const roles = dlg?.roles || [];
    const a = roles
      .filter((r) => r.who === "A")
      .flatMap((r) => r.lines)
      .join("\n") || "Hola.";
    const b = roles
      .filter((r) => r.who === "B")
      .flatMap((r) => r.lines)
      .join("\n") || "Hola.";
    setDialogLinesA(a);
    setDialogLinesB(b);

    const t = (ch.tips || [])
      .map((t) => `${t.title}: ${t.text}`)
      .join("\n");
    setTips(t || "Title: Note text");
  }, [show, courseIdx, chapterIdx, data]);

  const addPhrase = () => {
    const nid = `n${Date.now().toString(36)}`;
    setItems((prev) => [
      ...prev,
      { id: nid, type: "phrase", source: "", target: "" },
    ]);
  };

  const removePhrase = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updatePhrase = (idx, field, value) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    );
  };

  const saveChapter = () => {
    const course = data.courses[courseIdx] || data.courses[0];
    if (!course) return alert("No course available.");

    // build tips from textarea lines: "Title: Text"
    const parsedTips = (tips || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [t, ...rest] = l.split(":");
        return { title: (t || "").trim(), text: rest.join(":").trim() || "" };
      })
      .filter((t) => t.title);

    // build a single dialog from A/B boxes
    const linesA = (dialogLinesA || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const linesB = (dialogLinesB || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const maxLen = Math.max(linesA.length, linesB.length);
    const roles = [];
    for (let i = 0; i < maxLen; i++) {
      if (linesA[i]) roles.push({ who: "A", lines: [linesA[i]] });
      if (linesB[i]) roles.push({ who: "B", lines: [linesB[i]] });
    }

    const newDialog = {
      id: `dlg_${Date.now().toString(36)}`,
      title: dialogTitle || "Conversation",
      roles,
      translation: [], // optional per-line translations can be added later
    };

    // write back into a deep-cloned courses array
    const courses = data.courses.map((c, i) => {
      if (i !== courseIdx) return c;

      // respect either "items" or "vocab" in the stored chapter
      const chs = [...(c.chapters || [])];
      const existing = chs[chapterIdx] || {};
      const usesVocab = Array.isArray(existing.vocab);

      const newChapter = {
        ...existing,
        title,
        color,
        tips: parsedTips,
        dialogs: [newDialog],
      };

      if (usesVocab) {
        newChapter.vocab = items.map((it) => ({
          ...it,
          type: it.type || "phrase",
          id: it.id || `n${Math.random().toString(36).slice(2)}`,
        }));
        delete newChapter.items;
      } else {
        newChapter.items = items.map((it) => ({
          ...it,
          type: it.type || "phrase",
          id: it.id || `n${Math.random().toString(36).slice(2)}`,
        }));
        delete newChapter.vocab;
      }

      chs[chapterIdx] = newChapter;
      return { ...c, chapters: chs };
    });

    setData((prev) => ({
      ...prev,
      contentVersion: (prev.contentVersion ?? 0) + 1, // bump so devices auto-refresh next load
      courses,
    }));
    alert("Saved! (content version bumped)");
    setShow(false);
  };

  const addNewChapter = () => {
    const id = `custom_${Date.now().toString(36)}`;
    const base = {
      id,
      title: "New Chapter",
      color: "from-pink-200 to-pink-50",
      tips: [],
      // we’ll default to "vocab" to match your JSON schema
      vocab: [
        {
          id: `n${Date.now().toString(36)}`,
          type: "phrase",
          source: "Hola.",
          target: "Hello.",
        },
      ],
      dialogs: [],
      grammar: [],
    };
    const courses = data.courses.map((c, i) => {
      if (i !== courseIdx) return c;
      return { ...c, chapters: [...(c.chapters || []), base] };
    });
    setData((prev) => ({
      ...prev,
      contentVersion: (prev.contentVersion ?? 0) + 1,
      courses,
    }));
    // move editor to the new chapter
    setChapterIdx((data.courses[courseIdx]?.chapters?.length || 0));
  };

  return (
    <>
      {show && (
        <div
          className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50"
          onClick={() => setShow(false)}
        >
          <div
            className="max-w-5xl w-full bg-white rounded-2xl border p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium text-gray-900">Content Editor (beta)</div>
              <button
                className="px-3 py-2 rounded-xl border bg-white hover:shadow"
                onClick={() => setShow(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* selectors */}
            <div className="grid md:grid-cols-3 gap-3 mb-3">
              <div>
                <div className="text-xs text-gray-600 mb-1">Course</div>
                <select
                  className="w-full px-3 py-2 rounded-xl border bg-white"
                  value={courseIdx}
                  onChange={(e) => {
                    setCourseIdx(Number(e.target.value));
                    setChapterIdx(0);
                  }}
                >
                  {data.courses.map((c, i) => (
                    <option key={c.id} value={i}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Chapter</div>
                <select
                  className="w-full px-3 py-2 rounded-xl border bg-white"
                  value={chapterIdx}
                  onChange={(e) => setChapterIdx(Number(e.target.value))}
                >
                  {(data.courses[courseIdx]?.chapters || []).map((ch, i) => (
                    <option key={ch.id} value={i}>
                      {ch.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  className="w-full px-3 py-2 rounded-xl border bg-white hover:shadow"
                  onClick={addNewChapter}
                >
                  + Add New Chapter
                </button>
              </div>
            </div>

            {/* chapter basics */}
            <div className="grid md:grid-cols-2 gap-3 mb-3">
              <div>
                <div className="text-xs text-gray-600 mb-1">Chapter title</div>
                <input
                  className="w-full px-3 py-2 rounded-xl border bg-white"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Gradient color</div>
                <input
                  className="w-full px-3 py-2 rounded-xl border bg-white"
                  placeholder="from-brand-200 to-brand-50"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>
            </div>

            {/* tips */}
            <div className="mb-3">
              <div className="text-xs text-gray-600 mb-1">
                Tips (one per line as “Title: Note”)
              </div>
              <textarea
                className="w-full h-24 font-mono text-sm border rounded-xl p-3"
                value={tips}
                onChange={(e) => setTips(e.target.value)}
              />
            </div>

            {/* phrases */}
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Phrases</div>
                <button
                  className="px-3 py-2 rounded-xl border bg-white hover:shadow"
                  onClick={addPhrase}
                >
                  + Add phrase
                </button>
              </div>
              <div className="mt-2 grid gap-2">
                {items.map((it, i) => (
                  <div
                    key={i}
                    className="grid md:grid-cols-2 gap-2 items-center border rounded-xl p-2 bg-white"
                  >
                    <input
                      className="px-3 py-2 rounded-xl border bg-white"
                      placeholder="Source (e.g., Spanish/Japanese)"
                      value={it.source || ""}
                      onChange={(e) => updatePhrase(i, "source", e.target.value)}
                    />
                    <div className="flex gap-2">
                      <input
                        className="flex-1 px-3 py-2 rounded-xl border bg-white"
                        placeholder="Translation (e.g., English/Korean)"
                        value={it.target || ""}
                        onChange={(e) => updatePhrase(i, "target", e.target.value)}
                      />
                      <button
                        className="px-3 py-2 rounded-xl border bg-white hover:shadow"
                        onClick={() => removePhrase(i)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* dialog */}
            <div className="grid md:grid-cols-3 gap-3 mb-3">
              <div className="md:col-span-3 text-sm font-medium">Dialog (A/B lines)</div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Dialog title</div>
                <input
                  className="w-full px-3 py-2 rounded-xl border bg-white"
                  placeholder="Conversation"
                  value={dialogTitle}
                  onChange={(e) => setDialogTitle(e.target.value)}
                />
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">
                  Speaker A (one line per utterance)
                </div>
                <textarea
                  className="w-full h-32 font-mono text-sm border rounded-xl p-3"
                  value={dialogLinesA}
                  onChange={(e) => setDialogLinesA(e.target.value)}
                />
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">
                  Speaker B (one line per utterance)
                </div>
                <textarea
                  className="w-full h-32 font-mono text-sm border rounded-xl p-3"
                  value={dialogLinesB}
                  onChange={(e) => setDialogLinesB(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                className="px-3 py-2 rounded-xl border bg-white hover:shadow"
                onClick={() => setShow(false)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-2 rounded-xl border bg-white hover:shadow"
                onClick={saveChapter}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
