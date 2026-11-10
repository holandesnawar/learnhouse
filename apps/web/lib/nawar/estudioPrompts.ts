/**
 * Los prompts del Estudio (10/11/2026).
 *
 * La escuela NO llama a ninguna IA (usuario: «por ahora sin clave, con que
 * genere buen prompt»): arma el encargo entero, con el contexto de la marca,
 * las reglas de la casa y el formato de salida, y el usuario lo pega en un
 * proyecto nuevo de Claude (o en Claude Design, para las presentaciones).
 *
 * Todo es texto puro y sin estado: se prueba en `__tests__/estudioPrompts.test.ts`.
 *
 * ⚠️ Los datos de la escuela que salen aquí (16 semanas, 10 módulos, qué
 * incluye) son los de CLAUDE.md. Si cambia la oferta, cambiarlos en CONTEXTO.
 * Nada de precios: los prompts de contenido no los nombran, a propósito.
 */

export type Objetivo = 'alcance' | 'comunidad' | 'ventas'
export type TipoClase = 'semanal' | 'masterclass' | 'spreekclub'

export interface Generador {
  id: 'ideas' | 'guion' | 'blog' | 'comunidad' | 'clase' | 'recurso'
  nombre: string
  que: string
  /** Dónde se pega. */
  donde: 'Claude' | 'Claude Design'
}

export const GENERADORES: Generador[] = [
  { id: 'ideas', nombre: 'Ideas para redes', que: 'Reels y carruseles para Instagram y TikTok, según lo que busques: alcance, comunidad o ventas.', donde: 'Claude' },
  { id: 'guion', nombre: 'Guion de una idea', que: 'De una idea al guion entero: lo que se dice, lo que se ve y el texto de la publicación.', donde: 'Claude' },
  { id: 'blog', nombre: 'Artículo del blog', que: 'Un artículo pensado para Google y para las IAs, con su título, su resumen y sus preguntas.', donde: 'Claude' },
  { id: 'comunidad', nombre: 'Ideas para la comunidad', que: 'Qué publicar esta semana para que los alumnos escriban y practiquen entre ellos.', donde: 'Claude' },
  { id: 'clase', nombre: 'Presentación de una clase', que: 'El encargo para Claude Design: la clase semanal, la masterclass o el Spreekclub, con el formato de la casa.', donde: 'Claude Design' },
  { id: 'recurso', nombre: 'Recurso para alumnos', que: 'Una guía propia para Recursos: una carta explicada, frases para una situación, un sonido difícil.', donde: 'Claude' },
]

export const CONTEXTO = `CONTEXTO (léelo antes de escribir)
Holandés Nawar es una escuela online de neerlandés para hispanohablantes que viven en Países Bajos o Bélgica, o que van a mudarse. Todo se explica en español.
- El producto: la Formación Nawar A0-A1, de cero al nivel A1 en 16 semanas y 10 módulos. Lecciones en la escuela (vídeo, vocabulario con audio, ejercicios, lectura, escucha y hablar), una masterclass en directo cada semana, grupos de conversación (Spreekclub), consultas que responde un profe y una comunidad de alumnos.
- A quién le hablamos: adultos que llevan meses o años aquí y siguen dependiendo de otros para el médico, las cartas, el colegio de sus hijos o el trabajo. Muchos ya empezaron algún curso y lo dejaron. No se les da mal el idioma: se lo enseñaron pensado para quien habla inglés.
- Cómo hablamos: de tú, cercano y claro, con frases cortas. Nawar es «la escuela», nunca «la academia».`

export const REGLAS = `REGLAS DE LA CASA (no te las saltes)
- No inventes nada: ni testimonios, ni cifras, ni nombres de alumnos, ni promesas. Si te falta un dato, déjalo entre [corchetes] para que lo rellene yo.
- No prometas trabajo, aprobar exámenes ni plazos que no estén arriba. No nombres precios.
- El neerlandés tiene que ser correcto y natural, el de Países Bajos de hoy. Cada sustantivo con su artículo (de / het) y cada palabra o frase con su traducción al español. Si dudas entre dos formas, usa la más corriente.
- Piensa en los errores típicos de un hispanohablante (leven por wonen, los sonidos ui, eu, g, sch, el orden de la frase): es lo que nos distingue.
- Sin rayas largas, sin emojis de relleno y sin frases de vendedor. Español neutro, que se entienda igual en España y en América.`

