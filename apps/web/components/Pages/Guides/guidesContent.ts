/**
 * Las guías del módulo 0, en código.
 *
 * Por qué aquí y no pegadas a mano en el editor: así se ven igual en móvil y
 * en ordenador, llevan los colores de la marca sin que nadie los toque, y se
 * pueden corregir en un despliegue en vez de reescribiéndolas a mano.
 *
 * Se enganchan a una actividad de tipo "Insertar contenido" con la dirección
 * `nawar-guia:uso` o `nawar-guia:estudio` (se elige desde el desplegable, no
 * hace falta escribirla).
 *
 * El texto acepta **negritas** con asteriscos. Nada más: si un día hace falta
 * más, mejor añadir un tipo de bloque que meter HTML aquí.
 */

export type GuideBlock =
  | { t: 'h2'; text: string }
  | { t: 'p'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: string[] }
  /** Aviso destacado: la idea que no se puede pasar por alto. */
  | { t: 'callout'; text: string }
  /** Frase suelta con peso, tipo lema. */
  | { t: 'quote'; text: string }
  | { t: 'table'; head: string[]; rows: string[][] }
  /** Bloque con título propio dentro de una sección (las trampas, p. ej.). */
  | { t: 'item'; title: string; text: string }

export interface Guide {
  id: string
  /** Lo que se ve arriba del todo. */
  eyebrow: string
  title: string
  intro: string
  blocks: GuideBlock[]
}

