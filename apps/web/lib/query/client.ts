import { QueryClient } from '@tanstack/react-query'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        // Un fallo de red no es un error: es lo normal en un móvil que cambia
        // de wifi a datos, o en el medio segundo en que la API está
        // reiniciándose tras un despliegue. Se reintenta tres veces con espera
        // creciente (0,4s · 0,8s · 1,6s) antes de enseñar nada roto.
        // Los 4xx no se reintentan: si el servidor dice "no existe" o "no
        // tienes permiso", repetir la pregunta no cambia la respuesta.
        retry: (failureCount, error: any) => {
          const status = error?.status ?? error?.response?.status
          if (typeof status === 'number' && status >= 400 && status < 500) return false
          return failureCount < 3
        },
        retryDelay: (attempt) => Math.min(400 * 2 ** attempt, 4_000),
      },
    },
  })
}