const QUE_BUSCA: Record<Objetivo, string> = {
  alcance:
    'ALCANCE: que lo vea y lo comparta gente que todavía no nos conoce. Ganchos fuertes en la primera frase, temas en los que cualquiera que vive aquí se reconoce (pronunciación, errores típicos, choques con el idioma en la calle) y que se entienda sin conocer la escuela. Sin vender.',
  comunidad:
    'COMUNIDAD: que quien ya nos sigue comente, guarde y responda. Preguntas que se contestan en una línea, situaciones que piden contar la propia, mini retos y cosas útiles para guardar. Sin vender.',
  ventas:
    'VENTAS: que quien ya nos conoce dé el paso de pedir su llamada. Los dolores de verdad (depender de otros, haber dejado otros cursos), las dudas antes de entrar (tiempo, edad, «ya lo intenté») y cómo es la escuela por dentro. Acaba con una llamada a la acción clara y sin presión.',
}

const limpio = (t?: string) => (t || '').trim()

export interface OpcionesIdeas {
  objetivo: Objetivo
  /** reel · carrusel · mezcla */
  formato: 'reel' | 'carrusel' | 'mezcla'
  tema?: string
  cuantas?: number
  /** Títulos de ideas que ya están en el banco, para no repetirlas. */
  yaTenemos?: string[]
}