const GUIA_USO: Guide = {
  id: 'uso',
  eyebrow: 'Guía 1 de 2',
  title: 'Cómo funciona tu escuela',
  intro:
    'Cinco minutos de lectura ahora te ahorran muchas vueltas después. Esta guía es el mapa; la de estudio es el método.',
  blocks: [
    { t: 'h2', text: 'Cómo entras' },
    {
      t: 'p',
      // {escuela} lo rellena SchoolGuide con el dominio de la configuración.
      text: 'Tu escuela está en **{escuela}**. Entras con tu correo y la contraseña que creaste al matricularte.',
    },
    {
      t: 'p',
      text: 'Guárdala en favoritos en el ordenador y en la pantalla de inicio del móvil: si entrar te cuesta tres clics, entrarás menos.',
    },
    {
      t: 'p',
      text: '¿No te acuerdas de la contraseña? En la pantalla de entrada tienes **«¿Olvidaste tu contraseña?»** y te llega un correo para poner una nueva. Mira también en spam.',
    },

    { t: 'h2', text: 'El mapa: qué hay en cada sitio' },
    {
      t: 'table',
      head: ['Sección', 'Para qué es'],
      rows: [
        ['Inicio', 'Tu punto de partida. Arriba del todo, la tarjeta que te lleva justo a donde lo dejaste. Si no sabes qué hacer hoy, pulsa ahí.'],
        ['Formación', 'El camino completo, módulo a módulo y lección a lección. Es el corazón de todo.'],
        ['Ejercicios', 'Las mismas prácticas, sueltas, para repasar. No es otro camino: es el gimnasio.'],
        ['Mi progreso', 'Tu formación de un vistazo: qué hiciste, qué nota sacaste y qué fallaste.'],
        ['Comunidad', 'Los canales donde hablas con tus compañeros de clase.'],
        ['Eventos', 'Las clases en directo y las fechas importantes.'],
        ['Consultas', 'Tus dudas sobre las lecciones. Las responde el equipo y quedan a la vista.'],
        ['Mis mensajes', 'Tu línea directa con nosotros, en privado. Texto o nota de voz.'],
        ['Mis notas', 'Todo lo que subrayaste y anotaste, reunido en un sitio.'],
      ],
    },

    { t: 'h2', text: 'Cómo es una lección por dentro' },
    {
      t: 'p',
      text: 'Cada lección tiene varias partes, y **el orden está pensado**. La primera vez, hazlas así:',
    },
    {
      t: 'ol',
      items: [
        '**El vídeo.** La explicación. Míralo entero antes de tocar nada más.',
        '**Resumen (Samenvatting).** Lo que acabas de ver, por escrito, con las frases clave al final.',
        '**Flashcards.** El vocabulario de la lección, carta a carta.',
        '**Oefening.** Los ejercicios. Aquí se comprueba si de verdad lo entendiste.',
        '**Lezen.** Un texto para leer, con preguntas.',
        '**Luisteren.** Un diálogo para escuchar, con preguntas sobre lo que se dice.',
        '**Spreken.** Escuchas una situación y eliges qué dirías tú. Sin texto: como en la calle.',
      ],
    },
    {
      t: 'p',
      text: 'No todas las lecciones tienen las siete partes. Cuando hayas hecho todas, la lección se marca como terminada.',
    },

    { t: 'h2', text: 'Lo que la escuela apunta por ti' },
    {
      t: 'ul',
      items: [
        '**Los checks.** Cada parte terminada se marca sola. No tienes que apuntar nada.',
        '**El porcentaje.** Cuánto llevas de la formación.',
        '**Tu nota.** En cada práctica se guarda cuántas acertaste y **cuáles fallaste**.',
        '**La racha.** Los días seguidos que entras. Está para animarte, no para castigarte.',
      ],
    },
    {
      t: 'p',
      text: 'Todo se guarda en **tu cuenta**, no en el navegador: puedes empezar en el ordenador y seguir en el móvil.',
    },

    { t: 'h2', text: 'Subrayar y tomar notas' },
    {
      t: 'p',
      text: 'Dentro de una lección, **selecciona cualquier texto con el dedo o el ratón**: aparecerán cuatro colores para subrayar y la opción de escribir una nota.',
    },
    {
      t: 'p',
      text: 'Todo lo que subrayes se guarda en **Mis notas**, con el enlace a la lección de donde salió. Es tu cuaderno, y no se pierde.',
    },

    { t: 'h2', text: 'Dónde preguntar' },
    {
      t: 'table',
      head: ['Tu situación', 'Dónde'],
      rows: [
        ['«No entiendo esta frase de la lección 3»', 'Consultas'],
        ['«Quiero que me corrijáis cómo pronuncio esto»', 'Mis mensajes (nota de voz)'],
        ['Algo personal, o no te apetece preguntarlo en público', 'Mis mensajes'],
        ['«¿Alguien quiere practicar conmigo?»', 'Comunidad'],
      ],
    },
    {
      t: 'p',
      text: 'Las consultas quedan a la vista a propósito: tu duda casi siempre es la duda de otros cinco.',
    },

    { t: 'h2', text: 'La clase en directo' },
    {
      t: 'p',
      text: 'Todos los **jueves a las 19:00** (hora de Países Bajos) nos vemos en directo para repasar, resolver dudas y practicar hablando. La tienes en **Eventos**, con el enlace para entrar, y te avisamos por correo.',
    },
    {
      t: 'p',
      text: '**Si no puedes ir, no pasa nada**: todas se graban y quedan disponibles.',
    },
    {
      t: 'callout',
      text: 'Deja tu duda en Consultas **antes** de la clase. Las más votadas las resolvemos en directo.',
    },

    { t: 'h2', text: 'Por qué no ves todos los módulos' },
    {
      t: 'p',
      text: 'Los módulos se abren **poco a poco** desde el día que entras. No es para hacerte esperar: tragarse la formación entera en tres días tiene un nombre, y no es «aprender». A las dos semanas no queda nada. En el módulo cerrado verás la fecha en la que se abre.',
    },

    { t: 'h2', text: 'En el móvil' },
    {
      t: 'p',
      text: 'Funciona entero desde el móvil: vídeos, ejercicios, audios y notas de voz. Si vas a hacer **Luisteren** o **Spreken**, ponte auriculares: la diferencia al distinguir sonidos es enorme.',
    },

    { t: 'h2', text: 'Si algo no va' },
    {
      t: 'ul',
      items: [
        '**No se oye el audio** → Sube el volumen y comprueba que el móvil no está en silencio. Recargar la página arregla el 90% de los casos.',
        '**Una pantalla se queda cargando** → Recarga. Si sigue, cierra y vuelve a entrar.',
        '**No consigo entrar** → Recupera la contraseña desde la pantalla de entrada.',
        '**Nada de lo anterior funciona** → Escríbenos a **soporte@holandesnawar.com** o por Mis mensajes.',
      ],
    },
  ],
}

