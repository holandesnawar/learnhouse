import React from 'react'
import type { Metadata } from 'next'
import MessagesPage from '@components/Pages/Messages/MessagesPage'

export const metadata: Metadata = {
  title: 'Mensajes',
}

export default function Mensajes() {
  return <MessagesPage />
}