export function promptIdeas(o: OpcionesIdeas): string {
  const n = Math.min(Math.max(o.cuantas || 10, 3), 30)
  const formato =
    o.formato === 'reel' ? 'reels (vídeo vertical de 20 a 45 segundos)' : o.formato === 'carrusel' ? 'carruseles de Instagram (de 5 a 8 pantallas)' : 'una mezcla de reels y carruseles'
  const ya = (o.yaTenemos || []).map(limpio).filter(Boolean).slice(0, 40)
  return [
    `Eres el responsable de contenido de Holandés Nawar. Dame ${n} ideas de ${formato} para Instagram y TikTok.`,
    CONTEXTO,
    `LO QUE BUSCO CON ESTAS IDEAS\n${QUE_BUSCA[o.objetivo]}`,
    limpio(o.tema) ? `TEMA DE ESTA TANDA\n${limpio(o.tema)}` : '',
    ya.length ? `ESTAS YA LAS TENEMOS (no las repitas ni las reformules)\n${ya.map((t) => `- ${t}`).join('\n')}` : '',
    REGLAS,
    `CÓMO ME LO DAS
Una lista numerada con ${n} líneas y nada más: ni introducción ni despedida. Cada idea en UNA sola línea, con esta forma:
Formato · «El gancho, tal cual se diría en la primera frase» · de qué va, en diez palabras como mucho
Ejemplo de la forma (no del contenido): Reel · «Llevas dos años diciendo esto mal en el súper» · leven y wonen, con un ejemplo
Las pego tal cual en mi banco de ideas, así que no añadas nada entre líneas.`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export interface OpcionesGuion {
  idea: string
  formato: 'reel' | 'carrusel'
  objetivo?: Objetivo | ''
  notas?: string
}

export function promptGuion(o: OpcionesGuion): string {
  const salida =
    o.formato === 'reel'
      ? `CÓMO ME LO DAS (un reel de 30 a 45 segundos, para grabar con el móvil)
1. Gancho: la primera frase, de menos de 3 segundos, y qué se ve mientras se dice.
2. Desarrollo: de 3 a 5 golpes. En cada uno, lo que digo (tal cual) y lo que se ve o el texto que sale en pantalla.
3. Cierre: una frase que resuma y la llamada a la acción.
4. Texto en pantalla: las palabras en neerlandés que tienen que salir escritas, con su traducción.
5. Texto de la publicación: de 3 a 5 líneas, y 5 etiquetas.
Escribe para decirlo en voz alta: frases cortas, como hablo yo, no como un anuncio.`
      : `CÓMO ME LO DAS (un carrusel de 6 a 8 pantallas)
Pantalla a pantalla: un título de 8 palabras como mucho y un texto de 25 palabras como mucho. La primera pantalla es el gancho y tiene que entenderse sola; la última, el resumen y la llamada a la acción.
Después, el texto de la publicación (de 3 a 5 líneas) y 5 etiquetas.`
  return [
    `Eres el responsable de contenido de Holandés Nawar. Escríbeme el guion completo de esta idea:\n«${limpio(o.idea) || '[la idea]'}»`,
    CONTEXTO,
    o.objetivo ? `LO QUE BUSCO\n${QUE_BUSCA[o.objetivo]}` : '',
    limpio(o.notas) ? `LO QUE YA TENGO PENSADO\n${limpio(o.notas)}` : '',
    REGLAS,
    salida,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export interface OpcionesBlog {
  tema: string
  /** Lo que busca en Google quien llega a este artículo. */
  busqueda?: string
}

export function promptBlog(o: OpcionesBlog): string {
  return [
    `Eres el redactor del blog de Holandés Nawar (holandesnawar.com/blog). Escribe un artículo sobre:\n«${limpio(o.tema) || '[el tema]'}»`,
    limpio(o.busqueda) ? `LO QUE ESCRIBE EN GOOGLE QUIEN TIENE QUE LLEGAR AQUÍ\n${limpio(o.busqueda)}` : '',
    CONTEXTO,
    `PARA GOOGLE Y PARA LAS IAS
- El primer párrafo responde a la pregunta entera, en 2 o 3 frases: quien solo lea eso se va con la respuesta.
- La búsqueda sale en el título, en el primer párrafo y en algún subtítulo, de forma natural. No la repitas por repetir.
- Subtítulos que sean preguntas o frases que alguien buscaría. Párrafos de 3 líneas como mucho. Ejemplos en neerlandés con su traducción.
- Enlaza por dentro a la home, a «Nuestra visión» y a otros artículos del blog donde venga a cuento: dime dónde, entre [corchetes].
- Una sola llamada a la acción, al final: empezar el proceso de admisión de la formación.`,
    REGLAS,
    `CÓMO ME LO DAS
1. Tres títulos posibles (menos de 60 caracteres) y la descripción para Google (menos de 155).
2. El artículo entero, de 900 a 1.200 palabras, con sus subtítulos.
3. Cuatro preguntas frecuentes con su respuesta corta.
4. Dos ideas de reel o carrusel que salgan de este artículo, cada una en una línea.`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export interface OpcionesComunidad {
  /** De qué va la semana: el tema de la clase, una fecha, una noticia. */
  semana?: string
  cuantas?: number
}

export function promptComunidad(o: OpcionesComunidad): string {
  const n = Math.min(Math.max(o.cuantas || 6, 3), 15)
  return [
    `Eres quien dinamiza la comunidad de alumnos de Holandés Nawar. Dame ${n} publicaciones para esta semana, listas para copiar y pegar.`,
    CONTEXTO,
    `CÓMO ES LA COMUNIDAD
Alumnos de nivel A0-A1, dentro de la escuela, en canales: presentaciones, victorias, dudas y conversación. Lo que más les frena es el miedo a escribir mal y la sensación de estudiar solos. Publica el equipo; ellos responden.`,
    limpio(o.semana) ? `ESTA SEMANA\n${limpio(o.semana)}` : '',
    `QUÉ TIPOS QUIERO (mézclalos)
- Una pregunta que se contesta en UNA frase en neerlandés, con el principio de la frase ya dado.
- Un reto con foto: «foto de tu calle, tu desayuno, tu bici, y una frase en neerlandés».
- Una mini noticia de Países Bajos o Bélgica de esta semana, en neerlandés muy fácil (3 frases) y con 4 palabras explicadas. Si no puedes comprobar una noticia real, deja el hueco entre [corchetes] y dime qué buscar.
- Un juego corto: adivina la palabra, cuál sobra, de o het.
- Un hilo para después de la clase: «qué me llevo y qué voy a probar esta semana».
- Una invitación a contar una victoria pequeña de la semana.`,
    REGLAS,
    `CÓMO ME LO DAS
Para cada publicación: el canal al que va, un título corto, el texto tal cual se publica y, debajo, «Ejemplo de respuesta» con una respuesta de alumno de nivel A1 (para que yo la deje como primer comentario y nadie tenga que ser el primero). Dime también qué día de la semana la pondrías.
Al final, una lista con solo los títulos, uno por línea, para pegarla en mi banco de ideas.`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export interface OpcionesClase {
  tipo: TipoClase
  tema: string
  minutos?: number
  alumnos?: number
  /** Lo que ya enseña la escuela sobre este tema (ver `materialDeLeccion`). */
  material?: string
  notas?: string
}

const MARCA_DISENO = `EL DISEÑO (es el de siempre: no lo cambies)
- Colores: azul de marca #1D0084 y #0b2da0, acento #4da3ff, texto oscuro #0a1656, fondos blanco y #F0F5FF, bordes #DDE6F5. Sin naranja ni otros colores.
- Letra: Poppins en los títulos e Inter en el resto. El logo de Nawar arriba a la derecha.
- Rótulos pequeños en mayúsculas y en neerlandés encima de cada título (WOORDEN EN UITSPRAAK, THEORIE, ZINNEN, NU JIJ, VOORBEELD, HUISWERK). Los títulos y las instrucciones, en español; el contenido, en neerlandés con su traducción debajo, más pequeña.
- En cada palabra: su artículo, su traducción y la pronunciación con la sílaba fuerte en MAYÚSCULAS (WOON-ka-mer).
- Deja a propósito HUECOS EN BLANCO con líneas para escribir (notas de clase, palabras nuevas, errores de hoy): el profe escribe encima durante la clase y esa versión es la que reciben después los alumnos.`

const FORMATO_CLASE: Record<TipoClase, { que: string; estructura: string }> = {
  semanal: {
    que: 'el dossier de la clase semanal de conversación (CONVERSATIELES · IN DE LES)',
    estructura: `EL FORMATO: un dossier en PDF, A4 vertical, de 10 a 12 páginas, que el profe comparte en pantalla y el alumno puede imprimir.
1. Portada: «CONVERSATIELES · IN DE LES», el título con un emoji, «El dossier de la clase en directo», huecos para NAAM y DATUM y el PLAN VAN VANDAAG en una tabla (minutos, actividad, cómo se hace). Una sola sala: todos hablan en cada actividad.
2. Welkom (5 min): una pregunta en cadena para empezar a hablar desde el primer minuto, con su VOORBEELD.
3. Woorden en uitspraak: el vocabulario en dos columnas (emoji, palabra con artículo, traducción y sílaba fuerte), en dos bloques de unas 10 palabras.
4. Una actividad por cada bloque de palabras, con dos rondas: primero en coro y luego en cadena. De cada ronda: formato, tiempo por persona, tiempo total, tres pasos numerados y un VOORBEELD.
5. Uitspraak: los 3 o 4 sonidos difíciles de hoy para un hispanohablante, en tabla (sonido, palabras de hoy que lo llevan, cómo se hace con la boca).
6. Theorie: «Las reglas de la clase», 5 reglas cortas, cada una con una frase de ejemplo y su traducción.
7. Zinnen: las frases para hablar del tema, las preguntas para hacerle a un compañero y los adjetivos útiles.
8. La actividad principal (unos 14 min): cada alumno habla 2 minutos; quien escucha rellena una tabla (para que escuchar también sea trabajo).
9. Una situación de la vida real (unos 20 min): una llamada o una conversación con el profe delante del grupo, con «lo que tú dices», «lo que vas a oír», 6 situaciones para repartir y otra tabla para quien escucha. Y una ronda 2 por si sobra tiempo.
10. Pas op: «Ojo con estas trampas» en tabla (en español, la trampa tachada, así se dice), un recuadro FOUTEN VAN VANDAAG con líneas en blanco, y HUISWERK: una nota de voz de 30 a 60 segundos por «Mis mensajes», con su VOORBEELD.
Pie de cada página: «Holandés Nawar · A1» y el número.`,
  },
  masterclass: {
    que: 'las diapositivas de la masterclass semanal',
    estructura: `EL FORMATO: diapositivas 16:9 en PDF, de 18 a 20, alternando fondo azul de marca y fondo claro. El profe explica con el micro de los alumnos silenciado y ellos participan por el chat.
1. Portada: «MASTERCLASS · [serie] #[n]», el título, una frase que pique la curiosidad, «60 min · Micro silenciado · Participa por el chat».
2. Wie ben ik?: el profe se presenta con tres frases en neerlandés (hueco para su foto).
3. En jij?: los alumnos se presentan con una frase modelo y su VOORBEELD.
4. El reto de hoy: lo que se llevan, en una frase, y una PREGUNTA AL CHAT que se retoma al final.
5. Normas de la masterclass: micro silenciado, respuestas en el chat, papel y boli, apunta tus dudas.
6. El contenido, en 4 a 6 diapositivas con la MISMA forma: un rótulo («PATRÓN 1»), el título, la regla en una pastilla grande y 6 tarjetas (emoji, español, neerlandés con artículo y pronunciación). Debajo, un aviso «¡OJO!» o «UITSPRAAK».
7. Excepciones: cuándo NO funciona, con ejemplos tachados, y la frase para salir del paso (Zeg je dat zo?).
8. Tres rondas rápidas por el chat, cada una en su diapositiva y de menos a más difícil: reconocer, producir y decidir.
9. Una actividad con material real (un vídeo corto o un texto fácil de los medios neerlandeses): dime qué buscar y deja el hueco para el enlace.
10. Úsalo: habla de ti. Cinco frases con hueco para que cada uno escriba dos en el chat.
11. Vragen: preguntas del día.
12. Tot ziens: resumen en una línea, vuelta a la pregunta del principio, HUISWERK y «la semana que viene».
A la derecha de casi todas, recuadros pequeños: NU JIJ, REPITE y NOTAS DE CLASE (este, vacío, con líneas).`,
  },
  spreekclub: {
    que: 'la guía de una sesión del Spreekclub (grupos pequeños de conversación)',
    estructura: `EL FORMATO: un PDF 16:9 de 8 a 10 pantallas, para compartir en una sala pequeña. Aquí no se explica gramática: se habla. El monitor reparte turnos y apunta.
1. Portada: «SPREEKCLUB», el tema y «Hoy hablas tú».
2. Opwarmen (5 min): una pregunta en cadena que todos pueden contestar con una frase.
3. Woorden: las 12 palabras que van a hacer falta, con artículo, traducción y sílaba fuerte. Solo para tenerlas a la vista.
4. Tres rondas de conversación, de menos a más libre: frases con hueco, preguntas por parejas, y una situación de la vida real para representar. De cada una: tiempo por persona, pasos y un VOORBEELD.
5. Hulpzinnen: las frases para salir del paso (Kun je dat herhalen? · Hoe zeg je…? · Ik begrijp het niet).
6. Een spel: un juego corto para acabar (adivina, quién soy, verdadero o falso).
7. Fouten van vandaag: un recuadro vacío con líneas, para lo que apunte el monitor.
8. Tot de volgende keer: una frase para llevarse y decir esta semana en la calle.`,
  },
}

export function promptClase(o: OpcionesClase): string {
  const f = FORMATO_CLASE[o.tipo]
  const min = o.minutos || 60
  return [
    `Diseña ${f.que} de Holandés Nawar.\nTema: «${limpio(o.tema) || '[el tema]'}» · ${min} minutos${o.alumnos ? ` · unos ${o.alumnos} alumnos` : ''} · nivel A1.`,
    CONTEXTO,
    f.estructura,
    limpio(o.material)
      ? `LO QUE YA HAN VISTO EN LA ESCUELA SOBRE ESTE TEMA (parte de aquí y amplía; no contradigas nada)\n${limpio(o.material)}`
      : '',
    limpio(o.notas) ? `LO QUE QUIERO EN ESTA CLASE\n${limpio(o.notas)}` : '',
    `CÓMO SE DA LA CLASE
- Los tiempos tienen que sumar ${min} minutos. En cada actividad: quién habla, cuánto cada uno y cuánto en total.
- Nadie pasa más de 5 minutos seguidos solo escuchando: quien no habla, apunta algo.
- Las instrucciones se dirigen al alumno, de tú, en una línea. Cada actividad con su ejemplo ya resuelto.
- Sirve igual para los dos grupos de la semana: no pongas fechas, nombres de profes ni de alumnos (en los ejemplos, Ana y Marco).`,
    MARCA_DISENO,
    REGLAS,
    'Entrégalo como PDF. Antes de terminar, repasa cada frase en neerlandés como lo haría un profesor nativo.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

export interface OpcionesRecurso {
  tema: string
  /** guia · frases · carta · sonido */
  tipo: 'guia' | 'frases' | 'carta' | 'sonido'
}

const TIPO_RECURSO: Record<OpcionesRecurso['tipo'], string> = {
  guia: 'Una guía paso a paso de un trámite o una situación (DigiD, el huisarts, empadronarse): qué es, qué te van a pedir, cada pantalla o cada paso con las palabras en neerlandés que vas a ver y lo que significan.',
  frases: 'Una hoja de frases para una situación (la farmacia, el colegio, el casero): «lo que tú dices», «lo que vas a oír» y cómo salir del paso, de la más fácil a la más completa.',
  carta: 'Una carta típica explicada (del gemeente, de la Belastingdienst, del seguro): una carta de ejemplo inventada pero realista, párrafo a párrafo, con lo que dice, lo que te pide y qué plazo tienes. Las 12 palabras que se repiten en todas.',
  sonido: 'Una guía de pronunciación para hispanohablantes: un sonido que no existe en español, cómo se coloca la boca, con qué sonido español NO hay que confundirlo, 10 palabras para practicarlo y 3 frases.',
}

export function promptRecurso(o: OpcionesRecurso): string {
  return [
    `Eres el director académico de Holandés Nawar. Prepara un recurso para la sección «Recursos» de la escuela sobre:\n«${limpio(o.tema) || '[el tema]'}»`,
    CONTEXTO,
    `QUÉ TIPO DE RECURSO\n${TIPO_RECURSO[o.tipo]}`,
    `PARA QUIÉN
Alumnos de nivel A0-A1 que tienen que resolver esto de verdad esta semana. Una o dos páginas: que se pueda leer en el móvil en la sala de espera. Explicado en español, con el neerlandés justo que van a necesitar.`,
    REGLAS,
    `CÓMO ME LO DAS
El texto entero, con sus títulos, listo para maquetar. Los datos que puedan cambiar (plazos, importes, direcciones web oficiales) márcalos entre [corchetes] con «comprobar», y al final dame la lista de lo que tengo que verificar antes de publicarlo y en qué web oficial.`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/**
 * Lo que la escuela ya enseña en una lección, en texto, para el prompt de la
 * clase: su vocabulario (con artículo y traducción) y sus frases. `blocks` son
 * los de `courseData.ts`. Se recorta para que el prompt no se haga eterno.
 */
export function materialDeLeccion(titulo: string, blocks: any[], tope = 40): string {
  const palabras: string[] = []
  const frases: string[] = []
  for (const b of blocks || []) {
    if (b?.type === 'vocabulary') {
      for (const v of b.items || []) {
        const art = v.article && v.article !== 'none' && !String(v.dutch || '').toLowerCase().startsWith(`${v.article} `) ? `${v.article} ` : ''
        if (v.dutch && v.spanish) palabras.push(`${art}${v.dutch} = ${v.spanish}`)
      }
    } else if (b?.type === 'phrases') {
      for (const p of b.items || []) if (p.dutch && p.spanish) frases.push(`${p.dutch} = ${p.spanish}`)
    }
  }
  if (!palabras.length && !frases.length) return ''
  return [
    `Lección de la escuela: ${titulo}`,
    palabras.length ? `Vocabulario: ${palabras.slice(0, tope).join(' · ')}` : '',
    frases.length ? `Frases: ${frases.slice(0, Math.round(tope / 2)).join(' · ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