const GUIA_ESTUDIO: Guide = {
  id: 'estudio',
  eyebrow: 'Guía 2 de 2',
  title: 'Cómo aprender holandés de verdad',
  intro:
    'La otra guía te dice dónde está cada cosa. Esta te dice cómo estudiar para que dentro de unos meses estés hablando, y no solo hayas visto vídeos. Léela una vez ahora y vuelve a ella cuando te atasques.',
  blocks: [
    { t: 'h2', text: 'A dónde vamos' },
    {
      t: 'p',
      text: 'Al terminar esta formación estarás en **A1**. En la práctica, eso significa que vas a poder:',
    },
    {
      t: 'ul',
      items: [
        'Presentarte y contar quién eres, de dónde vienes y a qué te dedicas.',
        'Hablar de tu familia y de tus amigos.',
        'Hacer la compra y desenvolverte en una tienda.',
        'Hablar de tu trabajo, decir la hora y quedar con alguien.',
        'Entender frases sencillas cuando alguien te habla despacio.',
      ],
    },
    {
      t: 'p',
      text: 'Lo que **no** vas a poder todavía: seguir una conversación rápida entre dos neerlandeses, ni ver la tele sin subtítulos. Eso llega después, y llega mucho antes si la base está bien puesta. Esta formación es esa base.',
    },

    { t: 'h2', text: 'La regla de oro' },
    {
      t: 'quote',
      text: 'Veinte minutos casi todos los días valen más que tres horas el domingo.',
    },
    {
      t: 'p',
      text: 'Un idioma no se aprende: se acostumbra. Tu cabeza necesita volver a ver las mismas palabras muchas veces, separadas en el tiempo. Un maratón el domingo no te da eso; cinco ratos cortos, sí.',
    },
    {
      t: 'callout',
      text: 'Si un día solo tienes diez minutos: **haz las flashcards**. Ese día cuenta.',
    },

    { t: 'h2', text: 'Tu semana tipo' },
    {
      t: 'p',
      text: 'Un plan que funciona, para que no tengas que decidir cada día:',
    },
    {
      t: 'table',
      head: ['Día', 'Qué haces', 'Tiempo'],
      rows: [
        ['Lunes', 'Vídeo + Resumen de la lección nueva', '25 min'],
        ['Martes', 'Flashcards + Oefening', '20 min'],
        ['Miércoles', 'Lezen + Luisteren', '25 min'],
        ['Jueves', 'Clase en directo (o la grabación)', '1 h'],
        ['Viernes', 'Spreken + repasar tus fallos', '20 min'],
        ['Fin de semana', 'Un ratito de flashcards, sin presión', '10 min'],
      ],
    },
    {
      t: 'p',
      text: 'Ajústalo a tu vida. Lo importante no es el día: es que **casi todos los días haya algo**.',
    },

    { t: 'h2', text: 'Por qué ese orden dentro de la lección' },
    { t: 'p', text: 'No es capricho. Cada parte prepara la siguiente:' },
    {
      t: 'ul',
      items: [
        '**El vídeo** te da la idea.',
        '**El Resumen** la fija por escrito, mientras la tienes fresca.',
        '**Las Flashcards** meten las palabras.',
        '**Oefening** te obliga a usarlas: aquí se descubre lo que creías saber.',
        '**Lezen** te enseña esas palabras dentro de frases reales.',
        '**Luisteren** te las enseña a la velocidad a la que se hablan de verdad.',
        '**Spreken** te pone a elegir qué dirías tú.',
      ],
    },
    {
      t: 'p',
      text: 'Saltarse partes es el error más común. Sobre todo saltarse Luisteren, que es justo la que más cuesta y la que más falta te hace.',
    },

    { t: 'h2', text: 'El vocabulario: cómo se fija de verdad' },
    {
      t: 'ul',
      items: [
        '**Di la palabra en voz alta.** Siempre. Leerla en silencio la deja en los ojos; decirla la mete en la boca, que es donde la necesitas.',
        '**No estudies listas de treinta palabras.** Ocho o diez por sesión, bien hechas, valen más.',
        '**Vuelve a las de días anteriores.** Se olvidan justo cuando crees que ya las sabes. Por eso repasar importa más que avanzar.',
        '**Engánchalas a algo tuyo.** *De kapper* se te queda mucho mejor si piensas en tu peluquería de verdad, con su nombre y su calle.',
      ],
    },

    { t: 'h2', text: 'El oído: la técnica de las tres escuchas' },
    {
      t: 'p',
      text: 'Esta es la que más gente se salta y la que más cambia las cosas.',
    },
    {
      t: 'ol',
      items: [
        '**Escucha sin mirar el texto.** Aunque solo entiendas tres palabras. Sobre todo si solo entiendes tres palabras.',
        '**Escucha con el texto delante.** Ahora ves dónde estaban esas palabras que se te escapaban.',
        '**Escucha otra vez sin el texto.** Aquí ocurre el avance, y lo vas a notar.',
      ],
    },
    {
      t: 'p',
      text: 'Si te saltas la primera y vas directo al texto, estás leyendo, no escuchando. Y en la calle nadie te va a dar el texto.',
    },

    { t: 'h2', text: 'Hablar cuando no tienes con quién' },
    {
      t: 'ul',
      items: [
        '**Repite en voz alta** todo lo que escuches, imitando la entonación. Suena ridículo en tu cocina; funciona.',
        '**Habla solo.** Cuenta en holandés lo que estás haciendo: *ik maak koffie*, *ik ga naar mijn werk*. Aunque salga mal.',
        '**Mándanos notas de voz.** En Mis mensajes: grabas, te escuchas antes de enviarlo y te corregimos. Es lo más parecido a tener un profe al lado, y casi nadie lo usa. Úsalo tú.',
      ],
    },

    { t: 'h2', text: 'Tus fallos son tu mejor material' },
    {
      t: 'p',
      text: 'La escuela guarda **exactamente qué fallaste** en cada práctica. Ve a **Mi progreso** una vez por semana y repite solo eso.',
    },
    {
      t: 'p',
      text: 'Diez minutos repasando lo que fallaste valen más que una hora de lección nueva: estás trabajando justo donde tu cabeza tiene el hueco. Una sección por debajo del 60% no es un suspenso, es una señal de dónde volver.',
    },

    { t: 'h2', text: 'Qué NO hacer' },
    {
      t: 'ul',
      items: [
        '**No traduzcas palabra por palabra.** El holandés no es español con otras palabras: tiene su propio orden. Aprende frases enteras, no piezas sueltas.',
        '**No esperes a entenderlo todo para pasar a lo siguiente.** El 80% basta para avanzar; el 20% restante cae solo cuando lo vuelvas a ver.',
        '**No estudies solo con los ojos.** Boca y oídos, siempre.',
        '**No compares tu semana 3 con la de nadie.** Compárala con tu semana 1.',
      ],
    },

    { t: 'h2', text: 'Cómo saber si vas bien' },
    {
      t: 'ul',
      items: [
        'Terminas la mayoría de las semanas con **algo hecho casi todos los días**.',
        'Tus notas suben cuando repites lo que fallaste.',
        'Reconoces palabras **fuera de la formación**: en un cartel, en el súper, en algo que oyes por la calle. Ese es el mejor termómetro que existe.',
      ],
    },
    {
      t: 'p',
      text: 'Si un día no te sale, no es que no valgas para los idiomas: es que ese día tocaba descansar. Vuelve mañana. La constancia le gana a la intensidad, siempre.',
    },
    { t: 'quote', text: 'Veel succes!' },
  ],
}

export const GUIDES: Record<string, Guide> = {
  uso: GUIA_USO,
  estudio: GUIA_ESTUDIO,
}

/**
 * Para el desplegable del panel, sin cargar el contenido entero.
 *
 * `faq` e `indice` no tienen texto aquí: la primera lo saca de las preguntas
 * frecuentes (que se comparten con la portada del curso) y el segundo se
 * construye solo leyendo el curso.
 */
export const GUIDE_OPTIONS = [
  { id: 'uso', label: 'Guía de uso · Cómo funciona tu escuela' },
  { id: 'estudio', label: 'Guía de estudio · Cómo aprender holandés de verdad' },
  { id: 'faq', label: 'Preguntas frecuentes' },
  { id: 'indice', label: 'Índice de contenido (se genera solo)' },
]
