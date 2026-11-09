'use client'
/**
 * El Inicio del equipo (rediseño, rama diseno): los profes, monitores y
 * administradores no ven el Inicio del alumno sino la sala de profes
 * (08/11/2026): lo que toca hoy, las tareas del equipo, las clases, el
 * archivo y el manual. Ver components/Pages/Equipo/SalaProfes.tsx.
 */
import React from 'react'
import SalaProfes from '@components/Pages/Equipo/SalaProfes'

export default function InicioEquipo(_: { orgslug: string }) {
  return <SalaProfes />
}
