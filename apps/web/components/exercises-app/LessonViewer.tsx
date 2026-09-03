'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import type { Lesson, CourseModule, VocabularyItem, PhraseItem, ExerciseItem, Dialogue, SummaryBlock, SprekenBlock } from '@/lib/exercises-app/types';
import {
  getLessonProgress,
  markLessonStarted,
  markLessonCompleted,
  markPreviousAsCompleted,
} from '@/lib/exercises-app/progress';
import AudioPlayer from './AudioPlayer';
import TextoResaltable, { ProveedorResaltado } from './TextoResaltable';
import { getConfig, getUriWithOrg } from '@services/config/config';
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs';
import { Dumbbell } from 'lucide-react';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import useAdminStatus from '@components/Hooks/useAdminStatus';
import { saveItemResult } from '@/lib/exercises/exercises';
import { saveLastAttempt, getLastAttempt, type LastAttempt } from '@/lib/exercises-app/lastAttempts';
import { markLessonCompletedRemote, patchStudentProgress, listLessonCompletions } from '@services/student/progress';

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */

/**
 * Mapa global word_nl -> audio_url poblado por LessonViewer cuando carga la
 * lección. speakDutch lo consulta primero antes de caer a TTS del navegador.
 *
 * Esto hace que cualquier ejercicio que diga speakDutch("koffie") use
 * automáticamente el MP3 de ElevenLabs si existe — sin tocar cada componente.
 */
let _wordAudioMap: Record<string, string> = {};
let _currentAudio: HTMLAudioElement | null = null;

export function setWordAudioMap(map: Record<string, string>) {
  _wordAudioMap = map;
}

