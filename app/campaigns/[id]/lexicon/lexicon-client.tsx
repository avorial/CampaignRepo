"use client";

import { useEffect, useMemo, useState } from "react";
import type { LexiconEntry, LexiconPhonemes } from "@/lib/lexicon";

const WORD_CLASSES = ["noun", "verb", "adjective", "adverb", "pronoun", "particle", "name", "title", "place", "exclamation", "phrase", "other"];

const DEFAULT_VOWELS = "a e i o u ae ai ei ou";
const DEFAULT_CONSONANTS = "b d f g k l m n r s t v";
const DEFAULT_PATTERNS = "CVC CVCV CVCC CCVC CV";

function generateNameFn(vowels: string[], consonants: string[], patterns: string[]): string {
  const pat = patterns[Math.floor(Math.random() * patterns.length)] || "CVC";
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  let result = "";
  for (const ch of pat) {
    if (ch === "V") result += pick(vowels) || "";
    else if (ch === "C") result += pick(consonants) || "";
  }
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export default function LexiconClient({ campaignId }: { campaignId: number }) {
  const api = `/api/campaigns/${campaignId}/lexicon`;

  const [terms, setTerms] = useState<LexiconEntry[]>([]);
  const [phonemes, setPhonemes] = useState<LexiconPhonemes>({});
  const [patterns, setPatterns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);

  const [filter, setFilter] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showPhonemes, setShowPhonemes] = useState(false);

  // Phoneme editor state
  const [vowelInput, setVowelInput] = useState(DEFAULT_VOWELS);
  const [consonantInput, setConsonantInput] = useState(DEFAULT_CONSONANTS);
  const [patternInput, setPatternInput] = useState(DEFAULT_PATTERNS);

  // Name generator
  const [generatedNames, setGeneratedNames] = useState<string[]>([]);

  // New entry form
  const [newTerm, setNewTerm] = useState("");
  const [newTranslation, setNewTranslation] = useState("");
  const [newPronun, setNewPronun] = useState("");
  const [newClass, setNewClass] = useState("");
  const [newEtymo, setNewEtymo] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Inline editing
  const [editEntry, setEditEntry] = useState<LexiconEntry | null>(null);

  useEffect(() => {
    fetch(api).then((r) => r.json()).then((d) => {
      const lex = d.lexicon || {};
      setTerms(lex.terms || []);
      setPhonemes(lex.phonemes || {});
      setPatterns(lex.patterns || []);
      if (lex.phonemes?.vowels?.length) setVowelInput(lex.phonemes.vowels.join(" "));
      if (lex.phonemes?.consonants?.length) setConsonantInput(lex.phonemes.consonants.join(" "));
      if (lex.patterns?.length) setPatternInput(lex.patterns.join(" "));
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return terms
      .filter((t) => classFilter === "all" || t.wordClass === classFilter)
      .filter((t) => !f || t.term.toLowerCase().includes(f) || (t.translation || "").toLowerCase().includes(f))
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [terms, filter, classFilter]);

  const usedClasses = useMemo(() => [...new Set(terms.map((t) => t.wordClass).filter(Boolean))].sort() as string[], [terms]);

  async function save(updatedTerms: LexiconEntry[], ph?: LexiconPhonemes, pats?: string[]) {
    setSaving(true);
    setMessage("Saving…");
    const res = await fetch(api, {
      method: "PUT",
      body: JSON.stringify({ terms: updatedTerms, phonemes: ph ?? phonemes, patterns: pats ?? patterns })
    });
    setSaving(false);
    if (res.ok) { setMessage("Saved."); setDirty(false); setTimeout(() => setMessage(""), 2000); }
    else { const d = await res.json(); setMessage(d.error || "Save failed."); }
  }

  function addTerm() {
    if (!newTerm.trim()) return;
    const entry: LexiconEntry = {
      id: `${Date.now()}`,
      term: newTerm.trim(),
      translation: newTranslation.trim() || undefined,
      pronunciation: newPronun.trim() || undefined,
      wordClass: newClass || undefined,
      etymology: newEtymo.trim() || undefined,
      notes: newNotes.trim() || undefined
    };
    const updated = [...terms, entry];
    setTerms(updated);
    setNewTerm(""); setNewTranslation(""); setNewPronun(""); setNewClass(""); setNewEtymo(""); setNewNotes("");
    setShowAdd(false);
    save(updated);
  }

  function startEdit(entry: LexiconEntry) {
    setEditingId(entry.id);
    setEditEntry({ ...entry });
  }

  function saveEdit() {
    if (!editEntry) return;
    const updated = terms.map((t) => t.id === editEntry.id ? editEntry : t);
    setTerms(updated);
    setEditingId(null);
    setEditEntry(null);
    save(updated);
  }

  function deleteTerm(id: string) {
    if (!window.confirm("Delete this entry?")) return;
    const updated = terms.filter((t) => t.id !== id);
    setTerms(updated);
    save(updated);
  }

  function savePhonemes() {
    const vowels = vowelInput.trim().split(/\s+/).filter(Boolean);
    const consonants = consonantInput.trim().split(/\s+/).filter(Boolean);
    const pats = patternInput.trim().split(/\s+/).filter(Boolean);
    const ph = { vowels, consonants };
    setPhonemes(ph);
    setPatterns(pats);
    save(terms, ph, pats);
  }

  function generateNames(count = 8) {
    const vowels = (phonemes.vowels?.length ? phonemes.vowels : vowelInput.trim().split(/\s+/).filter(Boolean));
    const consonants = (phonemes.consonants?.length ? phonemes.consonants : consonantInput.trim().split(/\s+/).filter(Boolean));
    const pats = (patterns.length ? patterns : patternInput.trim().split(/\s+/).filter(Boolean));
    if (!vowels.length || !consonants.length) { setGeneratedNames(["Configure phonemes first"]); return; }
    setGeneratedNames(Array.from({ length: count }, () => generateNameFn(vowels, consonants, pats)));
  }

  return (
    <section className="lexicon-shell">
      <div className="lexicon-toolbar">
        <input placeholder="Search terms or translations…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="all">All classes</option>
          {usedClasses.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="muted" style={{ fontSize: "13px" }}>{filtered.length} / {terms.length} terms</span>
        <button type="button" onClick={() => setShowAdd(!showAdd)}>+ Add term</button>
        {dirty && <button type="button" onClick={() => save(terms)} disabled={saving}>Save changes</button>}
      </div>

      {showAdd && (
        <div className="panel lexicon-add-form">
          <h3>New term</h3>
          <div className="mapper-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <label>Term *<input value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder="Khaerak" /></label>
            <label>Translation<input value={newTranslation} onChange={(e) => setNewTranslation(e.target.value)} placeholder="storm-bringer" /></label>
            <label>Pronunciation<input value={newPronun} onChange={(e) => setNewPronun(e.target.value)} placeholder="kaɪ.rak" /></label>
            <label>Word class<select value={newClass} onChange={(e) => setNewClass(e.target.value)}><option value="">—</option>{WORD_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
            <label>Etymology<input value={newEtymo} onChange={(e) => setNewEtymo(e.target.value)} placeholder="From 'kha' (storm)" /></label>
            <label>Notes<input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="GM notes" /></label>
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button onClick={addTerm} disabled={!newTerm.trim()}>Add entry</button>
            <button type="button" className="secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <p className="muted">Loading…</p> : (
        <div className="organize-table-wrap">
          <table className="organize-table lexicon-table">
            <thead>
              <tr>
                <th>Term</th>
                <th>Translation</th>
                <th>Pronunciation</th>
                <th>Class</th>
                <th>Etymology</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => editingId === t.id && editEntry ? (
                <tr key={t.id} className="row-selected">
                  <td><input value={editEntry.term} onChange={(e) => setEditEntry({ ...editEntry, term: e.target.value })} style={{ width: "100%" }} /></td>
                  <td><input value={editEntry.translation || ""} onChange={(e) => setEditEntry({ ...editEntry, translation: e.target.value })} style={{ width: "100%" }} /></td>
                  <td><input value={editEntry.pronunciation || ""} onChange={(e) => setEditEntry({ ...editEntry, pronunciation: e.target.value })} style={{ width: "100%" }} /></td>
                  <td><select value={editEntry.wordClass || ""} onChange={(e) => setEditEntry({ ...editEntry, wordClass: e.target.value })}><option value="">—</option>{WORD_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}</select></td>
                  <td><input value={editEntry.etymology || ""} onChange={(e) => setEditEntry({ ...editEntry, etymology: e.target.value })} style={{ width: "100%" }} /></td>
                  <td><input value={editEntry.notes || ""} onChange={(e) => setEditEntry({ ...editEntry, notes: e.target.value })} style={{ width: "100%" }} /></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" onClick={saveEdit} style={{ fontSize: "12px" }}>✓</button>
                    <button type="button" className="secondary" style={{ fontSize: "12px" }} onClick={() => setEditingId(null)}>✕</button>
                  </td>
                </tr>
              ) : (
                <tr key={t.id}>
                  <td><strong>{t.term}</strong></td>
                  <td>{t.translation || <span className="muted">—</span>}</td>
                  <td>{t.pronunciation ? <em style={{ fontSize: "12px" }}>{t.pronunciation}</em> : <span className="muted">—</span>}</td>
                  <td>{t.wordClass ? <span className="tag-chip">{t.wordClass}</span> : <span className="muted">—</span>}</td>
                  <td style={{ fontSize: "12px", color: "var(--muted)" }}>{t.etymology || "—"}</td>
                  <td style={{ fontSize: "12px", color: "var(--muted)" }}>{t.notes || "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className="linklike" style={{ fontSize: "12px" }} onClick={() => startEdit(t)}>Edit</button>
                    <button type="button" className="linklike" style={{ fontSize: "12px", color: "var(--danger, #c0392b)" }} onClick={() => deleteTerm(t.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={7} className="muted">No terms match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {message && <p className="toast">{message}</p>}

      {/* Phoneme + name generator */}
      <div className="panel" style={{ marginTop: "24px" }}>
        <button type="button" className="linklike" onClick={() => setShowPhonemes(!showPhonemes)} style={{ fontWeight: 600 }}>
          {showPhonemes ? "▾" : "▸"} Phoneme-based name generator
        </button>
        {showPhonemes && (
          <div className="stack" style={{ marginTop: "12px" }}>
            <p className="muted" style={{ fontSize: "12px" }}>Define phoneme sets and patterns (C=consonant, V=vowel) to generate culturally consistent names.</p>
            <div className="mapper-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <label>Vowel phonemes (space-separated)
                <input value={vowelInput} onChange={(e) => setVowelInput(e.target.value)} placeholder="a e i o u ae ai" />
              </label>
              <label>Consonant phonemes (space-separated)
                <input value={consonantInput} onChange={(e) => setConsonantInput(e.target.value)} placeholder="k r n s th kh l m" />
              </label>
              <label>Syllable patterns (space-separated)
                <input value={patternInput} onChange={(e) => setPatternInput(e.target.value)} placeholder="CVC CVCV CVCC" />
              </label>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="button" onClick={savePhonemes} disabled={saving}>Save phonemes</button>
              <button type="button" className="secondary" onClick={() => generateNames(10)}>Generate 10 names</button>
            </div>
            {generatedNames.length > 0 && (
              <div className="traits-grid" style={{ marginTop: "8px" }}>
                {generatedNames.map((n, i) => (
                  <span key={i} className="trait-chip" style={{ cursor: "pointer" }} title="Click to copy"
                    onClick={() => navigator.clipboard?.writeText(n)}>
                    {n}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
