'use client'
import React, { useEffect, useRef, useState } from 'react'
import { Mic, Square, Trash2, Send, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * Grabar una nota de voz con el micrófono del navegador.
 *
 * Se graba, se escucha antes de mandar y se puede tirar. Sin previsualización
 * la gente no se atreve a mandar audios, y sin audios esto no sirve de nada en
 * una academia de idiomas.
 *
 * El permiso del micrófono se pide al pulsar grabar, no al abrir la página.
 */
export default function VoiceRecorder({
  onSend,
  sending,
}: {
  onSend: (audio: Blob, seconds: number) => Promise<void>
  sending: boolean
}) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<any>(null)

  // Soltar el objeto URL al cambiar de audio: si no, se acumulan en memoria.
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [url])

  const start = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Este navegador no deja grabar audio.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const out = new Blob(chunksRef.current, { type: 'audio/webm' })
        setBlob(out)
        setUrl(URL.createObjectURL(out))
        stream.getTracks().forEach((t) => t.stop())
      }
      rec.start()
      recorderRef.current = rec
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          // Tope de 3 minutos: pasado eso es una clase, no una nota.
          if (s >= 180) {
            rec.state === 'recording' && rec.stop()
            clearInterval(timerRef.current)
            setRecording(false)
          }
          return s + 1
        })
      }, 1000)
    } catch {
      toast.error('No hemos podido usar el micrófono. Revisa los permisos del navegador.')
    }
  }

  const stop = () => {
    const rec = recorderRef.current
    if (rec && rec.state === 'recording') rec.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
  }

  const discard = () => {
    if (url) URL.revokeObjectURL(url)
    setBlob(null)
    setUrl(null)
    setSeconds(0)
  }

  const send = async () => {
    if (!blob) return
    await onSend(blob, seconds)
    discard()
  }

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  if (blob && url) {
    return (
      <div className="flex items-center gap-2 w-full bg-[#F0F5FF] rounded-xl px-3 py-2">
        <audio src={url} controls className="h-9 flex-1 min-w-0" />
        <button
          type="button"
          onClick={discard}
          title="Descartar"
          className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-rose-500 hover:bg-white"
        >
          <Trash2 size={16} />
        </button>
        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#025dc7] text-white text-[13px] font-semibold hover:bg-[#0b6df0] disabled:opacity-50"
        >
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          Enviar
        </button>
      </div>
    )
  }

  if (recording) {
    return (
      <div className="flex items-center gap-2.5 w-full bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
        <span className="text-[13px] font-semibold text-rose-600 tabular-nums">{mmss}</span>
        <span className="text-[12.5px] text-rose-500/80 truncate">Grabando… habla con calma</span>
        <button
          type="button"
          onClick={stop}
          className="ml-auto shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-rose-500 text-white text-[13px] font-semibold hover:bg-rose-600"
        >
          <Square size={13} /> Parar
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={start}
      title="Grabar nota de voz"
      aria-label="Grabar nota de voz"
      className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg text-gray-400 hover:text-[#025dc7] hover:bg-[#F0F5FF] transition-colors"
    >
      <Mic size={18} />
    </button>
  )
}
