'use client'
import React, { useEffect } from 'react'
import toast, { Toaster, useToasterStore } from 'react-hot-toast'

// Como mucho dos avisos a la vista (19/11/2026): si salen más seguidos, el más
// viejo se va. Antes se apilaban y tapaban media pantalla en el móvil.
const MAX_AVISOS = 2

function LimiteDeAvisos() {
  const { toasts } = useToasterStore()
  useEffect(() => {
    toasts
      .filter((t) => t.visible)
      .filter((_, i) => i >= MAX_AVISOS) // la lista viene con el más nuevo primero
      .forEach((t) => toast.dismiss(t.id))
  }, [toasts])
  return null
}

function Toast() {
  return (
    <>
      <Toaster />
      <LimiteDeAvisos />
    </>
  )
}

export default Toast