function _ttsFallback(text: string, onDone?: () => void, rate?: number) {
  if (typeof window === 'undefined' || !window.speechSynthesis) { onDone?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'nl-NL';
  u.rate = rate ?? 0.85;
  u.pitch = 1;
  u.onend = () => onDone?.();
  window.speechSynthesis.speak(u);
}

// ¿Está disponible la ruta de ElevenLabs? (se aprende al primer intento; si no
// hay API key configurada devuelve 503 y dejamos de intentarlo en la sesión).
let _ttsRouteAvailable: boolean | null = null;
// Cache de audio por palabra (objectURL) para no re-pedir en la misma sesión.
const _ttsBlobCache = new Map<string, string>();

// Para CUALQUIER audio en curso (MP3 ElevenLabs/pre-gen o voz del navegador).
function stopDutch() {
  if (_currentAudio) { try { _currentAudio.pause(); } catch {} _currentAudio = null; }
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
}

function _playUrl(url: string, onFail: () => void, onDone?: () => void, rate?: number) {
  try {
    const audio = new Audio(url);
    if (rate && rate > 0) audio.playbackRate = rate; // versión "lenta" sin cambiar la voz
    _currentAudio = audio;
    audio.onerror = onFail;
    audio.onended = () => onDone?.();
    audio.play().catch(onFail);
  } catch {
    onFail();
  }
}

// Etiqueta de caché de la voz. SÚBELA (v3, v4...) cada vez que se cambie la voz
// por defecto, para que el navegador no sirva el audio viejo en caché.
// v5 → v6: se metió un segundo modelo de ElevenLabs (más natural) para las
// frases de los diálogos; sin subir esto, cada navegador que ya había oído un
// diálogo seguía sirviendo el mp3 viejo desde su caché de un año, ignorando
// el cambio en el servidor por completo.
const TTS_VOICE_TAG = 'v6';

async function _speakViaElevenLabs(text: string, onDone?: () => void, rate?: number): Promise<boolean> {
  if (_ttsRouteAvailable === false) return false;
  const key = `${TTS_VOICE_TAG}:${text.trim().toLowerCase()}`;
  const cached = _ttsBlobCache.get(key);
  if (cached) { _playUrl(cached, () => _ttsFallback(text, onDone, rate), onDone, rate); return true; }
  try {
    const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&vt=${TTS_VOICE_TAG}`);
    if (!res.ok) {
      if (res.status === 503) _ttsRouteAvailable = false; // no configurado → no reintentar
      return false;
    }
    _ttsRouteAvailable = true;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    _ttsBlobCache.set(key, url);
    _playUrl(url, () => _ttsFallback(text, onDone, rate), onDone, rate);
    return true;
  } catch {
    return false;
  }
}

// Obtiene la URL (objectURL) de un clip de audio para una frase + voz concreta.
// Reutiliza la caché por voz+texto. Devuelve null si la ruta no está disponible.
async function _ttsClipUrl(text: string, voice?: string): Promise<string | null> {
  const key = `${TTS_VOICE_TAG}:${voice || 'def'}:${text.trim().toLowerCase()}`;
  const cached = _ttsBlobCache.get(key);
  if (cached) return cached;
  if (_ttsRouteAvailable === false) return null;
  try {
    const q = new URLSearchParams({ text, vt: TTS_VOICE_TAG });
    if (voice) q.set('voice', voice);
    const res = await fetch(`/api/tts?${q.toString()}`);
    if (!res.ok) { if (res.status === 503) _ttsRouteAvailable = false; return null; }
    _ttsRouteAvailable = true;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    _ttsBlobCache.set(key, url);
    return url;
  } catch {
    return null;
  }
}

// AudioContext compartido (solo para decodificar y dibujar la forma de onda).
let _audioCtx: AudioContext | null = null;
function _getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_audioCtx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    _audioCtx = new AC();
  }
  return _audioCtx;
}

// Picos de amplitud (máximo absoluto por segmento) de un AudioBuffer.
function _peaks(buf: AudioBuffer, n: number): number[] {
  const data = buf.getChannelData(0);
  const block = Math.max(1, Math.floor(data.length / n));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let max = 0;
    const start = i * block;
    for (let j = 0; j < block; j++) {
      const v = Math.abs(data[start + j] || 0);
      if (v > max) max = v;
    }
    out.push(max);
  }
  return out;
}

// Clip de diálogo: objectURL para reproducir + duración real + picos a ~40/s.
const _dialogueClipCache = new Map<string, { url: string; dur: number; hiPeaks: number[] }>();

// Ejecuta `fn` sobre los items con concurrencia limitada (ElevenLabs limita las
// peticiones simultáneas; pedir 10 a la vez hacía fallar varias).
async function _mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker()));
  return out;
}

async function _dialogueClip(text: string, voice?: string, attempt = 0): Promise<{ url: string; dur: number; hiPeaks: number[] } | null> {
  const key = `${TTS_VOICE_TAG}:${voice || 'def'}:${text.trim().toLowerCase()}`;
  const cached = _dialogueClipCache.get(key);
  if (cached) return cached;
  if (_ttsRouteAvailable === false) return null;
  const retry = async () => {
    if (attempt >= 2) return null;
    await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    return _dialogueClip(text, voice, attempt + 1);
  };
  try {
    const q = new URLSearchParams({ text, vt: TTS_VOICE_TAG });
    if (voice) q.set('voice', voice);
    const res = await fetch(`/api/tts?${q.toString()}`);
    if (!res.ok) {
      if (res.status === 503) { _ttsRouteAvailable = false; return null; } // no configurado
      return retry(); // 429/502… transitorio → reintenta
    }
    _ttsRouteAvailable = true;
    const ab = await res.arrayBuffer();
    const forDecode = ab.slice(0); // decodeAudioData "consume" el buffer
    const url = URL.createObjectURL(new Blob([ab], { type: 'audio/mpeg' }));
    let dur = 1.6;
    let hiPeaks: number[] = [];
    try {
      const ctx = _getAudioCtx();
      if (ctx) {
        const audioBuf = await ctx.decodeAudioData(forDecode);
        dur = audioBuf.duration || 1.6;
        hiPeaks = _peaks(audioBuf, Math.max(8, Math.round(dur * 40)));
      }
    } catch { hiPeaks = []; }
    const out = { url, dur, hiPeaks };
    _dialogueClipCache.set(key, out);
    return out;
  } catch {
    return retry();
  }
}

function speakDutch(text: string, onDone?: () => void, rate?: number) {
  // Para parar cualquier audio previo (TTS o MP3)
  stopDutch();

  const key = text.trim().toLowerCase();

  // 1) Voz de ElevenLabs en NEERLANDÉS (la buena, sin acento inglés). Si la
  //    cuenta no está configurada, cae a las siguientes opciones.
  _speakViaElevenLabs(text, onDone, rate).then((ok) => {
    if (ok) return;
    // 2) MP3 pre-generado si existe.
    const url = _wordAudioMap[key];
    if (url) { _playUrl(url, () => _ttsFallback(text, onDone, rate), onDone, rate); return; }
    // 3) Voz del navegador (último recurso).
    _ttsFallback(text, onDone, rate);
  });
}

/**
 * Artículo (de/het) sin duplicar. Algunos registros tienen el artículo metido
 * dentro del campo `dutch` ("de fles") Y también en el campo `article` ("de"),
 * lo que provocaba "de de fles". `bareDutch` devuelve la palabra SIN el artículo
 * repetido; `joinDutch` devuelve "artículo + palabra" una sola vez.
 */
function bareDutch(article?: string | null, dutch?: string | null): string {
  const d = (dutch || '').trim();
  const a = (article || '').trim();
  if (!a) return d;
  const dl = d.toLowerCase();
  const al = a.toLowerCase();
  if (dl === al) return '';
  if (dl.startsWith(al + ' ')) return d.slice(a.length + 1).trim();
  return d;
}
function joinDutch(article?: string | null, dutch?: string | null): string {
  const bare = bareDutch(article, dutch);
  const a = (article || '').trim();
  if (!a) return bare;
  return bare ? `${a} ${bare}` : a;
}


/* ── Feedback banner (correct / incorrect) ── */

function FeedbackBanner({
  correct,
  correctAnswer,
  explanation,
}: {
  correct: boolean;
  correctAnswer?: string;
  explanation?: string;
  /** @deprecated ya no se usa — se mantiene la firma para no romper llamadas */
  onHear?: () => void;
}) {
  return (
    <div
      className={`rounded-lg px-4 py-3 text-[14px] font-medium ${
        correct
          ? 'bg-green-50 text-green-800 border border-green-200'
          : 'bg-red-50 text-red-700 border border-red-200'
      }`}
    >
      {correct ? '✓ ¡Correcto!' : `✗ La respuesta era: "${correctAnswer}"`}
      {explanation && (
        <p className="mt-1 text-[13px] opacity-80">{explanation}</p>
      )}
    </div>
  );
}

function GradientBar({ pct, label, subLabel }: { pct: number; label?: string; subLabel?: string }) {
  return (
    <div className="space-y-2">
      {(label || subLabel) && (
        <div className="flex items-center justify-between gap-3">
          <div>
            {label && <p className="text-[14px] font-bold text-gray-900 leading-tight">{label}</p>}
            {subLabel && <p className="text-[11px] text-[#9CA3AF] font-medium leading-tight">{subLabel}</p>}
          </div>
          <span className="text-[12px] font-bold text-[#025dc7] bg-[#EEF4FF] px-2 py-0.5 rounded-full shrink-0">{pct}%</span>
        </div>
      )}
      {/* Sin etiqueta, el porcentaje va EN LA MISMA LÍNEA que la barra.
          Antes ocupaba una fila para él solo, pegado a la derecha: treinta
          píxeles de blanco entre el título de la clase y la barra, que en el
          Lezen —donde debajo no hay nada que llene el ancho— se veían como un
          hueco raro. */}
      {!label && !subLabel ? (
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full bg-[#DDE6F5] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 progress-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 text-[12px] font-bold text-[#025dc7] bg-[#EEF4FF] px-2 py-0.5 rounded-full">
            {pct}%
          </span>
        </div>
      ) : (
        <div className="h-2 w-full rounded-full bg-[#DDE6F5] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 progress-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SECTION TYPE
───────────────────────────────────────────────────────────────────────────── */

type SectionId = 'resumen' | 'vocabulary' | 'flashcards' | 'lezen' | 'luisteren' | 'spreken';

const SECTION_META: Record<SectionId, { label: string; emoji: string; desc: string }> = {
  resumen:     { label: 'Resumen',     emoji: '📋', desc: 'Los puntos clave de la lección' },
  vocabulary:  { label: 'Oefeningen', emoji: '✏️', desc: 'Ejercicios de toda la lección' },
  flashcards:  { label: 'Flashcards',  emoji: '🃏', desc: 'Practica con tarjetas' },
  lezen:       { label: 'Lezen',       emoji: '📝', desc: 'Lee un texto y responde preguntas' },
  luisteren:   { label: 'Luisteren',   emoji: '🎧', desc: 'Escucha el diálogo' },
  spreken:     { label: 'Spreken',     emoji: '🗣️', desc: '¿Qué dices en esta situación?' },
};

/* ─────────────────────────────────────────────────────────────────────────────
   VOCAB PRACTICE — types & helpers
───────────────────────────────────────────────────────────────────────────── */

const VOCAB_PER_PAGE = 8;

type VPStepType =
  | 'words' | 'phrases' | 'listen' | 'translate' | 'truefalse' | 'test' | 'complete'
  | 'order' | 'classify' | 'write' | 'scramble' | 'pairs'
  | 'emoji' | 'intruder' | 'letterdash' | 'memory';

const VP_META: Record<VPStepType, { label: string; emoji: string }> = {
  words:      { label: 'Diccionario',           emoji: '📖' },
  phrases:    { label: 'Repaso de frases',      emoji: '💬' },
  listen:     { label: 'Escucha y elige',       emoji: '🎧' },
  translate:  { label: 'Escucha y traduce',     emoji: '🎙️' },
  truefalse:  { label: 'Verdadero o falso',     emoji: '✅' },
  test:       { label: 'Selecciona la correcta',emoji: '🧪' },
  complete:   { label: 'Completa la frase',     emoji: '✏️' },
  order:      { label: 'Ordena las palabras',   emoji: '🔤' },
  classify:   { label: 'Clasifica',             emoji: '🗂️' },
  write:      { label: 'Escribe en neerlandés', emoji: '✍️' },
  scramble:   { label: 'Deletrea la palabra',   emoji: '🔡' },
  pairs:      { label: 'Empareja',              emoji: '🔗' },
  emoji:      { label: 'Toca el emoji',         emoji: '🎯' },
  intruder:   { label: 'Elige la intrusa',      emoji: '🔎' },
  letterdash: { label: 'Letras que faltan',     emoji: '🔠' },
  memory:     { label: 'Memory cards',          emoji: '🃏' },
};

interface ClassifyGroup { id: string; label: string }
interface ClassifyItemData { dutch: string; groupId: string }

type VPStep =
  | { type: 'words' }
  | { type: 'phrases';    items: PhraseItem[] }
  | { type: 'listen';     exercises: ExerciseItem[] }
  | { type: 'translate';  exercises: ExerciseItem[] }
  | { type: 'truefalse';  exercises: ExerciseItem[] }
  | { type: 'test';       exercises: ExerciseItem[] }
  | { type: 'complete';   exercises: ExerciseItem[] }
  | { type: 'order';      exercises: ExerciseItem[] }
  | { type: 'classify';   groups: ClassifyGroup[]; items: ClassifyItemData[] }
  | { type: 'write';      exercises: ExerciseItem[] }
  | { type: 'scramble';   exercises: ExerciseItem[] }
  | { type: 'pairs';      exercises: ExerciseItem[] }
  | { type: 'emoji';      exercises: ExerciseItem[] }
  | { type: 'intruder';   exercises: ExerciseItem[] }
  | { type: 'letterdash'; exercises: ExerciseItem[] }
  | { type: 'memory';     exercises: ExerciseItem[] };

function isTrueFalse(e: ExerciseItem): boolean {
  if (e.type === 'true_false') return true;
  if (e.type !== 'multiple_choice') return false;
  const opts = (e.options ?? []).map(o => o.toLowerCase().trim());
  return opts.length === 2 && (opts.includes('verdadero') || opts.includes('true')) && (opts.includes('falso') || opts.includes('false'));
}

function buildClassifyData(items: VocabularyItem[]): { groups: ClassifyGroup[]; items: ClassifyItemData[] } | null {
  // Ignore blank/empty categories (happen when Supabase item has no local match)
  const validCategories = [...new Set(items.map(i => i.category).filter(c => c && c.trim() !== ''))];
  if (validCategories.length >= 2) {
    const eligible = items.filter(i => i.category && i.category.trim() !== '');
    return {
      groups: validCategories.map(c => ({ id: c, label: c })),
      items: eligible.map(i => ({ dutch: i.dutch, groupId: i.category })),
    };
  }
  // Article-based fallback — only de/het nouns (skip verbs and items without article)
  const deHetItems = items.filter(i => i.article === 'de' || i.article === 'het');
  const hasDE  = deHetItems.some(i => i.article === 'de');
  const hasHET = deHetItems.some(i => i.article === 'het');
  const groups: ClassifyGroup[] = [];
  if (hasDE)  groups.push({ id: 'de',  label: 'de ...' });
  if (hasHET) groups.push({ id: 'het', label: 'het ...' });
  if (groups.length >= 2) {
    return {
      groups,
      items: deHetItems.map(i => ({ dutch: i.dutch, groupId: i.article! })),
    };
  }
  return null;
}

function buildVPSteps(
  vocabItems: VocabularyItem[],
  phraseItems: PhraseItem[],
  exercises: ExerciseItem[],
): VPStep[] {
  const steps: VPStep[] = [];

  // El estudio de vocabulario Y las frases se muestran ahora en el "Resumen",
  // para que "Oefeningen" sea solo ejercicios. (antes: pasos 'words' y
  // 'phrases'). El parámetro se mantiene para no cambiar la firma a todos los
  // que llaman, pero ya no genera ningún paso.

  const listenEx = exercises.filter(e => e.type === 'listen_and_choose');
  if (listenEx.length > 0)
    steps.push({ type: 'listen', exercises: listenEx });

  const translateEx = exercises.filter(e => e.type === 'listen_translate');
  if (translateEx.length > 0)
    steps.push({ type: 'translate', exercises: translateEx });

  const tfEx = exercises.filter(isTrueFalse);
  if (tfEx.length > 0)
    steps.push({ type: 'truefalse', exercises: tfEx });

  const testEx = exercises.filter(e => e.type === 'multiple_choice' && !isTrueFalse(e));
  if (testEx.length > 0)
    steps.push({ type: 'test', exercises: testEx });

  const fillEx = exercises.filter(e => e.type === 'fill_blank');
  if (fillEx.length > 0)
    steps.push({ type: 'complete', exercises: fillEx });

  const orderEx = exercises.filter(e => e.type === 'order_sentence');
  if (orderEx.length > 0)
    steps.push({ type: 'order', exercises: orderEx });

  // Classify desactivado por feedback del usuario (no encajaba en el flujo Duolingo).
  // Se mantienen el tipo y el componente por si se reactiva más adelante.
  // const classifyData = buildClassifyData(vocabItems);
  // if (classifyData) steps.push({ type: 'classify', ...classifyData });

  const writeEx = exercises.filter(e => e.type === 'write_answer');
  if (writeEx.length > 0)
    steps.push({ type: 'write', exercises: writeEx });

  const scrambleEx = exercises.filter(e => e.type === 'word_scramble');
  if (scrambleEx.length > 0)
    steps.push({ type: 'scramble', exercises: scrambleEx });

  const pairsEx = exercises.filter(e => e.type === 'match_pairs');
  if (pairsEx.length > 0)
    steps.push({ type: 'pairs', exercises: pairsEx });

  const emojiEx = exercises.filter(e => e.type === 'emoji_choice');
  if (emojiEx.length > 0)
    steps.push({ type: 'emoji', exercises: emojiEx });

  const intruderEx = exercises.filter(e => e.type === 'odd_one_out');
  if (intruderEx.length > 0)
    steps.push({ type: 'intruder', exercises: intruderEx });

  const letterDashEx = exercises.filter(e => e.type === 'letter_dash');
  if (letterDashEx.length > 0)
    steps.push({ type: 'letterdash', exercises: letterDashEx });

  // Memory cards desactivado por feedback del usuario.
  // const memoryEx = exercises.filter(e => e.type === 'pair_memory');
  // if (memoryEx.length > 0) steps.push({ type: 'memory', exercises: memoryEx });

  return steps;
}

/* ── Step bar ── */

function StepBar({ steps, current }: {
  steps: VPStep[];
  current: number;
}) {
  const meta = VP_META[steps[current].type];
  // Total de "tarjetas" (steps no-content) y posición actual entre ellas
  const cardSteps = steps.filter(s => s.type !== 'words' && s.type !== 'phrases');
  const isContentStep = steps[current].type === 'words' || steps[current].type === 'phrases';
  const cardNum = isContentStep ? null : steps.slice(0, current + 1).filter(s => s.type !== 'words' && s.type !== 'phrases').length;

  return (
    <div className="flex-1 flex items-center gap-3 min-w-0">
      <p className="text-[20px] font-bold text-gray-900 leading-tight truncate" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}>
        {meta.emoji} {meta.label}
      </p>
      {!isContentStep && (
        <span className="text-[11px] text-[#9CA3AF] font-medium tabular-nums shrink-0">
          {cardNum} / {cardSteps.length}
        </span>
      )}
    </div>
  );
}

/* ── Word card (simple play button) ── */

function WordCard({ word }: { word: VocabularyItem }) {
  const [isPlaying, setIsPlaying] = useState(false);

  function handlePlay() {
    if (isPlaying) {
      // speakDutch maneja stop interno
      window.speechSynthesis?.cancel();
      setIsPlaying(false);
      return;
    }
    // Texto con artículo → speakDutch enruta automáticamente al MP3 -art.mp3
    // si está en el mapa global, o cae a TTS.
    const text = joinDutch(word.article, word.dutch);
    setIsPlaying(true);
    speakDutch(text);
    // Resetear estado tras una pausa razonable (no tenemos onended del helper)
    setTimeout(() => setIsPlaying(false), 2500);
  }

  return (
    <div className="rounded-2xl border border-[#DDE6F5] bg-white overflow-hidden flex flex-col">
      <div className="h-1.5 w-full bg-[#1D0084]" />
      <div className="flex-1 px-3 py-2.5 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {word.article && (
            <span className="text-[10px] font-bold text-[#025dc7] bg-[#F0F5FF] px-1.5 py-0.5 rounded-md shrink-0">
              {word.article}
            </span>
          )}
          <span className="text-[14px] font-bold text-gray-900 leading-tight" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}>
            {bareDutch(word.article, word.dutch)}
          </span>
        </div>
        <p className="text-[12px] text-[#5A6480] font-medium leading-snug">{word.spanish}</p>
      </div>
      <div className="px-3 pb-2.5">
        <button
          onClick={handlePlay}
          className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 border ${
            isPlaying
              ? 'bg-[#4da3ff] border-[#4da3ff] text-[#1D0084]'
              : 'bg-[#F0F5FF] border-[#DDE6F5] text-[#025dc7] hover:bg-[#e0eaff]'
          }`}
        >
          {isPlaying ? (
            <>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
              Parar
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Escuchar
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ── Words step (paginated grid) ── */

function WordsStep({ items, onDone, onSubProgress }: {
  items: VocabularyItem[];
  onDone: () => void;
  onSubProgress?: (done: number, total: number) => void;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(items.length / VOCAB_PER_PAGE);
  const pageItems = items.slice(page * VOCAB_PER_PAGE, (page + 1) * VOCAB_PER_PAGE);
  const isLastPage = page + 1 >= totalPages;

  useEffect(() => {
    onSubProgress?.(page + 1, totalPages);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {pageItems.map(word => <WordCard key={word.id} word={word} />)}
      </div>
      <div className="flex items-center justify-between gap-3 mt-6">
        <button
          onClick={() => setPage(p => p - 1)}
          disabled={page === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F0F5FF] text-gray-900 text-[14px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200 disabled:opacity-30 disabled:pointer-events-none"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Anterior
        </button>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => setPage(i)}
              className={`rounded-full transition-all duration-200 ${i === page ? 'w-5 h-2 bg-[#1D0084]' : 'w-2 h-2 bg-[#DDE6F5]'}`}
              aria-label={`Página ${i + 1}`}
            />
          ))}
        </div>
        {isLastPage ? (
          <button onClick={onDone} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[14px] font-semibold hover:bg-[#6cb5ff] transition-colors duration-200">
            Siguiente paso
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <button onClick={() => setPage(p => p + 1)} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[14px] font-semibold hover:bg-[#6cb5ff] transition-colors duration-200">
            Siguiente
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Phrases step ── */

function PhrasesStep({ items, onDone, onBack, onSubProgress }: {
  items: PhraseItem[];
  onDone: () => void;
  onBack: () => void;
  onSubProgress?: (done: number, total: number) => void;
}) {
  // Persistencia del índice (efecto libro: al volver, aterriza donde estabas / en
  // el último si el step estaba completado).
  const storageKey = typeof window !== 'undefined' ? `vp-phrases-${window.location.pathname}` : null;
  const [index, setIndex] = useState(() => {
    if (!storageKey || typeof window === 'undefined') return 0;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored !== null) {
        const n = parseInt(stored, 10);
        if (Number.isFinite(n) && n >= 0 && n < items.length) return n;
      }
    } catch {}
    return 0;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const phrase = items[index];
  const isLast = index + 1 >= items.length;

  function stopAudio() {
    stopDutch();
    setIsPlaying(false);
  }

  function handlePlay() {
    if (isPlaying) { stopAudio(); return; }
    setIsPlaying(true);
    // Voz por defecto (ElevenLabs nl) → pre-gen → navegador, gestionado en speakDutch.
    speakDutch(phrase.dutch, () => setIsPlaying(false));
  }

  function navigate(newIndex: number) {
    stopAudio();
    setIndex(newIndex);
    if (storageKey) try { sessionStorage.setItem(storageKey, String(newIndex)); } catch {}
    onSubProgress?.(newIndex + 1, items.length);
  }

  // Al pasar al siguiente step, guarda el ÚLTIMO índice para que al volver
  // atrás aterrice ahí (como una página atrás en un libro).
  function handleDone() {
    if (storageKey && items.length > 0) {
      try { sessionStorage.setItem(storageKey, String(items.length - 1)); } catch {}
    }
    onDone();
  }

  useEffect(() => {
    onSubProgress?.(1, items.length);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">

      <div className="bg-white rounded-2xl border border-[#DDE6F5] p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[22px] font-bold text-gray-900 leading-tight flex-1" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}>
            {phrase.dutch}
          </h2>
          <button
            onClick={handlePlay}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 border ${
              isPlaying
                ? 'bg-[#4da3ff] border-[#4da3ff] text-[#1D0084]'
                : 'bg-[#F0F5FF] border-[#DDE6F5] text-[#025dc7] hover:bg-[#e0eaff]'
            }`}
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
        </div>
        <div className="rounded-lg bg-[#F0F5FF] px-4 py-3 border border-[#DDE6F5]">
          <p className="text-[11px] font-semibold text-[#9CA3AF] mb-1 uppercase tracking-widest">Traducción</p>
          <p className="text-[15px] text-gray-900 font-medium leading-snug">{phrase.spanish}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => { stopAudio(); if (index === 0) onBack(); else navigate(index - 1); }}
          className="flex items-center gap-2 px-5 py-3 rounded-lg bg-[#F0F5FF] text-gray-900 text-[14px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Anterior
        </button>
        <button
          onClick={() => { stopAudio(); if (isLast) handleDone(); else navigate(index + 1); }}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[14px] font-semibold hover:bg-[#6cb5ff] transition-colors duration-200"
        >
          {isLast ? 'Siguiente paso' : 'Siguiente'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Exercise runner — navegación libre tipo app moderna
   Sin "finished" modal ni "reviewMode" secreto. Cada ejercicio es un slide.
   El usuario puede moverse siempre (Anterior/Siguiente/dots) y las respuestas
   ya dadas se mantienen. Al terminar TODOS, el boton de "Siguiente paso"
   pasa al step siguiente.
───────────────────────────────────────────────────────────────────────────── */

/** Lo que se espera antes de pasar sola a la siguiente al acertar. */
const AUTO_AVANCE_MS = 1400;

export function ExerciseRunner({ exercises, onDone, onBack, hasBackStep, onSubProgress, cacheKey, onItemResult }: {
  exercises: ExerciseItem[];
  onDone: () => void;
  onBack: () => void;
  hasBackStep?: boolean;
  onSubProgress?: (done: number, total: number) => void;
  cacheKey?: string;
  onItemResult?: (itemId: string, correct: boolean) => void;
}) {
  const answersKey = cacheKey ? `vp-ex-${cacheKey}-data` : null;
  const indexKey = cacheKey ? `vp-ex-${cacheKey}` : null;

  // Load cached answers once on mount (sessionStorage-safe).
  // Filtra entries con indices fuera del rango actual (cache obsoleto si
  // el seed cambió de tamaño).
  const initialAnswers = useMemo<Record<number, string>>(() => {
    if (!answersKey || typeof window === 'undefined') return {};
    try {
      const raw = sessionStorage.getItem(answersKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, string>;
      const cleaned: Record<number, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        const n = Number(k);
        if (Number.isFinite(n) && n >= 0 && n < exercises.length && typeof v === 'string') {
          cleaned[n] = v;
        }
      }
      // Re-persist cleaned version to evict stale entries from storage
      sessionStorage.setItem(answersKey, JSON.stringify(cleaned));
      return cleaned;
    } catch { return {}; }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [answers, setAnswers] = useState<Record<number, string>>(initialAnswers);
  // Desde qué pregunta hay que pasar sola. Se pone SOLO al contestar bien en
  // ese momento; volviendo atrás a una que ya estaba acertada no se dispara,
  // que si no sería imposible repasar nada.
  const [avanzarDesde, setAvanzarDesde] = useState<number | null>(null);
  const [index, setIndex] = useState(() => {
    if (typeof window === 'undefined') return 0;
    // Si hay un index guardado de una sesión en curso, úsalo
    if (indexKey) {
      try {
        const stored = sessionStorage.getItem(indexKey);
        if (stored !== null) {
          const n = parseInt(stored, 10);
          if (Number.isFinite(n) && n >= 0 && n < exercises.length) return n;
        }
      } catch {}
    }
    // Sin index guardado pero con respuestas previas → step ya completado:
    // aterriza en el ÚLTIMO ejercicio (como pasar páginas atrás en un libro).
    if (Object.keys(initialAnswers).length > 0 && exercises.length > 0) {
      return exercises.length - 1;
    }
    return 0;
  });
  const [exKey, setExKey] = useState(0);

  // Computed score from answers map — single source of truth.
  // Filtra índices fuera del rango actual (cache obsoleto de seeds antiguos).
  const score = useMemo(() => {
    return exercises.reduce((acc, ex, i) => {
      const a = answers[i];
      if (!a) return acc;
      const ca = (ex.correctAnswer ?? '').trim().toLowerCase();
      return a.trim().toLowerCase() === ca ? acc + 1 : acc;
    }, 0);
  }, [answers, exercises]);

  // Solo cuenta respuestas dentro del rango actual del step
  const answeredCount = Object.keys(answers).filter(k => {
    const n = Number(k);
    return Number.isFinite(n) && n >= 0 && n < exercises.length;
  }).length;
  const allAnswered = answeredCount >= exercises.length;
  const isLast = index + 1 >= exercises.length;
  const canGoBack = index > 0 || !!hasBackStep;

  // Persist index + report progress on every index change
  useEffect(() => {
    if (indexKey) try { sessionStorage.setItem(indexKey, String(index)); } catch {}
    onSubProgress?.(index, exercises.length);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAnswer(correct: boolean, answer: string) {
    setAnswers(prev => {
      // Only report the first answer for each item (avoid overwriting a recorded
      // result when the student navigates back to a previously answered step).
      if (!(index in prev)) {
        const itemId = exercises[index]?.id;
        if (itemId) onItemResult?.(itemId, correct);
      }
      const next = { ...prev, [index]: answer };
      if (answersKey) try { sessionStorage.setItem(answersKey, JSON.stringify(next)); } catch {}
      return next;
    });
    if (correct) setAvanzarDesde(index);
  }

  /**
   * Pasar sola de pregunta al acertar.
   *
   * Al fallar NO: ahí hay algo que leer —cuál era la buena y por qué la tuya no—
   * y llevárselo antes de tiempo es perder justo el instante en el que se
   * aprende. Al acertar no hay nada que leer.
   *
   * En la última no se avanza: ahí toca ver el resultado del bloque.
   *
   * El temporizador vive en un efecto y no dentro de `handleAnswer` a propósito:
   * desde el manejador, `index` y `answers` serían todavía los de antes de
   * contestar y se guardaría el intento con la cuenta mal.
   */
  useEffect(() => {
    if (avanzarDesde === null || avanzarDesde !== index || isLast) return;
    const t = setTimeout(() => {
      setAvanzarDesde(null);
      go(index + 1);
    }, AUTO_AVANCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avanzarDesde, index, isLast]);

  function go(target: number) {
    // Atrás: siempre permitido (incluyendo a paso anterior)
    if (target < 0) { if (hasBackStep) onBack(); return; }
    // Adelante libre (skip permitido — se endurecerá más adelante)
    if (target >= exercises.length) {
      // Al pasar al siguiente step, guardamos el ÚLTIMO índice del step que
      // dejamos para que al volver atrás aterrice ahí (no en el primero).
      // Así se comporta como "pasar página atrás en un libro".
      if (indexKey && exercises.length > 0) {
        try { sessionStorage.setItem(indexKey, String(exercises.length - 1)); } catch {}
      }
      onDone();
      return;
    }
    if (target === index) return;
    // No saltar hacia DELANTE sin responder: solo se puede ir a ejercicios ya
    // respondidos o al siguiente pendiente (no "volar" hasta el final).
    const firstUnanswered = exercises.findIndex((_, i) => !(i in answers));
    const maxForward = firstUnanswered === -1 ? exercises.length - 1 : firstUnanswered;
    if (target > index && target > maxForward) return;
    setIndex(target);
    setExKey(k => k + 1);
  }

  // La flecha "siguiente" solo avanza si el ejercicio actual está respondido.
  function handleNext() { if (!(index in answers)) return; go(index + 1); }
  function handlePrev() { go(index - 1); }

  const currentAnswered = index in answers;

  return (
    <div className="space-y-4">
      {/* Single progress strip: segmented bar (color por estado) + % + score */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 flex-1">
            {exercises.map((ex, i) => {
              const a = answers[i];
              let segCls = 'bg-[#DDE6F5] hover:bg-[#9CA3AF]/40';
              if (a !== undefined) {
                const correct = a.trim().toLowerCase() === (ex.correctAnswer ?? '').trim().toLowerCase();
                segCls = correct
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-red-400 hover:bg-red-500';
              }
              if (i === index && a === undefined) {
                segCls = 'hover:opacity-80';
              }
              const isCurrent = i === index;
              return (
                <button
                  key={i}
                  onClick={() => go(i)}
                  aria-label={`Ejercicio ${i + 1}`}
                  className={`h-2.5 flex-1 rounded-full transition-all duration-200 ${segCls} ${isCurrent ? 'ring-2 ring-[#1D0084] ring-offset-1' : ''} ${isCurrent && a === undefined ? 'progress-fill' : ''}`}
                />
              );
            })}
          </div>
          <span className="text-[13px] font-bold text-[#025dc7] bg-[#EEF4FF] px-2.5 py-0.5 rounded-full shrink-0 tabular-nums">
            {Math.min(100, Math.round((answeredCount / Math.max(exercises.length, 1)) * 100))}%
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#9CA3AF] font-medium tabular-nums">
            {index + 1} / {exercises.length}
          </span>
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#16a34a] bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {score}
          </div>
        </div>
      </div>

      {/* Exercise content */}
      <div className="relative md:px-[84px]">
        <button
          onClick={canGoBack ? handlePrev : undefined}
          aria-label="Anterior"
          className={`hidden md:flex absolute left-0 top-5 w-11 h-11 items-center justify-center rounded-2xl transition-all duration-200 ${
            canGoBack ? 'text-[#9CA3AF] hover:bg-[#F0F5FF] hover:text-[#025dc7] cursor-pointer' : 'text-[#E8ECF4] pointer-events-none'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div key={exKey}>
          <ExerciseStep exercise={exercises[index]} onAnswer={handleAnswer} initialAnswer={answers[index]} />
        </div>

        <button
          onClick={currentAnswered ? handleNext : undefined}
          aria-label={isLast ? 'Siguiente paso' : 'Siguiente ejercicio'}
          title={currentAnswered ? '' : 'Responde primero'}
          className={`hidden md:flex absolute right-0 top-5 w-11 h-11 items-center justify-center rounded-2xl transition-all duration-300 ${
            currentAnswered
              ? 'bg-[#4da3ff] text-[#1D0084] cursor-pointer hover:bg-[#6cb5ff]'
              : 'bg-[#F0F5FF] text-[#C7D2E8] border border-[#DDE6F5] cursor-not-allowed'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Mobile buttons — always visible */}
      <div className="flex items-stretch gap-2 md:hidden">
        <button
          onClick={handlePrev}
          disabled={!canGoBack}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white text-[#5A6480] text-[13px] font-semibold border border-[#DDE6F5] hover:text-[#025dc7] hover:border-[#1D0084]/30 disabled:opacity-40 transition-colors duration-200 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={currentAnswered ? handleNext : undefined}
          disabled={!currentAnswered}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-[15px] font-semibold transition-colors duration-200 ${
            currentAnswered
              ? 'bg-[#4da3ff] text-[#1D0084] hover:bg-[#6cb5ff]'
              : 'bg-[#F0F5FF] text-[#9CA3AF] border border-[#DDE6F5] cursor-not-allowed'
          }`}
        >
          {currentAnswered ? (isLast ? 'Siguiente paso' : 'Siguiente') : 'Responde primero'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ── Classify step ── */

function ClassifyStep({ groups, items, onDone, onBack }: { groups: ClassifyGroup[]; items: ClassifyItemData[]; onDone: () => void; onBack: () => void }) {
  const queue = useMemo(() => [...items].sort(() => Math.random() - 0.5).slice(0, Math.min(10, items.length)), [items]);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<{ correct: boolean; correctId: string } | null>(null);
  const [score, setScore] = useState(0);
  const current = queue[index];

  function handleGuess(groupId: string) {
    if (result) return;
    const correct = groupId === current.groupId;
    setResult({ correct, correctId: current.groupId });
    if (correct) setScore(s => s + 1);
  }

  function handleNext() {
    if (index + 1 >= queue.length) { onDone(); return; }
    setIndex(i => i + 1);
    setResult(null);
  }

  return (
    <div className="space-y-5">
      {/* Top row: back button (always visible) + score badge */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { if (index > 0) { setIndex(i => i - 1); setResult(null); } else { onBack(); } }}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-[#9CA3AF] hover:text-[#025dc7] transition-colors duration-200"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {index > 0 ? 'Anterior' : 'Paso anterior'}
        </button>
        <div className="flex items-center gap-1 text-[13px] font-bold text-[#16a34a] bg-green-50 border border-green-200 px-3 py-1 rounded-full">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {score}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border border-[#DDE6F5] bg-white py-10 px-6 gap-3 text-center">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest">¿A qué grupo pertenece? · {index + 1}/{queue.length}</p>
        <p className="text-[30px] font-bold text-gray-900" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}>
          {current.dutch}
        </p>
        <button onClick={() => speakDutch(current.dutch)} className="flex items-center gap-1.5 text-[12px] font-medium text-[#025dc7] hover:text-[#025dc7] transition-colors duration-200">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          Escuchar
        </button>
      </div>

      <div className={`grid gap-3 ${groups.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {groups.map(group => (
          <button
            key={group.id}
            onClick={() => handleGuess(group.id)}
            disabled={!!result}
            className={`py-5 rounded-lg text-[15px] font-bold border transition-all duration-200 ${
              result
                ? result.correctId === group.id
                  ? 'bg-green-50 border-green-400 text-green-800'
                  : 'bg-[#F8F9FA] border-[#DDE6F5] text-[#9CA3AF]'
                : 'bg-[#F0F5FF] border-[#DDE6F5] text-gray-900 hover:border-[#025dc7]/40 hover:bg-[#e8f0ff]'
            }`}
          >
            {group.label}
          </button>
        ))}
      </div>

      {result && (
        <div className={`rounded-lg px-4 py-3 text-[14px] font-medium ${result.correct ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {result.correct ? '✓ ¡Correcto!' : `✗ Era: "${groups.find(g => g.id === result!.correctId)?.label}"`}
        </div>
      )}

      {result && (
        <button onClick={handleNext} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[15px] font-semibold hover:bg-[#6cb5ff] transition-colors duration-200">
          {index + 1 < queue.length ? 'Siguiente' : 'Siguiente paso'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ── Main vocab practice section ── */

function VocabPracticeSection({
  vocabItems,
  phraseItems,
  practiceExercises: allExercises,
  onComplete,
  onItemResult,
  inCourse,
  cacheKey,
  reviewOnly,
}: {
  vocabItems: VocabularyItem[];
  phraseItems: PhraseItem[];
  practiceExercises: ExerciseItem[];
  onComplete: () => void;
  onItemResult?: (itemId: string, correct: boolean) => void;
  inCourse?: boolean;
  /** Clave `${lessonId}-vocabulary` para guardar la nota real de la sección. */
  cacheKey?: string;
  /** Modo repaso: solo se ejecutan los ejercicios fallados en el último intento. */
  reviewOnly?: boolean;
}) {
  const session = useLHSession() as any;
  const accessToken: string | undefined = session?.data?.tokens?.access_token;
  const [lastAttempt, setLastAttempt] = useState<LastAttempt | null>(null);
  useEffect(() => {
    if (!cacheKey) return;
    let active = true;
    getLastAttempt(cacheKey, accessToken).then((a) => { if (active) setLastAttempt(a); });
    return () => { active = false; };
  }, [cacheKey, accessToken]);

  // Modo repaso efectivo: hay fallos guardados que repetir.
  const inReview = Boolean(reviewOnly && lastAttempt?.failedLabels?.length);
  const practiceExercises = useMemo(() => {
    if (!inReview) return allExercises;
    const failedSet = new Set(lastAttempt!.failedLabels);
    const filtered = allExercises.filter((e) => failedSet.has(e.prompt));
    return filtered.length > 0 ? filtered : allExercises;
  }, [allExercises, inReview, lastAttempt]);

  // Resultado (primer intento de esta visita) por ejercicio → nota + fallos.
  const resultsRef = useRef<Map<string, boolean>>(new Map());
  function handleItemResultLocal(itemId: string, correct: boolean) {
    if (!resultsRef.current.has(itemId)) resultsRef.current.set(itemId, correct);
    onItemResult?.(itemId, correct);
  }

  const steps = useMemo(
    // En repaso saltamos las tarjetas de contenido (palabras/frases): directo a los fallos.
    () => buildVPSteps(inReview ? [] : vocabItems, inReview ? [] : phraseItems, practiceExercises),
    [vocabItems, phraseItems, practiceExercises, inReview]
  );
  const stepCacheKey = typeof window !== 'undefined' ? `vp-step-${window.location.pathname}` : null;
  const [stepIndex, setStepIndex] = useState(() => {
    if (!stepCacheKey) return 0;
    try {
      const n = parseInt(sessionStorage.getItem(stepCacheKey) ?? '0', 10);
      return Number.isFinite(n) && n < steps.length ? n : 0;
    } catch { return 0; }
  });
  const [allDone, setAllDone] = useState(false);
  const [runnerKey, setRunnerKey] = useState(0);
  const [subProgress, setSubProgress] = useState<{ done: number; total: number } | undefined>();

  function handleStepBack() {
    if (stepIndex > 0) {
      const next = stepIndex - 1;
      setStepIndex(next);
      if (stepCacheKey) try { sessionStorage.setItem(stepCacheKey, String(next)); } catch {}
      setSubProgress(undefined);
      setRunnerKey(k => k + 1);
    }
  }

  function handleStepDone() {
    if (stepIndex + 1 >= steps.length) {
      if (stepCacheKey) try { sessionStorage.removeItem(stepCacheKey); } catch {}
      // Nota REAL de la sección: aciertos/total + prompts fallados → el
      // progreso puede decir qué parte repasar y con qué porcentaje.
      if (cacheKey) {
        const answered = practiceExercises.filter((e) => resultsRef.current.has(e.id));
        if (answered.length > 0) {
          const failed = answered
            .filter((e) => resultsRef.current.get(e.id) === false)
            .map((e) => e.prompt);
          if (inReview && lastAttempt) {
            // Repaso: los ahora acertados salen de la lista y suman a la nota
            // original; los no repasados se conservan.
            const wrongNow = new Set(failed);
            const stillFailed = lastAttempt.failedLabels.filter((l) =>
              practiceExercises.some((e) => e.prompt === l) ? wrongNow.has(l) : true
            );
            const resolved = lastAttempt.failedLabels.length - stillFailed.length;
            saveLastAttempt(cacheKey, {
              score: Math.min(lastAttempt.total, lastAttempt.score + resolved),
              total: lastAttempt.total,
              failedLabels: stillFailed,
            }, accessToken);
          } else {
            saveLastAttempt(cacheKey, {
              score: answered.length - failed.length,
              total: answered.length,
              failedLabels: failed,
            }, accessToken);
          }
        } else {
          // Lección sin ejercicios de práctica: marcador simple de "hecha".
          saveLastAttempt(cacheKey, { score: 0, total: 0, failedLabels: [] }, accessToken);
        }
      }
      setAllDone(true);
    } else {
      // Avance a medias: se deja constancia de que HOY practicó esta sección
      // (si no, quien no llega al final no aparece en "Esta semana"). Marcado
      // como parcial: ni cuenta como sección hecha ni pone nota.
      if (cacheKey && !inReview) {
        const answered = practiceExercises.filter((e) => resultsRef.current.has(e.id));
        const failed = answered
          .filter((e) => resultsRef.current.get(e.id) === false)
          .map((e) => e.prompt);
        saveLastAttempt(
          cacheKey,
          answered.length > 0
            ? {
                score: answered.length - failed.length,
                total: practiceExercises.length,
                failedLabels: failed,
                partial: true,
              }
            : { score: 0, total: 0, failedLabels: [], partial: true },
          accessToken,
        );
      }
      const next = stepIndex + 1;
      setStepIndex(next);
      if (stepCacheKey) try { sessionStorage.setItem(stepCacheKey, String(next)); } catch {}
      setRunnerKey(k => k + 1);
    }
  }

  function handleReset(confirm = true) {
    if (confirm && typeof window !== 'undefined' && !window.confirm('¿Borrar todas tus respuestas y empezar de cero?')) return;
    // Borra TODO el cache de esta lección — respuestas, índices, step actual
    try {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && (k.startsWith('vp-ex-') || k.startsWith('vp-step-'))) keys.push(k);
      }
      keys.forEach(k => sessionStorage.removeItem(k));
    } catch {}
    setAllDone(false);
    setStepIndex(0);
    setSubProgress(undefined);
    setRunnerKey(k => k + 1);
  }

  if (allDone) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center text-center rounded-2xl py-12 px-6 gap-3" style={{ background: 'linear-gradient(135deg, #1D0084 0%, #025dc7 100%)' }}>
          <span className="text-5xl">⭐</span>
          <p className="text-white font-bold text-[22px]" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}>¡Práctica completada!</p>
          <p className="text-white/60 text-[14px]">Has repasado todo el vocabulario</p>
        </div>
        <button
          onClick={() => handleReset(false)}
          className="w-full py-4 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[16px] font-bold hover:bg-[#6cb5ff] transition-colors duration-200 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Hacer la práctica de nuevo
        </button>
        {inCourse ? (
          <p className="text-center text-[13px] text-[#5A6480]">Pulsa «Siguiente» abajo para continuar.</p>
        ) : (
          <button
            onClick={onComplete}
            className="w-full py-3 rounded-lg bg-white text-[#5A6480] text-[14px] font-semibold border border-[#DDE6F5] hover:bg-[#F0F5FF] hover:text-[#025dc7] transition-colors duration-200"
          >
            Salir al menú de la lección
          </button>
        )}
      </div>
    );
  }

  const step = steps[stepIndex];

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <StepBar steps={steps} current={stepIndex} />
        <button
          onClick={() => handleReset(true)}
          title="Reiniciar todas las respuestas"
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#9CA3AF] hover:text-[#025dc7] hover:bg-[#F0F5FF] transition-colors duration-200 -mt-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reiniciar
        </button>
      </div>

      {step.type === 'words' && (
        <WordsStep key={runnerKey} items={vocabItems} onDone={handleStepDone}
          onSubProgress={(done, total) => setSubProgress({ done, total })} />
      )}
      {step.type === 'phrases' && (
        <PhrasesStep key={runnerKey} items={step.items} onDone={handleStepDone} onBack={handleStepBack}
          onSubProgress={(done, total) => setSubProgress({ done, total })} />
      )}
      {(step.type === 'listen' || step.type === 'translate' || step.type === 'truefalse' || step.type === 'test' || step.type === 'complete' || step.type === 'order' || step.type === 'write' || step.type === 'scramble' || step.type === 'pairs' || step.type === 'emoji' || step.type === 'intruder' || step.type === 'letterdash' || step.type === 'memory') && (
        <ExerciseRunner
          key={runnerKey}
          exercises={step.exercises}
          onDone={handleStepDone}
          onBack={handleStepBack}
          hasBackStep={stepIndex > 0}
          onSubProgress={(done, total) => setSubProgress({ done, total })}
          cacheKey={step.type}
          onItemResult={handleItemResultLocal}
        />
      )}
      {step.type === 'classify' && (
        <ClassifyStep key={runnerKey} groups={step.groups} items={step.items} onDone={handleStepDone} onBack={handleStepBack} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   FLASHCARD SECTION
───────────────────────────────────────────────────────────────────────────── */

function FlashcardSection({
  items,
  onComplete,
}: {
  items: VocabularyItem[];
  onComplete: () => void;
}) {
  const [mode, setMode] = useState<'nl-es' | 'es-nl'>('nl-es');
  const [queue, setQueue] = useState<VocabularyItem[]>(() =>
    [...items].sort(() => Math.random() - 0.5)
  );
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  const [done, setDone] = useState(false);
  // Prevent showing next card content before flip-back animation completes
  const [isAdvancing, setIsAdvancing] = useState(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current); };
  }, []);

  const card = queue[index];
  const front = mode === 'nl-es'
    ? joinDutch(card?.article, card?.dutch)
    : card?.spanish ?? '';
  const back = mode === 'nl-es' ? card?.spanish ?? '' : joinDutch(card?.article, card?.dutch);

  function handleKnown() {
    setKnownCount(k => k + 1);
    advance();
  }

  function handleRepeat() {
    if (isAdvancing) return;
    setIsAdvancing(true);
    setFlipped(false);
    // Wait for flip-back animation (0.45s) before moving the card to end of queue
    advanceTimerRef.current = setTimeout(() => {
      setQueue(q => {
        const next = [...q];
        const [current] = next.splice(index, 1);
        next.push(current);
        return next;
      });
      setIsAdvancing(false);
    }, 460);
  }

  function advance() {
    if (isAdvancing) return;
    setIsAdvancing(true);
    setFlipped(false);
    // Wait for flip-back animation (0.45s) before showing the next card
    advanceTimerRef.current = setTimeout(() => {
      setIsAdvancing(false);
      if (index + 1 >= queue.length) {
        setDone(true);
      } else {
        setIndex(i => i + 1);
      }
    }, 460);
  }

  function handleShuffle() {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    setIsAdvancing(false);
    setQueue(q => [...q].sort(() => Math.random() - 0.5));
    setIndex(0);
    setFlipped(false);
    setDone(false);
  }

  function handleRestart() {
    setQueue([...items].sort(() => Math.random() - 0.5));
    setIndex(0);
    setFlipped(false);
    setKnownCount(0);
    setDone(false);
  }

  if (done) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center rounded-2xl bg-[#1D0084] py-10 px-6 text-center space-y-3">
          <span className="text-5xl">🎉</span>
          <p className="text-white font-bold text-[20px]" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}>
            ¡Ronda completada!
          </p>
          <p className="text-white/60 text-[14px]">{knownCount} de {items.length} palabras dominadas</p>
        </div>
        <button onClick={handleRestart} className="w-full py-3.5 rounded-lg bg-[#F0F5FF] text-gray-900 text-[15px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200">
          Repetir flashcards 🔄
        </button>
        <button onClick={onComplete} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg bg-[#F0F5FF] text-gray-900 text-[15px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          Volver a la lección
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <GradientBar pct={Math.round((index / queue.length) * 100)} />

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex rounded-lg border border-[#DDE6F5] overflow-hidden">
          <button
            onClick={() => { setMode('nl-es'); setFlipped(false); }}
            className={`px-3 py-2 text-[12px] font-semibold transition-colors duration-200 ${mode === 'nl-es' ? 'bg-[#4da3ff] text-[#1D0084]' : 'bg-white text-[#9CA3AF] hover:text-[#025dc7]'}`}
          >
            NL → ES
          </button>
          <button
            onClick={() => { setMode('es-nl'); setFlipped(false); }}
            className={`px-3 py-2 text-[12px] font-semibold transition-colors duration-200 ${mode === 'es-nl' ? 'bg-[#4da3ff] text-[#1D0084]' : 'bg-white text-[#9CA3AF] hover:text-[#025dc7]'}`}
          >
            ES → NL
          </button>
        </div>
        <button onClick={handleShuffle} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#DDE6F5] text-[12px] font-semibold text-[#5A6480] hover:text-[#025dc7] hover:bg-[#F0F5FF] transition-colors duration-200">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Barajar
        </button>
        <span className="text-[12px] font-semibold text-[#1D0084] bg-[#4da3ff] px-2.5 py-1 rounded-full">{knownCount} ✓</span>
      </div>

      {/* Card */}
      {/* El giro va en SU PROPIA capa de dibujo.
          Sin esto, la animación 3D obliga al navegador a repintar la capa
          entera donde vive la tarjeta, y al repintarla cambia el suavizado
          del texto: las líneas del párrafo de abajo "bailan" un poco aunque
          no se mueva ni un píxel de la maquetación.
          `isolation` corta la capa aquí y `willChange` le dice al navegador
          que promocione el elemento que gira antes de empezar, no a mitad. */}
      <div
        onClick={() => setFlipped(f => !f)}
        className="w-full max-w-sm mx-auto h-[180px] cursor-pointer"
        style={{ perspective: '1000px', isolation: 'isolate' }}
      >
        <div
          style={{
            transition: 'transform 0.45s cubic-bezier(0.4,0.2,0.2,1)',
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            willChange: 'transform',
            position: 'relative',
            height: '180px',
          }}
        >
          {/* Front */}
          <div
            className="rounded-2xl border border-[#DDE6F5] bg-white flex flex-col items-center justify-center gap-3 p-8 absolute inset-0"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest">
              {mode === 'nl-es' ? 'Nederlands' : 'Español'}
            </p>
            <p
              className="text-[22px] font-bold text-gray-900 text-center leading-tight"
              style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}
            >
              {front}
            </p>
            {mode === 'nl-es' && (
              <button
                onClick={(e) => { e.stopPropagation(); speakDutch(front); }}
                aria-label="Escuchar pronunciación"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0F5FF] text-[#025dc7] text-[12px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4.03v8.06A4.5 4.5 0 0016.5 12z" />
                </svg>
                Escuchar
              </button>
            )}
            <p className="text-[11px] text-[#9CA3AF]">Toca la tarjeta para girarla</p>
          </div>
          {/* Back */}
          <div
            className="rounded-2xl border border-[#025dc7]/30 bg-[#F8FAFF] flex flex-col items-center justify-center gap-3 p-8 absolute inset-0"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest">
              {mode === 'nl-es' ? 'Español' : 'Nederlands'}
            </p>
            <p
              className="text-[22px] font-bold text-gray-900 text-center leading-tight"
              style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}
            >
              {back}
            </p>
            {mode === 'es-nl' && (
              <button
                onClick={(e) => { e.stopPropagation(); speakDutch(back); }}
                aria-label="Escuchar pronunciación"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0F5FF] text-[#025dc7] text-[12px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4.03v8.06A4.5 4.5 0 0016.5 12z" />
                </svg>
                Escuchar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Actions
          El hueco se reserva SIEMPRE (min-h): antes esta zona pasaba de una
          línea de texto a dos botones al voltear la tarjeta, y todo lo de
          abajo —incluidos Anterior y Siguiente— daba un salto. */}
      <div className="min-h-[52px] flex items-center">
      {flipped && !isAdvancing ? (
        <div className="grid grid-cols-2 gap-3 w-full">
          <button
            onClick={handleRepeat}
            disabled={isAdvancing}
            className="py-3.5 rounded-lg bg-[#FFF5F5] border border-red-100 text-red-600 text-[15px] font-semibold hover:bg-red-50 transition-colors duration-200 disabled:opacity-40"
          >
            🔄 Repasar
          </button>
          <button
            onClick={handleKnown}
            disabled={isAdvancing}
            className="py-3.5 rounded-lg bg-[#F0FFF4] border border-green-200 text-green-700 text-[15px] font-semibold hover:bg-green-50 transition-colors duration-200 disabled:opacity-40"
          >
            ✓ Ya la sé
          </button>
        </div>
      ) : !isAdvancing ? (
        <p className="w-full text-center text-[13px] text-[#9CA3AF]">
          Primero mira la tarjeta, luego decide
        </p>
      ) : null}
      </div>

    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   EXERCISE COMPONENTS (shared between Practice and Lezen)
───────────────────────────────────────────────────────────────────────────── */

function MultipleChoiceExercise({
  exercise,
  onAnswer,
  initialAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
  initialAnswer?: string;
}) {
  const [selected, setSelected] = useState<string | null>(initialAnswer ?? null);
  const isAnswered = selected !== null;

  // Shuffle options once per exercise (stable across re-renders)
  const shuffledOptions = useMemo(() => {
    if (!exercise.options?.length) return exercise.options ?? [];
    const arr = [...exercise.options];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(opt: string) {
    if (isAnswered) return;
    setSelected(opt);
    onAnswer(opt === exercise.correctAnswer, opt);
  }

  function optionStyle(opt: string): string {
    const base =
      'w-full text-left px-4 py-3.5 rounded-lg text-[15px] font-medium transition-all duration-200 border ';
    if (!isAnswered)
      return base + 'bg-[#F0F5FF] border-[#DDE6F5] text-gray-900 hover:border-[#025dc7]/40 hover:bg-[#e8f0ff] active:scale-[0.98]';
    if (opt === exercise.correctAnswer) return base + 'bg-green-50 border-green-400 text-green-800';
    if (opt === selected) return base + 'bg-red-50 border-red-400 text-red-700';
    return base + 'bg-[#F8F9FA] border-[#DDE6F5] text-[#9CA3AF]';
  }

  const letters = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white">
        <p className="text-[17px] font-semibold text-gray-900 leading-snug">{exercise.prompt}</p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {shuffledOptions.map((opt, idx) => (
          <button key={opt} className={optionStyle(opt)} onClick={() => handleSelect(opt)}>
            <span className="flex items-center gap-3">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0 transition-all duration-200 ${
                !isAnswered ? 'bg-white/70 text-gray-900' :
                opt === exercise.correctAnswer ? 'bg-green-500 text-white' :
                opt === selected ? 'bg-red-400 text-white' : 'bg-[#E5E7EB] text-[#9CA3AF]'
              }`}>
                {letters[idx] ?? idx + 1}
              </span>
              <span className="flex-1 text-left">{opt}</span>
              {isAnswered && opt === exercise.correctAnswer && (
                <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {isAnswered && opt === selected && opt !== exercise.correctAnswer && (
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </span>
          </button>
        ))}
      </div>
      {isAnswered && (
        <FeedbackBanner
          correct={selected === exercise.correctAnswer}
          correctAnswer={exercise.correctAnswer}
          explanation={exercise.explanation}
          onHear={selected !== exercise.correctAnswer ? () => speakDutch(exercise.correctAnswer) : undefined}
        />
      )}
    </div>
  );
}

function WriteAnswerExercise({
  exercise,
  onAnswer,
  initialAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
  initialAnswer?: string;
}) {
  const [value, setValue] = useState(initialAnswer ?? '');
  const [submitted, setSubmitted] = useState(initialAnswer !== undefined);
  const isCorrect = value.trim().toLowerCase() === exercise.correctAnswer.trim().toLowerCase();

  function handleSubmit() {
    if (!value.trim() || submitted) return;
    setSubmitted(true);
    onAnswer(isCorrect, value.trim());
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white">
        <p className="text-[16px] font-semibold text-gray-900 leading-snug">{exercise.prompt}</p>
        {exercise.hint && (
          <p className="text-[13px] text-[#9CA3AF] mt-2">💡 {exercise.hint}</p>
        )}
      </div>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        disabled={submitted}
        placeholder="Escribe tu respuesta..."
        className="w-full px-4 py-3.5 rounded-lg border border-[#DDE6F5] text-[15px] text-gray-900 bg-white focus:outline-none focus:border-[#025dc7] transition-colors duration-200 disabled:opacity-60"
      />
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="w-full py-3.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[15px] font-semibold hover:bg-[#6cb5ff] transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none"
        >
          Comprobar
        </button>
      )}
      {submitted && (
        <FeedbackBanner
          correct={isCorrect}
          correctAnswer={exercise.correctAnswer}
          onHear={!isCorrect ? () => speakDutch(exercise.correctAnswer) : undefined}
        />
      )}
    </div>
  );
}

function FillBlankExercise({
  exercise,
  onAnswer,
  initialAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
  initialAnswer?: string;
}) {
  const hasOptions = (exercise.options?.length ?? 0) > 0;
  const parts = exercise.prompt.split('___');

  // ── Text-input mode state ──
  const [value, setValue] = useState(initialAnswer ?? '');
  const [submitted, setSubmitted] = useState(initialAnswer !== undefined && initialAnswer !== '');
  const isCorrect = value.trim().toLowerCase() === exercise.correctAnswer.trim().toLowerCase();

  // ── Chip mode state ──
  const [chipSelected, setChipSelected] = useState<string | null>(initialAnswer ?? null);
  const [playingChip, setPlayingChip] = useState<string | null>(null);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isChipAnswered = chipSelected !== null;
  const isChipCorrect = chipSelected?.trim().toLowerCase() === exercise.correctAnswer.trim().toLowerCase();

  const shuffledOptions = useMemo(() => {
    if (!exercise.options?.length) return [];
    const arr = [...exercise.options];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function playChipAudio(opt: string) {
    if (playTimerRef.current) clearTimeout(playTimerRef.current);
    setPlayingChip(opt);
    speakDutch(opt);
    playTimerRef.current = setTimeout(() => setPlayingChip(null), 2200);
  }

  // Dos fases: tap = escucha + rellena el hueco (no envía). "Comprobar" envía.
  const [chipSubmitted, setChipSubmitted] = useState(initialAnswer !== undefined && initialAnswer !== null);
  function handleChipTap(opt: string) {
    playChipAudio(opt);
    if (chipSubmitted) return; // tras comprobar, re-tap solo reproduce audio
    setChipSelected(opt);
  }
  function handleChipSubmit() {
    if (!chipSelected || chipSubmitted) return;
    setChipSubmitted(true);
    const correct = chipSelected.trim().toLowerCase() === exercise.correctAnswer.trim().toLowerCase();
    onAnswer(correct, chipSelected);
  }

  function handleTextSubmit() {
    if (!value.trim() || submitted) return;
    setSubmitted(true);
    onAnswer(isCorrect, value.trim());
  }

  // ── Chip variant ──
  if (hasOptions) {
    function chipStyle(opt: string): string {
      const base = 'flex items-center gap-2 px-4 py-3 rounded-lg border text-[15px] font-semibold transition-all duration-200 ';
      if (!chipSubmitted) {
        // Mientras no se ha enviado: chip seleccionado destaca, playing anima
        if (opt === chipSelected) {
          return base + 'bg-[#4da3ff] border-[#4da3ff] text-[#1D0084]';
        }
        if (opt === playingChip) {
          return base + 'bg-[#1D0084]/10 border-[#1D0084]/40 text-gray-900 scale-[0.97]';
        }
        return base + 'bg-[#F0F5FF] border-[#DDE6F5] text-gray-900 hover:border-[#025dc7]/40 hover:bg-[#e8f0ff] active:scale-[0.97]';
      }
      // Después de comprobar: verde la correcta, rojo la elegida si era incorrecta
      if (opt === exercise.correctAnswer) return base + 'bg-green-50 border-green-400 text-green-800';
      if (opt === chipSelected) return base + 'bg-red-50 border-red-400 text-red-700';
      return base + 'bg-[#F8F9FA] border-[#DDE6F5] text-[#9CA3AF]';
    }

    return (
      <div className="space-y-4">
        {/* Sentence with blank */}
        <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white">
          <p className="text-[16px] font-semibold text-gray-900 leading-snug">
            {parts[0]}
            <span className={`fill-blank-slot ${
              chipSubmitted
                ? isChipCorrect ? 'is-correct' : 'is-wrong'
                : chipSelected ? 'is-filled' : 'is-empty'
            }`}>
              {chipSelected ?? '\u00A0'}
            </span>
            {parts[1] ?? ''}
          </p>
          {exercise.hint && <p className="text-[13px] text-[#9CA3AF] mt-2">💡 {exercise.hint}</p>}
        </div>

        {/* Option chips — tap = escucha audio + rellena el hueco (no envía) */}
        <div className="grid grid-cols-2 gap-2">
          {shuffledOptions.map(opt => (
            <button key={opt} onClick={() => handleChipTap(opt)} className={chipStyle(opt)}>
              <svg className={`w-4 h-4 shrink-0 transition-opacity duration-150 ${opt === playingChip ? 'opacity-100' : 'opacity-50'}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="truncate">{opt}</span>
              {chipSubmitted && opt === exercise.correctAnswer && (
                <svg className="w-4 h-4 shrink-0 text-green-600 ml-auto" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Botón Comprobar: aparece cuando hay selección y aún no se ha enviado */}
        {!chipSubmitted && (
          <button
            onClick={handleChipSubmit}
            disabled={!chipSelected}
            className="w-full py-3.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[15px] font-semibold hover:bg-[#6cb5ff] transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none"
          >
            Comprobar
          </button>
        )}

        {chipSubmitted && (
          <FeedbackBanner
            correct={isChipCorrect}
            correctAnswer={exercise.correctAnswer}
            explanation={exercise.explanation}
          />
        )}
      </div>
    );
  }

  // ── Text-input variant (when no options) ──
  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white">
        <p className="text-[16px] font-semibold text-gray-900 leading-snug flex flex-wrap items-center gap-1">
          {parts[0]}
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTextSubmit()}
            disabled={submitted}
            placeholder="___"
            className={`inline-block w-28 px-2 py-0.5 rounded-lg border text-[15px] font-semibold text-center focus:outline-none transition-colors duration-200 disabled:opacity-70 ${
              submitted
                ? isCorrect
                  ? 'bg-green-50 border-green-400 text-green-800'
                  : 'bg-red-50 border-red-400 text-red-700'
                : 'bg-white border-[#025dc7] text-gray-900 focus:border-[#1D0084]'
            }`}
          />
          {parts[1] ?? ''}
        </p>
        {exercise.hint && (
          <p className="text-[13px] text-[#9CA3AF] mt-2">💡 {exercise.hint}</p>
        )}
      </div>

      {!submitted && (
        <button
          onClick={handleTextSubmit}
          disabled={!value.trim()}
          className="w-full py-3.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[15px] font-semibold hover:bg-[#6cb5ff] transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none"
        >
          Comprobar
        </button>
      )}
      {submitted && (
        <FeedbackBanner
          correct={isCorrect}
          correctAnswer={exercise.correctAnswer}
          explanation={exercise.explanation}
          onHear={!isCorrect ? () => speakDutch(exercise.correctAnswer) : undefined}
        />
      )}
    </div>
  );
}

function ListenAndChooseExercise({
  exercise,
  onAnswer,
  initialAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
  initialAnswer?: string;
}) {
  const [selected, setSelected] = useState<string | null>(initialAnswer ?? null);
  const isAnswered = selected !== null;
  // Extract Dutch word in quotes for TTS, but DON'T show it in the prompt
  const match = exercise.prompt.match(/"([^"]+)"/);
  const dutchText = match ? match[1] : exercise.prompt;
  const visiblePrompt = match
    ? exercise.prompt.replace(/\s*[:：]?\s*"[^"]+"\s*\.?\s*$/, '').trim() || 'Escucha y elige la respuesta correcta'
    : exercise.prompt;

  // Shuffle options once per exercise
  const shuffledOptions = useMemo(() => {
    if (!exercise.options?.length) return exercise.options ?? [];
    const arr = [...exercise.options];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(opt: string) {
    if (isAnswered) return;
    setSelected(opt);
    onAnswer(opt === exercise.correctAnswer, opt);
  }

  function optionStyle(opt: string): string {
    const base =
      'w-full text-left px-4 py-3.5 rounded-lg text-[15px] font-medium transition-all duration-200 border ';
    if (!isAnswered)
      return base + 'bg-[#F0F5FF] border-[#DDE6F5] text-gray-900 hover:border-[#025dc7]/40 hover:bg-[#e8f0ff] active:scale-[0.98]';
    if (opt === exercise.correctAnswer) return base + 'bg-green-50 border-green-400 text-green-800';
    if (opt === selected) return base + 'bg-red-50 border-red-400 text-red-700';
    return base + 'bg-[#F8F9FA] border-[#DDE6F5] text-[#9CA3AF]';
  }

  const letters = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white space-y-4">
        <div>
          <p className="text-[17px] font-semibold text-gray-900 leading-snug">{visiblePrompt}</p>
        </div>
        {exercise.audio?.url ? (
          <AudioPlayer src={exercise.audio.url} compact />
        ) : (
          <button
            onClick={() => speakDutch(dutchText)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[13px] font-semibold hover:bg-[#6cb5ff] transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            Escuchar
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {shuffledOptions.map((opt, idx) => (
          <button key={opt} className={optionStyle(opt)} onClick={() => handleSelect(opt)}>
            <span className="flex items-center gap-3">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0 transition-all duration-200 ${
                !isAnswered ? 'bg-white/70 text-gray-900' :
                opt === exercise.correctAnswer ? 'bg-green-500 text-white' :
                opt === selected ? 'bg-red-400 text-white' : 'bg-[#E5E7EB] text-[#9CA3AF]'
              }`}>
                {letters[idx] ?? idx + 1}
              </span>
              <span className="flex-1 text-left">{opt}</span>
              {isAnswered && opt === exercise.correctAnswer && (
                <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {isAnswered && opt === selected && opt !== exercise.correctAnswer && (
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </span>
          </button>
        ))}
      </div>
      {isAnswered && (
        <FeedbackBanner
          correct={selected === exercise.correctAnswer}
          correctAnswer={exercise.correctAnswer}
          explanation={exercise.explanation}
          onHear={selected !== exercise.correctAnswer ? () => speakDutch(exercise.correctAnswer) : undefined}
        />
      )}
    </div>
  );
}

/**
 * Escuchar y tocar el dibujo.
 *
 * Suena una palabra en neerlandés y el alumno toca la imagen. **No hay texto
 * en ningún sitio hasta que contesta**: ni la palabra neerlandesa ni la
 * traducción. Esa es toda la gracia — obliga a ir del sonido al significado
 * directamente, sin pasar por el español, que es lo que hace falta para
 * entender a alguien en una tienda.
 *
 * Suena solo al entrar y hay un botón grande para repetirlo. Lo de sonar solo
 * puede bloquearlo el navegador si no ha habido ningún clic todavía, y por eso
 * el botón de repetir está siempre visible: si el autoplay no sale, el
 * ejercicio se sigue pudiendo hacer.
 */
function ListenChooseImageExercise({
  exercise,
  onAnswer,
  initialAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
  initialAnswer?: string;
}) {
  const [selected, setSelected] = useState<string | null>(initialAnswer ?? null);
  const [sonando, setSonando] = useState(false);
  const isAnswered = selected !== null;

  // La palabra que suena. `promptNl` es el sitio canónico; si falta, se cae al
  // enunciado, que en el peor caso hace que suene algo en vez de nada.
  const palabra = exercise.promptNl || exercise.correctAnswer || exercise.prompt;

  const opciones = exercise.options ?? [];
  const dibujos = exercise.optionImages ?? [];

  // Se barajan una vez por ejercicio, arrastrando el dibujo con su palabra.
  const barajadas = useMemo(() => {
    const arr = opciones.map((opt, i) => ({ opt, img: dibujos[i] ?? '❓' }));
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function oir() {
    setSonando(true);
    speakDutch(palabra, () => setSonando(false));
  }

  // Suena solo al aparecer. Si ya estaba contestado (se vuelve a él desde el
  // repaso) no suena: sería ruido.
  useEffect(() => {
    if (initialAnswer) return;
    const t = setTimeout(oir, 250);
    return () => { clearTimeout(t); stopDutch(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  function elegir(opt: string) {
    if (isAnswered) return;
    stopDutch();
    setSonando(false);
    setSelected(opt);
    onAnswer(opt === exercise.correctAnswer, opt);
  }

  function estilo(opt: string): string {
    const base = 'h-[132px] sm:h-[150px] rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all duration-200';
    if (!isAnswered) return `${base} bg-[#F0F5FF] border-[#DDE6F5] hover:border-[#025dc7]/50 hover:bg-[#e8f0ff] active:scale-[0.95]`;
    if (opt === exercise.correctAnswer) return `${base} bg-green-50 border-green-400`;
    if (opt === selected) return `${base} bg-red-50 border-red-400`;
    return `${base} bg-gray-50 border-gray-200 opacity-50`;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white text-center">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-[0.08em] mb-3">
          Escucha y toca el dibujo
        </p>
        <button
          onClick={oir}
          className={`inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-[15px] font-semibold transition-colors ${
            sonando
              ? 'bg-[#025dc7] text-white'
              : 'bg-[#4da3ff] text-[#0a1656] hover:bg-[#6cb5ff]'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M19 5a9 9 0 010 14M5 9v6h4l5 4V5L9 9H5z" />
          </svg>
          {sonando ? 'Sonando…' : 'Repetir'}
        </button>
      </div>

      {/* Ancho tope: sin él, dos columnas en un escritorio ancho dan cajas
          enormes con un emoji diminuto perdido en el centro. */}
      <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto">
        {barajadas.map(({ opt, img }) => (
          <button
            key={opt}
            onClick={() => elegir(opt)}
            disabled={isAnswered}
            className={estilo(opt)}
            aria-label={isAnswered ? opt : 'Opción'}
          >
            <span
              className="text-6xl leading-none"
              style={{ fontFamily: '"Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji"), "Noto Color Emoji", sans-serif' }}
            >
              {img}
            </span>
            {/* La palabra aparece SOLO al contestar. Antes destriparía el
                ejercicio: bastaría con leerla en vez de escucharla. */}
            {isAnswered && (
              <span className="text-[13px] font-semibold text-gray-900 px-2 text-center leading-tight">{opt}</span>
            )}
          </button>
        ))}
      </div>

      {isAnswered && (
        <FeedbackBanner
          correct={selected === exercise.correctAnswer}
          correctAnswer={exercise.correctAnswer}
          explanation={exercise.explanation}
        />
      )}
    </div>
  );
}

/**
 * Spreken — "¿qué dices en esta situación?".
 *
 * Las tres respuestas SOLO suenan: no se enseña el texto hasta contestar. Es
 * la diferencia con `listen_and_choose`, donde se escucha la pregunta y se
 * eligen respuestas escritas. Aquí se entrena reconocer la frase de oído, que
 * es lo que pasa cuando alguien te habla en la calle.
 *
 * Al fallar sí se destapa el texto: en A0-A1 el objetivo es entender, no
 * sufrir, y sin ver la frase no se aprende de la equivocación.
 */
function SprekenChooseExercise({
  exercise,
  onAnswer,
  initialAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
  initialAnswer?: string;
}) {
  // Se elige primero y se comprueba después, como en una prueba de verdad:
  // así se puede cambiar de idea y volver a escuchar antes de decidir.
  const [selected, setSelected] = useState<string | null>(initialAnswer ?? null);
  const [checked, setChecked] = useState(Boolean(initialAnswer));
  const [playing, setPlaying] = useState<string | null>(null);

  const shuffledOptions = useMemo(() => {
    if (!exercise.options?.length) return exercise.options ?? [];
    const arr = [...exercise.options];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function hear(text: string, key: string) {
    setPlaying(key);
    speakDutch(text, () => setPlaying(null));
  }

  function check() {
    if (!selected || checked) return;
    stopDutch();
    setPlaying(null);
    setChecked(true);
    onAnswer(selected === exercise.correctAnswer, selected);
  }

  const letters = ['A', 'B', 'C', 'D', 'E'];

  function rowStyle(opt: string): string {
    const base = 'w-full rounded-xl border-2 transition-all duration-200 ';
    if (!checked) {
      return base + (selected === opt
        ? 'bg-[#EAF3FF] border-[#4da3ff]'
        : 'bg-white border-[#DDE6F5] hover:border-[#4da3ff]/60');
    }
    if (opt === exercise.correctAnswer) return base + 'bg-green-50 border-green-400';
    if (opt === selected) return base + 'bg-red-50 border-red-400';
    return base + 'bg-[#F8F9FA] border-[#E5E7EB] opacity-60';
  }

  return (
    <div className="space-y-4">
      {/* La situación. Con `promptNl` se puede escuchar además de leer: en los
          módulos avanzados el enunciado también se entrena de oído. */}
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white">
        <div className="flex items-start gap-3">
          <p className="flex-1 text-[17px] font-semibold text-gray-900 leading-snug">
            {exercise.promptNl || exercise.prompt}
          </p>
          {exercise.promptNl && (
            <button
              onClick={() => hear(exercise.promptNl!, '__prompt')}
              aria-label="Escuchar la situación"
              className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
                playing === '__prompt'
                  ? 'bg-[#025dc7] text-white'
                  : 'bg-[#F0F5FF] text-[#025dc7] hover:bg-[#e3edff]'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M19 5a9 9 0 010 14M5 9v6h4l5 4V5L9 9H5z" />
              </svg>
            </button>
          )}
        </div>
        {exercise.promptNl && (
          <p className="text-[13px] text-[#5A6480] leading-snug mt-2">{exercise.prompt}</p>
        )}
        {!checked && (
          <p className="text-[13px] text-[#9CA3AF] leading-snug mt-2">
            Escucha las respuestas y elige la tuya. El texto aparece al comprobar.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {shuffledOptions.map((opt, idx) => {
          const isSel = selected === opt;
          return (
            <div key={opt} className={rowStyle(opt)}>
              <div className="flex items-center gap-3 px-3.5 py-3">
                {/* Seleccionar: toda la fila, no un botón aparte. */}
                <button
                  onClick={() => {
                    if (checked) return;
                    setSelected(opt);
                    // Al elegir suena: es lo natural cuando aún no ves el
                    // texto — seleccionas la que quieres volver a oír.
                    hear(opt, opt);
                  }}
                  disabled={checked}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:cursor-default"
                >
                  <span
                    className={`w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                      !checked
                        ? isSel ? 'border-[#025dc7] bg-[#025dc7]' : 'border-[#C6D2E6]'
                        : opt === exercise.correctAnswer ? 'border-green-500 bg-green-500'
                        : isSel ? 'border-red-400 bg-red-400' : 'border-[#DDE6F5]'
                    }`}
                  >
                    {(isSel || (checked && opt === exercise.correctAnswer)) && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="text-[14.5px] leading-snug min-w-0">
                    {checked ? (
                      <span className={
                        opt === exercise.correctAnswer ? 'text-green-800 font-semibold'
                        : isSel ? 'text-red-700' : 'text-[#9CA3AF]'
                      }>
                        {opt}
                      </span>
                    ) : (
                      <span className="text-gray-700">
                        <span className="font-bold text-[#9CA3AF] mr-1.5">{letters[idx] ?? idx + 1}</span>
                        Escucha la respuesta
                      </span>
                    )}
                  </span>
                </button>

                <span className="shrink-0 text-[#C6D2E6]" aria-hidden>→</span>
                <button
                  onClick={() => hear(opt, opt)}
                  aria-label={`Escuchar la respuesta ${letters[idx] ?? idx + 1}`}
                  className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
                    playing === opt
                      ? 'bg-[#025dc7] text-white'
                      : 'bg-[#F0F5FF] text-[#025dc7] hover:bg-[#e3edff]'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M19 5a9 9 0 010 14M5 9v6h4l5 4V5L9 9H5z" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!checked ? (
        <button
          onClick={check}
          disabled={!selected}
          className="w-full py-3.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[15px] font-semibold hover:bg-[#6cb5ff] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Comprobar
        </button>
      ) : (
        <FeedbackBanner
          correct={selected === exercise.correctAnswer}
          correctAnswer={exercise.correctAnswer}
          explanation={exercise.explanation}
          onHear={() => speakDutch(exercise.correctAnswer)}
        />
      )}
    </div>
  );
}

function OrderSentenceExercise({
  exercise,
  onAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
}) {
  const [available, setAvailable] = useState<string[]>(() =>
    [...(exercise.options ?? [])].sort(() => Math.random() - 0.5)
  );
  const [sentence, setSentence] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  // Comparación tolerante: ignora MAYÚSCULAS y espacios extra. (Las fichas
  // pueden incluir "Ik" y "ik"; con orden correcto fallaba por la mayúscula.)
  const norm = (s: string) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const isCorrect = norm(sentence.join(' ')) === norm(exercise.correctAnswer);

  function addWord(word: string, idx: number) {
    if (submitted) return;
    setSentence(s => [...s, word]);
    setAvailable(a => a.filter((_, i) => i !== idx));
  }

  function removeWord(word: string, idx: number) {
    if (submitted) return;
    setAvailable(a => [...a, word]);
    setSentence(s => s.filter((_, i) => i !== idx));
  }

  function handleSubmit() {
    if (!sentence.length || submitted) return;
    setSubmitted(true);
    onAnswer(isCorrect, sentence.join(' '));
  }

  function handleReset() {
    setAvailable([...(exercise.options ?? [])].sort(() => Math.random() - 0.5));
    setSentence([]);
    setSubmitted(false);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white">
        <p className="text-[16px] font-semibold text-gray-900 leading-snug">{exercise.prompt}</p>
      </div>

      <div className="min-h-[52px] rounded-lg border-2 border-dashed border-[#DDE6F5] bg-white p-3 flex flex-wrap gap-2 items-center">
        {sentence.length === 0 && (
          <span className="text-[14px] text-[#9CA3AF]">Toca las palabras para ordenarlas...</span>
        )}
        {sentence.map((word, i) => (
          <button
            key={`${word}-${i}`}
            onClick={() => removeWord(word, i)}
            disabled={submitted}
            className="px-3 py-1.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[14px] font-medium hover:bg-[#6cb5ff] transition-colors duration-200 disabled:opacity-70"
          >
            {word}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {available.map((word, i) => (
          <button
            key={`${word}-${i}`}
            onClick={() => addWord(word, i)}
            disabled={submitted}
            className="px-3 py-1.5 rounded-lg bg-[#F0F5FF] border border-[#DDE6F5] text-gray-900 text-[14px] font-medium hover:border-[#025dc7]/40 hover:bg-[#e8f0ff] transition-colors duration-200 disabled:opacity-50"
          >
            {word}
          </button>
        ))}
      </div>

      {!submitted ? (
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-4 py-3 rounded-lg bg-[#F0F5FF] text-[#5A6480] text-[14px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200"
          >
            Reiniciar
          </button>
          <button
            onClick={handleSubmit}
            disabled={sentence.length === 0}
            className="flex-1 py-3 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[14px] font-semibold hover:bg-[#6cb5ff] transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none"
          >
            Comprobar
          </button>
        </div>
      ) : (
        <FeedbackBanner
          correct={isCorrect}
          correctAnswer={exercise.correctAnswer}
          onHear={!isCorrect ? () => speakDutch(exercise.correctAnswer) : undefined}
        />
      )}
    </div>
  );
}

function WordScrambleExercise({ exercise, onAnswer }: { exercise: ExerciseItem; onAnswer: (correct: boolean, answer: string) => void }) {
  const word = exercise.correctAnswer;
  const [letters, setLetters] = useState<string[]>(() =>
    word.split('').map((ch, i) => `${ch}__${i}`).sort(() => Math.random() - 0.5)
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const formed = selected.map(k => k.split('__')[0]).join('');
  const isCorrect = formed.toLowerCase() === word.toLowerCase();

  function pick(key: string) {
    if (submitted) return;
    setLetters(l => l.filter(k => k !== key));
    setSelected(s => [...s, key]);
  }
  function unpick(key: string) {
    if (submitted) return;
    setSelected(s => s.filter(k => k !== key));
    setLetters(l => [...l, key]);
  }
  function handleSubmit() {
    if (!selected.length || submitted) return;
    setSubmitted(true);
    onAnswer(isCorrect, formed);
  }
  function handleReset() {
    setLetters(word.split('').map((ch, i) => `${ch}__${i}`).sort(() => Math.random() - 0.5));
    setSelected([]);
    setSubmitted(false);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white">
        <p className="text-[17px] font-semibold text-gray-900 leading-snug">{exercise.prompt}</p>
        {exercise.hint && <p className="text-[14px] text-[#025dc7] font-medium mt-1">💡 {exercise.hint}</p>}
      </div>

      {/* Answer area */}
      <div className={`min-h-[52px] rounded-lg border-2 border-dashed p-3 flex flex-wrap gap-2 items-center transition-colors duration-300 ${
        submitted ? (isCorrect ? 'border-green-400 bg-green-50' : 'border-red-300 bg-red-50') : 'border-[#DDE6F5] bg-white'
      }`}>
        {selected.length === 0 && !submitted && (
          <span className="text-[14px] text-[#9CA3AF]">Toca las letras para formar la palabra...</span>
        )}
        {selected.map(key => (
          <button
            key={key}
            onClick={() => unpick(key)}
            disabled={submitted}
            className={`w-9 h-9 rounded-lg text-[16px] font-bold border transition-all duration-200 uppercase ${
              submitted ? (isCorrect ? 'bg-green-500 border-green-500 text-white' : 'bg-red-400 border-red-400 text-white') : 'bg-[#4da3ff] border-[#4da3ff] text-[#1D0084] hover:bg-[#6cb5ff]'
            }`}
          >
            {key.split('__')[0]}
          </button>
        ))}
      </div>

      {/* Available letters */}
      <div className="flex flex-wrap gap-2">
        {letters.map(key => (
          <button
            key={key}
            onClick={() => pick(key)}
            disabled={submitted}
            className="w-9 h-9 rounded-lg text-[16px] font-bold bg-[#F0F5FF] border border-[#DDE6F5] text-gray-900 hover:border-[#025dc7] hover:bg-[#e0eaff] transition-all duration-200 uppercase disabled:opacity-40"
          >
            {key.split('__')[0]}
          </button>
        ))}
      </div>

      {!submitted ? (
        <div className="flex gap-2">
          <button onClick={handleReset} className="px-4 py-3 rounded-lg bg-[#F0F5FF] text-[#5A6480] text-[14px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff]">
            Reiniciar
          </button>
          <button onClick={handleSubmit} disabled={selected.length === 0}
            className="flex-1 py-3 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[14px] font-semibold hover:bg-[#6cb5ff] transition-colors disabled:opacity-40 disabled:pointer-events-none">
            Comprobar
          </button>
        </div>
      ) : (
        <FeedbackBanner
          correct={isCorrect}
          correctAnswer={word}
          onHear={!isCorrect ? () => speakDutch(word) : undefined}
        />
      )}
    </div>
  );
}

function MatchPairsExercise({ exercise, onAnswer }: { exercise: ExerciseItem; onAnswer: (correct: boolean, answer: string) => void }) {
  const pairs = exercise.pairs ?? [];
  const [leftSel, setLeftSel] = useState<string | null>(null);
  const [rightSel, setRightSel] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, string>>({});
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState(0);

  const rightItems = useMemo(() => [...pairs.map(p => p.right)].sort(() => Math.random() - 0.5), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rightSel && leftSel) {
      const correct = pairs.find(p => p.left === leftSel)?.right === rightSel;
      if (correct) {
        const next = { ...matched, [leftSel]: rightSel };
        setMatched(next);
        if (Object.keys(next).length === pairs.length) {
          setDone(true);
          onAnswer(errors === 0, '');
        }
      } else {
        setErrors(e => e + 1);
        setWrongPair([leftSel, rightSel]);
        setTimeout(() => { setWrongPair(null); }, 700);
      }
      setLeftSel(null);
      setRightSel(null);
    }
  }, [leftSel, rightSel]); // eslint-disable-line react-hooks/exhaustive-deps

  function leftStyle(left: string) {
    const isMatched = matched[left] !== undefined;
    const isSelected = leftSel === left;
    const isWrong = wrongPair?.[0] === left;
    if (isMatched) return 'bg-green-50 border-green-400 text-green-800 cursor-default';
    if (isWrong) return 'bg-red-50 border-red-300 text-red-600 animate-pulse';
    if (isSelected) return 'bg-[#4da3ff] border-[#4da3ff] text-[#1D0084]';
    return 'bg-white border-[#DDE6F5] text-gray-900 hover:border-[#025dc7] hover:bg-[#F8FAFF]';
  }
  function rightStyle(right: string) {
    const isMatched = Object.values(matched).includes(right);
    const isSelected = rightSel === right;
    const isWrong = wrongPair?.[1] === right;
    if (isMatched) return 'bg-green-50 border-green-400 text-green-800 cursor-default';
    if (isWrong) return 'bg-red-50 border-red-300 text-red-600 animate-pulse';
    if (isSelected) return 'bg-[#025dc7] border-[#025dc7] text-white';
    return 'bg-white border-[#DDE6F5] text-[#5A6480] hover:border-[#025dc7] hover:bg-[#F8FAFF]';
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white">
        <p className="text-[17px] font-semibold text-gray-900">{exercise.prompt}</p>
        <p className="text-[12px] text-[#9CA3AF] mt-1">{Object.keys(matched).length}/{pairs.length} emparejadas</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          {pairs.map(p => (
            <button
              key={p.left}
              onClick={() => { if (!matched[p.left]) setLeftSel(p.left === leftSel ? null : p.left); }}
              className={`w-full px-3 py-3 rounded-lg border text-[14px] font-semibold text-left transition-all duration-200 ${leftStyle(p.left)}`}
            >
              {p.left}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {rightItems.map(right => (
            <button
              key={right}
              onClick={() => { if (!Object.values(matched).includes(right)) setRightSel(right === rightSel ? null : right); }}
              className={`w-full px-3 py-3 rounded-lg border text-[14px] font-medium text-left transition-all duration-200 ${rightStyle(right)}`}
            >
              {right}
            </button>
          ))}
        </div>
      </div>
      {done && (
        <div className={`rounded-lg px-4 py-3 text-[14px] font-medium ${errors === 0 ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-[#FFFBF2] text-[#8A6A2A] border border-[#EFE3C9]'}`}>
          {errors === 0 ? '✓ ¡Perfecto, sin errores!' : `✓ Completado con ${errors} error${errors > 1 ? 'es' : ''}`}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Test Lab formats: true_false, emoji_choice, odd_one_out, letter_dash, pair_memory
──────────────────────────────────────────────────────────────────────────── */

function TrueFalseExercise({
  exercise,
  onAnswer,
  initialAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
  initialAnswer?: string;
}) {
  const correct = (exercise.correctAnswer ?? '').toLowerCase().trim();
  const init = (initialAnswer ?? '').toLowerCase().trim();
  const [selected, setSelected] = useState<'verdadero' | 'falso' | null>(
    init === 'verdadero' || init === 'falso' ? (init as 'verdadero' | 'falso') : null
  );
  const isAnswered = selected !== null;

  function pick(ans: 'verdadero' | 'falso') {
    if (isAnswered) return;
    setSelected(ans);
    onAnswer(ans === correct, ans);
  }

  function styleFor(ans: 'verdadero' | 'falso') {
    const base = 'py-8 rounded-2xl text-[18px] font-bold border-2 flex flex-col items-center gap-2 transition-all duration-200';
    const isGreen = ans === 'verdadero';
    if (!isAnswered) {
      return `${base} ${isGreen
        ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100 active:scale-[0.98]'
        : 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100 active:scale-[0.98]'}`;
    }
    if (selected === ans && correct === ans) return `${base} bg-green-500 border-green-600 text-white`;
    if (selected === ans && correct !== ans) return `${base} bg-red-500 border-red-600 text-white`;
    if (correct === ans) return `${base} bg-green-100 border-green-400 text-green-800`;
    return `${base} bg-gray-50 border-gray-200 text-gray-400`;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2">¿Es verdadero o falso?</p>
        <p className="text-[20px] font-bold text-gray-900 leading-snug text-center py-2">{exercise.prompt}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => pick('verdadero')} disabled={isAnswered} className={styleFor('verdadero')}>
          <span className="text-3xl">✓</span>
          Verdadero
        </button>
        <button onClick={() => pick('falso')} disabled={isAnswered} className={styleFor('falso')}>
          <span className="text-3xl">✗</span>
          Falso
        </button>
      </div>
      {isAnswered && (
        <div className={`rounded-lg px-4 py-3 text-[14px] font-medium ${
          selected === correct
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {selected === correct
            ? '✓ ¡Correcto!'
            : `✗ La respuesta correcta era: ${correct === 'verdadero' ? 'Verdadero' : 'Falso'}`}
          {exercise.explanation && <p className="mt-1 text-[13px] opacity-80">{exercise.explanation}</p>}
        </div>
      )}
    </div>
  );
}

function EmojiChoiceExercise({
  exercise,
  onAnswer,
  initialAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
  initialAnswer?: string;
}) {
  const [selected, setSelected] = useState<string | null>(initialAnswer ?? null);
  const isAnswered = selected !== null;
  const options = exercise.options ?? [];

  function pick(opt: string) {
    if (isAnswered) return;
    setSelected(opt);
    onAnswer(opt === exercise.correctAnswer, opt);
  }

  function styleFor(opt: string) {
    const base = 'aspect-square rounded-2xl border-2 flex items-center justify-center text-6xl transition-all duration-200';
    if (!isAnswered) return `${base} bg-[#F0F5FF] border-[#DDE6F5] hover:border-[#025dc7]/50 hover:bg-[#e8f0ff] active:scale-[0.95]`;
    if (opt === exercise.correctAnswer) return `${base} bg-green-50 border-green-400`;
    if (opt === selected) return `${base} bg-red-50 border-red-400`;
    return `${base} bg-gray-50 border-gray-200 opacity-50`;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2">Toca el emoji que corresponde a:</p>
        <p className="text-[24px] font-bold text-gray-900 leading-snug text-center py-2">{exercise.prompt}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {options.map(opt => (
          <button key={opt} onClick={() => pick(opt)} disabled={isAnswered} className={styleFor(opt)}>
            {opt}
          </button>
        ))}
      </div>
      {isAnswered && (
        <div className={`rounded-lg px-4 py-3 text-[14px] font-medium ${
          selected === exercise.correctAnswer
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {selected === exercise.correctAnswer
            ? '✓ ¡Correcto!'
            : `✗ El correcto era ${exercise.correctAnswer}`}
          {exercise.explanation && <p className="mt-1 text-[13px] opacity-80">{exercise.explanation}</p>}
        </div>
      )}
    </div>
  );
}

function OddOneOutExercise({
  exercise,
  onAnswer,
  initialAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
  initialAnswer?: string;
}) {
  const [selected, setSelected] = useState<string | null>(initialAnswer ?? null);
  const isAnswered = selected !== null;
  const options = exercise.options ?? [];

  function pick(opt: string) {
    if (isAnswered) return;
    setSelected(opt);
    onAnswer(opt === exercise.correctAnswer, opt);
  }

  function styleFor(opt: string) {
    const base = 'py-6 rounded-2xl border-2 text-[17px] font-bold transition-all duration-200';
    if (!isAnswered) return `${base} bg-[#F0F5FF] border-[#DDE6F5] text-gray-900 hover:border-[#025dc7]/50 hover:bg-[#e8f0ff] active:scale-[0.97]`;
    if (opt === exercise.correctAnswer) return `${base} bg-green-50 border-green-400 text-green-800`;
    if (opt === selected) return `${base} bg-red-50 border-red-400 text-red-700`;
    return `${base} bg-gray-50 border-gray-200 text-gray-400`;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2">Elige la intrusa</p>
        <p className="text-[17px] font-semibold text-gray-900 leading-snug">{exercise.prompt}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {options.map(opt => (
          <button key={opt} onClick={() => pick(opt)} disabled={isAnswered} className={styleFor(opt)}>
            {opt}
          </button>
        ))}
      </div>
      {isAnswered && (
        <div className={`rounded-lg px-4 py-3 text-[14px] font-medium ${
          selected === exercise.correctAnswer
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {selected === exercise.correctAnswer
            ? '✓ ¡Correcto!'
            : `✗ La intrusa era: "${exercise.correctAnswer}"`}
          {exercise.explanation && <p className="mt-1 text-[13px] opacity-80">{exercise.explanation}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * LetterDashExercise
 * Muestra la palabra con algunas letras ocultas (k_ff_e). El alumno
 * escribe SOLO la palabra completa en el input. Pista visual + audio TTS.
 */
function LetterDashExercise({
  exercise,
  onAnswer,
  initialAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
  initialAnswer?: string;
}) {
  const target = (exercise.correctAnswer ?? '').trim();
  const [value, setValue] = useState(initialAnswer ?? '');
  const [submitted, setSubmitted] = useState(initialAnswer !== undefined && initialAnswer !== '');

  // Compute which letter positions to hide (~40% of letters, deterministic per exercise)
  const masked = useMemo(() => {
    if (!target) return '';
    const seed = exercise.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const indices: number[] = [];
    for (let i = 0; i < target.length; i++) {
      // Skip first letter as a hint, then mask every ~2nd letter using seed
      if (i === 0) continue;
      if (((i + seed) % 2) === 0) indices.push(i);
    }
    // Ensure at least 1 masked
    if (indices.length === 0 && target.length > 1) indices.push(target.length - 1);
    return target.split('').map((ch, i) => (indices.includes(i) ? '_' : ch)).join(' ');
  }, [exercise.id, target]);

  const isCorrect = value.trim().toLowerCase() === target.toLowerCase();

  function handleSubmit() {
    if (submitted || !value.trim()) return;
    setSubmitted(true);
    onAnswer(isCorrect, value.trim());
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white space-y-3">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest">Letras que faltan</p>
        <p className="text-[15px] text-gray-900 font-medium leading-snug">{exercise.prompt}</p>
        <div className="text-center py-3">
          <p className="text-[34px] font-bold text-gray-900 tracking-[0.4em] tabular-nums" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}>
            {masked}
          </p>
        </div>
        <div className="flex items-center gap-2 justify-center">
          <button
            onClick={() => speakDutch(target)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F0F5FF] text-[#025dc7] text-[12px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff]"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            Escuchar pista
          </button>
        </div>
      </div>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        disabled={submitted}
        onKeyDown={e => { if (e.key === 'Enter' && !submitted) handleSubmit(); }}
        placeholder="Escribe la palabra completa…"
        className={`w-full px-4 py-3.5 rounded-lg text-[16px] font-medium border outline-none transition-colors duration-200 ${
          submitted
            ? isCorrect
              ? 'bg-green-50 border-green-400 text-green-800'
              : 'bg-red-50 border-red-400 text-red-700'
            : 'bg-white border-[#DDE6F5] text-gray-900 focus:border-[#025dc7]'
        }`}
      />
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="w-full py-3 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[14px] font-semibold hover:bg-[#6cb5ff] disabled:bg-[#DDE6F5] disabled:text-[#9CA3AF] transition-colors duration-200"
        >
          Comprobar
        </button>
      )}
      {submitted && (
        <div className={`rounded-lg px-4 py-3 text-[14px] font-medium ${
          isCorrect
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {isCorrect ? '✓ ¡Correcto!' : `✗ La palabra era: "${target}"`}
          {exercise.explanation && <p className="mt-1 text-[13px] opacity-80">{exercise.explanation}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * PairMemoryExercise — clásico juego de memoria.
 * 2N cartas boca abajo; descubre 2 a la vez; si coinciden (NL↔ES) se quedan
 * descubiertas. Cuando todas están emparejadas, el ejercicio se completa.
 * Reutiliza `pairs` (igual que MatchPairs) — left=NL, right=ES.
 */
function PairMemoryExercise({ exercise, onAnswer }: { exercise: ExerciseItem; onAnswer: (correct: boolean, answer: string) => void }) {
  const pairs = exercise.pairs ?? [];

  type Card = { id: string; pairKey: string; text: string; side: 'left' | 'right' };
  const cards = useMemo<Card[]>(() => {
    const arr: Card[] = [];
    pairs.forEach((p, i) => {
      arr.push({ id: `L-${i}`, pairKey: String(i), text: p.left, side: 'left' });
      arr.push({ id: `R-${i}`, pairKey: String(i), text: p.right, side: 'right' });
    });
    // Fisher-Yates shuffle, deterministic per exercise
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [revealed, setRevealed] = useState<string[]>([]); // currently flipped (max 2)
  const [matched, setMatched] = useState<Set<string>>(new Set()); // matched pairKeys
  const [attempts, setAttempts] = useState(0);
  const [done, setDone] = useState(false);

  function tryFlip(card: Card) {
    if (done) return;
    if (matched.has(card.pairKey)) return;
    if (revealed.includes(card.id)) return;
    if (revealed.length >= 2) return;

    const next = [...revealed, card.id];
    setRevealed(next);
    if (next.length === 2) {
      setAttempts(a => a + 1);
      const [aId, bId] = next;
      const a = cards.find(c => c.id === aId)!;
      const b = cards.find(c => c.id === bId)!;
      const isMatch = a.pairKey === b.pairKey && a.side !== b.side;
      setTimeout(() => {
        if (isMatch) {
          const newMatched = new Set(matched);
          newMatched.add(a.pairKey);
          setMatched(newMatched);
          setRevealed([]);
          if (newMatched.size === pairs.length) {
            setDone(true);
            const finalAttempts = attempts + 1;
            const perfect = finalAttempts === pairs.length;
            onAnswer(perfect, String(finalAttempts));
          }
        } else {
          setRevealed([]);
        }
      }, isMatch ? 350 : 700);
    }
  }

  function cardClass(card: Card) {
    const isRevealed = revealed.includes(card.id) || matched.has(card.pairKey);
    const isMatched = matched.has(card.pairKey);
    const base = 'aspect-[3/4] rounded-lg border-2 flex items-center justify-center text-center px-2 text-[13px] font-semibold transition-all duration-300 select-none';
    if (isMatched) return `${base} bg-green-50 border-green-300 text-green-800`;
    if (isRevealed) return `${base} bg-white border-[#1D0084] text-gray-900 shadow-sm`;
    return `${base} bg-[#1D0084] border-[#1D0084] text-white hover:bg-[#025dc7] active:scale-[0.97] cursor-pointer`;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-1">Memory cards</p>
        <p className="text-[17px] font-semibold text-gray-900">{exercise.prompt}</p>
        <p className="text-[12px] text-[#9CA3AF] mt-1">{matched.size}/{pairs.length} encontradas · {attempts} intentos</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {cards.map(card => {
          const isRevealed = revealed.includes(card.id) || matched.has(card.pairKey);
          return (
            <button
              key={card.id}
              onClick={() => tryFlip(card)}
              disabled={matched.has(card.pairKey) || done}
              className={cardClass(card)}
            >
              {isRevealed ? card.text : '?'}
            </button>
          );
        })}
      </div>
      {done && (
        <div className={`rounded-lg px-4 py-3 text-[14px] font-medium ${
          attempts === pairs.length
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-[#FFFBF2] text-[#8A6A2A] border border-[#EFE3C9]'
        }`}>
          {attempts === pairs.length
            ? `✓ ¡Perfecto, sin errores! (${attempts} intentos)`
            : `✓ Completado con ${attempts} intentos (mínimo: ${pairs.length})`}
        </div>
      )}
    </div>
  );
}

/**
 * ListenTranslateExercise — escucha la frase NL y compón la traducción ES
 * con chips. La frase NL se muestra entre comillas en el prompt para que
 * TTS la pueda hablar (mismo patrón que ListenAndChoose).
 *
 *   prompt: "Escucha y traduce: \"Ik drink water in de ochtend\""
 *   correctAnswer: "Bebo agua por la mañana"
 *   options: ["Bebo", "agua", "por", "la", "mañana", "café"] (incluye distractores ES)
 */
function ListenTranslateExercise({ exercise, onAnswer }: { exercise: ExerciseItem; onAnswer: (correct: boolean, answer: string) => void }) {
  const match = exercise.prompt.match(/"([^"]+)"/);
  const dutchPhrase = match ? match[1] : exercise.prompt;
  const visibleHint = match
    ? exercise.prompt.replace(/\s*[:：]?\s*"[^"]+"\s*\.?\s*$/, '').trim() || 'Escucha y traduce al español'
    : 'Escucha y traduce al español';

  const [available, setAvailable] = useState<string[]>(() =>
    [...(exercise.options ?? [])].sort(() => Math.random() - 0.5)
  );
  const [sentence, setSentence] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const composed = sentence.join(' ');
  const isCorrect = composed.trim().toLowerCase() === exercise.correctAnswer.trim().toLowerCase();

  function addWord(word: string, idx: number) {
    if (submitted) return;
    setSentence(s => [...s, word]);
    setAvailable(a => a.filter((_, i) => i !== idx));
  }
  function removeWord(word: string, idx: number) {
    if (submitted) return;
    setAvailable(a => [...a, word]);
    setSentence(s => s.filter((_, i) => i !== idx));
  }
  function handleSubmit() {
    if (!sentence.length || submitted) return;
    setSubmitted(true);
    onAnswer(isCorrect, composed);
  }
  function handleReset() {
    setAvailable([...(exercise.options ?? [])].sort(() => Math.random() - 0.5));
    setSentence([]);
    setSubmitted(false);
  }

  return (
    <div className="space-y-4">
      {/* Frase NL + audio */}
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white space-y-3">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest">{visibleHint}</p>
        <p className="text-[20px] font-bold text-gray-900 leading-snug text-center" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}>
          {dutchPhrase}
        </p>
        <div className="flex justify-center">
          <button
            onClick={() => speakDutch(dutchPhrase)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[13px] font-semibold hover:bg-[#6cb5ff] transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            Escuchar
          </button>
        </div>
      </div>

      {/* Slot de la frase ES en construcción */}
      <div className="min-h-[52px] rounded-lg border-2 border-dashed border-[#DDE6F5] bg-white p-3 flex flex-wrap gap-2 items-center">
        {sentence.length === 0 && (
          <span className="text-[13px] text-[#9CA3AF]">Toca las palabras en español para componer la traducción…</span>
        )}
        {sentence.map((word, i) => (
          <button
            key={`${word}-${i}`}
            onClick={() => removeWord(word, i)}
            disabled={submitted}
            className="px-3 py-1.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[14px] font-medium hover:bg-[#6cb5ff] transition-colors duration-200 disabled:opacity-70"
          >
            {word}
          </button>
        ))}
      </div>

      {/* Chips disponibles (ES + distractores) */}
      <div className="flex flex-wrap gap-2">
        {available.map((word, i) => (
          <button
            key={`${word}-${i}`}
            onClick={() => addWord(word, i)}
            disabled={submitted}
            className="px-3 py-1.5 rounded-lg bg-[#F0F5FF] border border-[#DDE6F5] text-gray-900 text-[14px] font-medium hover:border-[#025dc7]/40 hover:bg-[#e8f0ff] transition-colors duration-200 disabled:opacity-50"
          >
            {word}
          </button>
        ))}
      </div>

      {!submitted ? (
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-4 py-3 rounded-lg bg-[#F0F5FF] text-[#5A6480] text-[14px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200"
          >
            Reiniciar
          </button>
          <button
            onClick={handleSubmit}
            disabled={sentence.length === 0}
            className="flex-1 py-3 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[14px] font-semibold hover:bg-[#6cb5ff] transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none"
          >
            Comprobar
          </button>
        </div>
      ) : (
        <div className={`rounded-lg px-4 py-3 text-[14px] font-medium ${
          isCorrect ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {isCorrect
            ? '✓ ¡Correcto!'
            : `✗ La traducción correcta era: "${exercise.correctAnswer}"`}
          {exercise.explanation && <p className="mt-1 text-[13px] opacity-80">{exercise.explanation}</p>}
        </div>
      )}
    </div>
  );
}

function ExerciseStep({
  exercise,
  onAnswer,
  initialAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
  initialAnswer?: string;
}) {
  if (exercise.type === 'multiple_choice') return <MultipleChoiceExercise exercise={exercise} onAnswer={onAnswer} initialAnswer={initialAnswer} />;
  if (exercise.type === 'write_answer') return <WriteAnswerExercise exercise={exercise} onAnswer={onAnswer} initialAnswer={initialAnswer} />;
  if (exercise.type === 'listen_and_choose') return <ListenAndChooseExercise exercise={exercise} onAnswer={onAnswer} initialAnswer={initialAnswer} />;
  if (exercise.type === 'spreken_choose') return <SprekenChooseExercise exercise={exercise} onAnswer={onAnswer} initialAnswer={initialAnswer} />;
  if (exercise.type === 'listen_choose_image') return <ListenChooseImageExercise exercise={exercise} onAnswer={onAnswer} initialAnswer={initialAnswer} />;
  if (exercise.type === 'listen_translate') return <ListenTranslateExercise exercise={exercise} onAnswer={onAnswer} />;
  if (exercise.type === 'fill_blank') return <FillBlankExercise exercise={exercise} onAnswer={onAnswer} initialAnswer={initialAnswer} />;
  if (exercise.type === 'order_sentence') return <OrderSentenceExercise exercise={exercise} onAnswer={onAnswer} />;
  if (exercise.type === 'word_scramble') return <WordScrambleExercise exercise={exercise} onAnswer={onAnswer} />;
  if (exercise.type === 'match_pairs') return <MatchPairsExercise exercise={exercise} onAnswer={onAnswer} />;
  if (exercise.type === 'true_false') return <TrueFalseExercise exercise={exercise} onAnswer={onAnswer} initialAnswer={initialAnswer} />;
  if (exercise.type === 'emoji_choice') return <EmojiChoiceExercise exercise={exercise} onAnswer={onAnswer} initialAnswer={initialAnswer} />;
  if (exercise.type === 'odd_one_out') return <OddOneOutExercise exercise={exercise} onAnswer={onAnswer} initialAnswer={initialAnswer} />;
  if (exercise.type === 'letter_dash') return <LetterDashExercise exercise={exercise} onAnswer={onAnswer} initialAnswer={initialAnswer} />;
  if (exercise.type === 'pair_memory') return <PairMemoryExercise exercise={exercise} onAnswer={onAnswer} />;
  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   RESUMEN SECTION — puntos clave de la lección, antes de los ejercicios
───────────────────────────────────────────────────────────────────────────── */

/** Renderiza markdown ligero: solo **negritas** → <strong> */
function ResumenSection({ block, vocabItems = [], phraseItems = [], inCourse, onComplete }: { block: SummaryBlock; vocabItems?: VocabularyItem[]; phraseItems?: PhraseItem[]; inCourse?: boolean; onComplete: () => void }) {
  return (
    <div className="space-y-6">
      {/* Hero con intro */}
      {(block.title || block.intro) && (
        <div className="rounded-2xl border border-[#DDE6F5] bg-[#F0F5FF] p-6">
          {block.title && (
            <h2
              className="text-[22px] font-bold text-gray-900 leading-tight mb-2"
              style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}
            >
              {block.title}
            </h2>
          )}
          {block.intro && (
            <TextoResaltable
              texto={block.intro}
              bloque="resumen"
              className="text-[15px] text-[#2E3A59] leading-relaxed"
            />
          )}
        </div>
      )}

      {/* Objetivos — lista con checks */}
      {block.objectives && block.objectives.length > 0 && (
        <div className="rounded-2xl border border-[#DDE6F5] bg-white p-5">
          <p className="text-[12px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">
            Objetivos de la lección
          </p>
          <ul className="space-y-2">
            {block.objectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
                  <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <TextoResaltable
                  texto={obj}
                  bloque={`resumen_obj${i}`}
                  className="text-[14px] text-gray-900 leading-snug min-w-0"
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Secciones temáticas */}
      {block.sections.map((sec, i) => (
        <div key={i} className="rounded-2xl border border-[#DDE6F5] bg-white p-5 space-y-3">
          <h3
            className="flex items-center gap-2 text-[17px] font-bold text-gray-900 leading-tight"
            style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}
          >
            <span aria-hidden className="shrink-0">{sec.heading.split(' ')[0]}</span>
            <span>{sec.heading.split(' ').slice(1).join(' ')}</span>
          </h3>
          {sec.body && (
            <TextoResaltable
              texto={sec.body}
              bloque={`resumen_s${i}`}
              className="text-[14px] text-[#2E3A59] leading-relaxed"
            />
          )}
          {sec.items && sec.items.length > 0 && (
            <div className="divide-y divide-[#DDE6F5] rounded-lg border border-[#DDE6F5] bg-[#F8FAFF] overflow-hidden">
              {sec.items.map((item, j) => (
                <div key={j} className="flex items-start gap-3 px-4 py-2.5">
                  {item.nl && (
                    <TextoResaltable
                      texto={item.nl}
                      bloque={`resumen_s${i}_nl${j}`}
                      className="text-[14px] font-semibold text-gray-900 flex-1 min-w-0 leading-snug"
                    />
                  )}
                  <TextoResaltable
                    texto={item.es}
                    bloque={`resumen_s${i}_es${j}`}
                    className="text-[14px] text-[#2E3A59] flex-1 min-w-0 leading-snug text-right"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Vocabulario de la lección (con sonido) — antes vivía en "Oefeningen" */}
      {vocabItems.length > 0 && (
        <div className="rounded-2xl border border-[#DDE6F5] bg-white p-5 space-y-3">
          <h3
            className="flex items-center gap-2 text-[17px] font-bold text-gray-900 leading-tight"
            style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}
          >
            <span aria-hidden className="shrink-0">📖</span>
            <span>Vocabulario</span>
          </h3>
          <p className="text-[14px] text-[#2E3A59] leading-relaxed">Toca el altavoz para escuchar la pronunciación.</p>
          <div className="divide-y divide-[#DDE6F5] rounded-lg border border-[#DDE6F5] bg-[#F8FAFF] overflow-hidden">
            {vocabItems.map((v) => (
              <div key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-xl shrink-0" aria-hidden>{v.emoji}</span>
                <span className="text-[14px] font-semibold text-gray-900 flex-1 min-w-0 leading-snug">{v.dutch}</span>
                <span className="text-[14px] text-[#2E3A59] flex-1 min-w-0 leading-snug text-right">{v.spanish}</span>
                <button
                  onClick={() => speakDutch(v.dutch)}
                  aria-label={`Escuchar ${v.dutch}`}
                  className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] font-semibold text-[#025dc7] hover:bg-[#F0F5FF] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M19 5a9 9 0 010 14M5 9v6h4l5 4V5L9 9H5z" />
                  </svg>
                  <span className="hidden sm:inline">Escuchar</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Frases — antes eran el primer paso de "Oefeningen", pero repasar no
          es un ejercicio: se estudian aquí, junto al vocabulario, y así la
          sección de ejercicios queda solo con ejercicios. */}
      {phraseItems.length > 0 && (
        <div className="rounded-2xl border border-[#DDE6F5] bg-white p-5 space-y-3">
          <h3
            className="flex items-center gap-2 text-[17px] font-bold text-gray-900 leading-tight"
            style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}
          >
            <span aria-hidden className="shrink-0">💬</span>
            <span>Frases</span>
          </h3>
          <p className="text-[14px] text-[#2E3A59] leading-relaxed">Toca el altavoz para escuchar la frase entera.</p>
          <div className="divide-y divide-[#DDE6F5] rounded-lg border border-[#DDE6F5] bg-[#F8FAFF] overflow-hidden">
            {phraseItems.map((p, i) => (
              <div key={p.id ?? i} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-gray-900 leading-snug">{p.dutch}</p>
                  <p className="text-[14px] text-[#2E3A59] leading-snug mt-0.5">{p.spanish}</p>
                </div>
                <button
                  onClick={() => speakDutch(p.dutch)}
                  aria-label={`Escuchar ${p.dutch}`}
                  className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] font-semibold text-[#025dc7] hover:bg-[#F0F5FF] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M19 5a9 9 0 010 14M5 9v6h4l5 4V5L9 9H5z" />
                  </svg>
                  <span className="hidden sm:inline">Escuchar</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tip final — se ajusta al contenido (no ocupa todo el ancho) */}
      {block.tip && (
        <div className="w-fit max-w-full rounded-2xl border border-[#FCD34D]/50 bg-[#FEF3C7] px-4 py-3 flex items-center gap-2.5">
          <span className="text-[18px] shrink-0 leading-none">💡</span>
          <TextoResaltable
            texto={block.tip}
            bloque="resumen_tip"
            className="text-[14px] text-[#92400E] leading-relaxed"
          />
        </div>
      )}

      {/* CTA — solo fuera del curso. Dentro del curso, el botón "Siguiente" de
          abajo ya lleva al paso de Flashcards, así que este sería redundante. */}
      {!inCourse && (
        <button
          onClick={onComplete}
          className="w-full py-4 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[15px] font-semibold hover:bg-[#6cb5ff] transition-colors duration-200 flex items-center justify-center gap-2"
        >
          Empezar con los ejercicios
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   LEZEN SECTION
───────────────────────────────────────────────────────────────────────────── */

function LezenSection({
  textNl,
  textEs,
  exercises: allExercises,
  onComplete: _onComplete,
  cacheKey,
  reviewOnly,
}: {
  textNl: string;
  textEs: string;
  exercises: ExerciseItem[];
  onComplete: () => void;
  cacheKey?: string;
  /** Modo repaso: solo se ejecutan los ejercicios fallados en el último intento. */
  reviewOnly?: boolean;
}) {
  const [step, setStep] = useState<'text' | 'exercises' | 'translation'>('text');
  // El texto sigue disponible durante las preguntas, plegado o desplegado.
  const [textOpen, setTextOpen] = useState(false);
  const exercisesRef = useRef<HTMLDivElement | null>(null);
  // Al empezar los ejercicios se baja hasta ellos con un scroll suave, en vez
  // de saltar de pantalla: así se ve que el texto sigue justo arriba.
  useEffect(() => {
    if (step !== 'exercises') return;
    const id = window.setTimeout(
      () => exercisesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      60,
    );
    return () => window.clearTimeout(id);
  }, [step]);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [wrongIndices, setWrongIndices] = useState<Set<number>>(new Set());
  const [answered, setAnswered] = useState(false);
  const [answeredSet, setAnsweredSet] = useState<Set<number>>(new Set());
  const [exKey, setExKey] = useState(0);
  const [lastAttempt, setLastAttempt] = useState<LastAttempt | null>(null);
  const session = useLHSession() as any;
  const accessToken: string | undefined = session?.data?.tokens?.access_token;

  // Load any previous attempt for this section on mount.
  useEffect(() => {
    if (!cacheKey) return;
    let active = true;
    getLastAttempt(cacheKey, accessToken).then((a) => {
      if (active) setLastAttempt(a);
    });
    return () => { active = false; };
  }, [cacheKey, accessToken]);

  // Modo repaso: si hay intento previo con fallos, se ejecutan SOLO esos
  // ejercicios (mapeados por su prompt). Sin fallos registrados → todos.
  const exercises = useMemo(() => {
    if (!reviewOnly || !lastAttempt?.failedLabels?.length) return allExercises;
    const failedSet = new Set(lastAttempt.failedLabels);
    const filtered = allExercises.filter((e) => failedSet.has(e.prompt));
    return filtered.length > 0 ? filtered : allExercises;
  }, [allExercises, reviewOnly, lastAttempt]);
  const totalSteps = exercises.length > 0 ? 3 : 2; // text, [exercises,] translation

  const exercise = exercises[exerciseIndex];

  const stepNum = step === 'text' ? 1 : step === 'exercises' ? 2 : totalSteps;
  const pct = Math.round(((stepNum - 1 + (step === 'exercises' ? exerciseIndex / exercises.length : 0)) / totalSteps) * 100);

  function handleAnswer(correct: boolean) {
    setAnswered(true);
    if (answeredSet.has(exerciseIndex)) return; // ya contado: no duplicar al volver
    setAnsweredSet((s) => new Set(s).add(exerciseIndex));
    const nextScore = correct ? score + 1 : score;
    const nextWrong = new Set(wrongIndices);
    if (correct) {
      setScore(nextScore);
    } else {
      nextWrong.add(exerciseIndex);
      setWrongIndices(nextWrong);
    }
    // Deja constancia del avance en cuanto responde: antes solo se guardaba al
    // llegar al ÚLTIMO ejercicio, así que quien practicaba un rato y salía no
    // dejaba rastro ninguno y "Esta semana" se quedaba en blanco. Se marca como
    // parcial para que no cuente como sección hecha ni como nota.
    const answeredCount = answeredSet.size + 1;
    if (cacheKey && !reviewOnly && answeredCount < exercises.length) {
      saveLastAttempt(
        cacheKey,
        {
          score: nextScore,
          total: exercises.length,
          failedLabels: Array.from(nextWrong)
            .sort((a, b) => a - b)
            .map((i) => exercises[i]?.prompt)
            .filter((p): p is string => !!p),
          partial: true,
        },
        accessToken,
      );
    }
  }

  function handlePrev() {
    if (exerciseIndex === 0) return;
    const ni = exerciseIndex - 1;
    setExerciseIndex(ni);
    setAnswered(answeredSet.has(ni));
    setExKey((k) => k + 1);
  }

  function resetExercises() {
    setExerciseIndex(0);
    setScore(0);
    setWrongIndices(new Set());
    setAnswered(false);
    setAnsweredSet(new Set());
    setExKey((k) => k + 1);
  }

  function handleNext() {
    if (exerciseIndex + 1 >= exercises.length) {
      // Snapshot the attempt so the student sees "last time…" next visit.
      if (cacheKey) {
        const failed = Array.from(wrongIndices)
          .sort((a, b) => a - b)
          .map((i) => exercises[i]?.prompt)
          .filter((p): p is string => !!p);
        if (reviewOnly && lastAttempt) {
          // Repaso: los fallos ahora acertados salen de la lista y suman a la
          // nota original; los que no entraron en este repaso se conservan.
          const wrongNow = new Set(failed);
          const stillFailed = lastAttempt.failedLabels.filter((l) =>
            exercises.some((e) => e.prompt === l) ? wrongNow.has(l) : true
          );
          const resolved = lastAttempt.failedLabels.length - stillFailed.length;
          saveLastAttempt(
            cacheKey,
            {
              score: Math.min(lastAttempt.total, lastAttempt.score + resolved),
              total: lastAttempt.total,
              failedLabels: stillFailed,
            },
            accessToken,
          );
        } else {
          saveLastAttempt(
            cacheKey,
            { score, total: exercises.length, failedLabels: failed },
            accessToken,
          );
        }
      }
      setStep('translation');
    } else {
      setExerciseIndex(i => i + 1);
      setAnswered(false);
      setExKey(k => k + 1);
    }
  }

  const progressBar = (
    <GradientBar pct={pct} />
  );

  if (step === 'text') {
    return (
      <div className="space-y-5">
        {progressBar}
        {/* Last-attempt banner — shown only when we have a previous attempt. */}
        {lastAttempt && exercises.length > 0 && (
          <div className="rounded-lg border border-[#DDE6F5] bg-[#F0F5FF] px-4 py-3">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <p className="text-[13px] font-bold text-gray-900">
                Última vez: {lastAttempt.score} / {lastAttempt.total} correctas
              </p>
              <button
                onClick={() => { resetExercises(); setStep('exercises'); }}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[12px] font-semibold hover:bg-[#6cb5ff] transition-colors"
              >
                🔄 Repetir test
              </button>
            </div>
            {lastAttempt.failedLabels.length > 0 && (
              <p className="text-[12px] text-[#5A6480] leading-snug">
                <span className="font-semibold text-gray-900">Fallaste en:</span>{' '}
                {lastAttempt.failedLabels.slice(0, 3).join(' · ')}
                {lastAttempt.failedLabels.length > 3 && ` · +${lastAttempt.failedLabels.length - 3}`}
              </p>
            )}
          </div>
        )}
        {exercises.length > 0 && (
          <div className="flex items-center gap-2.5 rounded-lg bg-[#FEF3C7] border border-[#FCD34D] px-4 py-2.5">
            <span className="text-[18px] shrink-0 leading-none">💡</span>
            <p className="text-[13px] text-[#92400E] leading-snug">
              <strong>Primero intenta entenderlo en neerlandés.</strong> Cuando completes los ejercicios, podrás ver la traducción al español.
            </p>
          </div>
        )}
        <div className="rounded-2xl border border-[#DDE6F5] bg-white p-6">
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-4">Texto en neerlandés</p>
          <TextoResaltable
            texto={textNl.replace(/^[ \t]+/gm, '').trim()}
            bloque="lezen_nl"
            className="text-[16px] text-gray-900 leading-relaxed whitespace-pre-line font-medium text-left max-w-prose"
          />
        </div>
        <button
          onClick={() => exercises.length > 0 ? setStep('exercises') : setStep('translation')}
          className="w-full py-3.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[15px] font-semibold hover:bg-[#6cb5ff] transition-colors duration-200"
        >
          {exercises.length > 0 ? 'Ir a los ejercicios →' : 'Ver traducción →'}
        </button>
      </div>
    );
  }

  if (step === 'exercises' && exercise) {
    return (
      <div className="space-y-5">
        {progressBar}

        {/* El texto se queda AQUÍ, encima de las preguntas, en vez de estar en
            otra pantalla: en una prueba de comprensión lectora hay que poder
            releer sin perder de vista lo que te preguntan. Plegable, y con
            altura máxima para que no empuje el ejercicio fuera de la pantalla. */}
        <div className="rounded-xl border border-[#DDE6F5] bg-[#FBFDFF]">
          <button
            onClick={() => setTextOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left"
          >
            <span className="text-[16px] leading-none">📄</span>
            <span className="flex-1 text-[13px] font-bold text-gray-900">Volver a leer el texto</span>
            <svg
              className={`w-4 h-4 text-[#9CA3AF] transition-transform ${textOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {textOpen && (
            /* El texto entero, sin scroll propio: dos barras de scroll una
               dentro de otra son un incordio en el móvil. Se despliega, se
               lee bajando la página normal, y se vuelve a plegar. */
            <div className="px-3.5 pb-3.5">
              <p className="text-[14.5px] text-gray-800 leading-relaxed whitespace-pre-line">
                {textNl}
              </p>
            </div>
          )}
        </div>

        <div ref={exercisesRef} className="flex items-center justify-between gap-4 scroll-mt-4">
          <button onClick={() => setStep('text')} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#9CA3AF] hover:text-[#025dc7] transition-colors duration-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver al texto
          </button>
          <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#16a34a] bg-green-50 border border-green-200 px-3 py-1 rounded-full">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {score}
          </div>
        </div>
        {/* Flechas laterales (desktop) — avanzar/retroceder sin hacer scroll */}
        <div className="relative md:px-[84px]">
          <button
            onClick={exerciseIndex > 0 ? handlePrev : undefined}
            aria-label="Anterior"
            className={`hidden md:flex absolute left-0 top-5 w-11 h-11 items-center justify-center rounded-2xl transition-all duration-200 ${
              exerciseIndex > 0 ? 'text-[#9CA3AF] hover:bg-[#F0F5FF] hover:text-[#025dc7] cursor-pointer' : 'text-[#E8ECF4] pointer-events-none'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div key={exKey}>
            <ExerciseStep exercise={exercise} onAnswer={handleAnswer} />
          </div>
          <button
            onClick={answered ? handleNext : undefined}
            aria-label="Siguiente"
            title={answered ? '' : 'Responde primero'}
            className={`hidden md:flex absolute right-0 top-5 w-11 h-11 items-center justify-center rounded-2xl transition-all duration-300 ${
              answered ? 'bg-[#4da3ff] text-[#1D0084] cursor-pointer hover:bg-[#6cb5ff]' : 'bg-[#F0F5FF] text-[#C7D2E8] border border-[#DDE6F5] cursor-not-allowed'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        {/* Móvil: botón abajo */}
        <button onClick={answered ? handleNext : undefined} disabled={!answered} className={`md:hidden w-full flex items-center justify-center gap-2 py-4 rounded-lg text-[15px] font-semibold transition-colors duration-200 ${answered ? 'bg-[#4da3ff] text-[#1D0084] hover:bg-[#6cb5ff]' : 'bg-[#F0F5FF] text-[#9CA3AF] border border-[#DDE6F5] cursor-not-allowed'}`}>
          {answered ? (exerciseIndex + 1 < exercises.length ? 'Siguiente ejercicio' : 'Ver traducción del texto') : 'Responde primero'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  // translation step
  const failedLabels = Array.from(wrongIndices)
    .sort((a, b) => a - b)
    .map((i) => exercises[i]?.prompt)
    .filter((p): p is string => !!p);
  return (
    <div className="space-y-6">
      <GradientBar pct={100} />
      {exercises.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl px-5 py-4" style={{ background: 'linear-gradient(135deg, #1D0084 0%, #025dc7 100%)' }}>
          <span className="text-2xl">{score >= exercises.length * 0.8 ? '🎉' : '📝'}</span>
          <div>
            <p className="text-white font-bold text-[15px]">¡Ejercicios completados!</p>
            <p className="text-white/60 text-[13px]">{score} de {exercises.length} respuestas correctas</p>
          </div>
        </div>
      )}
      {/* Failed-items list — apuntar las palabras que falles, justo aquí. */}
      {failedLabels.length > 0 && (
        <div className="rounded-lg border border-[#DDE6F5] bg-white p-4">
          <p className="text-[12px] font-semibold text-gray-900 uppercase tracking-wide mb-2">
            Fallaste en {failedLabels.length}
          </p>
          <ul className="space-y-1.5">
            {failedLabels.map((label, i) => (
              <li key={i} className="flex gap-2 text-[13px] text-gray-700 leading-snug">
                <span className="text-[#4da3ff] mt-px shrink-0">•</span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="rounded-2xl border border-[#DDE6F5] bg-white p-6 space-y-4">
        <div>
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-3">Texto original</p>
          <TextoResaltable
            texto={textNl.replace(/^[ \t]+/gm, '').trim()}
            bloque="lezen_nl"
            className="text-[14px] text-[#2E3A59] leading-relaxed whitespace-pre-line text-left max-w-prose"
          />
        </div>
        <div className="border-t border-[#DDE6F5] pt-4">
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-3">Traducción al español</p>
          <TextoResaltable
            texto={textEs.replace(/^[ \t]+/gm, '').trim()}
            bloque="lezen_es"
            className="text-[15px] text-gray-900 font-medium leading-relaxed whitespace-pre-line text-left max-w-prose"
          />
        </div>
      </div>
      <button
        onClick={() => { resetExercises(); setStep('exercises'); }}
        className="w-full py-3.5 rounded-lg bg-[#F0F5FF] text-gray-900 text-[15px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200"
      >
        🔄 Repetir ejercicios
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   LUISTEREN (DIALOGUE) SECTION
───────────────────────────────────────────────────────────────────────────── */

/**
 * Botón de audio para diálogos sin archivo grabado. Usa la voz por defecto
 * (ElevenLabs en neerlandés) con fallback a la voz del navegador.
 */
/* ── Voces del diálogo: se alternan por interlocutor (orden de aparición) ──
   A = primer interlocutor, B = segundo. En "In het café" el primero es el
   camarero (Ober, voz de chico) y la segunda María (voz de chica). */
const DIALOGUE_VOICE_A = '5zhopMftSdRGaPYVcwKK'   // chico (ElevenLabs)
const DIALOGUE_VOICE_B = 'yO6w2xlECAQRFP6pX7Hw'   // chica (ElevenLabs, voz por defecto)

type DLine = { id: string; speaker: string; dutch: string; spanish?: string };

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Reproductor de diálogo estilo ElevenLabs: una FORMA DE ONDA (waveform) con los
 * altibajos del volumen y los silencios, el progreso pasando por encima, tiempo
 * actual/total, ±2s, play/pausa y velocidad normal/lenta. NO muestra el texto
 * (es un ejercicio de escucha). Genera un clip por línea con la voz que toque
 * (dos voces: una por interlocutor) usando ElevenLabs en neerlandés.
 */
function DialoguePlayer({ lines, accentColor }: { lines: DLine[]; accentColor: string }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [total, setTotal] = useState(0);
  const [slow, setSlow] = useState(false);
  const [waveW, setWaveW] = useState(0);

  const clipsRef = useRef<{ audio: HTMLAudioElement; dur: number }[]>([]);
  const startsRef = useRef<number[]>([]);
  const dataRef = useRef<{ dur: number; hiPeaks: number[] }[]>([]);
  const curRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const waveRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const wasPlayingRef = useRef(false);

  const speakers = useMemo(() => {
    const seen: string[] = [];
    for (const l of lines) if (!seen.includes(l.speaker)) seen.push(l.speaker);
    return seen;
  }, [lines]);
  // Quién es quién. La regla de "el primero que habla lleva la voz de chico"
  // es un apaño: en cuanto un diálogo empieza con Anna, David suena a mujer.
  // Pasó justo así al reescribir los Luisteren del módulo 1. Los personajes
  // que se repiten llevan su voz puesta; el resto sigue con el turno.
  const VOZ_POR_PERSONAJE: Record<string, string> = {
    // ellas
    anna: DIALOGUE_VOICE_B, marta: DIALOGUE_VOICE_B, sara: DIALOGUE_VOICE_B,
    maría: DIALOGUE_VOICE_B, maria: DIALOGUE_VOICE_B, sanne: DIALOGUE_VOICE_B,
    fatima: DIALOGUE_VOICE_B, presentatrice: DIALOGUE_VOICE_B, lerares: DIALOGUE_VOICE_B,
    // ellos
    david: DIALOGUE_VOICE_A, pablo: DIALOGUE_VOICE_A, tom: DIALOGUE_VOICE_A,
    kees: DIALOGUE_VOICE_A, ahmed: DIALOGUE_VOICE_A, gerard: DIALOGUE_VOICE_A,
    ober: DIALOGUE_VOICE_A, monteur: DIALOGUE_VOICE_A, verkoper: DIALOGUE_VOICE_A,
    chef: DIALOGUE_VOICE_A,
  }

  const voiceFor = (speaker: string) => {
    const propia = VOZ_POR_PERSONAJE[(speaker || '').trim().toLowerCase()]
    if (propia) return propia
    // Un solo interlocutor (p. ej. una presentadora de radio) → voz femenina por
    // defecto. Con el % de antes, el único hablante (índice 0) caía en la voz
    // masculina A, que no es lo que queremos para una presentadora.
    if (speakers.length === 1) return DIALOGUE_VOICE_B || undefined;
    const v = speakers.indexOf(speaker) % 2 === 0 ? DIALOGUE_VOICE_A : DIALOGUE_VOICE_B;
    return v || undefined;
  };

  const rate = slow ? 0.8 : 1; // 0.7 alentaba demasiado y perdía calidad de voz
  // La velocidad se lee SIEMPRE de un ref para que el bucle de reproducción (que
  // va saltando de línea en línea) aplique la velocidad actual a cada clip, no
  // la que había cuando arrancó (el closure quedaba obsoleto → unas líneas
  // salían lentas y otras normales).
  const rateRef = useRef(1);
  useEffect(() => {
    rateRef.current = rate;
    clipsRef.current.forEach((c) => { c.audio.playbackRate = rate; });
  }, [rate]);
  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    clipsRef.current.forEach((c) => { try { c.audio.pause(); } catch {} });
  }, []);
  // Mide el ancho de la onda para alinear la capa de progreso.
  useEffect(() => {
    const el = waveRef.current;
    if (!el) return;
    const update = () => setWaveW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function locate(p: number) {
    const starts = startsRef.current;
    let i = 0;
    for (let k = 0; k < starts.length; k++) { if (p >= starts[k]) i = k; else break; }
    return i;
  }
  function stopTick() { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } }
  function pauseAll() { clipsRef.current.forEach((c) => { try { c.audio.pause(); } catch {} }); }
  function finish() {
    stopTick(); pauseAll(); setPlaying(false);
    curRef.current = 0; setPos(0);
  }
  function tick() {
    const i = curRef.current;
    const c = clipsRef.current[i];
    if (!c) { stopTick(); return; }
    if (c.audio.ended || c.audio.currentTime >= c.dur - 0.03) {
      if (i + 1 < clipsRef.current.length) { startClip(i + 1, 0, true); return; }
      finish(); return;
    }
    setPos((startsRef.current[i] ?? 0) + c.audio.currentTime);
    rafRef.current = requestAnimationFrame(tick);
  }
  function startClip(i: number, offset: number, autoplay: boolean) {
    pauseAll();
    curRef.current = i;
    const c = clipsRef.current[i];
    if (!c) return;
    try { c.audio.currentTime = offset; } catch {}
    setPos((startsRef.current[i] ?? 0) + offset);
    if (autoplay) {
      c.audio.playbackRate = rateRef.current;
      c.audio.play().catch(() => {});
      setPlaying(true);
      stopTick();
      rafRef.current = requestAnimationFrame(tick);
    }
  }

  async function ensureLoaded(): Promise<boolean> {
    if (ready) return true;
    setLoading(true); setFailed(false);
    // Concurrencia limitada (3) para no saturar el límite de ElevenLabs.
    const data = await _mapLimit(lines, 3, (l) => _dialogueClip(l.dutch, voiceFor(l.speaker)));
    if (data.some((d) => !d)) { setLoading(false); setFailed(true); return false; }
    const clips = data.map((d) => {
      const audio = new Audio(d!.url);
      audio.preload = 'auto';
      audio.playbackRate = rateRef.current;
      // Mantener el tono al ir lento (si no, suena grave/raro).
      audio.preservesPitch = true;
      (audio as any).webkitPreservesPitch = true;
      return { audio, dur: d!.dur };
    });
    const starts: number[] = [];
    let acc = 0;
    for (const c of clips) { starts.push(acc); acc += c.dur; }

    clipsRef.current = clips;
    startsRef.current = starts;
    dataRef.current = data.map((d) => ({ dur: d!.dur, hiPeaks: d!.hiPeaks }));
    setTotal(acc);
    setReady(true);
    setLoading(false);
    return true;
  }

  function playFallback() {
    // Voz del navegador como último recurso. stopDutch() antes evita que se
    // solapen dos audios al re-pulsar (el bug de "se duplica / se cuelga").
    stopDutch();
    setPlaying(true);
    speakDutch(lines.map((l) => l.dutch).join('. '), () => setPlaying(false), rateRef.current);
  }

  async function togglePlay() {
    if (playing) {
      pauseAll(); stopTick(); stopDutch(); setPlaying(false);
      return;
    }
    if (failed) { playFallback(); return; } // ya sabemos que ElevenLabs no carga: no reintentar ni duplicar
    const ok = await ensureLoaded();
    if (!ok) { playFallback(); return; }
    const offset = pos - (startsRef.current[curRef.current] ?? 0);
    startClip(curRef.current, Math.max(0, offset), true);
  }
  function seek(delta: number) {
    if (!ready) return;
    const np = Math.max(0, Math.min(total - 0.05, pos + delta));
    startClip(locate(np), np - (startsRef.current[locate(np)] ?? 0), playing);
  }
  // ── Arrastre (scrubbing) con dedo o ratón sobre la onda ──
  function posFromClientX(clientX: number): number {
    const el = waveRef.current;
    if (!el || total <= 0) return 0;
    const r = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return frac * total;
  }
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!ready || total <= 0) return;
    e.preventDefault();
    try { (e.currentTarget as any).setPointerCapture?.(e.pointerId); } catch {}
    draggingRef.current = true;
    wasPlayingRef.current = playing;
    pauseAll(); stopTick(); setPlaying(false);
    setPos(posFromClientX(e.clientX));
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    setPos(posFromClientX(e.clientX));
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const np = posFromClientX(e.clientX);
    startClip(locate(np), np - (startsRef.current[locate(np)] ?? 0), wasPlayingRef.current);
  }

  const progressPct = total > 0 ? Math.min(100, (pos / total) * 100) : 0;
  const ICON = 'w-4 h-4';

  // Barras de la onda, adaptadas al ancho (para que SIEMPRE quepan) y más
  // gruesas. Se recalculan al cargar el audio o al cambiar el ancho.
  const bars = useMemo(() => {
    const BAR = 4, GAP = 3; // px aprox por barra → nº de barras que caben
    const n = Math.max(20, Math.min(90, Math.floor((waveW || 280) / (BAR + GAP))));
    const data = dataRef.current;
    if (!ready || !data.length || total <= 0) {
      return Array.from({ length: n }, (_, i) => 0.28 + 0.42 * Math.abs(Math.sin(i * 0.6)));
    }
    const binDur = total / n;
    const binMax = new Array(n).fill(0);
    let off = 0;
    for (const d of data) {
      const m = d.hiPeaks.length || 1;
      const dt = d.dur / m;
      for (let j = 0; j < (d.hiPeaks.length || 0); j++) {
        const t = off + j * dt + dt / 2;
        const bin = Math.min(n - 1, Math.floor(t / binDur));
        if (d.hiPeaks[j] > binMax[bin]) binMax[bin] = d.hiPeaks[j];
      }
      off += d.dur;
    }
    const mx = Math.max(0.0001, ...binMax);
    return binMax.map((v) => Math.max(0.16, Math.pow(v / mx, 0.8))); // realza y deja mínimo visible
  }, [ready, waveW, total]);

  const Bars = ({ color }: { color: string }) => (
    <div className="h-full flex items-center gap-[3px]" style={{ width: waveW || '100%' }}>
      {bars.map((h, i) => (
        <div key={i} className="flex-1 rounded-full" style={{ height: `${Math.round(h * 100)}%`, background: color }} />
      ))}
    </div>
  );

  return (
    <div className="rounded-xl border border-[#DDE6F5] bg-white p-3 sm:p-4 space-y-3 overflow-hidden">
      {/* Forma de onda con progreso por encima (arrastrable) */}
      <div
        ref={waveRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative h-16 w-full cursor-pointer select-none overflow-hidden"
        style={{ touchAction: 'none' }}
      >
        <div className="absolute inset-0">
          <Bars color="#C9D6EF" />
        </div>
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${progressPct}%` }}>
          <Bars color={accentColor} />
        </div>
      </div>

      {/* Tiempo */}
      <div className="flex justify-between text-[11px] text-[#9CA3AF] tabular-nums -mt-1">
        <span>{fmtTime(pos)}</span>
        <span>{ready ? `-${fmtTime(Math.max(0, total - pos))}` : '—:—'}</span>
      </div>

      {/* Controles */}
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => seek(-2)} disabled={!ready} aria-label="Atrás 2 segundos"
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-[#F0F5FF] text-[#025dc7] hover:bg-[#e0eaff] disabled:opacity-40 transition-colors text-[11px] font-bold">
          −2s
        </button>
        <button onClick={togglePlay} aria-label={playing ? 'Pausar' : 'Reproducir'}
          className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-[#1D0084] shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: accentColor }}>
          {loading ? (
            <svg className={`${ICON} animate-spin`} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="40" opacity="0.85" /></svg>
          ) : playing ? (
            <svg className={ICON} fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
          ) : (
            <svg className={`${ICON} ml-0.5`} fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
        <button onClick={() => seek(2)} disabled={!ready} aria-label="Adelante 2 segundos"
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-[#F0F5FF] text-[#025dc7] hover:bg-[#e0eaff] disabled:opacity-40 transition-colors text-[11px] font-bold">
          +2s
        </button>
        <button onClick={() => setSlow((s) => !s)} aria-label="Velocidad"
          className={`shrink-0 px-3 h-9 rounded-full text-[12px] font-bold transition-colors ${
            slow ? 'bg-[#4da3ff] text-[#1D0084]' : 'bg-[#F0F5FF] text-[#025dc7] hover:bg-[#e0eaff]'
          }`}>
          {slow ? '🐢 Lento' : '1×'}
        </button>
      </div>

      {failed && (
        <p className="text-[11px] text-[#9CA3AF] text-center">No se pudo cargar el audio; se usó la voz del navegador.</p>
      )}
    </div>
  );
}

/**
 * Sección Spreken: situaciones reales, una detrás de otra.
 *
 * No tiene "material" que estudiar antes (a diferencia de Lezen o Luisteren):
 * se entra y se practica, así que es una sola pantalla con su progreso, su
 * nota y su intento guardado, como el resto.
 */
function SprekenSection({
  block,
  onComplete,
  cacheKey,
  reviewOnly,
}: {
  block: SprekenBlock;
  onComplete: () => void;
  cacheKey?: string;
  reviewOnly?: boolean;
}) {
  const session = useLHSession() as any;
  const accessToken: string | undefined = session?.data?.tokens?.access_token;

  const [lastAttempt, setLastAttempt] = useState<LastAttempt | null>(null);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [answered, setAnswered] = useState(false);
  const [answeredSet, setAnsweredSet] = useState<Set<number>>(new Set());
  const [exKey, setExKey] = useState(0);
  const [done, setDone] = useState(false);
  /** Si la última respuesta fue buena. `null` mientras no ha contestado. */
  const [acerto, setAcerto] = useState<boolean | null>(null);

  useEffect(() => {
    if (!cacheKey) return;
    let active = true;
    getLastAttempt(cacheKey, accessToken).then((a: LastAttempt | null) => { if (active) setLastAttempt(a); });
    return () => { active = false; };
  }, [cacheKey, accessToken]);

  // En modo repaso solo se rehacen las que se fallaron la última vez.
  const exercises = useMemo(() => {
    const all = block.exercises ?? [];
    if (!reviewOnly || !lastAttempt?.failedLabels?.length) return all;
    const failed = new Set(lastAttempt.failedLabels);
    const only = all.filter((e: ExerciseItem) => failed.has(e.prompt));
    return only.length ? only : all;
  }, [block.exercises, reviewOnly, lastAttempt]);

  function reset() {
    setIndex(0); setScore(0); setWrong(new Set());
    setAnswered(false); setAnsweredSet(new Set()); setDone(false); setExKey((k) => k + 1);
    setAcerto(null);
  }

  function handleAnswer(correct: boolean) {
    setAnswered(true);
    setAcerto(correct);
    if (answeredSet.has(index)) return;
    setAnsweredSet((s) => new Set(s).add(index));
    if (correct) setScore((v) => v + 1);
    else setWrong((s) => new Set(s).add(index));
  }

  // Al ACERTAR la pantalla pasa sola; al fallar, no.
  //
  // No es una asimetría caprichosa: al fallar hay algo que leer —la frase que
  // hasta ese momento solo se había oído, y por qué la que eligió no era— y
  // llevárselo antes de tiempo es perder justo el instante en el que se
  // aprende. Al acertar no hay nada que leer, así que el clic solo estorba.
  //
  // El temporizador se monta en un efecto y no dentro de `handleAnswer` a
  // propósito: `next()` lee `score` y `wrong` para guardar el intento, y desde
  // dentro del manejador esos valores serían todavía los de antes de contestar.
  useEffect(() => {
    if (!answered || acerto !== true) return;
    const t = setTimeout(() => next(), AUTO_AVANCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, acerto, index]);

  function next() {
    if (index + 1 >= exercises.length) {
      if (cacheKey) {
        const failed = Array.from(wrong).sort((a, b) => a - b)
          .map((i) => exercises[i]?.prompt).filter((p): p is string => !!p);
        saveLastAttempt(cacheKey, { score, total: exercises.length, failedLabels: failed }, accessToken);
      }
      setDone(true);
      return;
    }
    setIndex((i) => i + 1);
    setAnswered(false);
    setAcerto(null);
    setExKey((k) => k + 1);
  }

  if (!exercises.length) {
    return <p className="text-[14px] text-[#5A6480]">Esta lección todavía no tiene situaciones de Spreken.</p>;
  }

  if (done) {
    return (
      <div className="space-y-4">
        <GradientBar pct={100} />
        <div className="flex items-center gap-3 rounded-2xl px-5 py-4" style={{ background: 'linear-gradient(135deg, #1D0084 0%, #025dc7 100%)' }}>
          <span className="text-2xl">{score >= exercises.length * 0.8 ? '🎉' : '📝'}</span>
          <div>
            <p className="text-white font-bold text-[15px]">{score} / {exercises.length} correctas</p>
            <p className="text-white/60 text-[13px]">
              {score === exercises.length ? '¡Perfecto!' : score >= exercises.length * 0.8 ? '¡Muy bien!' : 'Sigue practicando'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button onClick={reset} className="w-full py-3.5 rounded-lg bg-[#F0F5FF] text-gray-900 text-[15px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors">
            🔄 Repetir
          </button>
          <button onClick={onComplete} className="w-full py-3.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[15px] font-semibold hover:bg-[#6cb5ff] transition-colors">
            Terminar
          </button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="space-y-5">
        <div className="text-center pt-4 sm:pt-6 pb-1">
          <h3 className="text-[23px] sm:text-[27px] font-bold text-gray-900 leading-tight" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}>
            {block.title || 'Wat zeg je?'}
          </h3>
        </div>

        <div className="rounded-2xl border border-[#DDE6F5] bg-[#F0F5FF] p-5">
          <p className="text-[15px] text-[#0a1656] leading-relaxed">
            {block.intro || 'Te vas a encontrar en situaciones normales del día a día. Escucha las tres respuestas y elige la que dirías tú. El texto no aparece hasta que contestas.'}
          </p>
        </div>

        {lastAttempt && (
          <div className="rounded-lg border border-[#DDE6F5] bg-white px-4 py-3">
            <p className="text-[13px] font-bold text-gray-900">
              Última vez: {lastAttempt.score} / {lastAttempt.total} correctas
            </p>
            {lastAttempt.failedLabels.length > 0 && (
              <p className="text-[12px] text-[#5A6480] leading-snug mt-1">
                <span className="font-semibold text-gray-900">Fallaste en:</span>{' '}
                {lastAttempt.failedLabels.slice(0, 3).join(' · ')}
                {lastAttempt.failedLabels.length > 3 && ` · +${lastAttempt.failedLabels.length - 3}`}
              </p>
            )}
          </div>
        )}

        <button
          onClick={() => setStarted(true)}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[15px] font-semibold hover:bg-[#6cb5ff] transition-colors"
        >
          Empezar
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  const pct = Math.round(((index + (answered ? 1 : 0)) / exercises.length) * 100);

  return (
    <div className="space-y-5">
      <GradientBar pct={pct} />
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[#9CA3AF]">
          {index + 1} de {exercises.length}
        </span>
        <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#16a34a] bg-green-50 border border-green-200 px-3 py-1 rounded-full">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {score}
        </div>
      </div>

      <ExerciseStep key={exKey} exercise={exercises[index]} onAnswer={handleAnswer} />

      {answered && (
        <button
          onClick={next}
          className="w-full py-4 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[15px] font-semibold hover:bg-[#6cb5ff] transition-colors flex items-center justify-center gap-2"
        >
          {index + 1 >= exercises.length ? 'Ver resultado' : 'Siguiente'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}

function LuisterenSection({
  dialogue,
  practiceExercises: allExercises,
  onComplete: _onComplete,
  cacheKey,
  reviewOnly,
}: {
  dialogue: Dialogue;
  practiceExercises: ExerciseItem[];
  onComplete: () => void;
  cacheKey?: string;
  /** Modo repaso: solo se ejecutan los ejercicios fallados en el último intento. */
  reviewOnly?: boolean;
}) {
  // Tres vistas: landing (solo audios + CTAs) → dialogue (transcript) → exercises
  const [view, setView] = useState<'landing' | 'dialogue' | 'exercises'>('landing');
  // Reproductor desplegado mientras se hacen los ejercicios. Abierto por
  // defecto: escuchar durante la prueba es parte del ejercicio.
  const [playerOpen, setPlayerOpen] = useState(true);
  const exercisesRef = useRef<HTMLDivElement | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [wrongIndices, setWrongIndices] = useState<Set<number>>(new Set());
  const [answered, setAnswered] = useState(false);
  const [answeredSet, setAnsweredSet] = useState<Set<number>>(new Set());
  const [exKey, setExKey] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [exercisesDone, setExercisesDone] = useState(false);
  // El texto del diálogo no se puede leer hasta completar los ejercicios (queda
  // desbloqueado para siempre una vez hechos, aunque se repitan).
  const [transcriptUnlocked, setTranscriptUnlocked] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<LastAttempt | null>(null);
  const session = useLHSession() as any;
  const accessToken: string | undefined = session?.data?.tokens?.access_token;

  // Load any previous attempt for this section on mount.
  useEffect(() => {
    if (!cacheKey) return;
    let active = true;
    getLastAttempt(cacheKey, accessToken).then((a) => {
      if (active) { setLastAttempt(a); if (a) setTranscriptUnlocked(true); }
    });
    return () => {
      active = false;
    };
  }, [cacheKey, accessToken]);

  // Modo repaso: solo los ejercicios fallados la última vez (por prompt).
  const practiceExercises = useMemo(() => {
    if (!reviewOnly || !lastAttempt?.failedLabels?.length) return allExercises;
    const failedSet = new Set(lastAttempt.failedLabels);
    const filtered = allExercises.filter((e) => failedSet.has(e.prompt));
    return filtered.length > 0 ? filtered : allExercises;
  }, [allExercises, reviewOnly, lastAttempt]);
  const hasExercises = practiceExercises.length > 0;

  function resetAttempt() {
    setExerciseIndex(0);
    setScore(0);
    setWrongIndices(new Set());
    setAnswered(false);
    setAnsweredSet(new Set());
    setExKey((k) => k + 1);
    setExercisesDone(false);
  }

  function onAnswerEx(correct: boolean) {
    setAnswered(true);
    if (answeredSet.has(exerciseIndex)) return; // ya contado: no duplicar al volver
    setAnsweredSet((s) => new Set(s).add(exerciseIndex));
    if (correct) setScore((s) => s + 1);
    else setWrongIndices((w) => { const next = new Set(w); next.add(exerciseIndex); return next; });
  }

  function goNextEx() {
    if (exerciseIndex + 1 >= practiceExercises.length) {
      if (cacheKey) {
        const failed = Array.from(wrongIndices).sort((a, b) => a - b)
          .map((i) => practiceExercises[i]?.prompt).filter((p): p is string => !!p);
        if (reviewOnly && lastAttempt) {
          // Repaso: los ahora acertados salen de la lista y suman a la nota
          // original; los que no entraron en este repaso se conservan.
          const wrongNow = new Set(failed);
          const stillFailed = lastAttempt.failedLabels.filter((l) =>
            practiceExercises.some((e) => e.prompt === l) ? wrongNow.has(l) : true
          );
          const resolved = lastAttempt.failedLabels.length - stillFailed.length;
          saveLastAttempt(cacheKey, {
            score: Math.min(lastAttempt.total, lastAttempt.score + resolved),
            total: lastAttempt.total,
            failedLabels: stillFailed,
          }, accessToken);
        } else {
          saveLastAttempt(cacheKey, { score, total: practiceExercises.length, failedLabels: failed }, accessToken);
        }
      }
      setExercisesDone(true);
      setTranscriptUnlocked(true);
    } else {
      setExerciseIndex((i) => i + 1);
      setAnswered(false);
      setExKey((k) => k + 1);
    }
  }

  // Bajar hasta las preguntas al empezar, dejando el audio a la vista arriba.
  useEffect(() => {
    if (view !== 'exercises') return;
    const id = window.setTimeout(
      () => exercisesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      60,
    );
    return () => window.clearTimeout(id);
  }, [view]);

  function goPrevEx() {
    if (exerciseIndex === 0) return;
    const ni = exerciseIndex - 1;
    setExerciseIndex(ni);
    setAnswered(answeredSet.has(ni));
    setExKey((k) => k + 1);
  }

  const exercise = practiceExercises[exerciseIndex];
  const pct = view !== 'exercises' ? 0
    : Math.round(((exerciseIndex + (answered ? 1 : 0)) / Math.max(practiceExercises.length, 1)) * 100);

  /* ── Vista 1: Landing — solo audios + 2 CTAs, texto oculto ─────────── */
  if (view === 'landing') {
    return (
      <div className="space-y-5">
        {/* Solo el título en neerlandés. Va alineado a la izquierda, como el
            resto de la lección: centrado y con mucho aire arriba dejaba un
            hueco raro debajo del nombre de la clase, y en móvil el título
            largo partido y centrado se leía peor. */}
        <div className="pb-0.5">
          <h3 className="text-[22px] sm:text-[26px] font-bold text-gray-900 leading-tight" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}>
            {dialogue.title}
          </h3>
        </div>

        {/* Last-attempt banner — only when we have one and there are exercises. */}
        {lastAttempt && hasExercises && (
          <div className="rounded-lg border border-[#DDE6F5] bg-[#F0F5FF] px-4 py-3">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <p className="text-[13px] font-bold text-gray-900">
                Última vez: {lastAttempt.score} / {lastAttempt.total} correctas
              </p>
              <button
                onClick={() => { resetAttempt(); setView('exercises'); }}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[12px] font-semibold hover:bg-[#6cb5ff] transition-colors"
              >
                🔄 Repetir test
              </button>
            </div>
            {lastAttempt.failedLabels.length > 0 && (
              <p className="text-[12px] text-[#5A6480] leading-snug">
                <span className="font-semibold text-gray-900">Fallaste en:</span>{' '}
                {lastAttempt.failedLabels.slice(0, 3).join(' · ')}
                {lastAttempt.failedLabels.length > 3 && ` · +${lastAttempt.failedLabels.length - 3}`}
              </p>
            )}
          </div>
        )}

        {/* Reproductor del diálogo: barra de progreso, ±2s, líneas que se
            iluminan, velocidad normal/lenta y dos voces (una por interlocutor). */}
        <div>
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className="text-2xl leading-none">🎧</span>
            <div>
              <p className="text-[15px] font-bold text-gray-900 leading-tight">Escucha el diálogo</p>
              <p className="text-[12px] text-[#9CA3AF] leading-tight">Sigue las líneas mientras suena · ajusta la velocidad</p>
            </div>
          </div>
          <DialoguePlayer lines={dialogue.lines} accentColor="#4da3ff" />
        </div>

        {/* El texto del diálogo se desbloquea al terminar los ejercicios. */}
        <div className="space-y-2 pt-2">
          {hasExercises && !transcriptUnlocked ? (
            <>
              <button
                onClick={() => setView('exercises')}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[15px] font-semibold hover:bg-[#6cb5ff] transition-colors duration-200"
              >
                Hacer los ejercicios
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#F0F5FF] border border-[#DDE6F5] text-[#9CA3AF] text-[13px] font-medium">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v4m-6 6h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm9-12V7a4 4 0 10-8 0v2" />
                </svg>
                Podrás leer el diálogo al terminar los ejercicios
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setView('dialogue')}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[15px] font-semibold hover:bg-[#6cb5ff] transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
                Ver el diálogo
              </button>
              {hasExercises && (
                <button
                  onClick={() => setView('exercises')}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-lg bg-white border border-[#DDE6F5] text-gray-900 text-[15px] font-semibold hover:bg-[#F0F5FF] transition-colors duration-200"
                >
                  Repetir los ejercicios
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── Vista 2: Diálogo — transcript estilo guión con traducción togglable ─ */
  if (view === 'dialogue') {
    return (
      <div className="space-y-4">
        {/* Cabecera: volver + toggle traducción */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setView('landing')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#5A6480] hover:text-[#025dc7] hover:bg-[#F0F5FF] transition-colors duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <button
            onClick={() => setShowTranslation(t => !t)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors duration-200 ${
              showTranslation
                ? 'bg-[#4da3ff] text-[#1D0084] hover:bg-[#6cb5ff]'
                : 'bg-white border border-[#DDE6F5] text-gray-900 hover:bg-[#F0F5FF]'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            {showTranslation ? 'Ocultar traducción' : 'Ver traducción'}
          </button>
        </div>

        {/* Título arriba */}
        <div className="border-b border-[#DDE6F5] pb-3">
          <h3 className="text-[18px] font-bold text-gray-900 leading-snug" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}>
            {dialogue.title}
          </h3>
        </div>

        {/* Transcript — estilo limpio tipo guión de libro */}
        <div className="space-y-4">
          {dialogue.lines.map(line => (
            <div key={line.id} className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                {line.speaker}
              </p>
              <p className="text-[16px] text-gray-900 leading-relaxed font-medium">
                {line.dutch}
              </p>
              {showTranslation && (
                <p className="text-[14px] text-[#5A6480] italic leading-relaxed">
                  {line.spanish}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* CTA a ejercicios */}
        {hasExercises && (
          <button
            onClick={() => setView('exercises')}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[15px] font-semibold hover:bg-[#6cb5ff] transition-colors duration-200 mt-6"
          >
            Ir a los ejercicios
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  /* ── Step 2: exercises ─────────────────────────────────── */

  // Results banner shown after last exercise
  if (exercisesDone) {
    const failedLabels = Array.from(wrongIndices)
      .sort((a, b) => a - b)
      .map((i) => practiceExercises[i]?.prompt)
      .filter(Boolean) as string[];
    return (
      <div className="space-y-4">
        <GradientBar pct={100} />
        <div className="flex items-center gap-3 rounded-2xl px-5 py-4" style={{ background: 'linear-gradient(135deg, #1D0084 0%, #025dc7 100%)' }}>
          <span className="text-2xl">{score >= practiceExercises.length * 0.8 ? '🎉' : '📝'}</span>
          <div>
            <p className="text-white font-bold text-[15px]">{score} / {practiceExercises.length} correctas</p>
            <p className="text-white/60 text-[13px]">
              {score === practiceExercises.length ? '¡Perfecto!' : score >= practiceExercises.length * 0.8 ? '¡Muy bien!' : 'Sigue practicando'}
            </p>
          </div>
        </div>

        {/* Failed-items list — apuntar las palabras que falles, justo aquí. */}
        {failedLabels.length > 0 && (
          <div className="rounded-lg border border-[#DDE6F5] bg-white p-4">
            <p className="text-[12px] font-semibold text-gray-900 uppercase tracking-wide mb-2">
              Fallaste en {failedLabels.length}
            </p>
            <ul className="space-y-1.5">
              {failedLabels.map((label, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-gray-700 leading-snug">
                  <span className="text-[#4da3ff] mt-px shrink-0">•</span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={() => { resetAttempt(); setView('landing'); }}
          className="w-full py-3.5 rounded-lg bg-[#F0F5FF] text-gray-900 text-[15px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200"
        >
          🔄 Repetir los ejercicios
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <GradientBar pct={pct} />

      {/* El mismo reproductor, aquí arriba: hay que poder volver a escuchar
          mientras se responde, que es justo lo que se hace en un examen de
          comprensión oral. Los audios ya están en memoria de la pantalla
          anterior, así que no se vuelven a generar. */}
      <div className="rounded-xl border border-[#DDE6F5] bg-[#FBFDFF] p-3">
        <button
          onClick={() => setPlayerOpen((v) => !v)}
          className="w-full flex items-center gap-2 text-left"
        >
          <span className="text-[17px] leading-none">🎧</span>
          <span className="flex-1 text-[13px] font-bold text-gray-900">Escuchar el diálogo</span>
          <svg
            className={`w-4 h-4 text-[#9CA3AF] transition-transform ${playerOpen ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {playerOpen && (
          <div className="mt-3">
            <DialoguePlayer lines={dialogue.lines} accentColor="#4da3ff" />
          </div>
        )}
      </div>

      {/* Sin "Volver al diálogo": el reproductor está fijado justo arriba,
          así que volver no lleva a ningún sitio nuevo y el botón solo servía
          para perder las respuestas empezadas. */}
      <div ref={exercisesRef} className="flex items-center justify-end scroll-mt-4">
        <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#16a34a] bg-green-50 border border-green-200 px-3 py-1 rounded-full">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {score}
        </div>
      </div>
      {exercise && (
        <>
          {/* Flechas laterales (desktop) — avanzar/retroceder sin scroll */}
          <div className="relative md:px-[84px]">
            <button
              onClick={exerciseIndex > 0 ? goPrevEx : undefined}
              aria-label="Anterior"
              className={`hidden md:flex absolute left-0 top-5 w-11 h-11 items-center justify-center rounded-2xl transition-all duration-200 ${
                exerciseIndex > 0 ? 'text-[#9CA3AF] hover:bg-[#F0F5FF] hover:text-[#025dc7] cursor-pointer' : 'text-[#E8ECF4] pointer-events-none'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div key={exKey}>
              <ExerciseStep exercise={exercise} onAnswer={onAnswerEx} />
            </div>
            <button
              onClick={answered ? goNextEx : undefined}
              aria-label="Siguiente"
              title={answered ? '' : 'Responde primero'}
              className={`hidden md:flex absolute right-0 top-5 w-11 h-11 items-center justify-center rounded-2xl transition-all duration-300 ${
                answered ? 'bg-[#4da3ff] text-[#1D0084] cursor-pointer hover:bg-[#6cb5ff]' : 'bg-[#F0F5FF] text-[#C7D2E8] border border-[#DDE6F5] cursor-not-allowed'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          {/* Móvil: botón abajo */}
          <button onClick={answered ? goNextEx : undefined} disabled={!answered} className={`md:hidden w-full flex items-center justify-center gap-2 py-4 rounded-lg text-[15px] font-semibold transition-colors duration-200 ${answered ? 'bg-[#4da3ff] text-[#1D0084] hover:bg-[#6cb5ff]' : 'bg-[#F0F5FF] text-[#9CA3AF] border border-[#DDE6F5] cursor-not-allowed'}`}>
            {answered ? (exerciseIndex + 1 < practiceExercises.length ? 'Siguiente ejercicio' : 'Ver resultado') : 'Responde primero'}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SECTION LANDING — list of sections
───────────────────────────────────────────────────────────────────────────── */

function SectionLanding({
  sections,
  completedSections,
  onEnter,
  nextLesson,
  moduleId,
  orgslug,
  inCourse,
}: {
  sections: SectionId[];
  completedSections: Set<SectionId>;
  onEnter: (s: SectionId) => void;
  nextLesson?: Lesson | null;
  moduleId?: string;
  orgslug: string;
  inCourse?: boolean;
}) {
  const allComplete = sections.length > 0 && sections.every(s => completedSections.has(s));
  return (
    <div className="space-y-3">
      {sections.map((id) => {
        const meta = SECTION_META[id];
        const done = completedSections.has(id);
        return (
          <button
            key={id}
            onClick={() => onEnter(id)}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-white border border-[#DDE6F5] hover:border-[#025dc7]/40 hover:bg-[#F8FAFF] transition-all duration-200 text-left group"
          >
            {/* Icon / Done badge */}
            <div className="w-12 h-12 flex items-center justify-center shrink-0">
              {done ? (
                <div className="w-10 h-10 rounded-lg bg-[#4da3ff] flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#1D0084]" fill="none" stroke="currentColor" strokeWidth={2.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <span
                  className="text-[34px] leading-none select-none"
                  style={{ filter: 'drop-shadow(0 2px 6px rgba(29,0,132,0.12))' }}
                  aria-hidden
                >
                  {meta.emoji}
                </span>
              )}
            </div>

            {/* Labels */}
            <div className="flex-1 min-w-0">
              <p
                className="text-[16px] font-bold text-gray-900 leading-tight"
                style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}
              >
                {meta.label}
              </p>
              <p className="text-[13px] font-semibold text-[#025dc7] mt-0.5">{meta.desc}</p>
            </div>

            {/* Arrow */}
            <svg
              className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#025dc7] transition-colors duration-200 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        );
      })}
      {/* In a course, the course's own action bar handles next/completion. */}
      {inCourse ? null : allComplete && nextLesson && moduleId ? (
        <Link
          href={getUriWithOrg(orgslug, `/ejercicios/modulo/${moduleId}/leccion/${nextLesson.id}`)}
          className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-2xl text-white text-[16px] font-bold transition-all duration-150 mt-2 brand-accent-line hover:brightness-110"
          style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}
        >
          Siguiente lección
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN LESSON VIEWER
───────────────────────────────────────────────────────────────────────────── */

interface LessonViewerProps {
  lesson: Lesson;
  module: CourseModule;
  prevLesson?: Lesson | null;
  nextLesson?: Lesson | null;
  orgslug: string;
  /** When embedded inside a course activity, the course's own action bar handles
   *  completion + next, so the viewer hides its lesson-level "next" button. */
  inCourse?: boolean;
  /** Show ONLY this part of the lesson (e.g. 'vocabulary', 'lezen'): no landing,
   *  no back button. Used so each exercise part is its own course class. */
  forcedSection?: string;
  /** Fired when the lesson (or the forced part) is finished — lets a course
   *  activity auto-mark itself complete so progress saves without a manual click. */
  onComplete?: () => void;
  /** Dónde vive esta lección DENTRO de la formación (curso + clase). Se guarda
   *  con la posición del alumno para que "Continúa donde lo dejaste" le
   *  devuelva a la formación, no a la app de ejercicios. */
  courseLocation?: { courseUuid: string; activityUuid: string };
}

export default function LessonViewer({ lesson, module, prevLesson: _prev, nextLesson, orgslug, inCourse, forcedSection, onComplete, courseLocation }: LessonViewerProps) {
  const session = useLHSession() as any;
  const { isAdmin } = useAdminStatus() as any;
  const accessToken: string | undefined = session?.data?.tokens?.access_token;
  const userUuid: string = session?.data?.user?.user_uuid || '';
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const [completedSections, setCompletedSections] = useState<Set<SectionId>>(new Set());
  const [forcedDone, setForcedDone] = useState(false);
  // Modo repaso (desde "Mi progreso"): ?repaso=1 ejecuta solo los fallos.
  const [reviewMode, setReviewMode] = useState(false);

  // ── Tiempo invertido en la lección ─────────────────────────────────────
  // Acumula segundos SOLO mientras la pestaña está visible. Se vuelca al
  // backend (lesson_completion.time_seconds, que suma incrementos) al terminar
  // la lección y, en revisitas de lecciones ya completadas, al salir.
  const timeRef = useRef(0);
  const lessonDoneRef = useRef(false);

  // En revisitas de una lección ya completada, el tiempo también cuenta:
  // marcamos el flag desde el servidor para que el flush de salida lo vuelque.
  useEffect(() => {
    if (!accessToken || !lesson?.id) return;
    let active = true;
    listLessonCompletions(accessToken).then((rows) => {
      if (active && rows.some((r) => r.lesson_id === lesson.id)) {
        lessonDoneRef.current = true;
      }
    });
    return () => { active = false; };
  }, [accessToken, lesson?.id]);

  useEffect(() => {
    const tick = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        timeRef.current += 1;
      }
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  // Flush pendiente al desmontar / cerrar pestaña — solo si la lección ya
  // está completada (así una simple ojeada nunca crea una compleción falsa).
  useEffect(() => {
    const flush = () => {
      const secs = Math.round(timeRef.current);
      if (!lessonDoneRef.current || secs < 5 || !accessToken) return;
      timeRef.current = 0;
      markLessonCompletedRemote(
        lesson.id,
        { module_id: lesson.moduleId, time_seconds: Math.min(secs, 3600) },
        accessToken,
      );
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, lesson?.id]);

  // Track the student's last position so the home can show "Continúa donde lo
  // dejaste" with the exact lesson + section. Se guarda SIEMPRE al entrar en
  // una lección — también dentro del curso — para que la tarjeta del Inicio
  // apunte siempre a la ÚLTIMA lección que abriste. Fire-and-forget.
  useEffect(() => {
    if (!accessToken || !lesson?.id) return;
    patchStudentProgress(
      {
        current_position: {
          // 'formacion' cuando la lección se está viendo dentro del curso:
          // así el Inicio sabe devolver al alumno a la formación y no a la
          // app de ejercicios (que es solo para repasar).
          area: courseLocation ? 'formacion' : 'ejercicios',
          module_id: lesson.moduleId,
          lesson_id: lesson.id,
          lesson_title: lesson.title,
          section_id: activeSection ?? forcedSection ?? null,
          course_uuid: courseLocation?.courseUuid ?? null,
          activity_uuid: courseLocation?.activityUuid ?? null,
          updated_at: new Date().toISOString(),
        },
      },
      accessToken,
    );
  }, [
    accessToken,
    inCourse,
    lesson?.id,
    lesson?.moduleId,
    lesson?.title,
    activeSection,
    forcedSection,
    courseLocation?.courseUuid,
    courseLocation?.activityUuid,
  ]);

  // Persist each graded answer to the per-student progress table (Supabase) so
  // the academy remembers what each student got right/wrong. Fire-and-forget;
  // failures are swallowed (e.g. anon write policy missing) to never block the UI.
  function handleItemResult(itemId: string, correct: boolean) {
    if (!userUuid) return;
    saveItemResult(userUuid, lesson.id, itemId, correct, 'practice').catch(() => {});
  }

  useEffect(() => {
    // Direct URL access (typically from Circle): mark all prior lessons as
    // completed so the in-app module list stays coherent for students who
    // progress via Circle rather than via our internal navigation.
    markPreviousAsCompleted(lesson);
    markLessonStarted(lesson.id, lesson.moduleId);
    const existing = getLessonProgress(lesson.id);
    if (existing?.status === 'completed') {
      // Pre-mark all sections as done for returning students
    }
  }, [lesson.id, lesson.moduleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Construye el mapa texto->audio_url para que los ejercicios usen MP3
  // de ElevenLabs en vez de TTS cuando hagan speakDutch().
  // Fuentes:
  //   - vocabulary_items.audio_url (con y sin artículo)
  //   - phrases.audio_url
  //   - practice_items con texto entre comillas (URL determinista en Storage)
  useEffect(() => {
    const map: Record<string, string> = {};
    const supabaseUrl = getConfig('NEXT_PUBLIC_SUPABASE_URL', '');
    // slug local para reconstruir URLs deterministas (debe coincidir con generate-audio.mjs)
    const slug = (s: string) => s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

    for (const block of lesson.blocks) {
      if (block.type === 'vocabulary') {
        for (const v of block.items) {
          // Palabra SIN artículo → audio_url en DB
          if (v.audio?.url) {
            map[v.dutch.trim().toLowerCase()] = v.audio.url;
          }
          // CON artículo → URL determinista (vocab/{lessonId}-{slug}-art.mp3)
          // El lesson_id no llega al cliente directamente; usamos un selector basado en
          // el patrón de la audio_url existente (extraemos {lessonId}-{slug}).
          if (v.article && supabaseUrl && v.audio?.url) {
            const articleUrl = v.audio.url.replace(/\.mp3$/, '-art.mp3');
            map[joinDutch(v.article, v.dutch).toLowerCase()] = articleUrl;
          }
        }
      }
      if (block.type === 'phrases') {
        for (const p of block.items) {
          if (p.audio?.url) {
            map[p.dutch.trim().toLowerCase()] = p.audio.url;
          }
        }
      }
      if (block.type === 'practice' && supabaseUrl) {
        for (const ex of block.exercises) {
          // Listen_* → practice/{id}.mp3
          if (ex.type === 'listen_and_choose' || ex.type === 'listen_translate') {
            const m = ex.prompt.match(/"([^"]+)"/);
            if (m) {
              map[m[1].trim().toLowerCase()] = `${supabaseUrl}/storage/v1/object/public/nawar-audio/practice/${ex.id}.mp3`;
            }
          }
          // Fill_blank options → options/{slug(text)}.mp3 (compartido global)
          if (ex.type === 'fill_blank' && ex.options) {
            for (const opt of ex.options) {
              const text = opt.trim();
              if (!text) continue;
              const s = slug(text);
              if (!s) continue;
              map[text.toLowerCase()] = `${supabaseUrl}/storage/v1/object/public/nawar-audio/options/${s}.mp3`;
            }
          }
        }
      }
    }
    setWordAudioMap(map);
    return () => setWordAudioMap({});
  }, [lesson]);

  // Build available sections from blocks (order matters → landing)
  const availableSections: SectionId[] = (() => {
    const result: SectionId[] = [];
    for (const block of lesson.blocks) {
      if (block.type === 'summary') {
        result.push('resumen');
      } else if (block.type === 'vocabulary') {
        result.push('vocabulary');
        result.push('flashcards');
      } else if (block.type === 'lezen') {
        result.push('lezen');
      } else if (block.type === 'dialogue') {
        result.push('luisteren');
      } else if (block.type === 'spreken') {
        result.push('spreken');
      }
    }
    return result;
  })();

  // Deep-link desde "Mi progreso": ?seccion=lezen abre esa sección directa y
  // ?repaso=1 activa el modo repaso (solo los ejercicios fallados la última vez).
  useEffect(() => {
    if (typeof window === 'undefined' || forcedSection) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('repaso') === '1') setReviewMode(true);
    const sec = sp.get('seccion');
    if (sec && availableSections.includes(sec as SectionId)) {
      setActiveSection(sec as SectionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A forced section (e.g. 'vocabulary' / 'lezen') is shown on its own, only if
  // the lesson actually has it.
  const forced = (forcedSection && availableSections.includes(forcedSection as SectionId))
    ? (forcedSection as SectionId)
    : null;
  const forcedMissing = Boolean(forcedSection) && !forced;

  // In a course: jump straight into the requested part (or vocabulary by default),
  // skipping the section landing.
  const didAutoEnter = useRef(false);
  useEffect(() => {
    if (!inCourse || didAutoEnter.current || activeSection !== null) return;
    // A specific part was requested: enter it, or (if the lesson lacks it) leave
    // null so the "missing" panel shows — never silently enter another part.
    if (forcedSection) {
      if (forced) {
        didAutoEnter.current = true;
        setActiveSection(forced);
      }
      return;
    }
    const target = availableSections.includes('vocabulary') ? 'vocabulary' : availableSections[0];
    if (target) {
      didAutoEnter.current = true;
      setActiveSection(target);
    }
  }, [inCourse, availableSections]); // eslint-disable-line react-hooks/exhaustive-deps

  function completeSection(id: SectionId) {
    const next = new Set([...completedSections, id]);
    setCompletedSections(next);
    const allDone = availableSections.length > 0 && availableSections.every(s => next.has(s));
    if (allDone) markLessonCompleted(lesson.id, lesson.moduleId, 0, 0, []);

    const token: string | undefined = session?.data?.tokens?.access_token;

    // Persist "section done" on the backend so the lesson cards can show the
    // per-section progress without forcing the student to re-open every lesson.
    // Lezen and Luisteren already write their own (richer) attempt records.
    // Vocabulary guarda su propia nota rica (score/total/fallos) al terminar
    // sus pasos — el marcador 0/0 la machacaría.
    if (id !== 'lezen' && id !== 'luisteren' && id !== 'resumen' && id !== 'vocabulary') {
      saveLastAttempt(
        `${lesson.id}-${id}`,
        { score: 0, total: 0, failedLabels: [] },
        token,
      );
    }

    // When every section of the lesson is done, register the lesson completion
    // server-side so /progreso and "continúa donde lo dejaste" can read it —
    // including the seconds spent on the lesson this visit (the API accumulates).
    if (allDone) {
      lessonDoneRef.current = true;
      const secs = Math.min(Math.round(timeRef.current), 3600);
      timeRef.current = 0;
      markLessonCompletedRemote(
        lesson.id,
        { module_id: lesson.moduleId, time_seconds: secs >= 5 ? secs : 0 },
        token,
      );
    }

    // In single-part (forced) mode the activity IS this part: finishing it
    // completes the activity. In whole-lesson mode, only when every part is done.
    if (forced) {
      setForcedDone(true);
      setActiveSection(null);
      onComplete?.();
      return;
    }
    if (allDone) onComplete?.();
    setActiveSection(null);
  }

  const summaryBlock  = lesson.blocks.find(b => b.type === 'summary');
  const vocabBlock    = lesson.blocks.find(b => b.type === 'vocabulary');
  const phraseBlock   = lesson.blocks.find(b => b.type === 'phrases');
  const practiceBlock = lesson.blocks.find(b => b.type === 'practice');
  const lezenBlock    = lesson.blocks.find(b => b.type === 'lezen');
  const dialogueBlock = lesson.blocks.find(b => b.type === 'dialogue');
  const sprekenBlock  = lesson.blocks.find(b => b.type === 'spreken');

  const phraseItems    = phraseBlock   && phraseBlock.type   === 'phrases'  ? phraseBlock.items        : [];
  const practiceItems  = practiceBlock && practiceBlock.type === 'practice' ? practiceBlock.exercises  : [];

  const activeMeta = activeSection ? SECTION_META[activeSection] : null;

  return (
    // El curso y la clase donde se lee, para que los textos subrayables no
    // tengan que recibirlo por props a través de media docena de secciones.
    <ProveedorResaltado
      courseUuid={courseLocation?.courseUuid}
      activityUuid={courseLocation?.activityUuid}
      nombre={lesson?.title || ''}
    >
      {/* ── Header ── In a course the activity page already shows the lesson
           name, so we drop the big banner-like title + extra padding and keep
           only the "back to parts" link (whole-lesson mode). ── */}
      <div>
        <div className={inCourse ? '' : 'max-w-(--breakpoint-2xl) mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-2'}>
          {/* Breadcrumb — where am I (whole-lesson mode only) */}
          {!inCourse && (
            <div className="mb-4">
              <Breadcrumbs items={[
                { label: 'Repasar', href: getUriWithOrg(orgslug, '/ejercicios'), icon: <Dumbbell size={14} /> },
                { label: module.title, href: getUriWithOrg(orgslug, `/ejercicios/modulo/${module.id}`) },
                { label: lesson.title },
              ]} />
            </div>
          )}
          {/* Inside a section: a subtle link back to the lesson landing
              (hidden in single-part mode — there's no landing to return to) */}
          {activeSection !== null && !forced && (
            <button
              onClick={() => setActiveSection(null)}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5A6480] hover:text-[#025dc7] transition-colors duration-200 mb-3"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              <span className="truncate">{lesson.title}</span>
            </button>
          )}
          {/* Solo admin: saltar la sección de EJERCICIOS (Oefeningen, Lezen,
              Luisteren) sin completarlos. No aparece en Resumen ni Flashcards.
              Los alumnos NO ven este botón. */}
          {activeSection !== null && isAdmin &&
            (activeSection === 'vocabulary' || activeSection === 'lezen' || activeSection === 'luisteren') && (
            <button
              onClick={() => completeSection(activeSection)}
              title="Solo admin: marca esta sección como vista y vuelve, sin completar los ejercicios"
              className="ml-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 hover:bg-amber-100 transition-colors mb-3"
            >
              Saltar (admin) →
            </button>
          )}

          {!inCourse && (
            <div className="flex items-start gap-3">
              <span className="text-4xl">{module.emoji}</span>
              <div>
                <h1
                  className="text-[24px] font-bold text-gray-900 leading-tight"
                  style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}
                >
                  {activeSection ? activeMeta!.label : lesson.title}
                </h1>
                <p className="text-[13px] font-semibold text-[#025dc7] mt-0.5">
                  {activeSection ? activeMeta!.desc : `${lesson.subtitle} · ${lesson.estimatedMinutes} min`}
                </p>
                {activeSection && (
                  <p className="text-[12px] text-[#8A93AB] mt-0.5 truncate">
                    {module.emoji} {lesson.title}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Dentro de un curso, la actividad ya se titula "2.2 Flashcards" —
              esta línea discreta recuerda de QUÉ lección viene la práctica. */}
          {inCourse && (
            <p className="text-[12.5px] font-semibold text-[#8A93AB] mb-2 flex items-center gap-1.5 min-w-0">
              <span className="shrink-0">{module.emoji}</span>
              <span className="truncate">{lesson.title}</span>
              {lesson.subtitle && (
                <span className="hidden sm:inline text-[#B5BDD0] font-normal truncate">· {lesson.subtitle}</span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className={inCourse ? 'pt-1 pb-4' : 'pt-2 pb-6'}>
        <div className={inCourse ? 'mx-auto max-w-5xl px-0' : 'max-w-(--breakpoint-2xl) mx-auto px-4 sm:px-6 lg:px-8'}>
         <div className={inCourse ? 'contents' : 'max-w-5xl'}>

          {/* Requested part doesn't exist in this lesson */}
          {forcedMissing && (
            <div className="rounded-2xl border border-[#DDE6F5] bg-[#F0F5FF] px-6 py-10 text-center">
              <p className="text-[15px] font-semibold text-gray-900">Esta lección no tiene esa parte todavía.</p>
              <p className="text-[13px] text-[#5A6480] mt-1">Pulsa «Siguiente» abajo para continuar.</p>
            </div>
          )}

          {/* Single-part completed */}
          {forcedDone && (
            <div className="flex flex-col items-center text-center rounded-2xl py-12 px-6 gap-3" style={{ background: 'linear-gradient(135deg, #1D0084 0%, #025dc7 100%)' }}>
              <span className="text-5xl">⭐</span>
              <p className="text-white font-bold text-[22px]" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}>¡Parte completada!</p>
              <p className="text-white/70 text-[14px]">Pulsa «Siguiente» abajo para continuar.</p>
            </div>
          )}

          {/* LANDING */}
          {!forcedMissing && !forcedDone && activeSection === null && (
            <>
              {/* Recordatorio: apunta tus errores. Dentro del curso el progreso
                  sí se guarda, así que el aviso solo aplica al modo standalone. */}
              {!inCourse && (
                <div className="rounded-2xl bg-[#FFF8E1] border border-[#F5D96A]/50 px-4 py-3 mb-6 flex gap-3">
                  <span className="text-xl shrink-0" aria-hidden>📝</span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#7A5A0E] leading-tight mb-0.5">
                      Consejo: apunta las palabras que falles
                    </p>
                    <p className="text-[12px] text-[#9C793B] leading-snug">
                      Tus respuestas no se guardan entre sesiones. Llevar un cuaderno con los errores te ayuda a repasarlos después.
                    </p>
                  </div>
                </div>
              )}

              <SectionLanding
                sections={availableSections}
                completedSections={completedSections}
                onEnter={setActiveSection}
                nextLesson={nextLesson}
                moduleId={module.id}
                orgslug={orgslug}
                inCourse={inCourse}
              />
            </>
          )}

          {/* RESUMEN — puntos clave de la lección */}
          {activeSection === 'resumen' && summaryBlock && summaryBlock.type === 'summary' && (
            <ResumenSection
              block={summaryBlock}
              vocabItems={vocabBlock && vocabBlock.type === 'vocabulary' ? vocabBlock.items : []}
              phraseItems={phraseBlock && phraseBlock.type === 'phrases' ? phraseBlock.items : []}
              inCourse={inCourse}
              onComplete={() => completeSection('resumen')}
            />
          )}

          {/* VOCABULARY — full practice centre */}
          {activeSection === 'vocabulary' && vocabBlock && vocabBlock.type === 'vocabulary' && (
            <VocabPracticeSection
              vocabItems={vocabBlock.items}
              phraseItems={phraseItems}
              practiceExercises={practiceItems}
              onComplete={() => completeSection('vocabulary')}
              onItemResult={handleItemResult}
              inCourse={inCourse}
              cacheKey={`${lesson.id}-vocabulary`}
              reviewOnly={reviewMode}
            />
          )}

          {/* FLASHCARDS */}
          {activeSection === 'flashcards' && vocabBlock && vocabBlock.type === 'vocabulary' && (
            <FlashcardSection
              items={vocabBlock.items}
              onComplete={() => completeSection('flashcards')}
            />
          )}

          {/* LEZEN */}
          {activeSection === 'lezen' && lezenBlock && lezenBlock.type === 'lezen' && (
            <LezenSection
              textNl={lezenBlock.textNl}
              textEs={lezenBlock.textEs}
              exercises={lezenBlock.exercises}
              onComplete={() => completeSection('lezen')}
              cacheKey={`${lesson.id}-lezen`}
              reviewOnly={reviewMode}
            />
          )}

          {/* SPREKEN */}
          {activeSection === 'spreken' && sprekenBlock && sprekenBlock.type === 'spreken' && (
            <SprekenSection
              block={sprekenBlock}
              onComplete={() => completeSection('spreken')}
              cacheKey={`${lesson.id}-spreken`}
              reviewOnly={reviewMode}
            />
          )}

          {/* LUISTEREN */}
          {activeSection === 'luisteren' && dialogueBlock && dialogueBlock.type === 'dialogue' && (
            <LuisterenSection
              dialogue={dialogueBlock.dialogue}
              practiceExercises={
                dialogueBlock.exercises?.length ? dialogueBlock.exercises : practiceItems
              }
              onComplete={() => completeSection('luisteren')}
              cacheKey={`${lesson.id}-luisteren`}
              reviewOnly={reviewMode}
            />
          )}

         </div>
        </div>
      </div>
    </ProveedorResaltado>
  );
}
