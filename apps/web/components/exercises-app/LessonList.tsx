'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getLessonProgress } from '@/lib/exercises-app/progress';
import { getUriWithOrg } from '@services/config/config';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { getAllAttempts, type LastAttempt } from '@/lib/exercises-app/lastAttempts';
import type { Lesson, LessonStatus } from '@/lib/exercises-app/types';

type SectionId = 'vocabulary' | 'flashcards' | 'lezen' | 'luisteren';

/* Section-completion dots — one per section available in this lesson,
   filled blue when the student has at least one saved attempt for it. */
function SectionDots({
    lesson,
    attempts,
}: {
    lesson: Lesson;
    attempts: Record<string, LastAttempt>;
}) {
    const hasVocab = lesson.blocks.some((b) => b.type === 'vocabulary');
    const hasLezen = lesson.blocks.some((b) => b.type === 'lezen');
    const hasDialogue = lesson.blocks.some((b) => b.type === 'dialogue');
    const sections: { id: SectionId; label: string }[] = [];
    if (hasVocab) sections.push({ id: 'vocabulary', label: 'Vocabulario' });
    if (hasVocab) sections.push({ id: 'flashcards', label: 'Flashcards' });
    if (hasLezen) sections.push({ id: 'lezen', label: 'Lezen' });
    if (hasDialogue) sections.push({ id: 'luisteren', label: 'Luisteren' });
    if (sections.length === 0) return null;
    const done = sections.filter((s) => !!attempts[`${lesson.id}-${s.id}`]).length;
    return (
        <div className="flex items-center gap-1.5 mt-2">
            {sections.map((s) => {
                const isDone = !!attempts[`${lesson.id}-${s.id}`];
                return (
                    <span
                        key={s.id}
                        title={`${s.label} — ${isDone ? 'hecha' : 'pendiente'}`}
                        className={`w-2 h-2 rounded-full ${isDone ? 'bg-[#4da3ff]' : 'bg-[#DDE6F5]'}`}
                    />
                );
            })}
            <span className="text-[10px] font-semibold text-[#9CA3AF] ml-1 tabular-nums">
                {done}/{sections.length}
            </span>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   STATUS BADGE
───────────────────────────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: LessonStatus }) {
    if (status === 'completed') {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-[11px] font-semibold">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.59L5.41 12 6.83 10.58 10 13.75l7.17-7.17 1.41 1.42L10 16.59z" />
                </svg>
                Repasada
            </span>
        );
    }
    if (status === 'in_progress') {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F0F5FF] border border-[#DDE6F5] text-[#025dc7] text-[11px] font-semibold">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
                </svg>
                En curso
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F8F9FA] border border-[#DDE6F5] text-[#9CA3AF] text-[11px] font-semibold">
            Pendiente
        </span>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   LESSON LIST (client — reads localStorage)
───────────────────────────────────────────────────────────────────────────── */

export default function LessonList({ lessons, moduleId, orgslug }: { lessons: Lesson[]; moduleId: string; orgslug: string }) {
    const [statuses, setStatuses] = useState<Record<string, LessonStatus>>({});
    const [attempts, setAttempts] = useState<Record<string, LastAttempt>>({});
    const session = useLHSession() as any;
    const accessToken: string | undefined = session?.data?.tokens?.access_token;

    useEffect(() => {
        const s: Record<string, LessonStatus> = {};
        for (const lesson of lessons) {
            const p = getLessonProgress(lesson.id);
            s[lesson.id] = p?.status ?? 'pending';
        }
        setStatuses(s);
    }, [lessons]);

    // Per-section progress dots: fetch every saved attempt for this student in
    // a single call so each lesson card can render the right state without N
    // round-trips.
    useEffect(() => {
        if (!accessToken) return;
        let active = true;
        getAllAttempts(accessToken).then((map) => {
            if (active) setAttempts(map);
        });
        return () => { active = false; };
    }, [accessToken]);

    // First non-completed lesson is the "next" one
    const nextLessonId = lessons.find(l => statuses[l.id] !== 'completed')?.id;

    return (
        <div className="space-y-3">
            {lessons.map(lesson => {
                const status = statuses[lesson.id] ?? 'pending';
                const isNext = lesson.id === nextLessonId;

                const cardClass = `group flex items-start gap-4 rounded-2xl border p-5 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(29,0,132,0.08)] ${
                    isNext
                        ? 'border-[#1D0084]/30 bg-[#F0F5FF] hover:border-[#1D0084]/50'
                        : 'border-[#DDE6F5] bg-white hover:border-[#1D0084]/20'
                }`;

                return (
                    <Link
                        key={lesson.id}
                        href={getUriWithOrg(orgslug, `/ejercicios/modulo/${moduleId}/leccion/${lesson.id}`)}
                        className={cardClass}
                    >
                        {/* Order number */}
                        <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-bold shrink-0 ${
                                status === 'completed'
                                    ? 'bg-green-100 text-green-700'
                                    : isNext
                                    ? 'bg-[#4da3ff] text-[#1D0084]'
                                        : 'bg-[#F8F9FA] text-[#9CA3AF]'
                            }`}
                        >
                            {String(lesson.order).padStart(2, '0')}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                                <h3
                                    className="text-[15px] font-bold leading-snug text-gray-900 group-hover:text-[#025dc7] transition-colors duration-200"
                                    style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}
                                >
                                    {lesson.title}
                                </h3>
                                <StatusBadge status={status} />
                            </div>
                            <p className="text-[13px] text-[#9CA3AF] leading-snug mb-2">{lesson.subtitle}</p>
                            <SectionDots lesson={lesson} attempts={attempts} />
                            {/* Aire entre los puntos y la línea de abajo: pegadas
                                se leían como una sola cosa. */}
                            <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 text-[12px] text-[#5A6480]">
                                <span className="flex items-center gap-1 shrink-0">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {lesson.estimatedMinutes} min
                                </span>
                                <span className="hidden sm:inline text-[#DDE6F5]">·</span>
                                <span className="leading-snug">{lesson.learningObjective}</span>
                            </div>
                        </div>

                        <svg
                            className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#025dc7] group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-1"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.5}
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                );
            })}
        </div>
    );
}
