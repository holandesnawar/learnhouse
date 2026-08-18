import type { CourseModule, Lesson } from './types';

/* ─────────────────────────────────────────────────────────────────────────────
   MODULES
───────────────────────────────────────────────────────────────────────────── */

export const MODULES: CourseModule[] = [
  {
    id: 'over-jou',
    title: 'Over jou',
    subtitle: 'Sobre ti',
    description: 'Preséntate, habla de ti mismo y aprende el vocabulario esencial para las primeras conversaciones.',
    order: 1,
    emoji: '🙋',
    level: 'Módulo 1',
    color: '#1D0084',
  },
  {
    id: 'familie-vrienden',
    title: 'Familie & vrienden',
    subtitle: 'Familia y amigos',
    description: 'Habla de tu familia, tus relaciones y organiza tu tiempo con el vocabulario del día a día.',
    order: 2,
    emoji: '👪',
    level: 'Módulo 2',
    color: '#025dc7',
  },
  {
    id: 'boodschappen',
    title: 'Boodschappen',
    subtitle: 'Compras y comida',
    description: 'Aprende a moverte en el supermercado, pedir en un restaurante y hablar de comida y bebida.',
    order: 3,
    emoji: '🛒',
    level: 'Módulo 3',
    color: '#0b7a4d',
  },
  {
    id: 'het-werk',
    title: 'Het werk',
    subtitle: 'El trabajo',
    description: 'Habla de tu profesión, tu sector y los contratos laborales. Vocabulario para entrevistas y vida laboral en NL.',
    order: 4,
    emoji: '💼',
    level: 'Módulo 4',
    color: '#b91c1c',
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE 1 — OVER JOU
───────────────────────────────────────────────────────────────────────────── */

const m1_les1: Lesson = {
  id: 'les-1-voorstellen',
  moduleId: 'over-jou',
  title: 'Les 1 — Jezelf voorstellen',
  subtitle: 'Presentarte: saludos, nombre, edad, nacionalidad y residencia',
  order: 1,
  learningObjective: 'Saludar, despedirte y presentarte: nombre, edad, nacionalidad y lugar de residencia',
  estimatedMinutes: 30,
  blocks: [
    {
      type: 'summary',
      title: 'Jezelf voorstellen',
      intro: '¡Bienvenido/a a tu primera lección! Hoy aprendes lo primero que necesitas en neerlandés: saludar, despedirte y presentarte — decir tu nombre, tu edad, tu nacionalidad y dónde vives.',
      objectives: [
        'Saludar y despedirte en cualquier momento del día',
        'Presentarte: nombre, edad, nacionalidad y lugar de residencia',
        'Contar algo sobre ti y entender a alguien que se presenta',
      ],
      sections: [
        {
          heading: '👋 Saludar — Groeten',
          body: 'El saludo cambia según la hora del día. **Hallo** vale siempre y en todas las ocasiones; **hoi** es informal (como "hey").',
          items: [
            { nl: 'hallo', es: 'hola (vale siempre)' },
            { nl: 'hoi', es: 'hola (informal)' },
            { nl: 'goedemorgen', es: 'buenos días (hasta las 12:00)' },
            { nl: 'goedemiddag', es: 'buenas tardes (12:00–18:00)' },
            { nl: 'goedenavond', es: 'buenas tardes/noches (después de las 18:00)' },
            { nl: 'goedenacht', es: 'buenas noches (al final del día)' },
            { nl: 'dag', es: 'hola / adiós (neutral, sirve para las dos cosas)' },
          ],
        },
        {
          heading: '🚪 Despedirse — Afscheid nemen',
          body: 'Casi todas las despedidas empiezan con **tot** (= hasta).',
          items: [
            { nl: 'tot ziens', es: 'hasta la vista (formal)' },
            { nl: 'doei!', es: '¡adiós! (informal)' },
            { nl: 'tot straks', es: 'hasta luego (si os veis más tarde el mismo día)' },
            { nl: 'tot later', es: 'hasta más tarde' },
            { nl: 'tot morgen', es: 'hasta mañana' },
            { nl: 'tot volgende week', es: 'hasta la semana que viene' },
            { nl: 'Fijne dag!', es: '¡Que tengas un buen día!' },
          ],
        },
        {
          heading: '🪪 Tus datos — Over jou',
          body: 'Los cuatro datos básicos para presentarte:',
          items: [
            { nl: 'de naam', es: 'el nombre' },
            { nl: 'de leeftijd', es: 'la edad' },
            { nl: 'de nationaliteit', es: 'la nacionalidad' },
            { nl: 'de woonplaats', es: 'el lugar de residencia' },
          ],
        },
        {
          heading: '💬 Frases modelo',
          body: 'Con estas cinco frases ya puedes presentarte entero/a:',
          items: [
            { nl: 'Mijn naam is Maria', es: 'Mi nombre es María' },
            { nl: 'Ik ben 35 jaar', es: 'Tengo 35 años' },
            { nl: 'Ik ben Spaans', es: 'Soy español/a' },
            { nl: 'Ik woon in Groningen', es: 'Vivo en Groninga' },
            { nl: 'Ik kom uit Colombia', es: 'Vengo de Colombia' },
          ],
        },
        {
          heading: '🇳🇱 Dos palabras muy neerlandesas',
          body: '**Gezellig** no tiene traducción exacta al español: es una mezcla de acogedor, agradable, divertido y cálido. Un lugar, un plan o una persona pueden ser *gezellig*. **Lekker** significa literalmente rico o delicioso, pero es una palabra comodín: comida, ambiente, bienestar, planes… ¡casi todo puede ser *lekker*!',
        },
      ],
      tip: 'En neerlandés la edad no se "tiene", se "es": **Ik ben 35 jaar** (nunca "Ik heb 35 jaar"). Es uno de los errores más típicos de los hispanohablantes — si lo clavas desde hoy, ya empiezas con ventaja.',
    },
    {
      type: 'vocabulary',
      items: [
        // Saludos
        { id: 'm1l1v-hallo',       dutch: 'hallo',             spanish: 'hola',                          article: null, emoji: '👋', color: '#1D0084', exampleNl: 'Hallo, ik ben David.',              exampleEs: 'Hola, soy David.',                        category: 'groeten', difficulty: 'A0' },
        { id: 'm1l1v-hoi',         dutch: 'hoi',               spanish: 'hola (informal)',               article: null, emoji: '😊', color: '#025dc7', exampleNl: 'Hoi Anna, hoe is het?',             exampleEs: 'Hola Anna, ¿qué tal?',                    category: 'groeten', difficulty: 'A0' },
        { id: 'm1l1v-goedemorgen', dutch: 'goedemorgen',       spanish: 'buenos días (hasta las 12:00)', article: null, emoji: '🌅', color: '#0b4db5', exampleNl: 'Goedemorgen! Koffie?',              exampleEs: '¡Buenos días! ¿Café?',                    category: 'groeten', difficulty: 'A0' },
        { id: 'm1l1v-goedemiddag', dutch: 'goedemiddag',       spanish: 'buenas tardes (12:00–18:00)',   article: null, emoji: '☀️', color: '#0a3d9e', exampleNl: 'Goedemiddag, meneer De Vries.',     exampleEs: 'Buenas tardes, señor De Vries.',          category: 'groeten', difficulty: 'A0' },
        { id: 'm1l1v-goedenavond', dutch: 'goedenavond',       spanish: 'buenas noches (desde las 18:00)', article: null, emoji: '🌆', color: '#1440a0', exampleNl: 'Goedenavond, welkom!',            exampleEs: 'Buenas noches, ¡bienvenido/a!',           category: 'groeten', difficulty: 'A0' },
        { id: 'm1l1v-goedenacht',  dutch: 'goedenacht',        spanish: 'buenas noches (para dormir)',   article: null, emoji: '🌙', color: '#0d5bbf', exampleNl: 'Goedenacht, slaap lekker!',         exampleEs: 'Buenas noches, ¡que duermas bien!',       category: 'groeten', difficulty: 'A0' },
        { id: 'm1l1v-dag',         dutch: 'dag',               spanish: 'hola / adiós (neutral)',        article: null, emoji: '🙋', color: '#1D0084', exampleNl: 'Dag mevrouw!',                      exampleEs: '¡Buenas, señora!',                        category: 'groeten', difficulty: 'A0' },
        // Despedidas
        { id: 'm1l1v-totziens',    dutch: 'tot ziens',         spanish: 'hasta la vista (formal)',       article: null, emoji: '🤝', color: '#025dc7', exampleNl: 'Tot ziens en bedankt!',             exampleEs: '¡Hasta la vista y gracias!',              category: 'afscheid', difficulty: 'A0' },
        { id: 'm1l1v-doei',        dutch: 'doei',              spanish: 'adiós (informal)',              article: null, emoji: '👋', color: '#0b4db5', exampleNl: 'Doei! Tot morgen!',                 exampleEs: '¡Adiós! ¡Hasta mañana!',                  category: 'afscheid', difficulty: 'A0' },
        { id: 'm1l1v-totstraks',   dutch: 'tot straks',        spanish: 'hasta luego (mismo día)',       article: null, emoji: '⏰', color: '#0a3d9e', exampleNl: 'Ik ga nu, tot straks!',             exampleEs: 'Me voy ahora, ¡hasta luego!',             category: 'afscheid', difficulty: 'A0' },
        { id: 'm1l1v-totmorgen',   dutch: 'tot morgen',        spanish: 'hasta mañana',                  article: null, emoji: '📅', color: '#1440a0', exampleNl: 'Fijne avond en tot morgen!',        exampleEs: '¡Buena tarde y hasta mañana!',            category: 'afscheid', difficulty: 'A0' },
        { id: 'm1l1v-totvolgende', dutch: 'tot volgende week', spanish: 'hasta la semana que viene',     article: null, emoji: '🗓️', color: '#0d5bbf', exampleNl: 'De les is klaar. Tot volgende week!', exampleEs: 'La clase terminó. ¡Hasta la semana que viene!', category: 'afscheid', difficulty: 'A0' },
        { id: 'm1l1v-fijnedag',    dutch: 'fijne dag',         spanish: '¡que tengas un buen día!',      article: null, emoji: '🌞', color: '#1D0084', exampleNl: 'Tot ziens, fijne dag!',             exampleEs: '¡Hasta la vista, que tengas un buen día!', category: 'afscheid', difficulty: 'A0' },
        // Datos personales
        { id: 'm1l1v-naam',        dutch: 'de naam',           spanish: 'el nombre',                     article: 'de', emoji: '🏷️', color: '#025dc7', exampleNl: 'Mijn naam is Maria.',               exampleEs: 'Mi nombre es María.',                     category: 'voorstellen', difficulty: 'A0' },
        { id: 'm1l1v-leeftijd',    dutch: 'de leeftijd',       spanish: 'la edad',                       article: 'de', emoji: '🎂', color: '#0b4db5', exampleNl: 'Wat is jouw leeftijd?',             exampleEs: '¿Cuál es tu edad?',                       category: 'voorstellen', difficulty: 'A0' },
        { id: 'm1l1v-nationaliteit', dutch: 'de nationaliteit', spanish: 'la nacionalidad',              article: 'de', emoji: '🛂', color: '#0a3d9e', exampleNl: 'Mijn nationaliteit is Spaans.',     exampleEs: 'Mi nacionalidad es española.',            category: 'voorstellen', difficulty: 'A0' },
        { id: 'm1l1v-woonplaats',  dutch: 'de woonplaats',     spanish: 'el lugar de residencia',        article: 'de', emoji: '🏠', color: '#1440a0', exampleNl: 'Mijn woonplaats is Groningen.',     exampleEs: 'Mi lugar de residencia es Groninga.',     category: 'voorstellen', difficulty: 'A0' },
        // Verbos clave
        { id: 'm1l1v-heten',       dutch: 'heten',             spanish: 'llamarse',                      article: null, emoji: '🗣️', color: '#0d5bbf', exampleNl: 'Hoe heet jij?',                     exampleEs: '¿Cómo te llamas?',                        category: 'voorstellen', difficulty: 'A0' },
        { id: 'm1l1v-wonen',       dutch: 'wonen',             spanish: 'vivir / residir',               article: null, emoji: '🏡', color: '#1D0084', exampleNl: 'Ik woon in Amsterdam.',             exampleEs: 'Vivo en Ámsterdam.',                      category: 'voorstellen', difficulty: 'A0' },
        { id: 'm1l1v-komenuit',    dutch: 'komen uit',         spanish: 'venir de / ser de',             article: null, emoji: '✈️', color: '#025dc7', exampleNl: 'Ik kom uit Colombia.',              exampleEs: 'Vengo de Colombia.',                      category: 'voorstellen', difficulty: 'A0' },
        // Muy neerlandesas
        { id: 'm1l1v-gezellig',    dutch: 'gezellig',          spanish: 'agradable / acogedor (sin traducción exacta)', article: null, emoji: '🤗', color: '#0b4db5', exampleNl: 'Het was gezellig!',      exampleEs: '¡Fue muy agradable!',                     category: 'typisch-nederlands', difficulty: 'A0' },
        { id: 'm1l1v-lekker',      dutch: 'lekker',            spanish: 'rico / genial (palabra comodín)', article: null, emoji: '😋', color: '#0a3d9e', exampleNl: 'Kom lekker zitten.',              exampleEs: 'Ven, siéntate cómodamente.',              category: 'typisch-nederlands', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm1l1p-1',  dutch: 'Ik heet David.',                   spanish: 'Me llamo David.',                            context: 'Presentarse' },
        { id: 'm1l1p-2',  dutch: 'Mijn naam is Maria.',              spanish: 'Mi nombre es María.',                        context: 'Presentarse' },
        { id: 'm1l1p-3',  dutch: 'Ik ben Ana.',                      spanish: 'Yo soy Ana.',                                context: 'Presentarse' },
        { id: 'm1l1p-4',  dutch: 'Hoe heet jij?',                    spanish: '¿Cómo te llamas? (informal)',                context: 'Preguntar' },
        { id: 'm1l1p-5',  dutch: 'Hoe heet u?',                      spanish: '¿Cómo se llama usted? (formal)',             context: 'Preguntar' },
        { id: 'm1l1p-6',  dutch: 'Hoe is het met je?',               spanish: '¿Cómo estás?',                               context: 'Preguntar' },
        { id: 'm1l1p-7',  dutch: 'Ik ben 35 jaar.',                  spanish: 'Tengo 35 años.',                             context: 'Sobre ti' },
        { id: 'm1l1p-8',  dutch: 'Ik ben Spaans.',                   spanish: 'Soy español/a.',                             context: 'Sobre ti' },
        { id: 'm1l1p-9',  dutch: 'Ik woon in Groningen.',            spanish: 'Vivo en Groninga.',                          context: 'Sobre ti' },
        { id: 'm1l1p-10', dutch: 'Ik kom uit Colombia.',             spanish: 'Vengo de Colombia.',                         context: 'Sobre ti' },
        { id: 'm1l1p-11', dutch: 'Prettig kennis te maken.',         spanish: 'Encantado/a de conocerte.',                  context: 'Cortesía' },
        { id: 'm1l1p-12', dutch: 'Leuk je ontmoet te hebben.',       spanish: 'Encantado/a de haberte conocido.',           context: 'Despedida' },
        { id: 'm1l1p-13', dutch: 'Het was gezellig!',                spanish: '¡Fue muy agradable!',                        context: 'Despedida' },
        { id: 'm1l1p-14', dutch: 'Ik spreek graag nog eens met je af.', spanish: 'Me gustaría volver a quedar contigo.',    context: 'Despedida' },
      ],
    },
    {
      type: 'lezen',
      title: 'Groeten in Nederland',
      textNl: `In Nederland is groeten heel belangrijk. De dag heeft vier momenten: ’s ochtends zeg je goedemorgen, ’s middags goedemiddag, ’s avonds goedenavond en heel laat goedenacht. Het woord hallo kan altijd — en hoi is informeel, voor vrienden.

Afscheid nemen kan ook op veel manieren. Tot ziens is formeel en beleefd. Doei is informeel. Met tot straks, tot morgen en tot volgende week zeg je wanneer je elkaar weer ziet. En fijne dag is een vriendelijke wens voor iedereen.

David is nieuw in Amsterdam. Hij komt uit Argentinië en woont nu in Nederland. Elke dag groet hij veel mensen: de bakker, zijn taalbuddy Anna en zijn buurvrouw Els. De mensen in Nederland zijn direct, maar vriendelijk.

Nog één ding: Nederlanders zeggen vaak gezellig — een woord zonder vertaling. Een middag met koffie en een goed gesprek? Dat is gezellig!`,
      textEs: `En Países Bajos saludar es muy importante. El día tiene cuatro momentos: por la mañana dices goedemorgen, al mediodía goedemiddag, por la tarde-noche goedenavond y muy tarde goedenacht. La palabra hallo vale siempre — y hoi es informal, para amigos.

Despedirse también tiene muchas formas. Tot ziens es formal y educado. Doei es informal. Con tot straks, tot morgen y tot volgende week dices cuándo os volvéis a ver. Y fijne dag es un deseo amable para cualquiera.

David es nuevo en Ámsterdam. Viene de Argentina y ahora vive en Países Bajos. Cada día saluda a mucha gente: al panadero, a su compañera de idiomas Anna y a su vecina Els. La gente en Países Bajos es directa, pero amable.

Una cosa más: los neerlandeses dicen mucho gezellig — una palabra sin traducción. ¿Una tarde con café y buena conversación? ¡Eso es gezellig!`,
      exercises: [
        { id: 'm1l1lz-1', type: 'multiple_choice', prompt: 'Según el texto, ¿cuántos "momentos" de saludo tiene el día?', options: ['Cuatro', 'Dos', 'Tres', 'Cinco'], correctAnswer: 'Cuatro', explanation: 'Goedemorgen, goedemiddag, goedenavond y goedenacht.' },
        { id: 'm1l1lz-2', type: 'multiple_choice', prompt: '¿Qué saludo vale SIEMPRE, a cualquier hora?', options: ['Hallo', 'Goedenacht', 'Tot ziens', 'Doei'], correctAnswer: 'Hallo', explanation: '"Het woord hallo kan altijd."' },
        { id: 'm1l1lz-3', type: 'multiple_choice', prompt: '¿Cuál es la despedida FORMAL?', options: ['Tot ziens', 'Doei', 'Hoi', 'Hallo'], correctAnswer: 'Tot ziens', explanation: '"Tot ziens is formeel en beleefd"; doei es la informal.' },
        { id: 'm1l1lz-4', type: 'fill_blank', prompt: '’s Ochtends zeg je ___.', correctAnswer: 'goedemorgen', hint: 'El saludo de antes de las 12:00', explanation: 'Por la mañana: goedemorgen.' },
        { id: 'm1l1lz-5', type: 'multiple_choice', prompt: '¿De dónde viene David?', options: ['De Argentina', 'De Italia', 'De Chile', 'De Países Bajos'], correctAnswer: 'De Argentina', explanation: '"Hij komt uit Argentinië."' },
        { id: 'm1l1lz-6', type: 'multiple_choice', prompt: '¿A quién saluda David cada día?', options: ['Al panadero, a Anna y a su vecina Els', 'Solo a Anna', 'A nadie', 'A su familia en Argentina'], correctAnswer: 'Al panadero, a Anna y a su vecina Els', explanation: '"De bakker, zijn taalbuddy Anna en zijn buurvrouw Els."' },
        { id: 'm1l1lz-7', type: 'fill_blank', prompt: 'Met tot ___, tot morgen en tot volgende week zeg je wanneer je elkaar weer ziet.', correctAnswer: 'straks', hint: 'La despedida de "hasta luego, hoy mismo"', explanation: '"Tot straks" = hasta luego (el mismo día).' },
        { id: 'm1l1lz-8', type: 'multiple_choice', prompt: 'Según el texto, ¿cómo es la gente en Países Bajos?', options: ['Directa, pero amable', 'Tímida', 'Muy formal siempre', 'Poco habladora'], correctAnswer: 'Directa, pero amable', explanation: '"De mensen in Nederland zijn direct, maar vriendelijk."' },
        { id: 'm1l1lz-9', type: 'fill_blank', prompt: 'Een middag met koffie en een goed gesprek? Dat is ___!', correctAnswer: 'gezellig', hint: 'La palabra neerlandesa sin traducción', explanation: 'Ese ambiente agradable y acogedor es… gezellig.' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'm1d1',
        title: 'De eerste kennismaking',
        context: 'David wil graag (beter) Nederlands leren en ontmoet zijn taalbuddy Anna voor het eerst.',
        lines: [
          { id: 'm1d1-1',  speaker: 'David', dutch: 'Hallo Anna!',                                                                                                          spanish: '¡Hola, Anna!' },
          { id: 'm1d1-2',  speaker: 'Anna',  dutch: 'Hoi David, ik ben hier! Kom lekker zitten. Wil je iets drinken?',                                                       spanish: '¡Hola David, estoy aquí! Ven y siéntate. ¿Quieres algo de beber?' },
          { id: 'm1d1-3',  speaker: 'David', dutch: 'Ja, een koffie verkeerd graag.',                                                                                        spanish: 'Sí, un café con leche, por favor.' },
          { id: 'm1d1-4',  speaker: 'Anna',  dutch: 'Hoe is het met je?',                                                                                                    spanish: '¿Cómo estás?' },
          { id: 'm1d1-5',  speaker: 'David', dutch: 'Goed! Ik vind het leuk hier in Nederland.',                                                                             spanish: '¡Genial! Me gusta estar aquí en los Países Bajos.' },
          { id: 'm1d1-6',  speaker: 'Anna',  dutch: 'Waar kom je oorspronkelijk vandaan?',                                                                                   spanish: '¿De dónde eres originalmente?' },
          { id: 'm1d1-7',  speaker: 'David', dutch: 'Ik ben Argentijns, en ik heb ook een Italiaans paspoort.',                                                              spanish: 'Soy argentino y también tengo pasaporte italiano.' },
          { id: 'm1d1-8',  speaker: 'Anna',  dutch: 'Wat goed! En waar woon je nu precies?',                                                                                 spanish: '¡Qué bien! ¿Y dónde vives ahora exactamente?' },
          { id: 'm1d1-9',  speaker: 'David', dutch: 'Ik woon nu in Amsterdam, maar de eerste zes maanden dat ik hier was, woonde ik in Amstelveen. Waar woon jij?',          spanish: 'Ahora vivo en Ámsterdam, pero los primeros seis meses que estuve aquí viví en Amstelveen. ¿Dónde vives tú?' },
          { id: 'm1d1-10', speaker: 'Anna',  dutch: 'Ik ben net verhuisd van Eindhoven naar Haarlem.',                                                                       spanish: 'Me acabo de mudar de Eindhoven a Haarlem.' },
          { id: 'm1d1-11', speaker: 'David', dutch: 'Eindhoven, wat leuk! Ik was daar jaren geleden op vakantie met mijn ouders en zus. Toen was ik tien jaar oud.',         spanish: '¡Eindhoven, qué bonito! Estuve allí de vacaciones hace años con mis padres y mi hermana. Entonces tenía diez años.' },
          { id: 'm1d1-12', speaker: 'Anna',  dutch: 'Wat gezellig! Ken je het woord ‘gezellig’ al?',                                                                         spanish: '¡Qué bien! ¿Ya conoces la palabra «gezellig»?' },
          { id: 'm1d1-13', speaker: 'David', dutch: 'Ja, ik hoor het heel vaak. Het klinkt heel Nederlands.',                                                                spanish: 'Sí, la oigo muy a menudo. Suena muy neerlandés.' },
          { id: 'm1d1-14', speaker: 'Anna',  dutch: 'Ik moet gaan. Leuk om je te ontmoeten!',                                                                                spanish: 'Me tengo que ir. ¡Un placer conocerte!' },
          { id: 'm1d1-15', speaker: 'David', dutch: 'Dank je wel voor je tijd. Ik spreek graag volgende week weer af, kun jij dan ook?',                                     spanish: 'Gracias por tu tiempo. Me encantaría quedar otra vez la semana que viene, ¿puedes tú también?' },
          { id: 'm1d1-16', speaker: 'Anna',  dutch: 'Dat is goed. Tot dan!',                                                                                                 spanish: 'De acuerdo. ¡Hasta entonces!' },
          { id: 'm1d1-17', speaker: 'David', dutch: 'Tot dan en een fijne dag!',                                                                                             spanish: '¡Hasta entonces y que tengas un buen día!' },
        ],
      },
      exercises: [
        { id: 'm1d1q-1', type: 'multiple_choice', prompt: '¿Qué pide David para beber?', options: ['Un café con leche', 'Un té verde', 'Un vaso de agua', 'Una cerveza'], correctAnswer: 'Un café con leche', explanation: '"Een koffie verkeerd" es el café con bastante leche. Literalmente "café al revés", porque lleva más leche que café.' },
        { id: 'm1d1q-2', type: 'multiple_choice', prompt: '¿De dónde es David originalmente?', options: ['De Argentina', 'De Italia', 'De España', 'De Países Bajos'], correctAnswer: 'De Argentina', explanation: '"Ik ben Argentijns" — y además tiene pasaporte italiano.' },
        { id: 'm1d1q-3', type: 'multiple_choice', prompt: '¿Dónde vive David ahora?', options: ['En Ámsterdam', 'En Amstelveen', 'En Haarlem', 'En Eindhoven'], correctAnswer: 'En Ámsterdam', explanation: 'Ahora en Ámsterdam; sus primeros seis meses vivió en Amstelveen.' },
        { id: 'm1d1q-4', type: 'multiple_choice', prompt: '¿Dónde vivió David sus primeros seis meses en el país?', options: ['En Amstelveen', 'En Ámsterdam', 'En Haarlem', 'En Utrecht'], correctAnswer: 'En Amstelveen', explanation: '"De eerste zes maanden dat ik hier was, woonde ik in Amstelveen."' },
        { id: 'm1d1q-5', type: 'multiple_choice', prompt: 'Anna se acaba de mudar. ¿De dónde a dónde?', options: ['De Eindhoven a Haarlem', 'De Haarlem a Eindhoven', 'De Ámsterdam a Haarlem', 'De Eindhoven a Ámsterdam'], correctAnswer: 'De Eindhoven a Haarlem', explanation: '"Ik ben net verhuisd van Eindhoven naar Haarlem." Verhuizen = mudarse.' },
        { id: 'm1d1q-6', type: 'multiple_choice', prompt: '¿Con quién estuvo David de vacaciones en Eindhoven?', options: ['Con sus padres y su hermana', 'Con Anna', 'Con unos amigos', 'Solo'], correctAnswer: 'Con sus padres y su hermana', explanation: '"Met mijn ouders en zus." De ouders = los padres, de zus = la hermana.' },
        { id: 'm1d1q-7', type: 'multiple_choice', prompt: '¿Cuántos años tenía David en aquel viaje?', options: ['Diez', 'Doce', 'Quince', 'No lo dice'], correctAnswer: 'Diez', explanation: '"Toen was ik tien jaar oud."' },
        { id: 'm1d1q-8', type: 'true_false', prompt: 'David no ha oído nunca la palabra "gezellig".', correctAnswer: 'falso', explanation: 'Dice justo lo contrario: "ik hoor het heel vaak" — la oye muchísimo.' },
        { id: 'm1d1q-9', type: 'multiple_choice', prompt: '¿Cómo quedan al despedirse?', options: ['En volver a verse la semana siguiente', 'En llamarse esa noche', 'En escribirse un correo', 'No quedan en nada'], correctAnswer: 'En volver a verse la semana siguiente', explanation: '"Ik spreek graag volgende week weer af" — afspreken = quedar con alguien.' },
      ],
    },
    {
      // Spreken: situaciones reales. Las tres respuestas SOLO suenan; el texto
      // aparece al contestar. Todas las frases salen del material de esta
      // misma lección, para que sea un repaso de oído y no contenido nuevo.
      type: 'spreken',
      title: 'Wat zeg je?',
      intro: 'Situaciones normales del día a día. Escucha las tres respuestas y elige la que dirías tú. El texto no aparece hasta que contestas.',
      exercises: [
        { id: 'm1l1sp-1', type: 'spreken_choose', prompt: 'Son las 9 de la mañana y entras en la panadería. ¿Qué dices?', options: ['Goedemorgen!', 'Goedenavond!', 'Tot morgen!'], correctAnswer: 'Goedemorgen!', explanation: '"Goedemorgen" hasta las 12:00. Ojo: "tot morgen" es "hasta mañana", no un saludo.' },
        { id: 'm1l1sp-2', type: 'spreken_choose', prompt: 'Alguien te pregunta: "Hoe heet je?". ¿Qué contestas?', options: ['Ik heet David.', 'Ik ben 35 jaar.', 'Ik woon in Utrecht.'], correctAnswer: 'Ik heet David.', explanation: '"Hoe heet je?" pregunta el nombre. La edad y el lugar contestan a otras preguntas.' },
        { id: 'm1l1sp-3', type: 'spreken_choose', prompt: 'Te despides de un amigo y os veis mañana. ¿Qué dices?', options: ['Tot morgen!', 'Tot straks!', 'Goedemiddag!'], correctAnswer: 'Tot morgen!', explanation: '"Tot straks" es el mismo día; "tot morgen", mañana. "Goedemiddag" es un saludo, no una despedida.' },
        { id: 'm1l1sp-4', type: 'spreken_choose', prompt: 'Te preguntan "Hoe is het met je?". ¿Qué contestas?', options: ['Goed, dank je!', 'Ik kom uit Spanje.', 'Alsjeblieft.'], correctAnswer: 'Goed, dank je!', explanation: 'Cuidado con la pareja "alsjeblieft" (por favor / aquí tienes) y "dank je" (gracias).' },
        { id: 'm1l1sp-5', type: 'spreken_choose', prompt: 'Quieres preguntarle el nombre a una señora mayor, de forma formal.', options: ['Hoe heet u?', 'Hoe heet jij?', 'Wie ben jij?'], correctAnswer: 'Hoe heet u?', explanation: 'Con "u" tratas de usted. "Jij" es tú, e "wie ben jij?" suena brusco.' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        // ── Opción múltiple ──
        { id: 'm1l1e-1',  type: 'multiple_choice', prompt: '¿Qué saludo usas antes de las 12:00?', options: ['Goedemorgen', 'Goedemiddag', 'Goedenavond', 'Goedenacht'], correctAnswer: 'Goedemorgen', explanation: '"Goedemorgen" hasta las 12:00; "goedemiddag" de 12:00 a 18:00; "goedenavond" después de las 18:00.' },
        { id: 'm1l1e-2',  type: 'multiple_choice', prompt: '¿Qué significa "de woonplaats"?', options: ['El lugar de residencia', 'La nacionalidad', 'La edad', 'El nombre'], correctAnswer: 'El lugar de residencia', explanation: '"Wonen" = vivir, "de plaats" = el lugar → el lugar donde vives.' },
        { id: 'm1l1e-3',  type: 'multiple_choice', prompt: '¿Cómo preguntas el nombre de manera FORMAL?', options: ['Hoe heet u?', 'Hoe heet jij?', 'Hoe is het met je?', 'Wie ben jij?'], correctAnswer: 'Hoe heet u?', explanation: '"U" = usted (formal). "Jij" = tú (informal).' },
        { id: 'm1l1e-4',  type: 'multiple_choice', prompt: 'Alguien te dice "Hoe is het met je?". ¿Qué contestas?', options: ['Goed, dank je!', 'Ik heet Anna.', 'Tot morgen!', 'Ik woon in Utrecht.'], correctAnswer: 'Goed, dank je!', explanation: '"Hoe is het met je?" = ¿cómo estás? → "Goed, dank je!" = ¡bien, gracias!' },
        { id: 'm1l1e-5',  type: 'multiple_choice', prompt: '¿Cuál es la forma correcta de decir tu edad?', options: ['Ik ben 35 jaar.', 'Ik heb 35 jaar.', 'Ik ben 35 jaren.', 'Ik heet 35 jaar.'], correctAnswer: 'Ik ben 35 jaar.', explanation: 'En neerlandés los años se "son", no se "tienen": Ik BEN 35 jaar.' },
        { id: 'm1l1e-6',  type: 'multiple_choice', prompt: '"Tot straks" se usa cuando…', options: ['os volvéis a ver el mismo día', 'os veis mañana', 'os veis la semana que viene', 'no os vais a ver más'], correctAnswer: 'os volvéis a ver el mismo día', explanation: '"Tot straks" = hasta luego, si os volvéis a ver más tarde ese mismo día.' },
        // ── Verdadero / Falso ──
        { id: 'm1l1e-7',  type: 'true_false', prompt: '"Doei" es una despedida informal.', correctAnswer: 'verdadero', explanation: '"Doei!" (o "doeiiii") es la despedida informal típica entre amigos.' },
        { id: 'm1l1e-8',  type: 'true_false', prompt: '"Goedenavond" se usa por la mañana.', correctAnswer: 'falso', explanation: '"Goedenavond" se usa después de las 18:00. Por la mañana: "goedemorgen".' },
        { id: 'm1l1e-9',  type: 'true_false', prompt: '"Gezellig" tiene una traducción exacta al español.', correctAnswer: 'falso', explanation: 'No la tiene: es una mezcla de acogedor, agradable, divertido y cálido.' },
        // ── Completar ──
        { id: 'm1l1e-10', type: 'fill_blank', prompt: 'Ik ___ David. (llamarse)', correctAnswer: 'heet', hint: 'heten → con ik va la raíz' },
        { id: 'm1l1e-11', type: 'fill_blank', prompt: 'Ik ___ 35 jaar. (ser)', correctAnswer: 'ben', hint: 'el verbo zijn (ser) es irregular: yo soy = ik …', explanation: 'La edad en neerlandés va con el verbo "zijn" (ser): Ik ben 35 jaar.' },
        { id: 'm1l1e-12', type: 'fill_blank', prompt: 'Ik ___ in Groningen. (vivir)', correctAnswer: 'woon', hint: 'wonen → con ik va la raíz' },
        { id: 'm1l1e-13', type: 'fill_blank', prompt: 'Ik kom ___ Colombia. (venir de)', correctAnswer: 'uit', hint: 'el verbo komen pide una preposición' },
        // ── Ordenar frases ──
        { id: 'm1l1e-14', type: 'order_sentence', prompt: 'Ordena: "Me llamo María y vengo de Colombia."', options: ['Ik', 'heet', 'Maria', 'en', 'ik', 'kom', 'uit', 'Colombia'], correctAnswer: 'Ik heet Maria en ik kom uit Colombia' },
        { id: 'm1l1e-15', type: 'order_sentence', prompt: 'Ordena: "¿Cómo te llamas?"', options: ['Hoe', 'heet', 'jij?'], correctAnswer: 'Hoe heet jij?' },
        { id: 'm1l1e-16', type: 'order_sentence', prompt: 'Ordena: "Ahora vivo en Ámsterdam."', options: ['Ik', 'woon', 'nu', 'in', 'Amsterdam'], correctAnswer: 'Ik woon nu in Amsterdam' },
        // ── Sopa de letras ──
        { id: 'm1l1e-17', type: 'word_scramble', prompt: '¿Cómo se dice "vivir"?', correctAnswer: 'wonen', hint: 'vivir' },
        { id: 'm1l1e-18', type: 'word_scramble', prompt: '¿Cómo se dice "la edad"?', correctAnswer: 'leeftijd', hint: 'la edad' },
        // ── Letras que faltan ──
        { id: 'm1l1e-19', type: 'letter_dash', prompt: 'Completa el saludo de la mañana', correctAnswer: 'goedemorgen', hint: 'buenos días (hasta las 12:00)' },
        { id: 'm1l1e-20', type: 'letter_dash', prompt: 'Completa la palabra neerlandesa para "acogedor/agradable"', correctAnswer: 'gezellig', hint: 'No tiene traducción exacta al español' },
        // ── Unir parejas ──
        { id: 'm1l1e-21', type: 'match_pairs', prompt: 'Une cada saludo o despedida con su traducción', correctAnswer: '', pairs: [
          { left: 'hallo', right: 'hola' },
          { left: 'doei', right: 'adiós (informal)' },
          { left: 'tot morgen', right: 'hasta mañana' },
          { left: 'goedenacht', right: 'buenas noches' },
          { left: 'tot ziens', right: 'hasta la vista' },
          { left: 'fijne dag!', right: '¡buen día!' },
        ] },
        { id: 'm1l1e-22', type: 'match_pairs', prompt: 'Une cada palabra con su traducción', correctAnswer: '', pairs: [
          { left: 'de naam', right: 'el nombre' },
          { left: 'de leeftijd', right: 'la edad' },
          { left: 'de nationaliteit', right: 'la nacionalidad' },
          { left: 'de woonplaats', right: 'el lugar de residencia' },
          { left: 'heten', right: 'llamarse' },
          { left: 'wonen', right: 'vivir' },
        ] },
        // ── Emoji ──
        { id: 'm1l1e-23', type: 'emoji_choice', prompt: '¿Qué emoji representa "goedemorgen"?', options: ['🌅', '🌙', '🍟', '🚗'], correctAnswer: '🌅', explanation: '"Goedemorgen" = buenos días → el amanecer.' },
        { id: 'm1l1e-24', type: 'emoji_choice', prompt: '¿Qué emoji representa "de leeftijd"?', options: ['🎂', '🏠', '☕', '📖'], correctAnswer: '🎂', explanation: '"De leeftijd" = la edad → la tarta de cumpleaños.' },
        // ── El intruso ──
        { id: 'm1l1e-25', type: 'odd_one_out', prompt: '¿Cuál NO es un saludo?', options: ['goedemorgen', 'goedemiddag', 'goedenavond', 'tot ziens'], correctAnswer: 'tot ziens', explanation: '"Tot ziens" es una despedida; las otras tres son saludos según la hora.' },
        { id: 'm1l1e-26', type: 'odd_one_out', prompt: '¿Cuál NO es un dato personal?', options: ['de naam', 'de leeftijd', 'doei', 'de woonplaats'], correctAnswer: 'doei', explanation: '"Doei" es una despedida; los otros tres son datos para presentarte.' },
        // ── Escribir ──
        { id: 'm1l1e-27', type: 'write_answer', prompt: 'Escribe en neerlandés: "Me llamo Ana"', correctAnswer: 'Ik heet Ana', hint: 'Empieza con "Ik…" · sin punto final' },
        { id: 'm1l1e-28', type: 'write_answer', prompt: 'Escribe en neerlandés: "Vivo en Amsterdam"', correctAnswer: 'Ik woon in Amsterdam', hint: 'wonen → ik woon · sin punto final' },
        // ── Escuchar ──
        { id: 'm1l1e-29', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "Tot morgen"', options: ['Tot morgen', 'Tot ziens', 'Tot straks', 'Tot later'], correctAnswer: 'Tot morgen' },
        { id: 'm1l1e-30', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "Hoe heet jij?"', options: ['Hoe heet jij?', 'Hoe is het met je?', 'Hoe heet u?', 'Waar woon jij?'], correctAnswer: 'Hoe heet jij?' },
        { id: 'm1l1e-31', type: 'listen_translate', prompt: 'Escucha y traduce: "Ik kom uit Spanje"', options: ['Vengo', 'de', 'España', 'Vivo', 'en', 'Ámsterdam'], correctAnswer: 'Vengo de España' },
        { id: 'm1l1e-32', type: 'listen_translate', prompt: 'Escucha y traduce: "Het was gezellig"', options: ['Fue', 'muy', 'agradable', 'Hasta', 'mañana', 'rico'], correctAnswer: 'Fue muy agradable' },
        // ── Comprensión del diálogo (De eerste kennismaking) ──
        { id: 'm1l1e-33', type: 'multiple_choice', prompt: 'En el diálogo, ¿qué pide David para beber?', options: ['Un café con leche (koffie verkeerd)', 'Un té', 'Un agua', 'Una cola'], correctAnswer: 'Un café con leche (koffie verkeerd)', explanation: '"Een koffie verkeerd graag" — el "koffie verkeerd" es el café con mucha leche típico de NL.' },
        { id: 'm1l1e-34', type: 'multiple_choice', prompt: '¿De dónde es David originalmente?', options: ['De Argentina', 'De Italia', 'De España', 'De Países Bajos'], correctAnswer: 'De Argentina', explanation: '"Ik ben Argentijns" — además tiene pasaporte italiano.' },
        { id: 'm1l1e-35', type: 'true_false', prompt: 'Anna se acaba de mudar a Haarlem.', correctAnswer: 'verdadero', explanation: '"Ik ben net verhuisd van Eindhoven naar Haarlem."' },
        { id: 'm1l1e-36', type: 'true_false', prompt: 'David vive ahora en Amstelveen.', correctAnswer: 'falso', explanation: 'Vivió en Amstelveen los primeros seis meses; ahora vive en Ámsterdam.' },
      ],
    },
    { type: 'review' },
  ],
};

const m1_les2: Lesson = {
  id: 'les-2-voornaamwoorden',
  moduleId: 'over-jou',
  title: 'Les 2 — Grammatica | Persoonlijke voornaamwoorden',
  subtitle: 'Pronombres personales',
  order: 2,
  learningObjective: 'Usar ik, jij, u, hij, zij, het, wij, jullie y zij, y distinguir las formas fuertes y débiles',
  estimatedMinutes: 30,
  blocks: [
    {
      type: 'summary',
      title: 'Persoonlijke voornaamwoorden',
      intro: 'En neerlandés los pronombres se usan mucho más que en español: mientras en español basta con la forma del verbo (hablo, comes, vivimos), en neerlandés casi siempre se dice el sujeto. Hoy los aprendes todos.',
      objectives: [
        'Usar ik, jij, u, hij, zij, het, wij, jullie y zij',
        'Distinguir las formas fuertes y débiles (jij/je, wij/we, zij/ze)',
        'Entender los casos especiales: u, het y el doble "zij"',
      ],
      sections: [
        {
          heading: '👤 Los pronombres',
          body: 'En neerlandés casi siempre se expresa el sujeto, igual que en inglés: **Ik ben docent** (soy profesor), **Wij wonen in Utrecht** (vivimos en Utrecht).',
          items: [
            { nl: 'ik', es: 'yo' },
            { nl: 'jij / je', es: 'tú' },
            { nl: 'u', es: 'usted (y también "ustedes")' },
            { nl: 'hij', es: 'él' },
            { nl: 'zij / ze', es: 'ella' },
            { nl: 'het', es: '"ello" (impersonal)' },
            { nl: 'wij / we', es: 'nosotros/as' },
            { nl: 'jullie', es: 'vosotros/as' },
            { nl: 'zij / ze', es: 'ellos / ellas' },
          ],
        },
        {
          heading: '💪 Formas fuertes y débiles',
          body: 'Algo muy característico del neerlandés: algunos pronombres tienen dos formas. La **débil** (je, we, ze) es la normal en la conversación de cada día; la **fuerte** (jij, wij, zij) se usa para dar énfasis o hacer contraste. **Je bent welkom** (eres bienvenido, neutro) vs. **Jij bent welkom** (TÚ eres bienvenido, énfasis).',
          items: [
            { nl: 'jij → je', es: 'tú' },
            { nl: 'wij → we', es: 'nosotros/as' },
            { nl: 'zij → ze', es: 'ella · ellos/ellas' },
          ],
        },
        {
          heading: '⚠️ Los tres casos especiales',
          body: '**1) "Zij" es doble**: significa "ella" Y "ellos/ellas" — el verbo te dice cuál es: *Zij is ingenieur* (ella es) / *Zij zijn broer en zus* (ellos son). **2) No existe "ustedes"**: para dirigirte a varias personas de forma formal usas **u**. **3) "Het" impersonal**: en neerlandés la frase casi siempre necesita sujeto; cuando en español no hay, aparece *het*: **Het regent** (llueve), **Het is laat** (es tarde).',
        },
      ],
      tip: 'En español dices "hablo" y ya está; en neerlandés casi SIEMPRE necesitas el pronombre: **Ik spreek**. Y si dudas entre jij/je, wij/we o zij/ze: la forma corta (débil) es la normal; la larga es para dar énfasis.',
    },
    {
      type: 'vocabulary',
      items: [
        { id: 'm1l2v-ik',      dutch: 'ik',       spanish: 'yo',                                article: null, emoji: '🙋', color: '#1D0084', exampleNl: 'Ik ben docent.',            exampleEs: 'Yo soy profesor/a.',            category: 'voornaamwoorden', difficulty: 'A0' },
        { id: 'm1l2v-jij',     dutch: 'jij',      spanish: 'tú (forma fuerte)',                 article: null, emoji: '👉', color: '#025dc7', exampleNl: 'Jij bent musicus.',         exampleEs: 'Tú eres músico.',               category: 'voornaamwoorden', difficulty: 'A0' },
        { id: 'm1l2v-je',      dutch: 'je',       spanish: 'tú (forma débil, la normal)',       article: null, emoji: '👈', color: '#0b4db5', exampleNl: 'Je bent welkom.',           exampleEs: 'Eres bienvenido/a.',            category: 'voornaamwoorden', difficulty: 'A0' },
        { id: 'm1l2v-u',       dutch: 'u',        spanish: 'usted / ustedes (formal)',          article: null, emoji: '🎩', color: '#0a3d9e', exampleNl: 'Hoe heet u?',               exampleEs: '¿Cómo se llama usted?',         category: 'voornaamwoorden', difficulty: 'A0' },
        { id: 'm1l2v-hij',     dutch: 'hij',      spanish: 'él',                                article: null, emoji: '👨', color: '#1440a0', exampleNl: 'Hij is arts.',              exampleEs: 'Él es médico.',                 category: 'voornaamwoorden', difficulty: 'A0' },
        { id: 'm1l2v-zij',     dutch: 'zij',      spanish: 'ella · ellos/ellas (según el verbo)', article: null, emoji: '👩', color: '#0d5bbf', exampleNl: 'Zij is ingenieur. / Zij zijn broer en zus.', exampleEs: 'Ella es ingeniera. / Ellos son hermanos.', category: 'voornaamwoorden', difficulty: 'A0' },
        { id: 'm1l2v-ze',      dutch: 'ze',       spanish: 'ella / ellos (forma débil)',        article: null, emoji: '💬', color: '#1D0084', exampleNl: 'Ze werkt vandaag.',         exampleEs: 'Ella trabaja hoy.',             category: 'voornaamwoorden', difficulty: 'A0' },
        { id: 'm1l2v-het',     dutch: 'het',      spanish: '"ello" (impersonal)',               article: null, emoji: '🌧️', color: '#025dc7', exampleNl: 'Het regent.',               exampleEs: 'Llueve.',                       category: 'voornaamwoorden', difficulty: 'A0' },
        { id: 'm1l2v-wij',     dutch: 'wij',      spanish: 'nosotros/as (forma fuerte)',        article: null, emoji: '👥', color: '#0b4db5', exampleNl: 'Wij wonen in Utrecht.',     exampleEs: 'Nosotros vivimos en Utrecht.',  category: 'voornaamwoorden', difficulty: 'A0' },
        { id: 'm1l2v-we',      dutch: 'we',       spanish: 'nosotros/as (forma débil)',         article: null, emoji: '🤝', color: '#0a3d9e', exampleNl: 'We gaan naar huis.',        exampleEs: 'Vamos a casa.',                 category: 'voornaamwoorden', difficulty: 'A0' },
        { id: 'm1l2v-jullie',  dutch: 'jullie',   spanish: 'vosotros/as',                       article: null, emoji: '👋', color: '#1440a0', exampleNl: 'Jullie zijn hier.',         exampleEs: 'Vosotros estáis aquí.',         category: 'voornaamwoorden', difficulty: 'A0' },
        { id: 'm1l2v-arts',    dutch: 'de arts',  spanish: 'el médico / la médica',             article: 'de', emoji: '🩺', color: '#0d5bbf', exampleNl: 'Zij is arts.',              exampleEs: 'Ella es médica.',               category: 'beroepen', difficulty: 'A0' },
        { id: 'm1l2v-schilder', dutch: 'de schilder', spanish: 'el pintor / la pintora',        article: 'de', emoji: '🎨', color: '#1D0084', exampleNl: 'Zij zijn schilders.',       exampleEs: 'Ellos son pintores.',           category: 'beroepen', difficulty: 'A0' },
        { id: 'm1l2v-thuis',   dutch: 'thuis',    spanish: 'en casa',                           article: null, emoji: '🏠', color: '#025dc7', exampleNl: 'Ben je thuis?',             exampleEs: '¿Estás en casa?',               category: 'algemeen', difficulty: 'A0' },
        { id: 'm1l2v-vandaag', dutch: 'vandaag',  spanish: 'hoy',                               article: null, emoji: '📆', color: '#0b4db5', exampleNl: 'Ze werkt vandaag.',         exampleEs: 'Ella trabaja hoy.',             category: 'algemeen', difficulty: 'A0' },
        { id: 'm1l2v-griep',   dutch: 'de griep', spanish: 'la gripe',                          article: 'de', emoji: '🤒', color: '#0a3d9e', exampleNl: 'Heeft hij griep?',          exampleEs: '¿Tiene él gripe?',              category: 'algemeen', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm1l2p-1',  dutch: 'Zijn jullie klaar?',      spanish: '¿Estáis listos/as?',            context: 'Preguntar' },
        { id: 'm1l2p-2',  dutch: 'Zij is arts.',            spanish: 'Ella es médica.',               context: 'Sobre otros' },
        { id: 'm1l2p-3',  dutch: 'Zij zijn schilders.',     spanish: 'Ellos son pintores.',           context: 'Sobre otros' },
        { id: 'm1l2p-4',  dutch: 'Ben je thuis?',           spanish: '¿Estás en casa?',               context: 'Preguntar' },
        { id: 'm1l2p-5',  dutch: 'Jij spreekt Nederlands.', spanish: 'Tú hablas neerlandés.',         context: 'Sobre ti' },
        { id: 'm1l2p-6',  dutch: 'Ik leer Nederlands.',     spanish: 'Estoy aprendiendo neerlandés.', context: 'Sobre ti' },
        { id: 'm1l2p-7',  dutch: 'Heeft hij griep?',        spanish: '¿Tiene (él) gripe?',            context: 'Preguntar' },
        { id: 'm1l2p-8',  dutch: 'Ze werkt vandaag.',       spanish: 'Ella trabaja hoy.',             context: 'Sobre otros' },
        { id: 'm1l2p-9',  dutch: 'Ik heb een kat.',         spanish: 'Tengo un gato.',                context: 'Sobre ti' },
        { id: 'm1l2p-10', dutch: 'We gaan naar huis.',      spanish: 'Vamos a casa.',                 context: 'Cotidiano' },
        { id: 'm1l2p-11', dutch: 'Drinken jullie koffie?',  spanish: '¿Tomáis café?',                 context: 'Preguntar' },
        { id: 'm1l2p-12', dutch: 'Wij gaan naar Antwerpen.', spanish: 'Nosotras vamos a Amberes.',    context: 'Cotidiano' },
      ],
    },
    {
      type: 'lezen',
      title: 'Sofia, Pablo en de kat Luna',
      textNl: `Dit is Sofia. Zij komt uit Chili en ze leert Nederlands. Pablo is de man van Sofia. Hij werkt thuis. Sofia en Pablo wonen in Rotterdam. Zij hebben een kat. De kat heet Luna.

’s Ochtends is Sofia altijd klaar, maar Pablo niet: hij drinkt eerst koffie. Veel koffie! Sofia lacht dan. Jullie kennen dat wel — in veel huizen gaat het zo.

Jan en Els wonen ook in de straat. Zij zijn schilders. Vandaag werken ze niet, want het regent. Zij zijn thuis. Luna, de kat, zit bij het raam. Zij kijkt naar de regen.

’s Avonds leren Sofia en Pablo samen Nederlands. Sofia leert snel, Pablo leert langzaam. Hij vindt Nederlands moeilijk, maar zij leren samen — en samen is het gezellig. En jullie? Leren jullie ook Nederlands? Dan zijn jullie net als Sofia en Pablo!`,
      textEs: `Esta es Sofía. Ella es de Chile y está aprendiendo neerlandés. Pablo es el marido de Sofía. Él trabaja en casa. Sofía y Pablo viven en Róterdam. Tienen un gato. La gata se llama Luna.

Por la mañana Sofía siempre está lista, pero Pablo no: él primero toma café. ¡Mucho café! Sofía entonces se ríe. Ya lo conocéis — en muchas casas pasa igual.

Jan y Els también viven en la calle. Ellos son pintores. Hoy no trabajan, porque llueve. Están en casa. Luna, la gata, está sentada junto a la ventana. Ella mira la lluvia.

Por la noche, Sofía y Pablo aprenden neerlandés juntos. Sofía aprende rápido, Pablo aprende despacio. A él el neerlandés le parece difícil, pero aprenden juntos — y juntos hay buen ambiente. ¿Y vosotros? ¿También estáis aprendiendo neerlandés? ¡Entonces sois como Sofía y Pablo!`,
      exercises: [
        { id: 'm1l2lz-1', type: 'multiple_choice', prompt: '¿De dónde es Sofía?', options: ['De Chile', 'De Colombia', 'De España', 'De Argentina'], correctAnswer: 'De Chile', explanation: '"Zij komt uit Chili."' },
        { id: 'm1l2lz-2', type: 'multiple_choice', prompt: '¿Quién trabaja en casa?', options: ['Pablo', 'Sofía', 'Jan', 'Els'], correctAnswer: 'Pablo', explanation: '"Hij werkt thuis" — hij = él = Pablo.' },
        { id: 'm1l2lz-3', type: 'multiple_choice', prompt: '¿Cómo se llama la gata?', options: ['Luna', 'Els', 'Minoes', 'Sofia'], correctAnswer: 'Luna', explanation: '"De kat heet Luna."' },
        { id: 'm1l2lz-4', type: 'fill_blank', prompt: 'Sofia en Pablo ___ in Rotterdam. (vivir, ellos)', correctAnswer: 'wonen', hint: 'Con "zij" (ellos) se usa el infinitivo', explanation: 'Plural → infinitivo: zij wonen.' },
        { id: 'm1l2lz-5', type: 'multiple_choice', prompt: '¿Qué hacen Jan y Els?', options: ['Son pintores', 'Son médicos', 'Son panaderos', 'Son profesores'], correctAnswer: 'Son pintores', explanation: '"Zij zijn schilders."' },
        { id: 'm1l2lz-6', type: 'multiple_choice', prompt: '¿Por qué están Jan y Els en casa?', options: ['Porque llueve', 'Porque es de noche', 'Porque están enfermos', 'Porque es fiesta'], correctAnswer: 'Porque llueve', explanation: '"Vandaag werken ze niet, want het regent."' },
        { id: 'm1l2lz-7', type: 'fill_blank', prompt: '___ regent, dus zij zijn thuis. (impersonal)', correctAnswer: 'Het', hint: 'El pronombre del clima', explanation: '"Het regent" = llueve. Het es el sujeto impersonal.' },
        { id: 'm1l2lz-8', type: 'multiple_choice', prompt: '¿Quién aprende rápido?', options: ['Sofía', 'Pablo', 'Luna', 'Jan'], correctAnswer: 'Sofía', explanation: '"Sofia leert snel, Pablo leert langzaam."' },
        { id: 'm1l2lz-9', type: 'fill_blank', prompt: 'Pablo ___ eerst koffie. (beber)', correctAnswer: 'drinkt', hint: 'drinken → con hij, raíz + t', explanation: 'Con "hij" el verbo lleva -t.' },
      ],
    },
    {
      // Diálogo de la presentación (Les 2 · De tweede ontmoeting).
      type: 'dialogue',
      dialogue: {
        id: 'm1d2',
        title: 'De tweede ontmoeting',
        context: 'David en Anna zien elkaar voor de tweede keer. Ze praten over hoe het met hen gaat, over de hond van David en over de huisgenoot van Anna.',
        lines: [
          { id: 'm1d2-1', speaker: 'Anna', dutch: 'Hoi David!', spanish: '¡Hola David!' },
          { id: 'm1d2-2', speaker: 'David', dutch: 'Hallo Anna!', spanish: '¡Hola, Anna!' },
          { id: 'm1d2-3', speaker: 'Anna', dutch: 'Hoe is het met je?', spanish: '¿Cómo estás?' },
          { id: 'm1d2-4', speaker: 'David', dutch: 'Ehm, ja, hoe is het met mij? Goed, denk ik.', spanish: 'Eh, sí, ¿cómo estoy yo? Bien, creo.' },
          { id: 'm1d2-5', speaker: 'Anna', dutch: 'Denk je? Of weet je het zeker?', spanish: '¿Lo crees? ¿O estás seguro?' },
          { id: 'm1d2-6', speaker: 'David', dutch: 'Ik weet het zeker. En hoe is het met jou?', spanish: 'Estoy seguro. ¿Y tú?' },
          { id: 'm1d2-7', speaker: 'Anna', dutch: 'Met mij gaat het ook goed. Hoe is het met je hond?', spanish: 'Yo también estoy bien. ¿Cómo está tu perra?' },
          { id: 'm1d2-8', speaker: 'David', dutch: 'Mijn hond is weer beter, dank je. Hoe weet jij dat?', spanish: 'Mi perra está mejor, gracias. ¿Cómo lo sabes tú?' },
          { id: 'm1d2-9', speaker: 'Anna', dutch: 'De serveerster vertelde me dat je hond ziek was.', spanish: 'La camarera me dijo que tu perra estaba enferma.' },
          { id: 'm1d2-10', speaker: 'David', dutch: 'Ja, ze heeft last van haar heup. Ze is al wat ouder. Heb jij een huisdier?', spanish: 'Sí, tiene problemas en la cadera. Es un poco mayor. ¿Tienes mascota tú?' },
          { id: 'm1d2-11', speaker: 'Anna', dutch: 'Nee, maar ik heb wel een huisgenoot die vaak ziek is.', spanish: 'No, pero tengo una compañera de piso que está enferma a menudo.' },
          { id: 'm1d2-12', speaker: 'David', dutch: 'Wat heeft ze dan?', spanish: '¿Qué le pasa entonces?' },
          { id: 'm1d2-13', speaker: 'Anna', dutch: 'Ze heeft soms ruzie met haar vriend en daarna is ze heel moe.', spanish: 'A veces discute con su novio y después está muy cansada.' },
          { id: 'm1d2-14', speaker: 'David', dutch: 'Wat vervelend dat ze ruzie maken. Ik heb het heel fijn met mijn partner, we zijn al lang samen.', spanish: 'Qué pena que discutan. Estoy muy feliz con mi pareja; llevamos mucho tiempo juntos.' },
          { id: 'm1d2-15', speaker: 'Anna', dutch: 'Wonen jullie samen?', spanish: '¿Vivís juntos?' },
          { id: 'm1d2-16', speaker: 'David', dutch: 'Nee, maar dat wil ik wel. We zoeken een huis.', spanish: 'No, pero me gustaría. Estamos buscando casa.' },
          { id: 'm1d2-17', speaker: 'Anna', dutch: 'Wat leuk! Ik houd mijn oren en ogen open!', spanish: '¡Qué bien! ¡Estaré atenta!' },
        ],
      },
      exercises: [
        { id: 'm1d2q-1', type: 'multiple_choice', prompt: '¿Cómo está la perra de David?', options: ['Ya está mejor', 'Sigue enferma', 'Está en el veterinario', 'Se ha perdido'], correctAnswer: 'Ya está mejor', explanation: '"Mijn hond is weer beter" — weer beter = otra vez mejor.' },
        { id: 'm1d2q-2', type: 'multiple_choice', prompt: '¿Cómo se enteró Anna de que la perra estaba enferma?', options: ['Se lo contó la camarera', 'Se lo contó David', 'Lo vio en la calle', 'Se lo dijo su compañera de piso'], correctAnswer: 'Se lo contó la camarera', explanation: '"De serveerster vertelde me dat je hond ziek was."' },
        { id: 'm1d2q-3', type: 'multiple_choice', prompt: '¿Qué le pasa a la perra?', options: ['Le duele la cadera', 'Le duele una pata', 'No come', 'Está resfriada'], correctAnswer: 'Le duele la cadera', explanation: '"Ze heeft last van haar heup" — de heup = la cadera.' },
        { id: 'm1d2q-4', type: 'true_false', prompt: 'Anna tiene una mascota.', correctAnswer: 'falso', explanation: 'Dice "Nee, maar ik heb wel een huisgenoot" — no tiene mascota, tiene compañera de piso.' },
        { id: 'm1d2q-5', type: 'multiple_choice', prompt: '¿Por qué acaba tan cansada la compañera de piso de Anna?', options: ['Porque discute con su novio', 'Porque trabaja de noche', 'Porque estudia mucho', 'Porque está enferma del corazón'], correctAnswer: 'Porque discute con su novio', explanation: '"Ze heeft soms ruzie met haar vriend en daarna is ze heel moe." Ruzie = discusión.' },
        { id: 'm1d2q-6', type: 'multiple_choice', prompt: '¿Viven juntos David y su pareja?', options: ['No, pero están buscando casa', 'Sí, desde hace años', 'No, y no quieren', 'Sí, acaban de mudarse'], correctAnswer: 'No, pero están buscando casa', explanation: '"Nee, maar dat wil ik wel. We zoeken een huis."' },
        { id: 'm1d2q-7', type: 'multiple_choice', prompt: 'Al principio David duda al decir cómo está. ¿Qué le contesta Anna?', options: ['Si lo cree o está seguro', 'Que no le importa', 'Que se lo pregunte a la camarera', 'Que hable más despacio'], correctAnswer: 'Si lo cree o está seguro', explanation: '"Denk je? Of weet je het zeker?" — un juego con denken (creer) y zeker weten (estar seguro).' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        // ── Opción múltiple ──
        { id: 'm1l2e-1',  type: 'multiple_choice', prompt: '¿Qué pronombre usas para "usted"?', options: ['u', 'jij', 'je', 'jullie'], correctAnswer: 'u', explanation: '"U" es el tratamiento formal, en singular y en plural.' },
        { id: 'm1l2e-2',  type: 'multiple_choice', prompt: '"Zij zijn broer en zus." — ¿quiénes son "zij"?', options: ['Ellos', 'Ella', 'Nosotros', 'Vosotros'], correctAnswer: 'Ellos', explanation: 'El verbo en plural (zijn) te dice que "zij" = ellos, no ella.' },
        { id: 'm1l2e-3',  type: 'multiple_choice', prompt: '¿Cuál es la forma DÉBIL de "wij"?', options: ['we', 'wij', 'ze', 'je'], correctAnswer: 'we', explanation: 'wij → we. La débil es la normal en conversación.' },
        { id: 'm1l2e-4',  type: 'multiple_choice', prompt: '¿Cómo te diriges a VARIAS personas de manera formal?', options: ['u', 'jullie', 'zij', 'wij'], correctAnswer: 'u', explanation: 'No existe un "ustedes": se usa "u" también en plural.' },
        // ── Verdadero / Falso ──
        { id: 'm1l2e-5',  type: 'true_false', prompt: 'En neerlandés casi siempre hay que decir el pronombre (el sujeto).', correctAnswer: 'verdadero', explanation: 'A diferencia del español, el sujeto casi nunca se omite: Ik ben docent.' },
        { id: 'm1l2e-6',  type: 'true_false', prompt: '"Het regent" significa "él llueve".', correctAnswer: 'falso', explanation: '"Het" es impersonal: Het regent = llueve. La frase neerlandesa necesita un sujeto.' },
        { id: 'm1l2e-7',  type: 'true_false', prompt: 'La forma débil (je, we, ze) es la más frecuente al hablar.', correctAnswer: 'verdadero', explanation: 'La fuerte (jij, wij, zij) se reserva para énfasis o contraste.' },
        // ── Completar ──
        { id: 'm1l2e-8',  type: 'fill_blank', prompt: '___ bent musicus. (tú, con énfasis)', correctAnswer: 'Jij', hint: 'Forma fuerte de "tú"' },
        { id: 'm1l2e-9',  type: 'fill_blank', prompt: '___ regent vandaag. (impersonal)', correctAnswer: 'Het', hint: 'El pronombre del clima' },
        { id: 'm1l2e-10', type: 'fill_blank', prompt: 'Kijk! ___ zijn schilders. (ellos)', correctAnswer: 'zij', hint: 'El mismo pronombre que "ella", pero con verbo en plural' },
        { id: 'm1l2e-11', type: 'fill_blank', prompt: 'Drinken ___ koffie? (vosotros)', correctAnswer: 'jullie', hint: 'Segunda persona del plural' },
        // ── Ordenar frases ──
        { id: 'm1l2e-12', type: 'order_sentence', prompt: 'Ordena: "Ella es médica."', options: ['Zij', 'is', 'arts'], correctAnswer: 'Zij is arts' },
        { id: 'm1l2e-13', type: 'order_sentence', prompt: 'Ordena: "¿Estáis listos?"', options: ['Zijn', 'jullie', 'klaar?'], correctAnswer: 'Zijn jullie klaar?' },
        { id: 'm1l2e-14', type: 'order_sentence', prompt: 'Ordena: "Nosotras vamos a Amberes."', options: ['Wij', 'gaan', 'naar', 'Antwerpen'], correctAnswer: 'Wij gaan naar Antwerpen' },
        // ── Sopa de letras ──
        { id: 'm1l2e-15', type: 'word_scramble', prompt: '¿Cómo se dice "vosotros"?', correctAnswer: 'jullie', hint: 'vosotros / vosotras' },
        // ── Letras que faltan ──
        { id: 'm1l2e-16', type: 'letter_dash', prompt: 'Completa: "en casa"', correctAnswer: 'thuis', hint: 'Ben je …?' },
        { id: 'm1l2e-17', type: 'letter_dash', prompt: 'Completa: "hoy"', correctAnswer: 'vandaag', hint: 'Ze werkt … (hoy)' },
        // ── Unir parejas ──
        { id: 'm1l2e-18', type: 'match_pairs', prompt: 'Une cada pronombre con su traducción', correctAnswer: '', pairs: [
          { left: 'ik', right: 'yo' },
          { left: 'jij', right: 'tú' },
          { left: 'u', right: 'usted' },
          { left: 'hij', right: 'él' },
          { left: 'wij', right: 'nosotros' },
          { left: 'jullie', right: 'vosotros' },
        ] },
        { id: 'm1l2e-19', type: 'match_pairs', prompt: 'Une cada frase con su traducción', correctAnswer: '', pairs: [
          { left: 'Ben je thuis?', right: '¿Estás en casa?' },
          { left: 'Ik heb een kat', right: 'Tengo un gato' },
          { left: 'We gaan naar huis', right: 'Vamos a casa' },
          { left: 'Ze werkt vandaag', right: 'Ella trabaja hoy' },
          { left: 'Heeft hij griep?', right: '¿Tiene él gripe?' },
        ] },
        // ── Emoji ──
        { id: 'm1l2e-20', type: 'emoji_choice', prompt: '¿Qué emoji representa "thuis"?', options: ['🏠', '🚗', '🏖️', '🏢'], correctAnswer: '🏠', explanation: '"Thuis" = en casa.' },
        { id: 'm1l2e-21', type: 'emoji_choice', prompt: '¿Qué emoji representa "de griep"?', options: ['🤒', '😀', '🎉', '🍎'], correctAnswer: '🤒', explanation: '"De griep" = la gripe.' },
        // ── El intruso ──
        { id: 'm1l2e-22', type: 'odd_one_out', prompt: '¿Cuál NO es un pronombre?', options: ['ik', 'jij', 'hij', 'arts'], correctAnswer: 'arts', explanation: '"De arts" (el médico) es una profesión, no un pronombre.' },
        { id: 'm1l2e-23', type: 'odd_one_out', prompt: '¿Cuál es la forma FUERTE (las otras son débiles)?', options: ['je', 'we', 'ze', 'wij'], correctAnswer: 'wij', explanation: '"Wij" es la forma fuerte; je, we y ze son débiles.' },
        // ── Escribir ──
        { id: 'm1l2e-24', type: 'write_answer', prompt: 'Escribe la forma débil de "jij"', correctAnswer: 'je', hint: 'Dos letras' },
        { id: 'm1l2e-25', type: 'write_answer', prompt: 'Escribe en neerlandés: "Ella es médica" (forma fuerte)', correctAnswer: 'Zij is arts', hint: 'Empieza con la forma fuerte · sin punto final' },
        // ── Escuchar ──
        { id: 'm1l2e-26', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "Zij is ingenieur"', options: ['Zij is ingenieur', 'Zij zijn ingenieurs', 'Hij is ingenieur', 'Wij zijn ingenieurs'], correctAnswer: 'Zij is ingenieur' },
        { id: 'm1l2e-27', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "Ben je thuis?"', options: ['Ben je thuis?', 'Ben jij thuis?', 'Is ze thuis?', 'Zijn ze thuis?'], correctAnswer: 'Ben je thuis?' },
        { id: 'm1l2e-28', type: 'listen_translate', prompt: 'Escucha y traduce: "Wij gaan naar Antwerpen"', options: ['Nosotras', 'vamos', 'a', 'Amberes', 'casa', 'Ellos'], correctAnswer: 'Nosotras vamos a Amberes' },
        { id: 'm1l2e-29', type: 'listen_translate', prompt: 'Escucha y traduce: "Ik heb een kat"', options: ['Tengo', 'un', 'gato', 'perro', 'Ella', 'tiene'], correctAnswer: 'Tengo un gato' },
        // ── Comprensión del diálogo (De tweede ontmoeting) ──
        { id: 'm1l2e-30', type: 'multiple_choice', prompt: 'En el diálogo, ¿qué tiempo hace?', options: ['Llueve', 'Hace sol', 'Nieva', 'Hace calor'], correctAnswer: 'Llueve', explanation: '"Het regent!" — por eso se sientan dentro.' },
        { id: 'm1l2e-31', type: 'true_false', prompt: 'La mujer que ven en el café es médica.', correctAnswer: 'falso', explanation: 'Ella es pintora ("Zij is schilder"); el hombre es el médico.' },
        { id: 'm1l2e-32', type: 'multiple_choice', prompt: '¿Qué le dice David a Anna: "u" o "jij"?', options: ['"Jij", porque son amigos', '"U", porque es formal', 'Ninguno de los dos', 'Los dos a la vez'], correctAnswer: '"Jij", porque son amigos', explanation: 'Entre amigos se usa jij/je; "u" es para el trato formal.' },
      ],
    },
    { type: 'review' },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────── */

const m1_les3: Lesson = {
  id: 'les-3-werkwoorden',
  moduleId: 'over-jou',
  title: 'Les 3 — Grammatica | De werkwoorden',
  subtitle: 'Los verbos regulares en presente',
  order: 3,
  learningObjective: 'Conjugar verbos regulares en presente: encontrar la raíz y aplicar raíz / raíz+t / infinitivo',
  estimatedMinutes: 30,
  blocks: [
    {
      type: 'summary',
      title: 'De werkwoorden',
      intro: 'En español los verbos tienen muchas formas (hablo, hablas, habla, hablamos…). En neerlandés es mucho más fácil: hoy aprendes UN patrón que sirve para casi todos los verbos regulares.',
      objectives: [
        'Encontrar la raíz de un verbo (infinitivo − "-en")',
        'Conjugar en presente: raíz / raíz + t / infinitivo',
        'Aplicar la regla de doblar la vocal (wonen → woon)',
      ],
      sections: [
        {
          heading: '🔍 Paso 1: la raíz',
          body: 'El infinitivo (la forma del diccionario) casi siempre termina en **-en**: *werken* (trabajar), *wonen* (vivir), *leren* (aprender). Para conjugar, primero quitamos ese **-en** y nos queda la raíz. La fórmula: **infinitivo − en = raíz**.',
          items: [
            { nl: 'werken → werk', es: 'trabajar' },
            { nl: 'denken → denk', es: 'pensar' },
            { nl: 'helpen → help', es: 'ayudar' },
          ],
        },
        {
          heading: '📐 Paso 2: solo tres formas',
          body: 'En presente solo existen TRES formas:',
          items: [
            { nl: 'ik werk', es: 'raíz (yo)' },
            { nl: 'jij / hij / zij werkt', es: 'raíz + t (tú, él, ella)' },
            { nl: 'wij / jullie / zij werken', es: 'infinitivo (todo el plural)' },
          ],
        },
        {
          heading: '✍️ La regla ortográfica: doblar la vocal',
          body: 'Con algunos verbos, la vocal de la raíz se escribe doble para mantener la misma pronunciación:',
          items: [
            { nl: 'wonen → ik woon', es: 'vivir' },
            { nl: 'leren → ik leer', es: 'aprender' },
            { nl: 'koken → ik kook', es: 'cocinar' },
            { nl: 'maken → ik maak', es: 'hacer' },
            { nl: 'vragen → ik vraag', es: 'preguntar' },
          ],
        },
        {
          heading: '❓ En preguntas: la -t desaparece con je/jij',
          body: 'Cuando el verbo va DELANTE de je/jij (en preguntas), pierde la -t: *Jij belt mij* pero **Bel je mij?** (¿me llamas?).',
        },
      ],
      tip: 'La fórmula mágica: **infinitivo − en = raíz**. Luego: ik = raíz · jij/hij/zij = raíz + t · plural = infinitivo. Y en preguntas con "je/jij" la -t desaparece: **Bel je mij?**',
    },
    {
      type: 'vocabulary',
      items: [
        { id: 'm1l3v-werken',   dutch: 'werken',   spanish: 'trabajar',            article: null, emoji: '💼', color: '#1D0084', exampleNl: 'Hij werkt veel.',            exampleEs: 'Él trabaja mucho.',              category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm1l3v-leren',    dutch: 'leren',    spanish: 'aprender',            article: null, emoji: '📖', color: '#025dc7', exampleNl: 'Jij leert snel!',            exampleEs: '¡Tú aprendes rápido!',           category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm1l3v-spreken',  dutch: 'spreken',  spanish: 'hablar',              article: null, emoji: '🗣️', color: '#0b4db5', exampleNl: 'Ik spreek een beetje Nederlands.', exampleEs: 'Hablo un poco de neerlandés.', category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm1l3v-studeren', dutch: 'studeren', spanish: 'estudiar',            article: null, emoji: '🎓', color: '#0a3d9e', exampleNl: 'Zij studeert in Leiden.',    exampleEs: 'Ella estudia en Leiden.',        category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm1l3v-denken',   dutch: 'denken',   spanish: 'pensar',              article: null, emoji: '💭', color: '#1440a0', exampleNl: 'Ik denk aan mijn familie.',  exampleEs: 'Pienso en mi familia.',          category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm1l3v-helpen',   dutch: 'helpen',   spanish: 'ayudar',              article: null, emoji: '🤲', color: '#0d5bbf', exampleNl: 'Je helpt een vriend.',       exampleEs: 'Ayudas a un amigo.',             category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm1l3v-wachten',  dutch: 'wachten',  spanish: 'esperar',             article: null, emoji: '⏳', color: '#1D0084', exampleNl: 'Ik wacht op de bus.',        exampleEs: 'Estoy esperando el autobús.',    category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm1l3v-bellen',   dutch: 'bellen',   spanish: 'llamar (por teléfono)', article: null, emoji: '📞', color: '#025dc7', exampleNl: 'Ze bellen morgen.',        exampleEs: 'Llaman mañana.',                 category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm1l3v-maken',    dutch: 'maken',    spanish: 'hacer',               article: null, emoji: '🛠️', color: '#0b4db5', exampleNl: 'Ik maak een foto.',          exampleEs: 'Hago una foto.',                 category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm1l3v-vragen',   dutch: 'vragen',   spanish: 'preguntar',           article: null, emoji: '❓', color: '#0a3d9e', exampleNl: 'Ik vraag het aan Anna.',     exampleEs: 'Se lo pregunto a Anna.',         category: 'werkwoorden', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm1l3p-1',  dutch: 'Je werkt morgen.',         spanish: 'Trabajas mañana.',               context: 'Trabajo' },
        { id: 'm1l3p-2',  dutch: 'Hij werkt veel.',          spanish: 'Él trabaja mucho.',              context: 'Trabajo' },
        { id: 'm1l3p-3',  dutch: 'We werken samen.',         spanish: 'Trabajamos juntos.',             context: 'Trabajo' },
        { id: 'm1l3p-4',  dutch: 'Ze werkt in een kantoor.', spanish: 'Ella trabaja en una oficina.',   context: 'Trabajo' },
        { id: 'm1l3p-5',  dutch: 'Jij leert snel!',          spanish: '¡Tú aprendes rápido!',           context: 'Aprender' },
        { id: 'm1l3p-6',  dutch: 'Hij leert thuis.',         spanish: 'Él aprende en casa.',            context: 'Aprender' },
        { id: 'm1l3p-7',  dutch: 'Jullie leren samen.',      spanish: 'Vosotros aprendéis juntos.',     context: 'Aprender' },
        { id: 'm1l3p-8',  dutch: 'Je helpt een vriend.',     spanish: 'Ayudas a un amigo.',             context: 'Ayudar' },
        { id: 'm1l3p-9',  dutch: 'Hij helpt op school.',     spanish: 'Él ayuda en la escuela.',        context: 'Ayudar' },
        { id: 'm1l3p-10', dutch: 'We helpen samen.',         spanish: 'Ayudamos juntos.',               context: 'Ayudar' },
        { id: 'm1l3p-11', dutch: 'Ik wacht op de bus.',      spanish: 'Estoy esperando el autobús.',    context: 'Cotidiano' },
        { id: 'm1l3p-12', dutch: 'We wachten buiten.',       spanish: 'Esperamos fuera.',               context: 'Cotidiano' },
        { id: 'm1l3p-13', dutch: 'Ze bellen morgen.',        spanish: 'Llaman mañana.',                 context: 'Teléfono' },
        { id: 'm1l3p-14', dutch: 'Bel je mij?',              spanish: '¿Me llamas?',                    context: 'Teléfono' },
      ],
    },
    {
      type: 'lezen',
      title: 'Een dag vol werkwoorden',
      textNl: `Anna werkt op een school in Haarlem. Zij helpt de kinderen en de kinderen leren snel. Anna vindt haar werk het mooiste werk van Nederland.

Na het werk wacht Anna op de bus. Maar de bus komt niet. Anna wacht en wacht. Dan belt ze haar zus. Haar zus is in de stad en samen gaan ze naar huis.

Thuis koken Anna en haar zus pasta. Anna kookt, haar zus helpt. Zij maken samen het eten. Het is gezellig in de keuken.

David werkt vandaag thuis. Hij leert Nederlands en denkt de hele dag aan de nieuwe woorden. ’s Avonds belt hij met Anna en zij spreken samen Nederlands. Zo oefent David alle werkwoorden van deze les: werken, wachten, koken, bellen en leren!`,
      textEs: `Anna trabaja en una escuela en Haarlem. Ella ayuda a los niños y los niños aprenden rápido. Para Anna, su trabajo es el más bonito de Países Bajos.

Después del trabajo, Anna espera el autobús. Pero el autobús no viene. Anna espera y espera. Entonces llama a su hermana. Su hermana está en la ciudad y juntas se van a casa.

En casa, Anna y su hermana cocinan pasta. Anna cocina, su hermana ayuda. Preparan la comida juntas. Hay buen ambiente en la cocina.

David hoy trabaja en casa. Aprende neerlandés y piensa todo el día en las palabras nuevas. Por la noche llama a Anna y hablan neerlandés juntos. Así David practica todos los verbos de esta lección: ¡trabajar, esperar, cocinar, llamar y aprender!`,
      exercises: [
        { id: 'm1l3lz-1', type: 'multiple_choice', prompt: '¿Dónde trabaja Anna?', options: ['En una escuela', 'En una oficina', 'En casa', 'En un café'], correctAnswer: 'En una escuela', explanation: '"Anna werkt op een school in Haarlem."' },
        { id: 'm1l3lz-2', type: 'multiple_choice', prompt: '¿A quién ayuda Anna?', options: ['A los niños', 'A David', 'A su hermana', 'A los médicos'], correctAnswer: 'A los niños', explanation: '"Zij helpt de kinderen."' },
        { id: 'm1l3lz-3', type: 'multiple_choice', prompt: '¿Qué pasa con el autobús?', options: ['No viene', 'Llega pronto', 'Está lleno', 'Es gratis'], correctAnswer: 'No viene', explanation: '"Maar de bus komt niet" — por eso Anna espera y espera.' },
        { id: 'm1l3lz-4', type: 'multiple_choice', prompt: '¿A quién llama Anna?', options: ['A su hermana', 'A David', 'A la escuela', 'A un taxi'], correctAnswer: 'A su hermana', explanation: '"Dan belt ze haar zus" — belt = llama (bellen).' },
        { id: 'm1l3lz-5', type: 'fill_blank', prompt: 'Thuis ___ zij pasta. (cocinar, ella)', correctAnswer: 'kookt', hint: 'koken → raíz + t (¡dobla la vocal!)', explanation: 'Con "zij" (ella): raíz + t.' },
        { id: 'm1l3lz-6', type: 'fill_blank', prompt: 'Hij ___ Nederlands. (aprender)', correctAnswer: 'leert', hint: 'leren → raíz + t (¡dobla la vocal!)' },
        { id: 'm1l3lz-7', type: 'multiple_choice', prompt: '¿Quién llama a quién por la noche?', options: ['David llama a Anna', 'Anna llama a David', 'La hermana llama a Anna', 'Nadie llama'], correctAnswer: 'David llama a Anna', explanation: '"’s Avonds belt hij met Anna" — hij = David.' },
        { id: 'm1l3lz-8', type: 'multiple_choice', prompt: 'Según el texto, ¿qué verbos practica David con esta lección?', options: ['Trabajar, esperar, cocinar, llamar y aprender', 'Solo cocinar', 'Comer y dormir', 'Leer y escribir'], correctAnswer: 'Trabajar, esperar, cocinar, llamar y aprender', explanation: '"Werken, wachten, koken, bellen en leren!"' },
        { id: 'm1l3lz-9', type: 'fill_blank', prompt: 'Anna ___ de kinderen. (ayudar)', correctAnswer: 'helpt', hint: 'helpen → raíz + t', explanation: 'Con "zij" (ella): help + t.' },
      ],
    },
    {
      // Diálogo de la presentación de la profe (Les 3 · De derde ontmoeting).
      // Las preguntas van SOBRE lo que se dice aquí, no sobre gramática: para
      // eso están los ejercicios de la lección.
      type: 'dialogue',
      dialogue: {
        id: 'm1d3',
        title: 'De derde ontmoeting',
        context: 'David wil graag (beter) Nederlands leren. Vandaag helpt zijn taalbuddy Anna hem met zijn huiswerk.',
        lines: [
          { id: 'm1d3-1',  speaker: 'Anna',  dutch: 'Hoi David!',                                                              spanish: '¡Hola David!' },
          { id: 'm1d3-2',  speaker: 'David', dutch: 'Hee hoi Anna!',                                                           spanish: '¡Eey hola, Anna!' },
          { id: 'm1d3-3',  speaker: 'Anna',  dutch: 'Ben je al lang hier?',                                                    spanish: '¿Llevas mucho tiempo aquí?' },
          { id: 'm1d3-4',  speaker: 'David', dutch: 'Ik ben er net. Wil je koffie?',                                           spanish: 'Acabo de llegar. ¿Quieres un café?' },
          { id: 'm1d3-5',  speaker: 'Anna',  dutch: 'Ik wil graag een groene thee. Studeer je veel?',                          spanish: 'Me gustaría un té verde. ¿Estudias mucho?' },
          { id: 'm1d3-6',  speaker: 'David', dutch: 'Ik studeer elke dag. Ik leer nu heel snel!',                              spanish: 'Estudio todos los días. ¡Estoy aprendiendo muy rápido!' },
          { id: 'm1d3-7',  speaker: 'Anna',  dutch: 'Wat goed! Wil je dat ik je help met je huiswerk?',                        spanish: '¡Qué bien! ¿Quieres que te ayude con tus deberes?' },
          { id: 'm1d3-8',  speaker: 'David', dutch: 'Ja graag. In de les gaat het soms zo snel.',                              spanish: 'Sí, por favor. A veces las cosas van muy rápido en clase.' },
          { id: 'm1d3-9',  speaker: 'Anna',  dutch: 'Dat snap ik. Wat moet je deze week studeren?',                            spanish: 'Lo entiendo. ¿Qué tienes que estudiar esta semana?' },
          { id: 'm1d3-10', speaker: 'David', dutch: 'Ik moet de werkwoorden beter leren vervoegen. Ik maak nog veel fouten.',  spanish: 'Necesito aprender a conjugar mejor los verbos. Todavía cometo muchos errores.' },
          { id: 'm1d3-11', speaker: 'Anna',  dutch: 'Oké, ik help je. Dan leren we samen, dat is leuker.',                     spanish: 'Vale, te ayudaré. Luego estudiaremos juntos, es más divertido.' },
          { id: 'm1d3-12', speaker: 'David', dutch: 'Veel leuker! Fijn dat je me helpt.',                                      spanish: '¡Mucho más divertido! Me alegra que me ayudes.' },
          { id: 'm1d3-13', speaker: 'Anna',  dutch: 'Als ik op mijn werk ben, denk ik vaak aan hoeveel leuker het is om taallessen te geven.', spanish: 'Cuando estoy en el trabajo, a menudo pienso en lo mucho más divertido que es dar clases de idiomas.' },
          { id: 'm1d3-14', speaker: 'David', dutch: 'Haha! Ik heb geluk met jou als docent.',                                  spanish: '¡Jaja! Tengo suerte de tenerte como profesora.' },
          { id: 'm1d3-15', speaker: 'Anna',  dutch: 'Haha, dank je! En graag gedaan.',                                         spanish: 'Jaja, ¡gracias! Y de nada.' },
          { id: 'm1d3-16', speaker: 'David', dutch: 'Ik ben moe en ga naar huis. Ik bel je morgen.',                           spanish: 'Estoy cansado y me voy a casa. Te llamo mañana.' },
          { id: 'm1d3-17', speaker: 'Anna',  dutch: 'Dat is goed. Tot morgen!',                                                spanish: 'Está bien. ¡Hasta mañana!' },
        ],
      },
      exercises: [
        { id: 'm1d3q-1', type: 'multiple_choice', prompt: '¿Qué quiere beber Anna?', options: ['Een groene thee', 'Een koffie', 'Water', 'Niets'], correctAnswer: 'Een groene thee', explanation: 'David le ofrece café, pero ella dice: "Ik wil graag een groene thee".' },
        { id: 'm1d3q-2', type: 'multiple_choice', prompt: 'Anna le pregunta si lleva mucho tiempo esperando. ¿Qué contesta David?', options: ['Que acaba de llegar', 'Que lleva una hora', 'Que lleva cinco minutos', 'Que ha llegado tarde'], correctAnswer: 'Que acaba de llegar', explanation: '"Ik ben er net" = acabo de llegar.' },
        { id: 'm1d3q-3', type: 'multiple_choice', prompt: '¿Cada cuánto estudia David?', options: ['Todos los días', 'Los fines de semana', 'Dos veces por semana', 'Casi nunca'], correctAnswer: 'Todos los días', explanation: '"Ik studeer elke dag."' },
        { id: 'm1d3q-4', type: 'multiple_choice', prompt: '¿Con qué se ofrece Anna a ayudarle?', options: ['Con los deberes', 'Con la mudanza', 'Con el trabajo', 'Con la compra'], correctAnswer: 'Con los deberes', explanation: '"Wil je dat ik je help met je huiswerk?" — het huiswerk son los deberes.' },
        { id: 'm1d3q-5', type: 'multiple_choice', prompt: '¿Qué tiene que estudiar David esta semana?', options: ['Conjugar los verbos', 'Los números', 'El alfabeto', 'Los colores'], correctAnswer: 'Conjugar los verbos', explanation: '"Ik moet de werkwoorden beter leren vervoegen."' },
        { id: 'm1d3q-6', type: 'true_false', prompt: 'David dice que ya no comete errores.', correctAnswer: 'falso', explanation: 'Dice justo lo contrario: "Ik maak nog veel fouten" (todavía cometo muchos errores).' },
        { id: 'm1d3q-7', type: 'multiple_choice', prompt: '¿Por qué prefieren estudiar juntos?', options: ['Porque es más divertido', 'Porque es más rápido', 'Porque es más barato', 'Porque Anna no tiene tiempo'], correctAnswer: 'Porque es más divertido', explanation: '"Dan leren we samen, dat is leuker" — leuk = divertido, agradable.' },
        { id: 'm1d3q-8', type: 'multiple_choice', prompt: '¿En qué trabaja Anna, según lo que cuenta?', options: ['Da clases de idiomas', 'Trabaja en una escuela infantil', 'Trabaja en una cafetería', 'No lo dice'], correctAnswer: 'Da clases de idiomas', explanation: 'Dice que en el trabajo piensa en lo divertido que es "taallessen te geven" (dar clases de idiomas).' },
        { id: 'm1d3q-9', type: 'multiple_choice', prompt: 'Al final, ¿qué dice David que hará?', options: ['La llamará mañana', 'Irá a clase mañana', 'Le escribirá un correo', 'La verá esta noche'], correctAnswer: 'La llamará mañana', explanation: '"Ik bel je morgen." Fíjate: bellen = llamar por teléfono.' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        // ── Opción múltiple ──
        { id: 'm1l3e-1',  type: 'multiple_choice', prompt: '¿Cuál es la raíz de "werken"?', options: ['werk', 'werken', 'werkt', 'wer'], correctAnswer: 'werk', explanation: 'Infinitivo − en = raíz: werken − en = werk.' },
        { id: 'm1l3e-2',  type: 'multiple_choice', prompt: '¿Cuál es la forma correcta con "hij"?', options: ['hij werkt', 'hij werk', 'hij werken', 'hij werkent'], correctAnswer: 'hij werkt', explanation: 'jij/hij/zij = raíz + t → werkt.' },
        { id: 'm1l3e-3',  type: 'multiple_choice', prompt: '¿Cuál es la forma correcta con "jullie"?', options: ['jullie werken', 'jullie werkt', 'jullie werk', 'jullie werkens'], correctAnswer: 'jullie werken', explanation: 'Todo el plural usa el infinitivo: werken.' },
        { id: 'm1l3e-4',  type: 'multiple_choice', prompt: '¿Cuál es la pregunta correcta?', options: ['Bel je mij?', 'Belt je mij?', 'Bellen je mij?', 'Belt jij mij?'], correctAnswer: 'Bel je mij?', explanation: 'Cuando el verbo va delante de je/jij, pierde la -t.' },
        // ── Verdadero / Falso ──
        { id: 'm1l3e-5',  type: 'true_false', prompt: 'Con "wij" se usa el infinitivo del verbo.', correctAnswer: 'verdadero', explanation: 'Wij/jullie/zij (plural) → infinitivo: wij werken.' },
        { id: 'm1l3e-6',  type: 'true_false', prompt: '"Ik werkt" es correcto.', correctAnswer: 'falso', explanation: 'Con "ik" va la raíz sin -t: ik werk.' },
        { id: 'm1l3e-7',  type: 'true_false', prompt: 'La raíz de "wonen" es "won".', correctAnswer: 'falso', explanation: 'La vocal se dobla para mantener la pronunciación: wonen → woon.' },
        // ── Completar ──
        { id: 'm1l3e-8',  type: 'fill_blank', prompt: 'Hij ___ veel. (trabajar)', correctAnswer: 'werkt', hint: 'raíz + t' },
        { id: 'm1l3e-9',  type: 'fill_blank', prompt: 'Jullie ___ samen. (aprender)', correctAnswer: 'leren', hint: 'Plural → infinitivo' },
        { id: 'm1l3e-10', type: 'fill_blank', prompt: 'Ik ___ op de bus. (esperar)', correctAnswer: 'wacht', hint: 'wachten → raíz' },
        { id: 'm1l3e-11', type: 'fill_blank', prompt: 'Ze ___ morgen. (llamar, ellos)', correctAnswer: 'bellen', hint: 'Plural → infinitivo' },
        { id: 'm1l3e-12', type: 'fill_blank', prompt: 'Zij ___ in een kantoor. (trabajar, ella)', correctAnswer: 'werkt', hint: 'raíz + t' },
        // ── Ordenar frases ──
        { id: 'm1l3e-13', type: 'order_sentence', prompt: 'Ordena: "Trabajamos juntos."', options: ['We', 'werken', 'samen'], correctAnswer: 'We werken samen' },
        { id: 'm1l3e-14', type: 'order_sentence', prompt: 'Ordena: "Él ayuda en la escuela."', options: ['Hij', 'helpt', 'op', 'school'], correctAnswer: 'Hij helpt op school' },
        // ── Sopa de letras ──
        { id: 'm1l3e-15', type: 'word_scramble', prompt: '¿Cómo se dice "pensar"?', correctAnswer: 'denken', hint: 'pensar' },
        { id: 'm1l3e-16', type: 'word_scramble', prompt: '¿Cómo se dice "esperar"?', correctAnswer: 'wachten', hint: 'esperar' },
        // ── Letras que faltan ──
        { id: 'm1l3e-17', type: 'letter_dash', prompt: 'Completa: "ayudar"', correctAnswer: 'helpen', hint: 'Je … een vriend' },
        { id: 'm1l3e-18', type: 'letter_dash', prompt: 'Completa: "preguntar"', correctAnswer: 'vragen', hint: 'raíz: vraag' },
        // ── Unir parejas ──
        { id: 'm1l3e-19', type: 'match_pairs', prompt: 'Une cada verbo con su traducción', correctAnswer: '', pairs: [
          { left: 'denken', right: 'pensar' },
          { left: 'helpen', right: 'ayudar' },
          { left: 'wachten', right: 'esperar' },
          { left: 'bellen', right: 'llamar' },
          { left: 'maken', right: 'hacer' },
          { left: 'vragen', right: 'preguntar' },
        ] },
        { id: 'm1l3e-20', type: 'match_pairs', prompt: 'Une cada persona con su forma del verbo', correctAnswer: '', pairs: [
          { left: 'ik', right: 'help' },
          { left: 'jij', right: 'denkt' },
          { left: 'hij', right: 'kookt' },
          { left: 'wij', right: 'wachten' },
          { left: 'jullie', right: 'bellen' },
          { left: 'zij (ellos)', right: 'vragen' },
        ] },
        // ── Emoji ──
        { id: 'm1l3e-21', type: 'emoji_choice', prompt: '¿Qué emoji representa "bellen"?', options: ['📞', '🍳', '📖', '⏳'], correctAnswer: '📞', explanation: '"Bellen" = llamar por teléfono.' },
        { id: 'm1l3e-22', type: 'emoji_choice', prompt: '¿Qué emoji representa "denken"?', options: ['💭', '💼', '🤲', '❓'], correctAnswer: '💭', explanation: '"Denken" = pensar.' },
        // ── El intruso ──
        { id: 'm1l3e-23', type: 'odd_one_out', prompt: '¿Cuál es un INFINITIVO (las otras son raíces)?', options: ['werk', 'woon', 'leer', 'werken'], correctAnswer: 'werken', explanation: '"Werken" termina en -en: es el infinitivo. Las otras son raíces.' },
        { id: 'm1l3e-24', type: 'odd_one_out', prompt: '¿Cuál NO es un verbo?', options: ['denken', 'helpen', 'morgen', 'wachten'], correctAnswer: 'morgen', explanation: '"Morgen" significa mañana: no es un verbo aunque termine en -en.' },
        // ── Escribir ──
        { id: 'm1l3e-25', type: 'write_answer', prompt: 'Escribe la raíz de "vragen"', correctAnswer: 'vraag', hint: 'Recuerda doblar la vocal' },
        { id: 'm1l3e-26', type: 'write_answer', prompt: 'Escribe en neerlandés: "Él aprende en casa"', correctAnswer: 'Hij leert thuis', hint: 'raíz + t · sin punto final' },
        // ── Escuchar ──
        { id: 'm1l3e-27', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "Jij leert snel"', options: ['Jij leert snel', 'Jij leert veel', 'Wij leren snel', 'Hij leert snel'], correctAnswer: 'Jij leert snel' },
        { id: 'm1l3e-28', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "We wachten buiten"', options: ['We wachten buiten', 'We werken buiten', 'Ze wachten buiten', 'We wachten binnen'], correctAnswer: 'We wachten buiten' },
        { id: 'm1l3e-29', type: 'listen_translate', prompt: 'Escucha y traduce: "Hij werkt veel"', options: ['Él', 'trabaja', 'mucho', 'poco', 'Ella', 'ayuda'], correctAnswer: 'Él trabaja mucho' },
        { id: 'm1l3e-30', type: 'listen_translate', prompt: 'Escucha y traduce: "Je helpt een vriend"', options: ['Ayudas', 'a', 'un', 'amigo', 'Llamas', 'niño'], correctAnswer: 'Ayudas a un amigo' },
        // ── Comprensión del diálogo (De derde ontmoeting) ──
        { id: 'm1l3e-31', type: 'multiple_choice', prompt: 'En el diálogo, ¿dónde trabaja Anna?', options: ['En una escuela', 'En una oficina', 'En casa', 'En un restaurante'], correctAnswer: 'En una escuela', explanation: '"Ik werk op een school. Ik help de kinderen."' },
        { id: 'm1l3e-32', type: 'true_false', prompt: 'Anna cocina pasta esta noche.', correctAnswer: 'verdadero', explanation: '"Ja, ik kook pasta. Mijn zus helpt."' },
        { id: 'm1l3e-33', type: 'true_false', prompt: 'David llama a Anna esta noche.', correctAnswer: 'falso', explanation: 'La llama mañana por la mañana: "Ik bel je morgen… in de ochtend".' },
      ],
    },
    { type: 'review' },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────── */

const m1_les4: Lesson = {
  id: 'les-4-nummers',
  moduleId: 'over-jou',
  title: 'Les 4 — Grammatica | De nummers',
  subtitle: 'Los números del 0 al 100',
  order: 4,
  learningObjective: 'Contar del 0 al 100, usar los números en la vida diaria y hacer cálculos sencillos',
  estimatedMinutes: 30,
  blocks: [
    {
      type: 'summary',
      title: 'De nummers',
      intro: 'Los números están en todas partes: tu edad, tu número de casa, tu teléfono, los precios. Hoy aprendes a contar del 0 al 100 — y el truco más importante: en neerlandés se piensa "al revés".',
      objectives: [
        'Contar del 0 al 100',
        'Formar números compuestos: unidades ANTES de decenas (vierentwintig)',
        'Hacer cálculos sencillos con plus, min, keer e is',
      ],
      sections: [
        {
          heading: '🔢 Del 0 al 10',
          items: [
            { nl: 'nul, één, twee, drie, vier', es: '0, 1, 2, 3, 4' },
            { nl: 'vijf, zes, zeven, acht, negen, tien', es: '5, 6, 7, 8, 9, 10' },
          ],
        },
        {
          heading: '1️⃣1️⃣ Del 11 al 20',
          body: 'Del 13 al 19 se forman con **-tien** (como "trece = tres-diez"). Ojo con los irregulares **elf** (11), **twaalf** (12), **veertien** (14, no "viertien") y **achttien** (con dos t).',
          items: [
            { nl: 'elf, twaalf, dertien, veertien, vijftien', es: '11, 12, 13, 14, 15' },
            { nl: 'zestien, zeventien, achttien, negentien, twintig', es: '16, 17, 18, 19, 20' },
          ],
        },
        {
          heading: '🔟 Las decenas',
          items: [
            { nl: 'twintig, dertig, veertig, vijftig', es: '20, 30, 40, 50' },
            { nl: 'zestig, zeventig, tachtig, negentig, honderd', es: '60, 70, 80, 90, 100' },
          ],
        },
        {
          heading: '🔄 La regla: al revés que en español',
          body: 'Para decir 24, primero la unidad, luego **en** (y), luego la decena: **vier + en + twintig = vierentwintig** ("cuatro y veinte"). Para RECONOCER un número, escucha cómo TERMINA la palabra: ahí está la decena. *Zevenenzestig* termina en -zestig → es sesenta y algo (67).',
        },
        {
          heading: '➕ Calcular — Rekenen',
          body: 'Con cuatro palabras ya puedes hacer cuentas: **Twee plus drie is vijf** (2+3=5), **Negen min vier is vijf** (9−4=5), **Twee keer drie is zes** (2×3=6).',
          items: [
            { nl: 'plus', es: 'más' },
            { nl: 'min', es: 'menos' },
            { nl: 'keer', es: 'por / veces' },
            { nl: 'is', es: 'es → aquí: "son"' },
          ],
        },
      ],
      tip: 'Piensa "al revés": 24 = **vier**en**twintig** (cuatro y veinte). Y para reconocer un número que escuchas, fíjate en el FINAL de la palabra: ahí está la decena.',
    },
    {
      type: 'vocabulary',
      items: [
        { id: 'm1l4v-nul',      dutch: 'nul',      spanish: 'cero (0)',            article: null, emoji: '0️⃣', color: '#1D0084', exampleNl: 'Nul zes is het begin van mijn nummer.', exampleEs: 'Cero seis es el principio de mi número.', category: 'nummers', difficulty: 'A0' },
        { id: 'm1l4v-een',      dutch: 'één',      spanish: 'uno (1)',             article: null, emoji: '1️⃣', color: '#025dc7', exampleNl: 'Ik heb één kat.',            exampleEs: 'Tengo un gato.',                 category: 'nummers', difficulty: 'A0' },
        { id: 'm1l4v-twee',     dutch: 'twee',     spanish: 'dos (2)',             article: null, emoji: '2️⃣', color: '#0b4db5', exampleNl: 'Twee koffie, alstublieft.',  exampleEs: 'Dos cafés, por favor.',          category: 'nummers', difficulty: 'A0' },
        { id: 'm1l4v-drie',     dutch: 'drie',     spanish: 'tres (3)',            article: null, emoji: '3️⃣', color: '#0a3d9e', exampleNl: 'Drie keer drie is negen.',   exampleEs: 'Tres por tres son nueve.',       category: 'nummers', difficulty: 'A0' },
        { id: 'm1l4v-vier',     dutch: 'vier',     spanish: 'cuatro (4)',          article: null, emoji: '4️⃣', color: '#1440a0', exampleNl: 'Vier plus vijf is negen.',   exampleEs: 'Cuatro más cinco son nueve.',    category: 'nummers', difficulty: 'A0' },
        { id: 'm1l4v-vijf',     dutch: 'vijf',     spanish: 'cinco (5)',           article: null, emoji: '5️⃣', color: '#0d5bbf', exampleNl: 'Ik wacht vijf minuten.',     exampleEs: 'Espero cinco minutos.',          category: 'nummers', difficulty: 'A0' },
        { id: 'm1l4v-zes',      dutch: 'zes',      spanish: 'seis (6)',            article: null, emoji: '6️⃣', color: '#1D0084', exampleNl: 'Twee keer drie is zes.',     exampleEs: 'Dos por tres son seis.',         category: 'nummers', difficulty: 'A0' },
        { id: 'm1l4v-zeven',    dutch: 'zeven',    spanish: 'siete (7)',           article: null, emoji: '7️⃣', color: '#025dc7', exampleNl: 'De week heeft zeven dagen.', exampleEs: 'La semana tiene siete días.',    category: 'nummers', difficulty: 'A0' },
        { id: 'm1l4v-acht',     dutch: 'acht',     spanish: 'ocho (8)',            article: null, emoji: '8️⃣', color: '#0b4db5', exampleNl: 'David woont op nummer acht.', exampleEs: 'David vive en el número ocho.', category: 'nummers', difficulty: 'A0' },
        { id: 'm1l4v-negen',    dutch: 'negen',    spanish: 'nueve (9)',           article: null, emoji: '9️⃣', color: '#0a3d9e', exampleNl: 'Het kost negen euro.',       exampleEs: 'Cuesta nueve euros.',            category: 'nummers', difficulty: 'A0' },
        { id: 'm1l4v-tien',     dutch: 'tien',     spanish: 'diez (10)',           article: null, emoji: '🔟', color: '#1440a0', exampleNl: 'Twintig min tien is tien.',  exampleEs: 'Veinte menos diez son diez.',    category: 'nummers', difficulty: 'A0' },
        { id: 'm1l4v-elf',      dutch: 'elf',      spanish: 'once (11)',           article: null, emoji: '⏰', color: '#0d5bbf', exampleNl: 'Elf min zes is vijf.',       exampleEs: 'Once menos seis son cinco.',     category: 'nummers', difficulty: 'A0' },
        { id: 'm1l4v-twaalf',   dutch: 'twaalf',   spanish: 'doce (12)',           article: null, emoji: '🕛', color: '#1D0084', exampleNl: 'Ik woon op nummer twaalf.',  exampleEs: 'Vivo en el número doce.',        category: 'nummers', difficulty: 'A0' },
        { id: 'm1l4v-twintig',  dutch: 'twintig',  spanish: 'veinte (20)',         article: null, emoji: '2️⃣0️⃣', color: '#025dc7', exampleNl: 'Vier keer vijf is twintig.', exampleEs: 'Cuatro por cinco son veinte.', category: 'nummers', difficulty: 'A0' },
        { id: 'm1l4v-dertig',   dutch: 'dertig',   spanish: 'treinta (30)',        article: null, emoji: '🎯', color: '#0b4db5', exampleNl: 'Mijn broer is dertig jaar.', exampleEs: 'Mi hermano tiene treinta años.', category: 'nummers', difficulty: 'A0' },
        { id: 'm1l4v-honderd',  dutch: 'honderd',  spanish: 'cien (100)',          article: null, emoji: '💯', color: '#0a3d9e', exampleNl: 'Honderd min één is negenennegentig.', exampleEs: 'Cien menos uno son noventa y nueve.', category: 'nummers', difficulty: 'A0' },
        { id: 'm1l4v-hoeveel',  dutch: 'hoeveel',  spanish: '¿cuánto/s?',          article: null, emoji: '🤔', color: '#1440a0', exampleNl: 'Hoeveel kost het?',          exampleEs: '¿Cuánto cuesta?',                category: 'nummers', difficulty: 'A0' },
        { id: 'm1l4v-kosten',   dutch: 'kosten',   spanish: 'costar',              article: null, emoji: '💰', color: '#0d5bbf', exampleNl: 'Het kost negen euro.',       exampleEs: 'Cuesta nueve euros.',            category: 'nummers', difficulty: 'A0' },
        { id: 'm1l4v-euro',     dutch: 'de euro',  spanish: 'el euro',             article: 'de', emoji: '💶', color: '#1D0084', exampleNl: 'Het kost twee euro.',        exampleEs: 'Cuesta dos euros.',              category: 'nummers', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm1l4p-1',  dutch: 'Hoe oud ben je?',                spanish: '¿Cuántos años tienes?',            context: 'Edad' },
        { id: 'm1l4p-2',  dutch: 'Ik ben vijfentwintig jaar.',     spanish: 'Tengo veinticinco años.',          context: 'Edad' },
        { id: 'm1l4p-3',  dutch: 'Hij is achtenveertig jaar.',     spanish: 'Él tiene cuarenta y ocho años.',   context: 'Edad' },
        { id: 'm1l4p-4',  dutch: 'Op welk nummer woon je?',        spanish: '¿En qué número vives?',            context: 'Dirección' },
        { id: 'm1l4p-5',  dutch: 'Ik woon op nummer twaalf.',      spanish: 'Vivo en el número doce.',          context: 'Dirección' },
        { id: 'm1l4p-6',  dutch: 'Hoeveel kost het?',              spanish: '¿Cuánto cuesta?',                  context: 'Precios' },
        { id: 'm1l4p-7',  dutch: 'Het kost negen euro.',           spanish: 'Cuesta nueve euros.',              context: 'Precios' },
        { id: 'm1l4p-8',  dutch: 'Wat is je telefoonnummer?',      spanish: '¿Cuál es tu número de teléfono?',  context: 'Teléfono' },
        { id: 'm1l4p-9',  dutch: 'Mijn nummer is 06-87654321.',    spanish: 'Mi número es 06-87654321.',        context: 'Teléfono' },
        { id: 'm1l4p-10', dutch: 'Hoeveel is vijf keer vijf?',     spanish: '¿Cuánto es cinco por cinco?',      context: 'Calcular' },
        { id: 'm1l4p-11', dutch: 'Zeven keer twee is veertien.',   spanish: 'Siete por dos son catorce.',       context: 'Calcular' },
        { id: 'm1l4p-12', dutch: 'Elf min zes is vijf.',           spanish: 'Once menos seis son cinco.',       context: 'Calcular' },
        { id: 'm1l4p-13', dutch: 'Welk nummer heeft u?',           spanish: '¿Qué número tiene usted?',         context: 'Formal' },
        { id: 'm1l4p-14', dutch: 'Ik heb nummer drieëndertig.',    spanish: 'Tengo el número treinta y tres.',  context: 'Formal' },
      ],
    },
    {
      type: 'lezen',
      title: 'Nummers overal',
      textNl: `Nummers zijn overal in Nederland. Elk huis heeft een nummer: David woont op nummer acht in Amsterdam en Anna woont op nummer vijftien in Haarlem. Elke bus heeft ook een nummer: de bus van David is lijn vijfentwintig.

En dan de prijzen! Een koffie in de stad kost ongeveer vier euro. Twee koffie? Dat is acht euro. Een boek kost al snel twaalf euro. Veel mensen vinden dat veel geld.

Nederlanders rekenen graag. De woorden zijn makkelijk: plus, min en keer. Negen plus negen is achttien. Vier keer vijf is twintig. En honderd min één? Negenennegentig!

Nog één ding: in het Nederlands zeg je eerst de eenheid en dan het tiental. Vierentwintig is dus vier-en-twintig. Even wennen voor Spaanstaligen — maar na deze les ken jij alle nummers!`,
      textEs: `Los números están por todas partes en Países Bajos. Cada casa tiene un número: David vive en el número ocho en Ámsterdam y Anna vive en el número quince en Haarlem. Cada autobús también tiene un número: el autobús de David es la línea veinticinco.

¡Y luego los precios! Un café en la ciudad cuesta unos cuatro euros. ¿Dos cafés? Son ocho euros. Un libro cuesta fácilmente doce euros. A mucha gente eso le parece mucho dinero.

A los neerlandeses les gusta calcular. Las palabras son fáciles: plus, min y keer. Nueve más nueve son dieciocho. Cuatro por cinco son veinte. ¿Y cien menos uno? ¡Noventa y nueve!

Una cosa más: en neerlandés se dice primero la unidad y luego la decena. Veinticuatro es, literalmente, cuatro-y-veinte. Cuesta acostumbrarse siendo hispanohablante — ¡pero después de esta lección te sabrás todos los números!`,
      exercises: [
        { id: 'm1l4lz-1', type: 'multiple_choice', prompt: '¿Cuánto cuesta UN café en la ciudad?', options: ['Unos cuatro euros', 'Ocho euros', 'Dos euros', 'Doce euros'], correctAnswer: 'Unos cuatro euros', explanation: '"Een koffie kost ongeveer vier euro."' },
        { id: 'm1l4lz-2', type: 'multiple_choice', prompt: '¿En qué número vive David?', options: ['En el ocho', 'En el quince', 'En el veinticinco', 'En el cuatro'], correctAnswer: 'En el ocho', explanation: '"David woont op nummer acht."' },
        { id: 'm1l4lz-3', type: 'fill_blank', prompt: 'Twee koffie? Dat is ___ euro. (en letras)', correctAnswer: 'acht', hint: '4 + 4 = …', explanation: 'Dos cafés a cuatro euros: acht (ocho) euros.' },
        { id: 'm1l4lz-4', type: 'multiple_choice', prompt: '¿Cuánto cuesta un libro según el texto?', options: ['Doce euros', 'Diez euros', 'Ocho euros', 'Veinte euros'], correctAnswer: 'Doce euros', explanation: '"Een boek kost al snel twaalf euro" — twaalf = 12.' },
        { id: 'm1l4lz-5', type: 'multiple_choice', prompt: '¿Qué número tiene el autobús de David?', options: ['La línea veinticinco', 'La línea ocho', 'La línea doce', 'La línea dieciocho'], correctAnswer: 'La línea veinticinco', explanation: '"Lijn vijfentwintig" = vijf-en-twintig = 25.' },
        { id: 'm1l4lz-6', type: 'fill_blank', prompt: 'Negen plus negen is ___. (en letras)', correctAnswer: 'achttien', hint: '9 + 9 = 18 (¡con dos t!)', explanation: 'Achttien (18) se escribe con dos t: acht + tien.' },
        { id: 'm1l4lz-7', type: 'fill_blank', prompt: 'Honderd min één is ___ennegentig. (la unidad)', correctAnswer: 'negen', hint: '99 = "nueve y noventa"', explanation: '99 = negenennegentig: primero la unidad, luego la decena.' },
        { id: 'm1l4lz-8', type: 'multiple_choice', prompt: '¿En qué número vive Anna?', options: ['En el quince', 'En el ocho', 'En el cincuenta', 'En el cinco'], correctAnswer: 'En el quince', explanation: '"Anna woont op nummer vijftien" — vijftien = 15.' },
        { id: 'm1l4lz-9', type: 'multiple_choice', prompt: 'Según el texto, ¿qué se dice PRIMERO en los números neerlandeses?', options: ['La unidad', 'La decena', 'El cero', 'Da igual'], correctAnswer: 'La unidad', explanation: 'Vierentwintig = "cuatro y veinte": primero la unidad, luego la decena.' },
      ],
    },
    {
      // Diálogo de la presentación (Les 4 · dos partes: precios, y edad,
      // número de casa y teléfono).
      type: 'dialogue',
      dialogue: {
        id: 'm1d4',
        title: 'Hoeveel kost het?',
        context: 'Anna en David bestellen iets te drinken en rekenen af. Daarna praten ze over leeftijd, huisnummer en telefoonnummer.',
        lines: [
          { id: 'm1d4-1', speaker: 'Anna', dutch: 'Hoi David! Kijk, deze koffie kost twee euro vijftig.', spanish: '¡Hola David! Mira, este café cuesta dos euros cincuenta.' },
          { id: 'm1d4-2', speaker: 'David', dutch: 'Hallo Anna! En hoeveel kost de thee?', spanish: '¡Hola, Anna! ¿Y cuánto cuesta el té?' },
          { id: 'm1d4-3', speaker: 'Anna', dutch: 'De thee kost twee euro. Samen is dat vier euro vijftig.', spanish: 'El té cuesta dos euros. Juntos son cuatro euros cincuenta.' },
          { id: 'm1d4-4', speaker: 'David', dutch: 'Ik heb tien euro. Dus ik krijg vijf euro vijftig terug.', spanish: 'Tengo diez euros. Así que me devuelven cinco cincuenta.' },
          { id: 'm1d4-5', speaker: 'Anna', dutch: 'Hoe oud ben je, David?', spanish: '¿Cuántos años tienes, David?' },
          { id: 'm1d4-6', speaker: 'David', dutch: 'Ik ben vijfendertig jaar. En jij?', spanish: 'Tengo treinta y cinco años. ¿Y tú?' },
          { id: 'm1d4-7', speaker: 'Anna', dutch: 'Ik ben achtentwintig. Op welk nummer woon je?', spanish: 'Tengo veintiocho. ¿En qué número vives?' },
          { id: 'm1d4-8', speaker: 'David', dutch: 'Ik woon op nummer twaalf. Mijn nummer is 06-87654321.', spanish: 'Vivo en el número doce. Mi número es 06-87654321.' },
          { id: 'm1d4-9', speaker: 'Anna', dutch: 'Bedankt! Ik bel je morgen.', spanish: '¡Gracias! Te llamo mañana.' },
        ],
      },
      exercises: [
        { id: 'm1d4q-1', type: 'multiple_choice', prompt: '¿Cuánto cuesta el café?', options: ['2,50 €', '2,00 €', '4,50 €', '5,50 €'], correctAnswer: '2,50 €', explanation: '"Deze koffie kost twee euro vijftig."' },
        { id: 'm1d4q-2', type: 'multiple_choice', prompt: '¿Cuánto cuesta el té?', options: ['2,00 €', '2,50 €', '1,50 €', '3,00 €'], correctAnswer: '2,00 €', explanation: '"De thee kost twee euro."' },
        { id: 'm1d4q-3', type: 'multiple_choice', prompt: '¿Cuánto es todo junto?', options: ['4,50 €', '4,00 €', '5,50 €', '10,00 €'], correctAnswer: '4,50 €', explanation: '"Samen is dat vier euro vijftig." Samen = juntos, en total.' },
        { id: 'm1d4q-4', type: 'multiple_choice', prompt: 'David paga con diez euros. ¿Cuánto le devuelven?', options: ['5,50 €', '4,50 €', '6,00 €', '5,00 €'], correctAnswer: '5,50 €', explanation: '10 − 4,50 = 5,50. "Ik krijg vijf euro vijftig terug" — terugkrijgen = recibir de vuelta.' },
        { id: 'm1d4q-5', type: 'multiple_choice', prompt: '¿Cuántos años tiene David?', options: ['35', '28', '25', '38'], correctAnswer: '35', explanation: '"Ik ben vijfendertig jaar." Ojo al orden: vijf-en-dertig, primero el cinco.' },
        { id: 'm1d4q-6', type: 'multiple_choice', prompt: '¿Y Anna?', options: ['28', '35', '38', '20'], correctAnswer: '28', explanation: '"Ik ben achtentwintig": acht-en-twintig.' },
        { id: 'm1d4q-7', type: 'multiple_choice', prompt: '¿En qué número vive David?', options: ['12', '20', '2', '10'], correctAnswer: '12', explanation: '"Ik woon op nummer twaalf."' },
        { id: 'm1d4q-8', type: 'true_false', prompt: 'David dice "ik heb vijfendertig jaar" para su edad.', correctAnswer: 'falso', explanation: 'Dice "ik BEN vijfendertig jaar". La edad se es, no se tiene — es el aviso que deja la profe en la presentación.' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        // ── Opción múltiple ──
        { id: 'm1l4e-1',  type: 'multiple_choice', prompt: '¿Cómo se dice 24?', options: ['vierentwintig', 'twintigvier', 'twee-vier', 'viertwintig'], correctAnswer: 'vierentwintig', explanation: 'Primero la unidad (vier), luego "en", luego la decena (twintig): "cuatro y veinte".' },
        { id: 'm1l4e-2',  type: 'multiple_choice', prompt: '¿Qué número es "achtentachtig"?', options: ['88', '80', '18', '8'], correctAnswer: '88', explanation: 'acht (8) + en + tachtig (80) = 88.' },
        { id: 'm1l4e-3',  type: 'multiple_choice', prompt: '¿Qué significa "Hoeveel kost het?"', options: ['¿Cuánto cuesta?', '¿Cuántos años tienes?', '¿Qué número tienes?', '¿Dónde vives?'], correctAnswer: '¿Cuánto cuesta?', explanation: 'Hoeveel = cuánto, kosten = costar.' },
        { id: 'm1l4e-4',  type: 'multiple_choice', prompt: '¿Qué palabra usas para multiplicar (por/veces)?', options: ['keer', 'plus', 'min', 'is'], correctAnswer: 'keer', explanation: 'Twee keer drie is zes = dos por tres son seis.' },
        // ── Verdadero / Falso ──
        { id: 'm1l4e-5',  type: 'true_false', prompt: '"Vijftien" es el número 15.', correctAnswer: 'verdadero', explanation: 'vijf (5) + tien (10) = vijftien (15).' },
        { id: 'm1l4e-6',  type: 'true_false', prompt: '"Tachtig" es el número 18.', correctAnswer: 'falso', explanation: 'Tachtig = 80. El 18 es "achttien".' },
        { id: 'm1l4e-7',  type: 'true_false', prompt: 'En neerlandés se dice primero la decena y luego la unidad.', correctAnswer: 'falso', explanation: 'Es al revés que en español: primero la unidad → vierentwintig ("cuatro y veinte").' },
        // ── Completar ──
        { id: 'm1l4e-8',  type: 'fill_blank', prompt: 'Twee plus drie is ___. (en letras)', correctAnswer: 'vijf', hint: '2 + 3' },
        { id: 'm1l4e-9',  type: 'fill_blank', prompt: 'Twintig min tien is ___. (en letras)', correctAnswer: 'tien', hint: '20 − 10' },
        { id: 'm1l4e-10', type: 'fill_blank', prompt: 'Vier keer vijf is ___. (en letras)', correctAnswer: 'twintig', hint: '4 × 5' },
        { id: 'm1l4e-11', type: 'fill_blank', prompt: '25 = vijfen___. (la decena)', correctAnswer: 'twintig', hint: '"cinco y veinte"' },
        // ── Ordenar frases ──
        { id: 'm1l4e-12', type: 'order_sentence', prompt: 'Ordena: "¿Cuántos años tienes?"', options: ['Hoe', 'oud', 'ben', 'je?'], correctAnswer: 'Hoe oud ben je?' },
        { id: 'm1l4e-13', type: 'order_sentence', prompt: 'Ordena: "Cuesta nueve euros."', options: ['Het', 'kost', 'negen', 'euro'], correctAnswer: 'Het kost negen euro' },
        // ── Sopa de letras ──
        { id: 'm1l4e-14', type: 'word_scramble', prompt: '¿Cómo se dice "doce"?', correctAnswer: 'twaalf', hint: '12' },
        { id: 'm1l4e-15', type: 'word_scramble', prompt: '¿Cómo se dice "nueve"?', correctAnswer: 'negen', hint: '9' },
        // ── Letras que faltan ──
        { id: 'm1l4e-16', type: 'letter_dash', prompt: 'Completa el número 14', correctAnswer: 'veertien', hint: 'Irregular: no es "viertien"' },
        { id: 'm1l4e-17', type: 'letter_dash', prompt: 'Completa el número 100', correctAnswer: 'honderd', hint: 'cien' },
        // ── Unir parejas ──
        { id: 'm1l4e-18', type: 'match_pairs', prompt: 'Une cada número con su cifra', correctAnswer: '', pairs: [
          { left: 'elf', right: '11' },
          { left: 'twaalf', right: '12' },
          { left: 'dertien', right: '13' },
          { left: 'veertien', right: '14' },
          { left: 'twintig', right: '20' },
          { left: 'dertig', right: '30' },
        ] },
        { id: 'm1l4e-19', type: 'match_pairs', prompt: 'Une cada palabra de calcular con su significado', correctAnswer: '', pairs: [
          { left: 'plus', right: 'más' },
          { left: 'min', right: 'menos' },
          { left: 'keer', right: 'por / veces' },
          { left: 'hoeveel', right: 'cuánto' },
          { left: 'de euro', right: 'el euro' },
        ] },
        // ── Emoji ──
        { id: 'm1l4e-20', type: 'emoji_choice', prompt: '¿Qué emoji representa "de euro"?', options: ['💶', '🎂', '📞', '🕛'], correctAnswer: '💶', explanation: '"De euro" = el euro, el dinero.' },
        // ── El intruso ──
        { id: 'm1l4e-21', type: 'odd_one_out', prompt: '¿Cuál es IMPAR? (las otras son pares)', options: ['twee', 'vier', 'zes', 'zeven'], correctAnswer: 'zeven', explanation: 'Twee (2), vier (4) y zes (6) son pares; zeven (7) es impar.' },
        { id: 'm1l4e-22', type: 'odd_one_out', prompt: '¿Cuál NO es una decena?', options: ['tien', 'twintig', 'dertig', 'twaalf'], correctAnswer: 'twaalf', explanation: 'Twaalf (12) no es una decena; tien (10), twintig (20) y dertig (30) sí.' },
        // ── Escribir ──
        { id: 'm1l4e-23', type: 'write_answer', prompt: 'Escribe en letras el número 44', correctAnswer: 'vierenveertig', hint: '"cuatro y cuarenta", todo junto' },
        { id: 'm1l4e-24', type: 'write_answer', prompt: 'Drie keer drie is … — escribe el resultado en letras', correctAnswer: 'negen', hint: '3 × 3' },
        // ── Escuchar ──
        { id: 'm1l4e-25', type: 'listen_and_choose', prompt: 'Escucha y elige el número que oyes: "zeventien"', options: ['zeventien', 'zeventig', 'zeven', 'zevenentwintig'], correctAnswer: 'zeventien', explanation: '-tien = 17; -tig sería 70.' },
        { id: 'm1l4e-26', type: 'listen_and_choose', prompt: 'Escucha y elige el número que oyes: "vijfenveertig"', options: ['vijfenveertig', 'vierenvijftig', 'vijftien', 'veertig'], correctAnswer: 'vijfenveertig', explanation: 'vijf-en-veertig = 45 ("cinco y cuarenta"); vierenvijftig sería 54.' },
        { id: 'm1l4e-27', type: 'listen_and_choose', prompt: 'Escucha y elige el número que oyes: "tachtig"', options: ['tachtig', 'achttien', 'acht', 'achtentachtig'], correctAnswer: 'tachtig' },
        { id: 'm1l4e-28', type: 'listen_translate', prompt: 'Escucha y traduce: "Het kost negen euro"', options: ['Cuesta', 'nueve', 'euros', 'diez', 'Vale', 'céntimos'], correctAnswer: 'Cuesta nueve euros' },
        { id: 'm1l4e-29', type: 'listen_translate', prompt: 'Escucha y traduce: "Ik woon op nummer twaalf"', options: ['Vivo', 'en', 'el', 'número', 'doce', 'trece'], correctAnswer: 'Vivo en el número doce' },
        // ── Comprensión del diálogo (De vierde ontmoeting) ──
        { id: 'm1l4e-30', type: 'multiple_choice', prompt: 'En el diálogo, ¿cuántos años tiene David?', options: ['32', '23', '29', '38'], correctAnswer: '32', explanation: '"Ik ben tweeëndertig jaar" = dos y treinta = 32.' },
        { id: 'm1l4e-31', type: 'true_false', prompt: 'Anna vive en el número quince.', correctAnswer: 'verdadero', explanation: '"Ik woon op nummer vijftien."' },
        { id: 'm1l4e-32', type: 'true_false', prompt: 'David falla la cuenta "twintig min elf".', correctAnswer: 'falso', explanation: 'La acierta: twintig min elf is negen (20 − 11 = 9).' },
      ],
    },
    { type: 'review' },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────── */

const m1_les5: Lesson = {
  id: 'les-5-alfabet',
  moduleId: 'over-jou',
  title: 'Les 5 — Woordenschat | Het alfabet',
  subtitle: 'El alfabeto y deletrear',
  order: 5,
  learningObjective: 'Conocer el alfabeto neerlandés, pronunciar las letras y deletrear nombres y palabras',
  estimatedMinutes: 30,
  blocks: [
    {
      type: 'summary',
      title: 'Het alfabet',
      intro: 'En la vida diaria en Países Bajos tendrás que deletrear muchas veces: tu nombre, tu apellido, tu email, tu calle. La pregunta clave: **Hoe schrijf je je naam?** (¿cómo se escribe tu nombre?).',
      objectives: [
        'Conocer el alfabeto neerlandés y el nombre de cada letra',
        'Pronunciar las letras que suenan diferente al español',
        'Deletrear tu nombre, apellido y email',
      ],
      sections: [
        {
          heading: '✅ Las letras "fáciles"',
          body: 'Muchas letras suenan casi igual que en español: **B D F K L M N P R S T**.',
        },
        {
          heading: '⚠️ Las letras que suenan diferente',
          items: [
            { nl: 'C', es: 'como "k" ante a/o/u; como "s" ante e/i' },
            { nl: 'G', es: 'sale desde la garganta (goed, graag, groen)' },
            { nl: 'H', es: 'aspirada y sonora, como la h inglesa (happy)' },
            { nl: 'J', es: 'NO es la jota: suena como en "ya" (ja, juli)' },
            { nl: 'W', es: 'entre la "b" y la "u" (water, werken, wit)' },
            { nl: 'V', es: 'no es la b: se sopla suavemente (vier, vader)' },
            { nl: 'Z', es: 'una "s" vibrante, como el zumbido de una abeja (zes, zon)' },
            { nl: 'Y', es: 'se usa poco, sobre todo en nombres (Yvonne)' },
          ],
        },
        {
          heading: '🗣️ El NOMBRE de la letra ≠ su SONIDO',
          body: 'Para los hispanohablantes lo confuso son los NOMBRES de las letras: la J no se llama "jota" sino **jee**; la W no es "doble uve" sino **wee**; la Y se llama **griekse ij** (ij griega); la G se llama **gee**. La letra se LLAMA "jee", pero en una palabra SUENA como la "y" de "ya".',
        },
        {
          heading: '👀 Dos contrastes típicos',
          body: 'Dos parejas que cuestan mucho a los hispanohablantes: **V – W** (vee vs. wee): *Victor* empieza con V, *Willem* con W. Y **I – IJ** (ie vs. ij): *Iris* empieza con I, *IJmuiden* con IJ.',
        },
      ],
      tip: 'La V neerlandesa NO es como la b española: se sopla suavemente. Y cuando alguien te deletree, ojo con **vee (V)** y **wee (W)** — el error clásico. Bonus: la @ se llama **apenstaartje** ("colita de mono"). 🐒',
    },
    {
      type: 'vocabulary',
      items: [
        { id: 'm1l5v-achternaam',  dutch: 'de achternaam',    spanish: 'el apellido',                    article: 'de',  emoji: '📇', color: '#1D0084', exampleNl: 'Wat is je achternaam?',           exampleEs: '¿Cuál es tu apellido?',              category: 'alfabet', difficulty: 'A0' },
        { id: 'm1l5v-voornaam',    dutch: 'de voornaam',      spanish: 'el nombre (de pila)',            article: 'de',  emoji: '🏷️', color: '#025dc7', exampleNl: 'Mijn voornaam is Carlos.',        exampleEs: 'Mi nombre de pila es Carlos.',       category: 'alfabet', difficulty: 'A0' },
        { id: 'm1l5v-spellen',     dutch: 'spellen',          spanish: 'deletrear',                      article: null,  emoji: '🔤', color: '#0b4db5', exampleNl: 'Kun je dat spellen?',             exampleEs: '¿Puedes deletrear eso?',             category: 'alfabet', difficulty: 'A0' },
        { id: 'm1l5v-letter',      dutch: 'de letter',        spanish: 'la letra',                       article: 'de',  emoji: '🅰️', color: '#0a3d9e', exampleNl: 'Welke letter is dat?',            exampleEs: '¿Qué letra es esa?',                 category: 'alfabet', difficulty: 'A0' },
        { id: 'm1l5v-herhalen',    dutch: 'herhalen',         spanish: 'repetir',                        article: null,  emoji: '🔁', color: '#1440a0', exampleNl: 'Sorry, kun je dat herhalen?',     exampleEs: 'Perdona, ¿puedes repetirlo?',        category: 'alfabet', difficulty: 'A0' },
        { id: 'm1l5v-emailadres',  dutch: 'het e-mailadres',  spanish: 'la dirección de correo',         article: 'het', emoji: '📧', color: '#0d5bbf', exampleNl: 'Kun je je e-mailadres spellen?',  exampleEs: '¿Puedes deletrear tu email?',        category: 'alfabet', difficulty: 'A0' },
        { id: 'm1l5v-straat',      dutch: 'de straat',        spanish: 'la calle',                       article: 'de',  emoji: '🛣️', color: '#1D0084', exampleNl: 'Wat is je straatnaam?',           exampleEs: '¿Cuál es el nombre de tu calle?',    category: 'alfabet', difficulty: 'A0' },
        { id: 'm1l5v-beginnen',    dutch: 'beginnen',         spanish: 'empezar',                        article: null,  emoji: '▶️', color: '#025dc7', exampleNl: 'Mijn achternaam begint met een Z.', exampleEs: 'Mi apellido empieza con Z.',       category: 'alfabet', difficulty: 'A0' },
        { id: 'm1l5v-eindigen',    dutch: 'eindigen',         spanish: 'terminar',                       article: null,  emoji: '⏹️', color: '#0b4db5', exampleNl: 'Mijn achternaam eindigt op een G.', exampleEs: 'Mi apellido termina con G.',       category: 'alfabet', difficulty: 'A0' },
        { id: 'm1l5v-apenstaartje', dutch: 'het apenstaartje', spanish: 'la arroba @ ("colita de mono")', article: 'het', emoji: '🐒', color: '#0a3d9e', exampleNl: 'David, apenstaartje, mail, punt, nl.', exampleEs: 'David, arroba, mail, punto, nl.', category: 'alfabet', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm1l5p-1',  dutch: 'Hoe spel je je naam?',                spanish: '¿Cómo se deletrea tu nombre?',        context: 'Deletrear' },
        { id: 'm1l5p-2',  dutch: 'Mijn naam is C-A-R-L-O-S.',           spanish: 'Mi nombre es C-A-R-L-O-S.',           context: 'Deletrear' },
        { id: 'm1l5p-3',  dutch: 'Wat is je achternaam?',               spanish: '¿Cuál es tu apellido?',               context: 'Preguntar' },
        { id: 'm1l5p-4',  dutch: 'Hoe spel je je achternaam?',          spanish: '¿Cómo se deletrea tu apellido?',      context: 'Deletrear' },
        { id: 'm1l5p-5',  dutch: 'Mijn achternaam begint met een Z.',   spanish: 'Mi apellido empieza con Z.',          context: 'Deletrear' },
        { id: 'm1l5p-6',  dutch: 'Mijn achternaam eindigt op een G.',   spanish: 'Mi apellido termina con G.',          context: 'Deletrear' },
        { id: 'm1l5p-7',  dutch: 'Kun je dat spellen?',                 spanish: '¿Puedes deletrear eso?',              context: 'Pedir' },
        { id: 'm1l5p-8',  dutch: 'Amsterdam spel je met een A.',        spanish: 'Ámsterdam se deletrea con A.',        context: 'Deletrear' },
        { id: 'm1l5p-9',  dutch: 'Nederland schrijf je met een N.',     spanish: 'Nederland se escribe con N.',         context: 'Deletrear' },
        { id: 'm1l5p-10', dutch: 'Kun je je e-mailadres spellen?',      spanish: '¿Puedes deletrear tu email?',         context: 'Pedir' },
        { id: 'm1l5p-11', dutch: 'Wat is je straatnaam?',               spanish: '¿Cuál es el nombre de tu calle?',     context: 'Preguntar' },
        { id: 'm1l5p-12', dutch: 'Sorry, kun je dat herhalen?',         spanish: 'Perdona, ¿puedes repetirlo?',         context: 'Pedir' },
        { id: 'm1l5p-13', dutch: 'Welke letter is dat?',                spanish: '¿Qué letra es esa?',                  context: 'Preguntar' },
      ],
    },
    {
      type: 'lezen',
      title: 'Spellen in Nederland',
      textNl: `In Nederland moet je vaak spellen: je naam, je achternaam, je e-mailadres, je straat. Bij de gemeente, aan de telefoon, op een taalschool — overal vragen ze: hoe spel je dat?

De letters hebben namen. De J heet jee, de W heet wee en de Y heet griekse ij. Voor Spaanstaligen zijn de V en de W lastig: Victor begint met een V, Willem met een W. Het verschil hoor je in de eerste klank.

David gaat naar een taalschool. De school heet De Windmolen. Daar spelt hij zijn achternaam: M-O-R-E-N-O. Hij spelt ook zijn e-mailadres. Het teken @ heet in het Nederlands apenstaartje — een klein woord met een grote glimlach.

Nog een tip: versta je iets niet? Vraag dan rustig om herhaling. Iedereen in Nederland helpt je graag met spellen.`,
      textEs: `En Países Bajos tienes que deletrear muchas veces: tu nombre, tu apellido, tu email, tu calle. En el ayuntamiento, al teléfono, en una escuela de idiomas — en todas partes preguntan: ¿cómo se deletrea?

Las letras tienen nombres. La J se llama jee, la W se llama wee y la Y se llama griekse ij. Para los hispanohablantes, la V y la W son complicadas: Victor empieza con V, Willem con W. La diferencia se oye en el primer sonido.

David va a una escuela de idiomas. La escuela se llama De Windmolen. Allí deletrea su apellido: M-O-R-E-N-O. También deletrea su email. El símbolo @ se llama en neerlandés apenstaartje ("colita de mono") — una palabra pequeña con una gran sonrisa.

Un consejo más: ¿no entiendes algo? Pide tranquilamente que lo repitan. En Países Bajos todo el mundo te ayuda encantado a deletrear.`,
      exercises: [
        { id: 'm1l5lz-1', type: 'multiple_choice', prompt: 'Según el texto, ¿dónde te piden deletrear?', options: ['En el ayuntamiento, al teléfono y en la escuela', 'Solo en el aeropuerto', 'Solo en internet', 'En ningún sitio'], correctAnswer: 'En el ayuntamiento, al teléfono y en la escuela', explanation: '"Bij de gemeente, aan de telefoon, op een taalschool — overal."' },
        { id: 'm1l5lz-2', type: 'multiple_choice', prompt: '¿Cómo se llama la escuela de David?', options: ['De Windmolen', 'De Taalschool', 'De Letter', 'Het Alfabet'], correctAnswer: 'De Windmolen', explanation: '"De school heet De Windmolen" — el molino de viento.' },
        { id: 'm1l5lz-3', type: 'multiple_choice', prompt: '¿Cuál es el apellido de David?', options: ['Moreno', 'Molina', 'Romero', 'Montero'], correctAnswer: 'Moreno', explanation: 'Lo deletrea: M-O-R-E-N-O.' },
        { id: 'm1l5lz-4', type: 'fill_blank', prompt: 'Daar ___ hij zijn achternaam. (deletrear)', correctAnswer: 'spelt', hint: 'spellen → con hij, raíz + t' },
        { id: 'm1l5lz-5', type: 'multiple_choice', prompt: '¿Qué significa "apenstaartje"?', options: ['La arroba (@)', 'El punto (.)', 'El guion (-)', 'La eñe (ñ)'], correctAnswer: 'La arroba (@)', explanation: 'Literalmente "colita de mono" = @.' },
        { id: 'm1l5lz-6', type: 'fill_blank', prompt: 'De J heet ___.', correctAnswer: 'jee', hint: 'El NOMBRE de la letra (no "jota")', explanation: 'La J se llama "jee" en neerlandés.' },
        { id: 'm1l5lz-7', type: 'multiple_choice', prompt: 'Victor y Willem: ¿con qué letra empieza cada uno?', options: ['Victor con V, Willem con W', 'Los dos con V', 'Los dos con W', 'Victor con W, Willem con V'], correctAnswer: 'Victor con V, Willem con W', explanation: 'El contraste V–W: la diferencia se oye en el primer sonido.' },
        { id: 'm1l5lz-8', type: 'multiple_choice', prompt: 'Según el texto, ¿qué haces si no entiendes algo?', options: ['Pedir tranquilamente que lo repitan', 'Cambiar de tema', 'Colgar el teléfono', 'Adivinar'], correctAnswer: 'Pedir tranquilamente que lo repitan', explanation: '"Vraag dan rustig om herhaling."' },
        { id: 'm1l5lz-9', type: 'multiple_choice', prompt: '¿Cómo se llama la letra Y en neerlandés?', options: ['Griekse ij', 'Ypsilon', 'Doble i', 'Wee'], correctAnswer: 'Griekse ij', explanation: '"De Y heet griekse ij" — la ij griega.' },
      ],
    },
    {
      // Diálogo de la presentación (Les 5 · De vijfde ontmoeting).
      type: 'dialogue',
      dialogue: {
        id: 'm1d5',
        title: 'De vijfde ontmoeting',
        context: 'Anna wil weten hoe David heet. Ze spellen allebei hun achternaam en praten over namen die moeilijk te spellen zijn.',
        lines: [
          { id: 'm1d5-1', speaker: 'Anna', dutch: 'Hoi David!', spanish: '¡Hola David!' },
          { id: 'm1d5-2', speaker: 'David', dutch: 'Hoi Anna!', spanish: '¡Hola, Anna!' },
          { id: 'm1d5-3', speaker: 'Anna', dutch: 'Wat is je achternaam? Dat weet ik nog niet.', spanish: '¿Cuál es tu apellido? Todavía no lo sé.' },
          { id: 'm1d5-4', speaker: 'David', dutch: 'Ik heb twee achternamen, net als iedereen in Spanje.', spanish: 'Tengo dos apellidos, como todo el mundo en España.' },
          { id: 'm1d5-5', speaker: 'Anna', dutch: 'O ja, dat is waar. Wat zijn je achternamen?', spanish: 'Ah, sí, es verdad. ¿Cuáles son tus apellidos?' },
          { id: 'm1d5-6', speaker: 'David', dutch: 'Ik heet David Martínez Guerrero. Martínez schrijf je met een z, en Guerrero schrijf je met dubbel r. Hoe spel je jouw achternaam?', spanish: 'Me llamo David Martínez Guerrero. Martínez se escribe con z y Guerrero con doble r. ¿Cómo se escribe tu apellido?' },
          { id: 'm1d5-7', speaker: 'Anna', dutch: 'Mijn achternaam is moeilijker dan mijn voornaam. Ik heet Anna van Oldenbarnevelt. Dat schrijf je met een t aan het eind.', spanish: 'Mi apellido es más difícil que mi nombre. Me llamo Anna van Oldenbarnevelt. Se escribe con t al final.' },
          { id: 'm1d5-8', speaker: 'David', dutch: 'Poe, dat is een lastige achternaam.', spanish: 'Uf, qué apellido más complicado.' },
          { id: 'm1d5-9', speaker: 'Anna', dutch: 'Er zijn veel straten in Nederland met deze naam. Dan vragen ze je bij het spellen meestal of het op een d of een t eindigt.', spanish: 'Hay muchas calles en los Países Bajos con ese nombre. Al deletrearlo suelen preguntarte si termina en d o en t.' },
          { id: 'm1d5-10', speaker: 'David', dutch: 'Goed om te weten. Ik woon nu aan het Schaepmanplein, met a-e. Ook best gecompliceerd.', spanish: 'Está bien saberlo. Ahora vivo en Schaepmanplein, con a-e. También es bastante complicado.' },
          { id: 'm1d5-11', speaker: 'Anna', dutch: 'Sommige namen zijn inderdaad lastig om te spellen. Maar je doet het goed!', spanish: 'Algunos nombres sí que son difíciles de deletrear. ¡Pero lo estás haciendo muy bien!' },
          { id: 'm1d5-12', speaker: 'David', dutch: 'Dank je, goed om te horen!', spanish: '¡Gracias, me alegra oírlo!' },
        ],
      },
      exercises: [
        { id: 'm1d5q-1', type: 'multiple_choice', prompt: '¿Cuántos apellidos tiene David?', options: ['Dos', 'Uno', 'Tres', 'No lo dice'], correctAnswer: 'Dos', explanation: '"Ik heb twee achternamen, net als iedereen in Spanje."' },
        { id: 'm1d5q-2', type: 'multiple_choice', prompt: '¿Con qué letra se escribe "Martínez"?', options: ['Con z', 'Con s', 'Con c', 'Con doble z'], correctAnswer: 'Con z', explanation: '"Martínez schrijf je met een z."' },
        { id: 'm1d5q-3', type: 'multiple_choice', prompt: '¿Qué tiene "Guerrero" según David?', options: ['Doble r', 'Doble e', 'Una h muda', 'Dos acentos'], correctAnswer: 'Doble r', explanation: '"Guerrero schrijf je met dubbel r."' },
        { id: 'm1d5q-4', type: 'multiple_choice', prompt: '¿Con qué letra termina el apellido de Anna?', options: ['Con t', 'Con d', 'Con f', 'Con e'], correctAnswer: 'Con t', explanation: '"Dat schrijf je met een t aan het eind."' },
        { id: 'm1d5q-5', type: 'true_false', prompt: 'Anna dice que su apellido es más fácil que su nombre.', correctAnswer: 'falso', explanation: 'Dice lo contrario: "Mijn achternaam is moeilijker dan mijn voornaam".' },
        { id: 'm1d5q-6', type: 'multiple_choice', prompt: 'Al deletrear el nombre de una calle, ¿qué suelen preguntarte?', options: ['Si termina en d o en t', 'Si lleva mayúscula', 'Si es larga o corta', 'En qué ciudad está'], correctAnswer: 'Si termina en d o en t', explanation: 'Es una duda clásica en neerlandés: al final de palabra, la d y la t suenan igual.' },
        { id: 'm1d5q-7', type: 'multiple_choice', prompt: '¿Dónde vive David ahora?', options: ['En Schaepmanplein', 'En Oldenbarneveltstraat', 'En Amsterdam-Zuid', 'No lo dice'], correctAnswer: 'En Schaepmanplein', explanation: '"Ik woon nu aan het Schaepmanplein, met a-e."' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        // ── Opción múltiple ──
        { id: 'm1l5e-1',  type: 'multiple_choice', prompt: '¿Cómo se llama la letra J en neerlandés?', options: ['jee', 'jota', 'ye', 'ji'], correctAnswer: 'jee', explanation: 'La J se llama "jee" (y en las palabras suena como la "y" de "ya").' },
        { id: 'm1l5e-2',  type: 'multiple_choice', prompt: '¿Cómo se llama la letra Y?', options: ['griekse ij', 'ypsilon', 'doble i', 'wee'], correctAnswer: 'griekse ij', explanation: 'La Y se llama "griekse ij" (ij griega).' },
        { id: 'm1l5e-3',  type: 'multiple_choice', prompt: '"Victor" y "Willem": ¿con qué letra empieza cada uno?', options: ['Victor con V, Willem con W', 'Los dos con V', 'Los dos con W', 'Victor con W, Willem con V'], correctAnswer: 'Victor con V, Willem con W', explanation: 'El contraste V–W (vee vs. wee) es el clásico para hispanohablantes.' },
        { id: 'm1l5e-4',  type: 'multiple_choice', prompt: '¿Cómo suena la C antes de "e" o "i"?', options: ['Como "s"', 'Como "k"', 'Como "z" española', 'Como "ch"'], correctAnswer: 'Como "s"', explanation: 'C + e/i = sonido "s"; C + a/o/u = sonido "k".' },
        // ── Verdadero / Falso ──
        { id: 'm1l5e-5',  type: 'true_false', prompt: 'La G neerlandesa sale desde la garganta.', correctAnswer: 'verdadero', explanation: 'Como en "goed", "graag", "groen" — salvo en el sur del país.' },
        { id: 'm1l5e-6',  type: 'true_false', prompt: 'La W se llama "doble uve" en neerlandés.', correctAnswer: 'falso', explanation: 'Se llama "wee".' },
        { id: 'm1l5e-7',  type: 'true_false', prompt: 'El nombre de una letra y su sonido son siempre iguales.', correctAnswer: 'falso', explanation: 'La letra se LLAMA "jee" pero SUENA como la "y" de "ya". Son cosas distintas.' },
        // ── Completar ──
        { id: 'm1l5e-8',  type: 'fill_blank', prompt: 'Mijn achternaam begint ___ een Z.', correctAnswer: 'met', hint: 'beginnen pide una preposición (¿con?)' },
        { id: 'm1l5e-9',  type: 'fill_blank', prompt: 'Mijn achternaam eindigt ___ een G.', correctAnswer: 'op', hint: 'eindigen op = terminar con' },
        { id: 'm1l5e-10', type: 'fill_blank', prompt: 'Hoe ___ je je naam?', correctAnswer: 'spel', hint: 'deletrear (¡en pregunta con je, sin -t!)' },
        // ── Ordenar frases ──
        { id: 'm1l5e-11', type: 'order_sentence', prompt: 'Ordena: "Perdona, ¿puedes repetirlo?"', options: ['Sorry,', 'kun', 'je', 'dat', 'herhalen?'], correctAnswer: 'Sorry, kun je dat herhalen?' },
        { id: 'm1l5e-12', type: 'order_sentence', prompt: 'Ordena: "¿Cómo se deletrea tu apellido?"', options: ['Hoe', 'spel', 'je', 'je', 'achternaam?'], correctAnswer: 'Hoe spel je je achternaam?' },
        // ── Sopa de letras ──
        { id: 'm1l5e-13', type: 'word_scramble', prompt: '¿Cómo se dice "deletrear"?', correctAnswer: 'spellen', hint: 'deletrear' },
        { id: 'm1l5e-14', type: 'word_scramble', prompt: '¿Cómo se dice "la letra"?', correctAnswer: 'letter', hint: 'de …' },
        // ── Letras que faltan ──
        { id: 'm1l5e-15', type: 'letter_dash', prompt: 'Completa: "el apellido"', correctAnswer: 'achternaam', hint: 'de …' },
        { id: 'm1l5e-16', type: 'letter_dash', prompt: 'Completa: "repetir"', correctAnswer: 'herhalen', hint: 'Sorry, kun je dat …?' },
        // ── Unir parejas ──
        { id: 'm1l5e-17', type: 'match_pairs', prompt: 'Une cada letra con su nombre neerlandés', correctAnswer: '', pairs: [
          { left: 'J', right: 'jee' },
          { left: 'W', right: 'wee' },
          { left: 'Y', right: 'griekse ij' },
          { left: 'G', right: 'gee' },
          { left: 'V', right: 'vee' },
        ] },
        { id: 'm1l5e-18', type: 'match_pairs', prompt: 'Une cada palabra con su traducción', correctAnswer: '', pairs: [
          { left: 'de achternaam', right: 'el apellido' },
          { left: 'de voornaam', right: 'el nombre de pila' },
          { left: 'de straat', right: 'la calle' },
          { left: 'herhalen', right: 'repetir' },
          { left: 'spellen', right: 'deletrear' },
          { left: 'het apenstaartje', right: 'la arroba (@)' },
        ] },
        // ── Emoji ──
        { id: 'm1l5e-19', type: 'emoji_choice', prompt: '¿Qué emoji representa "het e-mailadres"?', options: ['📧', '🛣️', '📇', '🔁'], correctAnswer: '📧', explanation: '"Het e-mailadres" = la dirección de correo electrónico.' },
        { id: 'm1l5e-20', type: 'emoji_choice', prompt: '¿Qué emoji representa "het apenstaartje"?', options: ['🐒', '🐱', '🐦', '🐟'], correctAnswer: '🐒', explanation: 'La @ se llama "colita de mono" — ¡por eso el mono!' },
        // ── El intruso ──
        { id: 'm1l5e-21', type: 'odd_one_out', prompt: '¿Cuál NO es el nombre de una letra?', options: ['jee', 'wee', 'gee', 'ja'], correctAnswer: 'ja', explanation: '"Ja" significa "sí"; jee (J), wee (W) y gee (G) son nombres de letras.' },
        { id: 'm1l5e-22', type: 'odd_one_out', prompt: '¿Qué nombre NO empieza con W?', options: ['Willem', 'Wouter', 'Victor', 'Wim'], correctAnswer: 'Victor', explanation: 'Victor empieza con V (vee); los otros con W (wee).' },
        // ── Escribir ──
        { id: 'm1l5e-23', type: 'write_answer', prompt: '¿Qué palabra es? H-U-I-S', correctAnswer: 'huis', hint: 'Une las letras: significa "casa"' },
        { id: 'm1l5e-24', type: 'write_answer', prompt: '¿Qué nombre es? A-N-N-A', correctAnswer: 'Anna', hint: 'La taalbuddy de David' },
        // ── Escuchar ──
        { id: 'm1l5e-25', type: 'listen_and_choose', prompt: 'Escucha el nombre de la letra: "vee"', options: ['V', 'W', 'B', 'F'], correctAnswer: 'V', explanation: '"Vee" es el nombre de la V; "wee" sería la W.' },
        { id: 'm1l5e-26', type: 'listen_and_choose', prompt: 'Escucha el nombre de la letra: "wee"', options: ['W', 'V', 'U', 'M'], correctAnswer: 'W' },
        { id: 'm1l5e-27', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "Willem"', options: ['Willem', 'Villem', 'Wilem', 'Willen'], correctAnswer: 'Willem' },
        { id: 'm1l5e-28', type: 'listen_translate', prompt: 'Escucha y traduce: "Kun je dat herhalen?"', options: ['¿Puedes', 'repetir', 'eso?', 'deletrear', '¿Quieres', 'ahora?'], correctAnswer: '¿Puedes repetir eso?' },
        // ── Comprensión del diálogo (De vijfde ontmoeting) ──
        { id: 'm1l5e-29', type: 'multiple_choice', prompt: 'En el diálogo, ¿qué palabra le cuesta deletrear a David?', options: ['Willem', 'Anna', 'Moreno', 'David'], correctAnswer: 'Willem', explanation: 'Empieza a decir V… y se corrige: ¡W! El clásico lío V–W.' },
        { id: 'm1l5e-30', type: 'true_false', prompt: 'El apellido de David es Moreno.', correctAnswer: 'verdadero', explanation: 'Lo deletrea: M-O-R-E-N-O.' },
        { id: 'm1l5e-31', type: 'true_false', prompt: 'La "@" del email se llama "apenstaartje" (colita de mono).', correctAnswer: 'verdadero', explanation: 'Así deletrea David su email: "david, punt, moreno, apenstaartje, mail, punt, nl".' },
      ],
    },
    { type: 'review' },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────── */

const m1_les6: Lesson = {
  id: 'les-6-uitspraak-klinkers',
  moduleId: 'over-jou',
  title: 'Les 6 — Uitspraak | a/aa – e/ee – o/oo',
  subtitle: 'Vocales cortas y largas',
  order: 6,
  learningObjective: 'Distinguir vocales cortas y largas, y entender la regla de las sílabas abiertas y cerradas',
  estimatedMinutes: 30,
  blocks: [
    {
      type: 'summary',
      title: 'Korte en lange klinkers',
      intro: 'En neerlandés la duración de la vocal puede cambiar el SIGNIFICADO de una palabra: *man* (hombre) no es lo mismo que *maan* (luna). Hoy aprendes a oír la diferencia y la regla de ortografía que hay detrás.',
      objectives: [
        'Reconocer y pronunciar vocales cortas y largas',
        'Entender las sílabas abiertas y cerradas',
        'Aplicar la regla: maan → manen, boom → bomen',
      ],
      sections: [
        {
          heading: '👂 Corta vs. larga: cambia el significado',
          body: 'Una vocal escrita DOS veces se pronuncia larga:',
          items: [
            { nl: 'kam → kaas', es: 'peine (corta) → queso (larga)' },
            { nl: 'pet → peer', es: 'gorra (corta) → pera (larga)' },
            { nl: 'bol → boom', es: 'bola (corta) → árbol (larga)' },
            { nl: 'bus → buur', es: 'autobús (corta) → vecino (larga)' },
            { nl: 'man → maan', es: 'hombre (corta) → luna (larga)' },
            { nl: 'geld → geel', es: 'dinero (corta) → amarillo (larga)' },
          ],
        },
        {
          heading: '🧱 Sílabas cerradas y abiertas',
          body: '**Sílaba cerrada** = termina en consonante (*man, kat, bos, bus*): una sola vocal se pronuncia CORTA. **Sílaba abierta** = termina en vocal (*ma-, ka-, bo-*): una sola vocal se pronuncia LARGA.',
        },
        {
          heading: '✍️ La regla de ortografía',
          body: 'En *maan, boom, been, muur* la vocal es larga y la sílaba cerrada → se escriben DOS vocales. Al añadir otra sílaba, la primera queda abierta: **ma-nen, bo-men, be-nen, mu-ren** — y como la sílaba abierta ya suena larga, basta UNA vocal. Por eso: **maan → manen, boom → bomen, been → benen, muur → muren**. ¡La pronunciación NO cambia, solo la escritura! "Maan" y la primera sílaba de "manen" suenan exactamente igual.',
        },
      ],
      tip: 'Regla de oro: sílaba cerrada + vocal larga → escribe DOS vocales (maan, boom). Al añadir una sílaba, se abre y basta UNA (manen, bomen). La pronunciación no cambia — solo la escritura.',
    },
    {
      type: 'vocabulary',
      items: [
        { id: 'm1l6v-man',   dutch: 'de man',   spanish: 'el hombre',        article: 'de',  emoji: '👨', color: '#1D0084', exampleNl: 'De man kijkt naar de maan.',  exampleEs: 'El hombre mira la luna.',      category: 'kort', difficulty: 'A0' },
        { id: 'm1l6v-maan',  dutch: 'de maan',  spanish: 'la luna',          article: 'de',  emoji: '🌙', color: '#025dc7', exampleNl: 'De maan is groot en geel.',   exampleEs: 'La luna es grande y amarilla.', category: 'lang', difficulty: 'A0' },
        { id: 'm1l6v-kam',   dutch: 'de kam',   spanish: 'el peine',         article: 'de',  emoji: '💇', color: '#0b4db5', exampleNl: 'De kam is voor je haar.',     exampleEs: 'El peine es para tu pelo.',    category: 'kort', difficulty: 'A0' },
        { id: 'm1l6v-pet',   dutch: 'de pet',   spanish: 'la gorra',         article: 'de',  emoji: '🧢', color: '#0a3d9e', exampleNl: 'Ik heb een blauwe pet.',      exampleEs: 'Tengo una gorra azul.',        category: 'kort', difficulty: 'A0' },
        { id: 'm1l6v-peer',  dutch: 'de peer',  spanish: 'la pera',          article: 'de',  emoji: '🍐', color: '#1440a0', exampleNl: 'Ik eet een peer.',            exampleEs: 'Como una pera.',               category: 'lang', difficulty: 'A0' },
        { id: 'm1l6v-bol',   dutch: 'de bol',   spanish: 'la bola',          article: 'de',  emoji: '⚽', color: '#0d5bbf', exampleNl: 'De bol is rond.',             exampleEs: 'La bola es redonda.',          category: 'kort', difficulty: 'A0' },
        { id: 'm1l6v-boom',  dutch: 'de boom',  spanish: 'el árbol',         article: 'de',  emoji: '🌳', color: '#1D0084', exampleNl: 'De boom is groot.',           exampleEs: 'El árbol es grande.',          category: 'lang', difficulty: 'A0' },
        { id: 'm1l6v-bus',   dutch: 'de bus',   spanish: 'el autobús',       article: 'de',  emoji: '🚌', color: '#025dc7', exampleNl: 'De bus komt.',                exampleEs: 'El autobús viene.',            category: 'kort', difficulty: 'A0' },
        { id: 'm1l6v-buur',  dutch: 'de buur',  spanish: 'el vecino / la vecina', article: 'de', emoji: '🏘️', color: '#0b4db5', exampleNl: 'Mijn buur drinkt koffie.', exampleEs: 'Mi vecino toma café.',        category: 'lang', difficulty: 'A0' },
        { id: 'm1l6v-muur',  dutch: 'de muur',  spanish: 'la pared',         article: 'de',  emoji: '🧱', color: '#0a3d9e', exampleNl: 'De muur is wit.',             exampleEs: 'La pared es blanca.',          category: 'lang', difficulty: 'A0' },
        { id: 'm1l6v-geld',  dutch: 'het geld', spanish: 'el dinero',        article: 'het', emoji: '💰', color: '#1440a0', exampleNl: 'Ik heb geld voor de bus.',    exampleEs: 'Tengo dinero para el autobús.', category: 'kort', difficulty: 'A0' },
        { id: 'm1l6v-wiel',  dutch: 'het wiel', spanish: 'la rueda',         article: 'het', emoji: '🛞', color: '#0d5bbf', exampleNl: 'Het wiel van de fiets.',      exampleEs: 'La rueda de la bicicleta.',    category: 'lang', difficulty: 'A0' },
        { id: 'm1l6v-boot',  dutch: 'de boot',  spanish: 'el barco',         article: 'de',  emoji: '⛵', color: '#1D0084', exampleNl: 'De boot vaart op de zee.',    exampleEs: 'El barco navega por el mar.',  category: 'lang', difficulty: 'A0' },
        { id: 'm1l6v-kat',   dutch: 'de kat',   spanish: 'el gato',          article: 'de',  emoji: '🐱', color: '#025dc7', exampleNl: 'De kat slaapt.',              exampleEs: 'El gato duerme.',              category: 'kort', difficulty: 'A0' },
        { id: 'm1l6v-zon',   dutch: 'de zon',   spanish: 'el sol',           article: 'de',  emoji: '☀️', color: '#0b4db5', exampleNl: 'De zon schijnt.',             exampleEs: 'El sol brilla.',               category: 'kort', difficulty: 'A0' },
        { id: 'm1l6v-bos',   dutch: 'het bos',  spanish: 'el bosque',        article: 'het', emoji: '🌲', color: '#0a3d9e', exampleNl: 'Het bos is mooi.',            exampleEs: 'El bosque es hermoso.',        category: 'kort', difficulty: 'A0' },
        { id: 'm1l6v-zee',   dutch: 'de zee',   spanish: 'el mar',           article: 'de',  emoji: '🌊', color: '#1440a0', exampleNl: 'De zee is mooi.',             exampleEs: 'El mar es hermoso.',           category: 'lang', difficulty: 'A0' },
        { id: 'm1l6v-krant', dutch: 'de krant', spanish: 'el periódico',     article: 'de',  emoji: '📰', color: '#0d5bbf', exampleNl: 'Ik lees een krant.',          exampleEs: 'Leo un periódico.',            category: 'kort', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm1l6p-1',  dutch: 'De kat slaapt.',      spanish: 'El gato duerme.',          context: 'Vocal corta' },
        { id: 'm1l6p-2',  dutch: 'Ik pak de tas.',      spanish: 'Cojo el bolso.',           context: 'Vocal corta' },
        { id: 'm1l6p-3',  dutch: 'Ik heb een pen.',     spanish: 'Tengo un bolígrafo.',      context: 'Vocal corta' },
        { id: 'm1l6p-4',  dutch: 'De vis zwemt.',       spanish: 'El pez nada.',             context: 'Vocal corta' },
        { id: 'm1l6p-5',  dutch: 'De zon schijnt.',     spanish: 'El sol brilla.',           context: 'Vocal corta' },
        { id: 'm1l6p-6',  dutch: 'Het bos is mooi.',    spanish: 'El bosque es hermoso.',    context: 'Vocal corta' },
        { id: 'm1l6p-7',  dutch: 'De klok klinkt.',     spanish: 'El reloj suena.',          context: 'Vocal corta' },
        { id: 'm1l6p-8',  dutch: 'De bus komt.',        spanish: 'El autobús viene.',        context: 'Vocal corta' },
        { id: 'm1l6p-9',  dutch: 'Ik eet kaas.',        spanish: 'Como queso.',              context: 'Vocal larga' },
        { id: 'm1l6p-10', dutch: 'Ik lees een krant.',  spanish: 'Leo un periódico.',        context: 'Vocal larga' },
        { id: 'm1l6p-11', dutch: 'De boom is groot.',   spanish: 'El árbol es grande.',      context: 'Vocal larga' },
        { id: 'm1l6p-12', dutch: 'Ik koop brood.',      spanish: 'Compro pan.',              context: 'Vocal larga' },
        { id: 'm1l6p-13', dutch: 'Ik woon hier.',       spanish: 'Vivo aquí.',               context: 'Vocal larga' },
        { id: 'm1l6p-14', dutch: 'De zee is mooi.',     spanish: 'El mar es hermoso.',       context: 'Vocal larga' },
        { id: 'm1l6p-15', dutch: 'Het vuur is hoog.',   spanish: 'El fuego es alto.',        context: 'Vocal larga' },
      ],
    },
    {
      type: 'lezen',
      title: 'De zon, de maan en het park',
      textNl: `De zon schijnt. David zit in het park onder een boom. Hij eet brood met kaas en leest de krant. In de krant staat goed nieuws: mooi weer vandaag!

In het park is het druk. Een man loopt met een hond. De hond kijkt naar het brood van David — maar dat brood is voor David! Bij de bushalte stopt de bus. Zijn buurvrouw Els stapt uit en komt even in het park zitten.

David oefent de klanken van deze les. De man loopt in het park, en de maan staat in de lucht. De bus rijdt door de straat, en de buur zit op de bank. Kort en lang: dat is het verschil, en soms verandert één klinker het hele woord.

’s Avonds is David thuis. Hij kijkt uit het raam. De maan is groot en geel. De stad is stil. Nederland is mooi, denkt David. De taal is niet makkelijk, maar hij leert elke dag. En morgen? Weer brood met kaas in het park!`,
      textEs: `El sol brilla. David está sentado en el parque bajo un árbol. Come pan con queso y lee el periódico. En el periódico hay buenas noticias: ¡buen tiempo hoy!

En el parque hay mucha gente. Un hombre pasea con un perro. El perro mira el pan de David — ¡pero ese pan es para David! En la parada se detiene el autobús. Su vecina Els se baja y se sienta un rato en el parque.

David practica los sonidos de esta lección. El hombre (man) camina por el parque, y la luna (maan) está en el cielo. El autobús (bus) pasa por la calle, y la vecina (buur) está sentada en el banco. Corta y larga: esa es la diferencia, y a veces una sola vocal cambia toda la palabra.

Por la noche, David está en casa. Mira por la ventana. La luna es grande y amarilla. La ciudad está en silencio. Países Bajos es bonito, piensa David. El idioma no es fácil, pero aprende cada día. ¿Y mañana? ¡Otra vez pan con queso en el parque!`,
      exercises: [
        { id: 'm1l6lz-1', type: 'multiple_choice', prompt: '¿Dónde está sentado David?', options: ['Bajo un árbol', 'En el autobús', 'En casa', 'En la playa'], correctAnswer: 'Bajo un árbol', explanation: '"David zit in het park onder een boom."' },
        { id: 'm1l6lz-2', type: 'multiple_choice', prompt: '¿Qué come David?', options: ['Pan con queso', 'Una pera', 'Pasta', 'Sopa'], correctAnswer: 'Pan con queso', explanation: '"Hij eet brood met kaas."' },
        { id: 'm1l6lz-3', type: 'multiple_choice', prompt: '¿Qué pone el periódico?', options: ['Buen tiempo hoy', 'Llueve mañana', 'La luna es amarilla', 'El parque cierra'], correctAnswer: 'Buen tiempo hoy', explanation: '"In de krant staat goed nieuws: mooi weer vandaag!"' },
        { id: 'm1l6lz-4', type: 'multiple_choice', prompt: '¿Qué mira el perro?', options: ['El pan de David', 'La luna', 'El periódico', 'El autobús'], correctAnswer: 'El pan de David', explanation: '"De hond kijkt naar het brood van David."' },
        { id: 'm1l6lz-5', type: 'multiple_choice', prompt: '¿Quién se baja del autobús?', options: ['Su vecina Els', 'Anna', 'Su hermana', 'Un médico'], correctAnswer: 'Su vecina Els', explanation: '"Zijn buurvrouw Els stapt uit" — de buur = el vecino/la vecina.' },
        { id: 'm1l6lz-6', type: 'fill_blank', prompt: 'De maan is groot en ___. (amarilla)', correctAnswer: 'geel', hint: 'Vocal larga: ee', explanation: '"Geel" (amarillo) lleva vocal larga; "geld" (dinero) corta.' },
        { id: 'm1l6lz-7', type: 'multiple_choice', prompt: 'Según el texto, ¿quién camina por el parque y qué está en el cielo?', options: ['El hombre (man) camina; la luna (maan) está en el cielo', 'La luna camina; el hombre está en el cielo', 'Los dos caminan', 'Ninguno'], correctAnswer: 'El hombre (man) camina; la luna (maan) está en el cielo', explanation: 'man (a corta) = hombre · maan (aa larga) = luna.' },
        { id: 'm1l6lz-8', type: 'fill_blank', prompt: 'Hij leest de ___. (el periódico)', correctAnswer: 'krant', hint: 'de …', explanation: '"De krant" = el periódico.' },
        { id: 'm1l6lz-9', type: 'multiple_choice', prompt: '¿Qué va a hacer David mañana?', options: ['Comer pan con queso en el parque otra vez', 'Ir a Argentina', 'Comprar un perro', 'Tomar el autobús 25'], correctAnswer: 'Comer pan con queso en el parque otra vez', explanation: '"En morgen? Weer brood met kaas in het park!"' },
      ],
    },
    {
      // Diálogo de la presentación (Les 6 · tres partes). Está escrito para
      // que suenen los pares de vocal corta y larga: maan/man, boot/bot,
      // muur/duur, zon/zoon.
      type: 'dialogue',
      dialogue: {
        id: 'm1d6',
        title: 'De zesde ontmoeting',
        context: 'Anna en David praten over de maan, over de fiets van Anna en over de bus. Let op de klinkers: maan en man, boot en bot, zon en zoon.',
        lines: [
          { id: 'm1d6-1', speaker: 'Anna', dutch: 'Goedemorgen David!', spanish: '¡Buenos días, David!' },
          { id: 'm1d6-2', speaker: 'David', dutch: 'Goedemorgen Anna! Heb je de maan gezien?', spanish: '¡Buenos días, Anna! ¿Has visto la luna?' },
          { id: 'm1d6-3', speaker: 'Anna', dutch: 'Ja! Mooi is ze hè? Ik droom soms over een man op de maan.', spanish: '¡Sí! Es preciosa, ¿verdad? A veces sueño con un hombre en la luna.' },
          { id: 'm1d6-4', speaker: 'David', dutch: 'O ja?', spanish: '¿Ah, sí?' },
          { id: 'm1d6-5', speaker: 'Anna', dutch: 'Ja. Hij heeft een boot, gemaakt van bot.', spanish: 'Sí. Tiene un barco, hecho de hueso.' },
          { id: 'm1d6-6', speaker: 'David', dutch: 'Echt? Wat bijzonder. Maar ik heb liever een fiets.', spanish: '¿En serio? Qué especial. Pero yo prefiero una bici.' },
          { id: 'm1d6-7', speaker: 'Anna', dutch: 'Ik ook! Alleen is mijn wiel stuk, dus ik wil straks even naar de fietsenmaker.', spanish: '¡Yo también! Solo que se me rompió una rueda, así que quiero ir al taller de bicis más tarde.' },
          { id: 'm1d6-8', speaker: 'David', dutch: 'Waar staat je fiets?', spanish: '¿Dónde está tu bici?' },
          { id: 'm1d6-9', speaker: 'Anna', dutch: 'Daar bij de muur. Hij is geel en heeft me veel geld gekost.', spanish: 'Allí, junto a la pared. Es amarilla y me costó un dineral.' },
          { id: 'm1d6-10', speaker: 'David', dutch: 'Het is ook echt een mooie fiets. Je kunt zien dat hij duur was.', spanish: 'Es una bici preciosa. Se nota que fue cara.' },
          { id: 'm1d6-11', speaker: 'Anna', dutch: 'Zo duur dat ik soms de bus neem, haha.', spanish: 'Tan cara que a veces cojo el autobús, jaja.' },
          { id: 'm1d6-12', speaker: 'David', dutch: 'Ik vind het leuk om met de bus te gaan, zo zie ik veel van de stad.', spanish: 'Me gusta coger el autobús; así veo mucho de la ciudad.' },
          { id: 'm1d6-13', speaker: 'Anna', dutch: 'Ik vind geel een hele mooie kleur. Net als de zon! Dat zegt de zoon van mijn buurvrouw ook.', spanish: 'Creo que el amarillo es un color precioso. ¡Igual que el sol! El hijo de mi vecina también lo dice.' },
          { id: 'm1d6-14', speaker: 'David', dutch: 'Hij heeft helemaal gelijk!', spanish: '¡Tiene toda la razón!' },
        ],
      },
      exercises: [
        { id: 'm1d6q-1', type: 'multiple_choice', prompt: '¿Con qué sueña Anna a veces?', options: ['Con un hombre en la luna', 'Con una bici nueva', 'Con el mar', 'Con su vecina'], correctAnswer: 'Con un hombre en la luna', explanation: '"Ik droom soms over een man op de maan." Fíjate: man (hombre) y maan (luna) solo se distinguen por la vocal.' },
        { id: 'm1d6q-2', type: 'multiple_choice', prompt: '¿De qué está hecho el barco del sueño?', options: ['De hueso', 'De madera', 'De hierro', 'De papel'], correctAnswer: 'De hueso', explanation: '"Een boot, gemaakt van bot." Otro par: boot (barco) y bot (hueso).' },
        { id: 'm1d6q-3', type: 'multiple_choice', prompt: '¿Qué le pasa a la bici de Anna?', options: ['Tiene una rueda rota', 'Se la han robado', 'No tiene luces', 'Se ha quedado sin frenos'], correctAnswer: 'Tiene una rueda rota', explanation: '"Mijn wiel is stuk" — stuk = roto.' },
        { id: 'm1d6q-4', type: 'multiple_choice', prompt: '¿Adónde quiere ir Anna más tarde?', options: ['Al taller de bicis', 'A casa de su vecina', 'A la parada del autobús', 'A la playa'], correctAnswer: 'Al taller de bicis', explanation: '"Ik wil straks even naar de fietsenmaker." De fietsenmaker = quien arregla bicis.' },
        { id: 'm1d6q-5', type: 'multiple_choice', prompt: '¿De qué color es la bici y dónde está?', options: ['Amarilla, junto a la pared', 'Roja, en el portal', 'Amarilla, en el taller', 'Negra, junto a la pared'], correctAnswer: 'Amarilla, junto a la pared', explanation: '"Daar bij de muur. Hij is geel." Otro par de vocales: muur (pared) y duur (caro).' },
        { id: 'm1d6q-6', type: 'true_false', prompt: 'La bici de Anna fue barata.', correctAnswer: 'falso', explanation: '"Heeft me veel geld gekost" y "je kunt zien dat hij duur was" — le costó cara.' },
        { id: 'm1d6q-7', type: 'multiple_choice', prompt: '¿Por qué le gusta a David ir en autobús?', options: ['Porque así ve mucho de la ciudad', 'Porque es más barato', 'Porque no tiene bici', 'Porque llueve mucho'], correctAnswer: 'Porque así ve mucho de la ciudad', explanation: '"Zo zie ik veel van de stad."' },
        { id: 'm1d6q-8', type: 'multiple_choice', prompt: 'Al final Anna compara el amarillo con el sol. ¿Quién opina lo mismo?', options: ['El hijo de su vecina', 'Su vecina', 'David', 'El del taller'], correctAnswer: 'El hijo de su vecina', explanation: 'Aquí está el par estrella de la lección: zon (sol) y zoon (hijo). "De zoon van mijn buurvrouw".' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        // ── Opción múltiple ──
        { id: 'm1l6e-1',  type: 'multiple_choice', prompt: '¿Qué significa "de maan"?', options: ['La luna', 'El hombre', 'La pared', 'El mar'], correctAnswer: 'La luna', explanation: '"De maan" (aa larga) = luna; "de man" (a corta) = hombre.' },
        { id: 'm1l6e-2',  type: 'multiple_choice', prompt: '¿Cuál es el plural de "boom"?', options: ['bomen', 'boomen', 'booms', 'bomes'], correctAnswer: 'bomen', explanation: 'La sílaba se abre (bo-men) y basta una vocal: boom → bomen.' },
        { id: 'm1l6e-3',  type: 'multiple_choice', prompt: '¿Cuál de estas palabras tiene vocal LARGA?', options: ['kaas', 'kam', 'kat', 'bus'], correctAnswer: 'kaas', explanation: 'La doble "aa" de kaas se pronuncia larga; kam, kat y bus llevan vocal corta.' },
        { id: 'm1l6e-4',  type: 'multiple_choice', prompt: 'Una sílaba CERRADA termina en…', options: ['consonante', 'vocal', 'dos vocales', 'la letra n'], correctAnswer: 'consonante', explanation: 'Cerrada = termina en consonante (man, kat); abierta = termina en vocal (ma-, ka-).' },
        // ── Verdadero / Falso ──
        { id: 'm1l6e-5',  type: 'true_false', prompt: '"Kam" y "kaas" se pronuncian con la misma "a".', correctAnswer: 'falso', explanation: 'La "a" de kam es corta; la "aa" de kaas es larga. ¡Y cambia el significado!' },
        { id: 'm1l6e-6',  type: 'true_false', prompt: '"Maan" y la primera sílaba de "manen" suenan exactamente igual.', correctAnswer: 'verdadero', explanation: 'Solo cambia la ortografía, no la pronunciación.' },
        { id: 'm1l6e-7',  type: 'true_false', prompt: '"Geel" significa dinero.', correctAnswer: 'falso', explanation: '"Geel" (ee larga) = amarillo; "geld" (e corta) = dinero.' },
        // ── Completar ──
        { id: 'm1l6e-8',  type: 'fill_blank', prompt: 'De ___ schijnt. (el sol)', correctAnswer: 'zon', hint: 'Vocal corta' },
        { id: 'm1l6e-9',  type: 'fill_blank', prompt: 'Plural: één boom, twee ___', correctAnswer: 'bomen', hint: 'La sílaba se abre: una sola o' },
        { id: 'm1l6e-10', type: 'fill_blank', prompt: 'Plural: één muur, twee ___', correctAnswer: 'muren', hint: 'muur → mu-ren' },
        { id: 'm1l6e-11', type: 'fill_blank', prompt: 'Ik eet brood met ___. (queso)', correctAnswer: 'kaas', hint: 'Vocal larga: aa' },
        // ── Ordenar frases ──
        { id: 'm1l6e-12', type: 'order_sentence', prompt: 'Ordena: "El árbol es grande."', options: ['De', 'boom', 'is', 'groot'], correctAnswer: 'De boom is groot' },
        { id: 'm1l6e-13', type: 'order_sentence', prompt: 'Ordena: "Leo un periódico."', options: ['Ik', 'lees', 'een', 'krant'], correctAnswer: 'Ik lees een krant' },
        // ── Sopa de letras ──
        { id: 'm1l6e-14', type: 'word_scramble', prompt: '¿Cómo se dice "el periódico"?', correctAnswer: 'krant', hint: 'de …' },
        { id: 'm1l6e-15', type: 'word_scramble', prompt: '¿Cómo se dice "el vecino"?', correctAnswer: 'buur', hint: 'Vocal larga: uu' },
        // ── Letras que faltan ──
        { id: 'm1l6e-16', type: 'letter_dash', prompt: 'Completa: "el pan"', correctAnswer: 'brood', hint: 'Ik koop … (vocal larga oo)' },
        { id: 'm1l6e-17', type: 'letter_dash', prompt: 'Completa: "la pared"', correctAnswer: 'muur', hint: 'Vocal larga uu' },
        // ── Unir parejas ──
        { id: 'm1l6e-18', type: 'match_pairs', prompt: 'Une cada palabra con su traducción (¡ojo con las parejas mínimas!)', correctAnswer: '', pairs: [
          { left: 'de man', right: 'el hombre' },
          { left: 'de maan', right: 'la luna' },
          { left: 'het geld', right: 'el dinero' },
          { left: 'geel', right: 'amarillo' },
          { left: 'de bus', right: 'el autobús' },
          { left: 'de buur', right: 'el vecino' },
        ] },
        { id: 'm1l6e-19', type: 'match_pairs', prompt: 'Une cada palabra con su traducción', correctAnswer: '', pairs: [
          { left: 'de kam', right: 'el peine' },
          { left: 'de kaas', right: 'el queso' },
          { left: 'de pet', right: 'la gorra' },
          { left: 'de peer', right: 'la pera' },
          { left: 'de bol', right: 'la bola' },
          { left: 'de boom', right: 'el árbol' },
        ] },
        // ── Emoji ──
        { id: 'm1l6e-20', type: 'emoji_choice', prompt: '¿Qué emoji representa "de boom"?', options: ['🌳', '🌙', '🧀', '🚌'], correctAnswer: '🌳', explanation: '"De boom" = el árbol (oo larga).' },
        { id: 'm1l6e-21', type: 'emoji_choice', prompt: '¿Qué emoji representa "de kaas"?', options: ['🧀', '🧢', '🍐', '📰'], correctAnswer: '🧀', explanation: '"De kaas" = el queso (aa larga).' },
        // ── El intruso ──
        { id: 'm1l6e-22', type: 'odd_one_out', prompt: '¿Cuál tiene vocal CORTA? (las otras son largas)', options: ['kaas', 'peer', 'boom', 'pet'], correctAnswer: 'pet', explanation: 'Pet (gorra) lleva "e" corta; kaas, peer y boom llevan vocal larga.' },
        { id: 'm1l6e-23', type: 'odd_one_out', prompt: '¿Cuál tiene vocal LARGA? (las otras son cortas)', options: ['man', 'kat', 'bus', 'maan'], correctAnswer: 'maan', explanation: 'Maan (luna) lleva "aa" larga; man, kat y bus son cortas.' },
        // ── Escribir ──
        { id: 'm1l6e-24', type: 'write_answer', prompt: 'Escribe el plural de "muur"', correctAnswer: 'muren', hint: 'La sílaba se abre: una sola u' },
        { id: 'm1l6e-25', type: 'write_answer', prompt: 'Escribe en neerlandés: "El sol brilla"', correctAnswer: 'De zon schijnt', hint: 'Sin punto final' },
        // ── Escuchar ──
        { id: 'm1l6e-26', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "maan"', options: ['maan', 'man', 'manen', 'mannen'], correctAnswer: 'maan', explanation: 'La "aa" larga te dice que es maan (luna), no man (hombre).' },
        { id: 'm1l6e-27', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "buur"', options: ['buur', 'bus', 'boer', 'bar'], correctAnswer: 'buur' },
        { id: 'm1l6e-28', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "peer"', options: ['peer', 'pet', 'per', 'peren'], correctAnswer: 'peer' },
        { id: 'm1l6e-29', type: 'listen_translate', prompt: 'Escucha y traduce: "De kat slaapt"', options: ['El', 'gato', 'duerme', 'come', 'perro', 'La'], correctAnswer: 'El gato duerme' },
        { id: 'm1l6e-30', type: 'listen_translate', prompt: 'Escucha y traduce: "Het bos is mooi"', options: ['El', 'bosque', 'es', 'hermoso', 'mar', 'grande'], correctAnswer: 'El bosque es hermoso' },
        // ── Comprensión del diálogo (De zesde ontmoeting) ──
        { id: 'm1l6e-31', type: 'multiple_choice', prompt: 'En el diálogo, Anna dice de broma que come queso con…', options: ['Un peine (kam)', 'Una gorra (pet)', 'Una bola (bol)', 'Un periódico (krant)'], correctAnswer: 'Un peine (kam)', explanation: '"Ik eet kaas met een kam" — y David la corrige: ¡el peine es para el pelo!' },
        { id: 'm1l6e-32', type: 'true_false', prompt: 'La "a" de "man" es larga.', correctAnswer: 'falso', explanation: 'Es corta; la larga es la "aa" de "maan".' },
        { id: 'm1l6e-33', type: 'true_false', prompt: 'Esta noche David va a mirar la luna.', correctAnswer: 'verdadero', explanation: '"Vanavond kijk ik naar de maan."' },
      ],
    },
    { type: 'review' },
  ],
};

const m1_extra1: Lesson = {
  id: 'extra-kleuren',
  moduleId: 'over-jou',
  title: 'Extra | Kleuren',
  subtitle: 'Los colores',
  order: 1,
  isExtra: true,
  learningObjective: 'Conocer y usar los colores en neerlandés',
  estimatedMinutes: 10,
  blocks: [
    {
      type: 'vocabulary',
      items: [
        { id: 'rood', dutch: 'rood', spanish: 'rojo', article: null, emoji: '🔴', color: '#1D0084', exampleNl: 'De auto is rood.', exampleEs: 'El coche es rojo.', category: 'kleuren', difficulty: 'A0' },
        { id: 'blauw', dutch: 'blauw', spanish: 'azul', article: null, emoji: '🔵', color: '#025dc7', exampleNl: 'De lucht is blauw.', exampleEs: 'El cielo es azul.', category: 'kleuren', difficulty: 'A0' },
        { id: 'groen', dutch: 'groen', spanish: 'verde', article: null, emoji: '🟢', color: '#0b4db5', exampleNl: 'Het gras is groen.', exampleEs: 'La hierba es verde.', category: 'kleuren', difficulty: 'A0' },
        { id: 'geel', dutch: 'geel', spanish: 'amarillo', article: null, emoji: '🟡', color: '#0a3d9e', exampleNl: 'De zon is geel.', exampleEs: 'El sol es amarillo.', category: 'kleuren', difficulty: 'A0' },
        { id: 'oranje', dutch: 'oranje', spanish: 'naranja', article: null, emoji: '🟠', color: '#1440a0', exampleNl: 'Het shirt van het elftal is oranje.', exampleEs: 'La camiseta del equipo es naranja.', category: 'kleuren', difficulty: 'A0' },
        { id: 'wit', dutch: 'wit', spanish: 'blanco', article: null, emoji: '⬜', color: '#0d5bbf', exampleNl: 'De muren zijn wit.', exampleEs: 'Las paredes son blancas.', category: 'kleuren', difficulty: 'A0' },
        { id: 'zwart', dutch: 'zwart', spanish: 'negro', article: null, emoji: '⬛', color: '#1D0084', exampleNl: 'Mijn jas is zwart.', exampleEs: 'Mi chaqueta es negra.', category: 'kleuren', difficulty: 'A0' },
        { id: 'grijs', dutch: 'grijs', spanish: 'gris', article: null, emoji: '🩶', color: '#025dc7', exampleNl: 'De lucht is grijs vandaag.', exampleEs: 'El cielo está gris hoy.', category: 'kleuren', difficulty: 'A0' },
        { id: 'bruin', dutch: 'bruin', spanish: 'marrón', article: null, emoji: '🟫', color: '#0b4db5', exampleNl: 'Mijn haar is bruin.', exampleEs: 'Mi cabello es marrón.', category: 'kleuren', difficulty: 'A0' },
        { id: 'roze', dutch: 'roze', spanish: 'rosa', article: null, emoji: '🩷', color: '#0a3d9e', exampleNl: 'Haar jurk is roze.', exampleEs: 'Su vestido es rosa.', category: 'kleuren', difficulty: 'A0' },
        { id: 'paars', dutch: 'paars', spanish: 'morado / violeta', article: null, emoji: '🟣', color: '#1440a0', exampleNl: 'De bloem is paars.', exampleEs: 'La flor es morada.', category: 'kleuren', difficulty: 'A0' },
        { id: 'lichtblauw', dutch: 'lichtblauw', spanish: 'azul claro', article: null, emoji: '🩵', color: '#0d5bbf', exampleNl: 'De baby draagt lichtblauwe kleren.', exampleEs: 'El bebé lleva ropa azul claro.', category: 'kleuren', difficulty: 'A1' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'pk1-1', dutch: 'Wat is jouw lievelingskleur?', spanish: '¿Cuál es tu color favorito?', context: 'Colores' },
        { id: 'pk1-2', dutch: 'Mijn lievelingskleur is blauw.', spanish: 'Mi color favorito es el azul.', context: 'Colores' },
        { id: 'pk1-3', dutch: 'Welke kleur heeft die auto?', spanish: '¿De qué color es ese coche?', context: 'Descripción' },
        { id: 'pk1-4', dutch: 'Ik draag graag zwarte kleren.', spanish: 'Me gusta llevar ropa negra.', context: 'Ropa' },
        { id: 'pk1-5', dutch: 'De Nederlandse vlag is rood, wit en blauw.', spanish: 'La bandera neerlandesa es roja, blanca y azul.', context: 'Cultura' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        { id: 'ek1-1', type: 'multiple_choice', prompt: '¿Cómo se dice "verde" en neerlandés?', options: ['blauw', 'geel', 'groen', 'grijs'], correctAnswer: 'groen' },
        { id: 'ek1-2', type: 'fill_blank', prompt: 'De Nederlandse vlag is rood, ___ en blauw.', correctAnswer: 'wit', hint: 'Color que va en el medio' },
        { id: 'ek1-3', type: 'multiple_choice', prompt: '¿Qué color es "oranje"?', options: ['amarillo', 'naranja', 'rojo', 'marrón'], correctAnswer: 'naranja' },
        { id: 'ek1-4', type: 'fill_blank', prompt: 'De lucht is ___ vandaag. (azul)', correctAnswer: 'blauw' },
        { id: 'ek1-5', type: 'multiple_choice', prompt: '"Zwart" significa:', options: ['blanco', 'gris', 'negro', 'marrón'], correctAnswer: 'negro' },
      ],
    },
    { type: 'review' },
  ],
};

const m1_extra2: Lesson = {
  id: 'extra-basisvragen',
  moduleId: 'over-jou',
  title: 'Extra | Basisvragen',
  subtitle: 'Preguntas básicas',
  order: 2,
  isExtra: true,
  learningObjective: 'Hacer y responder preguntas básicas en neerlandés',
  estimatedMinutes: 10,
  blocks: [
    {
      type: 'vocabulary',
      items: [
        { id: 'wie', dutch: 'wie', spanish: 'quién', article: null, emoji: '🙋', color: '#1D0084', exampleNl: 'Wie is dat?', exampleEs: '¿Quién es ese?', category: 'vragen', difficulty: 'A0' },
        { id: 'wat', dutch: 'wat', spanish: 'qué', article: null, emoji: '❓', color: '#025dc7', exampleNl: 'Wat doe je?', exampleEs: '¿Qué haces?', category: 'vragen', difficulty: 'A0' },
        { id: 'waar', dutch: 'waar', spanish: 'dónde', article: null, emoji: '📍', color: '#0b4db5', exampleNl: 'Waar woon je?', exampleEs: '¿Dónde vives?', category: 'vragen', difficulty: 'A0' },
        { id: 'wanneer', dutch: 'wanneer', spanish: 'cuándo', article: null, emoji: '📅', color: '#0a3d9e', exampleNl: 'Wanneer kom je?', exampleEs: '¿Cuándo vienes?', category: 'vragen', difficulty: 'A0' },
        { id: 'waarom', dutch: 'waarom', spanish: 'por qué', article: null, emoji: '🤔', color: '#1440a0', exampleNl: 'Waarom leer je Nederlands?', exampleEs: '¿Por qué aprendes neerlandés?', category: 'vragen', difficulty: 'A0' },
        { id: 'hoe', dutch: 'hoe', spanish: 'cómo', article: null, emoji: '💭', color: '#0d5bbf', exampleNl: 'Hoe gaat het?', exampleEs: '¿Cómo estás?', category: 'vragen', difficulty: 'A0' },
        { id: 'welk', dutch: 'welk / welke', spanish: 'cuál / qué (con sustantivo)', article: null, emoji: '🗂️', color: '#1D0084', exampleNl: 'Welke taal spreek je?', exampleEs: '¿Qué idioma hablas?', category: 'vragen', difficulty: 'A0' },
        { id: 'hoeveel', dutch: 'hoeveel', spanish: 'cuánto / cuántos', article: null, emoji: '🔢', color: '#025dc7', exampleNl: 'Hoeveel kost dat?', exampleEs: '¿Cuánto cuesta eso?', category: 'vragen', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'pbv-1', dutch: 'Hoe gaat het met jou?', spanish: '¿Cómo estás?', context: 'Saludo' },
        { id: 'pbv-2', dutch: 'Waar kom jij vandaan?', spanish: '¿De dónde eres?', context: 'Origen' },
        { id: 'pbv-3', dutch: 'Waarom leer je Nederlands?', spanish: '¿Por qué aprendes neerlandés?', context: 'Motivación' },
        { id: 'pbv-4', dutch: 'Wanneer heb je les?', spanish: '¿Cuándo tienes clase?', context: 'Horario' },
        { id: 'pbv-5', dutch: 'Hoeveel talen spreek jij?', spanish: '¿Cuántos idiomas hablas?', context: 'Idiomas' },
        { id: 'pbv-6', dutch: 'Welke films kijk jij graag?', spanish: '¿Qué películas te gustan?', context: 'Gustos' },
        { id: 'pbv-7', dutch: 'Wat is jouw favoriete eten?', spanish: '¿Cuál es tu comida favorita?', context: 'Comida' },
        { id: 'pbv-8', dutch: 'Wie is jouw leraar?', spanish: '¿Quién es tu profesor/a?', context: 'Personas' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        { id: 'ebv-1', type: 'multiple_choice', prompt: '¿Cómo se dice "¿Por qué?" en neerlandés?', options: ['wanneer', 'waarom', 'waardoor', 'waarvoor'], correctAnswer: 'waarom' },
        { id: 'ebv-2', type: 'fill_blank', prompt: '___ kost dat? (¿Cuánto cuesta eso?)', correctAnswer: 'Hoeveel' },
        { id: 'ebv-3', type: 'multiple_choice', prompt: '"Waar woon jij?" significa:', options: ['¿Cuándo vives?', '¿Dónde vives?', '¿Por qué vives aquí?', '¿Cómo vives?'], correctAnswer: '¿Dónde vives?' },
        { id: 'ebv-4', type: 'fill_blank', prompt: '___ talen spreek jij? (¿Cuántos idiomas hablas?)', correctAnswer: 'Hoeveel' },
        { id: 'ebv-5', type: 'order_sentence', prompt: 'Ordena: "¿Por qué aprendes neerlandés?"', options: ['Waarom', 'leer', 'jij', 'Nederlands'], correctAnswer: 'Waarom leer jij Nederlands' },
        { id: 'ebv-6', type: 'multiple_choice', prompt: '"Welke" se usa antes de:', options: ['verbos', 'pronombres', 'sustantivos', 'adjetivos'], correctAnswer: 'sustantivos', explanation: '"Welke film?" / "Welk boek?" — siempre acompaña a un sustantivo.' },
      ],
    },
    { type: 'review' },
  ],
};

const m1_extra3: Lesson = {
  id: 'extra-landen-talen',
  moduleId: 'over-jou',
  title: 'Extra | Landen en talen',
  subtitle: 'Países e idiomas',
  order: 3,
  isExtra: true,
  learningObjective: 'Hablar sobre países, nacionalidades e idiomas',
  estimatedMinutes: 10,
  blocks: [
    {
      type: 'vocabulary',
      items: [
        { id: 'nederland', dutch: 'Nederland', spanish: 'Países Bajos / Holanda', article: null, emoji: '🇳🇱', color: '#1D0084', exampleNl: 'Ik woon in Nederland.', exampleEs: 'Vivo en los Países Bajos.', category: 'landen', difficulty: 'A0' },
        { id: 'belgie', dutch: 'België', spanish: 'Bélgica', article: null, emoji: '🇧🇪', color: '#025dc7', exampleNl: 'In België spreken ze ook Nederlands.', exampleEs: 'En Bélgica también hablan neerlandés.', category: 'landen', difficulty: 'A0' },
        { id: 'spanje', dutch: 'Spanje', spanish: 'España', article: null, emoji: '🇪🇸', color: '#0b4db5', exampleNl: 'Ik kom uit Spanje.', exampleEs: 'Soy de España.', category: 'landen', difficulty: 'A0' },
        { id: 'duitsland', dutch: 'Duitsland', spanish: 'Alemania', article: null, emoji: '🇩🇪', color: '#0a3d9e', exampleNl: 'Duitsland is een buur van Nederland.', exampleEs: 'Alemania es vecina de los Países Bajos.', category: 'landen', difficulty: 'A0' },
        { id: 'frankrijk', dutch: 'Frankrijk', spanish: 'Francia', article: null, emoji: '🇫🇷', color: '#1440a0', exampleNl: 'Ik ga op vakantie naar Frankrijk.', exampleEs: 'Voy de vacaciones a Francia.', category: 'landen', difficulty: 'A0' },
        { id: 'italie', dutch: 'Italië', spanish: 'Italia', article: null, emoji: '🇮🇹', color: '#0d5bbf', exampleNl: 'Marco komt uit Italië.', exampleEs: 'Marco es de Italia.', category: 'landen', difficulty: 'A0' },
        { id: 'engels', dutch: 'Engels', spanish: 'inglés', article: null, emoji: '🇬🇧', color: '#1D0084', exampleNl: 'Ik spreek ook Engels.', exampleEs: 'También hablo inglés.', category: 'talen', difficulty: 'A0' },
        { id: 'spaans', dutch: 'Spaans', spanish: 'español', article: null, emoji: '🗣️', color: '#025dc7', exampleNl: 'Spaans is mijn moedertaal.', exampleEs: 'El español es mi lengua materna.', category: 'talen', difficulty: 'A0' },
        { id: 'duits', dutch: 'Duits', spanish: 'alemán', article: null, emoji: '🇩🇪', color: '#0b4db5', exampleNl: 'Ik leer ook een beetje Duits.', exampleEs: 'También aprendo un poco de alemán.', category: 'talen', difficulty: 'A0' },
        { id: 'Frans', dutch: 'Frans', spanish: 'francés', article: null, emoji: '🇫🇷', color: '#0a3d9e', exampleNl: 'Spreek jij Frans?', exampleEs: '¿Hablas francés?', category: 'talen', difficulty: 'A0' },
        { id: 'marokkaans', dutch: 'Marokkaans', spanish: 'marroquí / árabe marroquí', article: null, emoji: '🇲🇦', color: '#1440a0', exampleNl: 'Zij spreekt Marokkaans thuis.', exampleEs: 'Ella habla árabe marroquí en casa.', category: 'talen', difficulty: 'A1' },
        { id: 'turks', dutch: 'Turks', spanish: 'turco', article: null, emoji: '🇹🇷', color: '#0d5bbf', exampleNl: 'Turks is een mooie taal.', exampleEs: 'El turco es un idioma bonito.', category: 'talen', difficulty: 'A1' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'plt-1', dutch: 'Ik kom uit Spanje, maar ik woon in Nederland.', spanish: 'Soy de España, pero vivo en los Países Bajos.', context: 'Origen y residencia' },
        { id: 'plt-2', dutch: 'Welke talen spreek jij?', spanish: '¿Qué idiomas hablas?', context: 'Idiomas' },
        { id: 'plt-3', dutch: 'Ik spreek Spaans, Engels en een beetje Nederlands.', spanish: 'Hablo español, inglés y un poco de neerlandés.', context: 'Idiomas propios' },
        { id: 'plt-4', dutch: 'In Nederland spreken ze Nederlands.', spanish: 'En los Países Bajos hablan neerlandés.', context: 'Países y lenguas' },
        { id: 'plt-5', dutch: 'Mijn moedertaal is Spaans.', spanish: 'Mi lengua materna es el español.', context: 'Lengua materna' },
        { id: 'plt-6', dutch: 'In België spreken ze ook Nederlands, Frans en Duits.', spanish: 'En Bélgica también hablan neerlandés, francés y alemán.', context: 'Bélgica' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        { id: 'elt-1', type: 'multiple_choice', prompt: '¿Cómo se dice "Alemania" en neerlandés?', options: ['Duitsland', 'Denemarken', 'Engeland', 'Duitsen'], correctAnswer: 'Duitsland' },
        { id: 'elt-2', type: 'fill_blank', prompt: 'In ___ spreken ze ook Nederlands. (Bélgica)', correctAnswer: 'België' },
        { id: 'elt-3', type: 'multiple_choice', prompt: '"Spaans" en neerlandés significa:', options: ['español (el idioma)', 'España (el país)', 'español (la persona)', 'hablar español'], correctAnswer: 'español (el idioma)' },
        { id: 'elt-4', type: 'fill_blank', prompt: 'Mijn ___ is Spaans. (lengua materna)', correctAnswer: 'moedertaal' },
        { id: 'elt-5', type: 'multiple_choice', prompt: '¿Cómo se dice "Francia" en neerlandés?', options: ['Frankijk', 'Frankrijk', 'Francio', 'Frans'], correctAnswer: 'Frankrijk' },
      ],
    },
    { type: 'review' },
  ],
};


/* ─────────────────────────────────────────────────────────────────────────────
   MODULE 2 — FAMILIE & VRIENDEN
───────────────────────────────────────────────────────────────────────────── */

const m2_les1: Lesson = {
  id: 'm2-les-1-familie',
  moduleId: 'familie-vrienden',
  title: 'Les 1 — Woordenschat | Familie & relaties',
  subtitle: 'La familia, las relaciones y cómo presentar a alguien',
  order: 1,
  learningObjective: 'Hablar de tu familia y presentar a las personas importantes de tu vida',
  estimatedMinutes: 30,
  blocks: [
    {
      type: 'summary',
      title: 'Familie & relaties',
      intro: 'En este módulo hablas de las personas importantes de tu vida. Hoy: el vocabulario de la familia y las relaciones, y la frase más usada para presentar a alguien: "Dit is mijn moeder".',
      objectives: [
        'Usar las palabras de la familia y las relaciones',
        'Presentar a una persona (Dit is…) o a varias (Dit zijn…)',
        'Hablar de tu propia familia con "mijn"',
      ],
      sections: [
        {
          heading: '👪 La familia básica',
          items: [
            { nl: 'de vader / de moeder', es: 'el padre / la madre (papa / mama)' },
            { nl: 'de broer / de zus', es: 'el hermano / la hermana' },
            { nl: 'de zoon / de dochter', es: 'el hijo / la hija' },
            { nl: 'de opa / de oma', es: 'el abuelo / la abuela' },
            { nl: 'het kind → de kinderen', es: 'el niño/hijo → los niños/hijos' },
            { nl: 'de ouders', es: 'los padres' },
          ],
        },
        {
          heading: '❤️ Las relaciones — ¡ojo con vriend!',
          body: '**De vriend** significa novio Y amigo; **de vriendin**, novia Y amiga. El contexto (o "mijn" vs "een") lo aclara: *Hij is mijn vriend* = es mi novio · *Hij is een vriend* = es un amigo. **De partner** = la pareja.',
          items: [
            { nl: 'mijn vriend / mijn vriendin', es: 'mi novio / mi novia' },
            { nl: 'een vriend / een vriendin', es: 'un amigo / una amiga' },
            { nl: 'de partner', es: 'la pareja' },
          ],
        },
        {
          heading: '🏠 Gezin vs. familie',
          body: '**Het gezin** = la familia con la que vives (padres e hijos). **De familie** = toda la familia (abuelos, tíos, primos…). *Dit is mijn gezin* · *Mijn familie is groot*.',
        },
        {
          heading: '👉 Presentar a alguien: Dit is / Dit zijn',
          body: '**Dit is** + 1 persona · **Dit zijn** + varias personas. *Dit is mijn moeder* · *Dit zijn mijn ouders*. Ojo: "dit" NO cambia como este/esta en español. También puedes decir: *Hij is mijn…* (él es mi…), *Zij is mijn…* (ella es mi…), *Zij zijn mijn…* (ellos son mis…).',
        },
        {
          heading: '🔑 El posesivo mijn',
          body: '**Mijn** = mi y mis — nunca cambia: *mijn moeder, mijn ouders*. Pronunciación: la **ij** de mijn suena parecida al "ei" español de "peine".',
        },
      ],
      tip: 'El error clásico: mezclar "is" y "zijn" al presentar. Cuenta las personas: UNA → **Dit is** mijn moeder · VARIAS → **Dit zijn** mijn ouders.',
    },
    {
      type: 'vocabulary',
      items: [
        { id: 'm2l1v-vader',    dutch: 'de vader',    spanish: 'el padre',                 article: 'de',  emoji: '👨', color: '#0b7a4d', exampleNl: 'Mijn vader heet Carlos.',        exampleEs: 'Mi padre se llama Carlos.',        category: 'familie', difficulty: 'A0' },
        { id: 'm2l1v-moeder',   dutch: 'de moeder',   spanish: 'la madre',                 article: 'de',  emoji: '👩', color: '#1a7a40', exampleNl: 'Dit is mijn moeder.',            exampleEs: 'Esta es mi madre.',                category: 'familie', difficulty: 'A0' },
        { id: 'm2l1v-broer',    dutch: 'de broer',    spanish: 'el hermano',               article: 'de',  emoji: '👦', color: '#0d6e33', exampleNl: 'Dit is mijn broer.',             exampleEs: 'Este es mi hermano.',              category: 'familie', difficulty: 'A0' },
        { id: 'm2l1v-zus',      dutch: 'de zus',      spanish: 'la hermana',               article: 'de',  emoji: '👧', color: '#2e7d52', exampleNl: 'Mijn zus woont in Madrid.',      exampleEs: 'Mi hermana vive en Madrid.',       category: 'familie', difficulty: 'A0' },
        { id: 'm2l1v-zoon',     dutch: 'de zoon',     spanish: 'el hijo',                  article: 'de',  emoji: '🧒', color: '#0b7a4d', exampleNl: 'Hun zoon is vijf jaar.',         exampleEs: 'Su hijo tiene cinco años.',        category: 'familie', difficulty: 'A0' },
        { id: 'm2l1v-dochter',  dutch: 'de dochter',  spanish: 'la hija',                  article: 'de',  emoji: '👶', color: '#1a7a40', exampleNl: 'Dit zijn mijn dochters.',        exampleEs: 'Estas son mis hijas.',             category: 'familie', difficulty: 'A0' },
        { id: 'm2l1v-opa',      dutch: 'de opa',      spanish: 'el abuelo',                article: 'de',  emoji: '👴', color: '#0d6e33', exampleNl: 'Dit is mijn opa.',               exampleEs: 'Este es mi abuelo.',               category: 'familie', difficulty: 'A0' },
        { id: 'm2l1v-oma',      dutch: 'de oma',      spanish: 'la abuela',                article: 'de',  emoji: '👵', color: '#2e7d52', exampleNl: 'Mijn oma woont in Sevilla.',     exampleEs: 'Mi abuela vive en Sevilla.',       category: 'familie', difficulty: 'A0' },
        { id: 'm2l1v-kind',     dutch: 'het kind',    spanish: 'el niño / el hijo',        article: 'het', emoji: '🧸', color: '#0b7a4d', exampleNl: 'Het kind is vijf jaar.',         exampleEs: 'El niño tiene cinco años.',        category: 'familie', difficulty: 'A0' },
        { id: 'm2l1v-ouders',   dutch: 'de ouders',   spanish: 'los padres',               article: 'de',  emoji: '👫', color: '#1a7a40', exampleNl: 'Dit zijn mijn ouders.',          exampleEs: 'Estos son mis padres.',            category: 'familie', difficulty: 'A0' },
        { id: 'm2l1v-gezin',    dutch: 'het gezin',   spanish: 'la familia (con la que vives)', article: 'het', emoji: '🏠', color: '#0d6e33', exampleNl: 'Dit is mijn gezin.',        exampleEs: 'Esta es mi familia (de casa).',    category: 'familie', difficulty: 'A0' },
        { id: 'm2l1v-familie',  dutch: 'de familie',  spanish: 'la familia (toda)',        article: 'de',  emoji: '🌳', color: '#2e7d52', exampleNl: 'Mijn familie is groot.',         exampleEs: 'Mi familia es grande.',            category: 'familie', difficulty: 'A0' },
        { id: 'm2l1v-vriend',   dutch: 'de vriend',   spanish: 'el novio / el amigo',      article: 'de',  emoji: '🧑‍🦱', color: '#0b7a4d', exampleNl: 'Hij is mijn vriend.',          exampleEs: 'Él es mi novio.',                  category: 'relaties', difficulty: 'A0' },
        { id: 'm2l1v-vriendin', dutch: 'de vriendin', spanish: 'la novia / la amiga',      article: 'de',  emoji: '👱‍♀️', color: '#1a7a40', exampleNl: 'Zij is een vriendin.',        exampleEs: 'Ella es una amiga.',               category: 'relaties', difficulty: 'A0' },
        { id: 'm2l1v-partner',  dutch: 'de partner',  spanish: 'la pareja',                article: 'de',  emoji: '💑', color: '#0d6e33', exampleNl: 'Dit is mijn partner.',           exampleEs: 'Esta es mi pareja.',               category: 'relaties', difficulty: 'A0' },
        { id: 'm2l1v-mijn',     dutch: 'mijn',        spanish: 'mi / mis (nunca cambia)',  article: null,  emoji: '🔑', color: '#2e7d52', exampleNl: 'Mijn moeder en mijn ouders.',    exampleEs: 'Mi madre y mis padres.',           category: 'relaties', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm2l1p-1',  dutch: 'Dit is mijn moeder.',        spanish: 'Esta es mi madre.',              context: 'Presentar (1 persona)' },
        { id: 'm2l1p-2',  dutch: 'Dit is mijn broer.',         spanish: 'Este es mi hermano.',            context: 'Presentar (1 persona)' },
        { id: 'm2l1p-3',  dutch: 'Dit zijn mijn ouders.',      spanish: 'Estos son mis padres.',          context: 'Presentar (varias)' },
        { id: 'm2l1p-4',  dutch: 'Dit zijn mijn kinderen.',    spanish: 'Estos son mis hijos.',           context: 'Presentar (varias)' },
        { id: 'm2l1p-5',  dutch: 'Hij is mijn vriend.',        spanish: 'Él es mi novio.',                context: 'Relaciones' },
        { id: 'm2l1p-6',  dutch: 'Hij is een vriend.',         spanish: 'Él es un amigo.',                context: 'Relaciones' },
        { id: 'm2l1p-7',  dutch: 'Zij is mijn vriendin.',      spanish: 'Ella es mi novia.',              context: 'Relaciones' },
        { id: 'm2l1p-8',  dutch: 'Dit is mijn gezin.',         spanish: 'Esta es mi familia (de casa).',  context: 'Familia' },
        { id: 'm2l1p-9',  dutch: 'Mijn familie is groot.',     spanish: 'Mi familia es grande.',          context: 'Familia' },
        { id: 'm2l1p-10', dutch: 'Zij zijn mijn broers en zussen.', spanish: 'Ellos son mis hermanos.',   context: 'Familia' },
        { id: 'm2l1p-11', dutch: 'Dit is mijn opa.',           spanish: 'Este es mi abuelo.',             context: 'Presentar (1 persona)' },
        { id: 'm2l1p-12', dutch: 'Zij is mijn partner.',       spanish: 'Ella es mi pareja.',             context: 'Relaciones' },
      ],
    },
    {
      type: 'lezen',
      title: 'Het gezin en de familie',
      textNl: `In het Nederlands zijn er twee woorden voor familia. Het gezin is klein: de ouders en de kinderen — de mensen in één huis. De familie is groot: ook de opa, de oma en de rest.

Een Nederlands gezin is vaak klein: twee ouders en één of twee kinderen. De familie woont niet altijd dichtbij. De opa en oma wonen soms in een andere stad.

David denkt vaak aan zijn familie. Zijn ouders en zijn zus wonen in Argentinië — heel ver weg. Maar zijn gezin hier in Nederland? Dat zijn zijn vrienden: Anna, de bakker Kees en buurvrouw Els. Vrienden zijn ook een beetje familie.

En let op het woord vriend: mijn vriend is de novio, maar een vriend is een amigo. Eén klein woord — een groot verschil!`,
      textEs: `En neerlandés hay dos palabras para "familia". Het gezin es pequeña: los padres y los hijos — la gente de una misma casa. De familie es grande: también el abuelo, la abuela y el resto.

Una familia (gezin) neerlandesa suele ser pequeña: dos padres y uno o dos hijos. La familia no siempre vive cerca. Los abuelos a veces viven en otra ciudad.

David piensa mucho en su familia. Sus padres y su hermana viven en Argentina — muy lejos. ¿Pero su "gezin" aquí en Países Bajos? Son sus amigos: Anna, el panadero Kees y la vecina Els. Los amigos también son un poco familia.

Y ojo con la palabra "vriend": mijn vriend es el novio, pero een vriend es un amigo. ¡Una palabrita — una gran diferencia!`,
      exercises: [
        { id: 'm2l1lz-1', type: 'multiple_choice', prompt: '¿Qué es "het gezin"?', options: ['La familia de casa (padres e hijos)', 'Toda la familia', 'Los amigos', 'Los vecinos'], correctAnswer: 'La familia de casa (padres e hijos)', explanation: '"Het gezin is klein: de ouders en de kinderen."' },
        { id: 'm2l1lz-2', type: 'multiple_choice', prompt: '¿Quiénes entran en "de familie"?', options: ['También los abuelos y el resto', 'Solo los padres', 'Solo los hijos', 'Solo la pareja'], correctAnswer: 'También los abuelos y el resto', explanation: '"De familie is groot: ook de opa, de oma en de rest."' },
        { id: 'm2l1lz-3', type: 'multiple_choice', prompt: '¿Cómo suele ser un "gezin" neerlandés?', options: ['Pequeño: dos padres y uno o dos hijos', 'Muy grande', 'Sin hijos', 'De diez personas'], correctAnswer: 'Pequeño: dos padres y uno o dos hijos', explanation: '"Een Nederlands gezin is vaak klein."' },
        { id: 'm2l1lz-4', type: 'multiple_choice', prompt: '¿Dónde viven los padres y la hermana de David?', options: ['En Argentina', 'En Ámsterdam', 'En España', 'En Haarlem'], correctAnswer: 'En Argentina', explanation: '"Zijn ouders en zijn zus wonen in Argentinië."' },
        { id: 'm2l1lz-5', type: 'fill_blank', prompt: 'Zijn ouders wonen heel ver ___.', correctAnswer: 'weg', hint: '"muy lejos" = heel ver …', explanation: '"Ver weg" = lejos.' },
        { id: 'm2l1lz-6', type: 'multiple_choice', prompt: '¿Quiénes son el "gezin" de David en Países Bajos?', options: ['Sus amigos: Anna, Kees y Els', 'Sus abuelos', 'Sus compañeros de trabajo', 'Nadie'], correctAnswer: 'Sus amigos: Anna, Kees y Els', explanation: '"Dat zijn zijn vrienden" — los amigos también son un poco familia.' },
        { id: 'm2l1lz-7', type: 'multiple_choice', prompt: '"Mijn vriend" vs "een vriend": ¿cuál es el novio?', options: ['Mijn vriend', 'Een vriend', 'Los dos', 'Ninguno'], correctAnswer: 'Mijn vriend', explanation: 'mijn vriend = mi novio · een vriend = un amigo.' },
        { id: 'm2l1lz-8', type: 'fill_blank', prompt: 'Het ___ is klein: de ouders en de kinderen.', correctAnswer: 'gezin', hint: 'La familia de casa', explanation: 'La familia con la que vives = het gezin.' },
        { id: 'm2l1lz-9', type: 'fill_blank', prompt: 'De opa en oma wonen soms in een andere ___.', correctAnswer: 'stad', hint: 'ciudad', explanation: '"In een andere stad" = en otra ciudad.' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'm2d1',
        title: 'De familiefoto’s',
        context: 'Anna laat David foto’s van haar familie zien. Zevende ontmoeting.',
        lines: [
          { id: 'm2d1-1',  speaker: 'David', dutch: 'Hoi Anna! Wat kijk je?',                                          spanish: '¡Hola Anna! ¿Qué miras?' },
          { id: 'm2d1-2',  speaker: 'Anna',  dutch: 'Foto’s van mijn familie! Kijk, dit is mijn moeder.',              spanish: '¡Fotos de mi familia! Mira, esta es mi madre.' },
          { id: 'm2d1-3',  speaker: 'David', dutch: 'Wat leuk! En wie is dit?',                                        spanish: '¡Qué bien! ¿Y quién es este?' },
          { id: 'm2d1-4',  speaker: 'Anna',  dutch: 'Dit is mijn broer. En dit zijn mijn ouders samen.',               spanish: 'Este es mi hermano. Y estos son mis padres juntos.' },
          { id: 'm2d1-5',  speaker: 'David', dutch: 'Je moeder en jij… dat is één gezicht!',                           spanish: 'Tu madre y tú… ¡sois la misma cara!' },
          { id: 'm2d1-6',  speaker: 'Anna',  dutch: 'Haha! En hier: mijn opa en oma. Zij wonen in Groningen.',         spanish: '¡Jaja! Y aquí: mi abuelo y mi abuela. Viven en Groninga.' },
          { id: 'm2d1-7',  speaker: 'David', dutch: 'Mooi. Mijn familie woont in Argentinië: mijn ouders en mijn zus.', spanish: 'Bonito. Mi familia vive en Argentina: mis padres y mi hermana.' },
          { id: 'm2d1-8',  speaker: 'Anna',  dutch: 'Heb je ook broers?',                                              spanish: '¿Tienes también hermanos?' },
          { id: 'm2d1-9',  speaker: 'David', dutch: 'Nee, één zus. Zij heet Lucía. En haar dochter is mijn nichtje!',  spanish: 'No, una hermana. Se llama Lucía. ¡Y su hija es mi sobrinita!' },
          { id: 'm2d1-10', speaker: 'Anna',  dutch: 'Aah! En… heb je een vriendin, David?',                            spanish: '¡Aah! Y… ¿tienes novia, David?' },
          { id: 'm2d1-11', speaker: 'David', dutch: 'Een vriendin? Nee… maar ik heb veel vriendinnen. Dat is anders, toch?', spanish: '¿Novia? No… pero tengo muchas amigas. Eso es distinto, ¿no?' },
          { id: 'm2d1-12', speaker: 'Anna',  dutch: 'Haha, precies! Mijn vriendin is amiga o novia — het kleine woord "mijn" of "een" maakt het verschil.', spanish: '¡Jaja, exacto! "Mijn vriendin" o "een vriendin" — la palabrita "mijn" o "een" marca la diferencia.' },
          { id: 'm2d1-13', speaker: 'David', dutch: 'Nederlands is gevaarlijk! Dit is mijn les voor vandaag.',         spanish: '¡El neerlandés es peligroso! Esta es mi lección de hoy.' },
          { id: 'm2d1-14', speaker: 'Anna',  dutch: 'Haha! Tot volgende week, David.',                                 spanish: '¡Jaja! Hasta la semana que viene, David.' },
          { id: 'm2d1-15', speaker: 'David', dutch: 'Doei! Groetjes aan je familie!',                                  spanish: '¡Adiós! ¡Saludos a tu familia!' },
        ],
      },
    },
    {
      type: 'practice',
      exercises: [
        // ── Opción múltiple ──
        { id: 'm2l1e-1',  type: 'multiple_choice', prompt: '¿Cómo presentas a UNA persona?', options: ['Dit is mijn moeder.', 'Dit zijn mijn moeder.', 'Dit ben mijn moeder.', 'Dit hebben mijn moeder.'], correctAnswer: 'Dit is mijn moeder.', explanation: 'Una persona → dit IS; varias → dit ZIJN.' },
        { id: 'm2l1e-2',  type: 'multiple_choice', prompt: '¿Cómo presentas a VARIAS personas?', options: ['Dit zijn mijn ouders.', 'Dit is mijn ouders.', 'Dit zijn mijn moeder.', 'Deze is mijn ouders.'], correctAnswer: 'Dit zijn mijn ouders.', explanation: 'Varias personas → dit ZIJN. Y "dit" nunca cambia.' },
        { id: 'm2l1e-3',  type: 'multiple_choice', prompt: '"Hij is een vriend" significa…', options: ['Él es un amigo', 'Él es mi novio', 'Él es mi hermano', 'Él es mi pareja'], correctAnswer: 'Él es un amigo', explanation: 'een vriend = un amigo; mijn vriend = mi novio.' },
        { id: 'm2l1e-4',  type: 'multiple_choice', prompt: '¿Qué palabra usas para la familia CON LA QUE VIVES?', options: ['het gezin', 'de familie', 'de ouders', 'de partner'], correctAnswer: 'het gezin', explanation: 'gezin = padres+hijos de una casa; familie = toda la familia.' },
        { id: 'm2l1e-5',  type: 'multiple_choice', prompt: '¿Cuál es el plural de "het kind"?', options: ['de kinderen', 'de kinden', 'het kinderen', 'de kinds'], correctAnswer: 'de kinderen', explanation: 'het kind → de kinderen (¡el plural siempre lleva "de"!).' },
        // ── Verdadero / Falso ──
        { id: 'm2l1e-6',  type: 'true_false', prompt: '"Mijn" cambia según sea mi o mis, como en español.', correctAnswer: 'falso', explanation: 'Mijn nunca cambia: mijn moeder, mijn ouders.' },
        { id: 'm2l1e-7',  type: 'true_false', prompt: '"De vriendin" puede ser la novia o una amiga.', correctAnswer: 'verdadero', explanation: 'El contexto (mijn/een) lo aclara.' },
        { id: 'm2l1e-8',  type: 'true_false', prompt: '"Dit" cambia a "ditte" con palabras femeninas.', correctAnswer: 'falso', explanation: '"Dit" nunca cambia, ni por género ni por número: dit is / dit zijn.' },
        // ── Completar ──
        { id: 'm2l1e-9',  type: 'fill_blank', prompt: 'Dit ___ mijn moeder. (1 persona)', correctAnswer: 'is', hint: '¿Una persona o varias?' },
        { id: 'm2l1e-10', type: 'fill_blank', prompt: 'Dit ___ mijn ouders. (varias personas)', correctAnswer: 'zijn', hint: '¿Una persona o varias?' },
        { id: 'm2l1e-11', type: 'fill_blank', prompt: 'Hij is ___ vriend: es mi novio.', correctAnswer: 'mijn', hint: '¿"mijn" o "een"?' },
        { id: 'm2l1e-12', type: 'fill_blank', prompt: 'Zij is ___ vriendin: es solo una amiga.', correctAnswer: 'een', hint: '¿"mijn" o "een"?' },
        // ── Ordenar frases ──
        { id: 'm2l1e-13', type: 'order_sentence', prompt: 'Ordena: "Esta es mi hermana."', options: ['Dit', 'is', 'mijn', 'zus'], correctAnswer: 'Dit is mijn zus' },
        { id: 'm2l1e-14', type: 'order_sentence', prompt: 'Ordena: "Estos son mis hijos."', options: ['Dit', 'zijn', 'mijn', 'kinderen'], correctAnswer: 'Dit zijn mijn kinderen' },
        { id: 'm2l1e-15', type: 'order_sentence', prompt: 'Ordena: "Mi familia es grande."', options: ['Mijn', 'familie', 'is', 'groot'], correctAnswer: 'Mijn familie is groot' },
        // ── Sopa de letras ──
        { id: 'm2l1e-16', type: 'word_scramble', prompt: '¿Cómo se dice "la hija"?', correctAnswer: 'dochter', hint: 'la hija' },
        { id: 'm2l1e-17', type: 'word_scramble', prompt: '¿Cómo se dice "el hermano"?', correctAnswer: 'broer', hint: 'el hermano' },
        // ── Letras que faltan ──
        { id: 'm2l1e-18', type: 'letter_dash', prompt: 'Completa: "la madre"', correctAnswer: 'moeder', hint: 'de …' },
        { id: 'm2l1e-19', type: 'letter_dash', prompt: 'Completa: "los padres"', correctAnswer: 'ouders', hint: 'de …' },
        // ── Unir parejas ──
        { id: 'm2l1e-20', type: 'match_pairs', prompt: 'Une cada familiar con su traducción', correctAnswer: '', pairs: [
          { left: 'de vader', right: 'el padre' },
          { left: 'de moeder', right: 'la madre' },
          { left: 'de zoon', right: 'el hijo' },
          { left: 'de dochter', right: 'la hija' },
          { left: 'de opa', right: 'el abuelo' },
          { left: 'de oma', right: 'la abuela' },
        ] },
        { id: 'm2l1e-21', type: 'match_pairs', prompt: 'Une cada palabra con su traducción', correctAnswer: '', pairs: [
          { left: 'het gezin', right: 'la familia de casa' },
          { left: 'de familie', right: 'toda la familia' },
          { left: 'de partner', right: 'la pareja' },
          { left: 'de ouders', right: 'los padres' },
          { left: 'het kind', right: 'el niño' },
        ] },
        // ── Emoji ──
        { id: 'm2l1e-22', type: 'emoji_choice', prompt: '¿Qué emoji representa "de oma"?', options: ['👵', '👴', '👶', '👦'], correctAnswer: '👵', explanation: '"De oma" = la abuela.' },
        { id: 'm2l1e-23', type: 'emoji_choice', prompt: '¿Qué emoji representa "het gezin"?', options: ['🏠', '🌳', '💼', '🚗'], correctAnswer: '🏠', explanation: 'El gezin es la familia de una misma casa.' },
        // ── El intruso ──
        { id: 'm2l1e-24', type: 'odd_one_out', prompt: '¿Cuál NO es de la familia?', options: ['de broer', 'de zus', 'de bakker', 'de opa'], correctAnswer: 'de bakker', explanation: 'De bakker (el panadero) es una profesión.' },
        { id: 'm2l1e-25', type: 'odd_one_out', prompt: '¿Cuál va con "het"? (las otras con "de")', options: ['moeder', 'kind', 'vader', 'zus'], correctAnswer: 'kind', explanation: 'Het kind — la mayoría de la familia va con "de", pero kind es neutro.' },
        // ── Escribir ──
        { id: 'm2l1e-26', type: 'write_answer', prompt: 'Escribe en neerlandés: "Esta es mi madre"', correctAnswer: 'Dit is mijn moeder', hint: 'Empieza con "Dit…" · sin punto final' },
        { id: 'm2l1e-27', type: 'write_answer', prompt: 'Escribe en neerlandés: "Estos son mis padres"', correctAnswer: 'Dit zijn mijn ouders', hint: 'Varias personas · sin punto final' },
        // ── Escuchar ──
        { id: 'm2l1e-28', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "Dit is mijn zus"', options: ['Dit is mijn zus', 'Dit is mijn zoon', 'Dit zijn mijn zussen', 'Dit is mijn broer'], correctAnswer: 'Dit is mijn zus' },
        { id: 'm2l1e-29', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "de dochter"', options: ['de dochter', 'de moeder', 'de broer', 'de oma'], correctAnswer: 'de dochter' },
        { id: 'm2l1e-30', type: 'listen_translate', prompt: 'Escucha y traduce: "Mijn familie is groot"', options: ['Mi', 'familia', 'es', 'grande', 'pequeña', 'Su'], correctAnswer: 'Mi familia es grande' },
        { id: 'm2l1e-31', type: 'listen_translate', prompt: 'Escucha y traduce: "Hij is een vriend"', options: ['Él', 'es', 'un', 'amigo', 'novio', 'mi'], correctAnswer: 'Él es un amigo' },
        // ── Comprensión del diálogo (De familiefoto’s) ──
        { id: 'm2l1e-32', type: 'multiple_choice', prompt: 'En el diálogo, ¿dónde viven los abuelos de Anna?', options: ['En Groninga', 'En Haarlem', 'En Argentina', 'En Madrid'], correctAnswer: 'En Groninga', explanation: '"Mijn opa en oma… zij wonen in Groningen."' },
        { id: 'm2l1e-33', type: 'multiple_choice', prompt: '¿Cómo se llama la hermana de David?', options: ['Lucía', 'Anna', 'Els', 'Luna'], correctAnswer: 'Lucía', explanation: '"Zij heet Lucía" — y su hija es la sobrinita de David.' },
        { id: 'm2l1e-34', type: 'true_false', prompt: 'David tiene novia.', correctAnswer: 'falso', explanation: 'Dice que no tiene "een vriendin" de novia, pero sí muchas amigas.' },
      ],
    },
    { type: 'review' },
  ],
};
const m2_les2: Lesson = {
  id: 'm2-les-2-zinsstructuur',
  moduleId: 'familie-vrienden',
  title: 'Les 2 — Grammatica | Zinnen maken',
  subtitle: 'La estructura S + V + Resto',
  order: 2,
  learningObjective: 'Construir frases correctas con la estructura Sujeto + Verbo + Resto, sin traducir literalmente del español',
  estimatedMinutes: 30,
  blocks: [
    {
      type: 'summary',
      title: 'Zinnen maken: S + V + R',
      intro: 'El español y el neerlandés se parecen… pero no son iguales. Hoy aprendes EL esquema con el que se construye casi cualquier frase neerlandesa: Sujeto + Verbo + Resto.',
      objectives: [
        'Reconocer la estructura S–V–Resto',
        'Construir frases correctas (sin traducir literalmente)',
        'Convertir palabras sueltas en frases completas',
      ],
      sections: [
        {
          heading: '🚂 La estructura básica: S + V + R',
          body: '**S**ujeto (onderwerp) + **V**erbo (werkwoord) + **R**esto (de rest). *Mijn broer woont in Utrecht* = Mi hermano vive en Utrecht. Regla de oro: **el verbo SIEMPRE va en segundo lugar**.',
          items: [
            { nl: 'Mijn ouders werken in Nederland', es: 'Mis padres trabajan en Países Bajos' },
            { nl: 'Mijn moeder woont in Spanje', es: 'Mi madre vive en España' },
            { nl: 'Mijn vriend studeert in Amsterdam', es: 'Mi novio estudia en Ámsterdam' },
          ],
        },
        {
          heading: '🧩 ¿Qué es "el resto"?',
          body: 'El resto responde a **dónde / cuándo / qué**: *in Nederland* (dónde), *in februari* (cuándo), *aardappels* (qué). *Hij eet aardappels* · *Ik werk in de zomer*.',
        },
        {
          heading: '🔧 Conjugar (repaso con truco nuevo)',
          body: 'Infinitivo − en = raíz → ik = raíz · jij/hij/zij/het = raíz + t · plural = infinitivo. Nuevo matiz: si la raíz queda con UNA consonante al final (*dromen, slapen, studeren*), **alarga la vocal**: droom, slaap, studeer. Con dos consonantes (*werken, zingen, brengen*) no hace falta: werk, zing, breng.',
          items: [
            { nl: 'dromen → ik droom', es: 'soñar' },
            { nl: 'slapen → ik slaap', es: 'dormir' },
            { nl: 'zingen → ik zing', es: 'cantar' },
          ],
        },
        {
          heading: '⚠️ La GRAN diferencia con el español',
          body: 'En español dices "Vive en Utrecht" sin sujeto. En neerlandés eso está mal: **SIEMPRE hace falta el sujeto** → *Hij woont in Utrecht*.',
        },
      ],
      tip: 'Cuando dudes, monta el tren: ¿QUIÉN? (S) → ¿QUÉ HACE? (V, en 2º lugar, bien conjugado) → el resto. Y nunca dejes el tren sin conductor: el sujeto es obligatorio.',
    },
    {
      type: 'vocabulary',
      items: [
        { id: 'm2l2v-zin',        dutch: 'de zin',        spanish: 'la frase',            article: 'de',  emoji: '🚂', color: '#0b7a4d', exampleNl: 'Ik maak een zin.',              exampleEs: 'Hago una frase.',                category: 'grammatica', difficulty: 'A0' },
        { id: 'm2l2v-werkwoord',  dutch: 'het werkwoord', spanish: 'el verbo',            article: 'het', emoji: '⚙️', color: '#1a7a40', exampleNl: 'Het werkwoord staat op plek twee.', exampleEs: 'El verbo va en el segundo lugar.', category: 'grammatica', difficulty: 'A0' },
        { id: 'm2l2v-dromen',     dutch: 'dromen',        spanish: 'soñar',               article: null,  emoji: '💭', color: '#0d6e33', exampleNl: 'Ik droom in het Nederlands!',   exampleEs: '¡Sueño en neerlandés!',          category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm2l2v-zingen',     dutch: 'zingen',        spanish: 'cantar',              article: null,  emoji: '🎤', color: '#0b7a4d', exampleNl: 'Mijn zus zingt heel mooi.',     exampleEs: 'Mi hermana canta muy bonito.',   category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm2l2v-brengen',    dutch: 'brengen',       spanish: 'llevar / traer',      article: null,  emoji: '📦', color: '#1a7a40', exampleNl: 'Ik breng koffie voor iedereen.', exampleEs: 'Traigo café para todos.',       category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm2l2v-douche',     dutch: 'de douche',     spanish: 'la ducha',            article: 'de',  emoji: '🚿', color: '#0d6e33', exampleNl: 'Mijn broer zingt in de douche.', exampleEs: 'Mi hermano canta en la ducha.', category: 'algemeen', difficulty: 'A0' },
        { id: 'm2l2v-gaan',       dutch: 'gaan',          spanish: 'ir',                  article: null,  emoji: '➡️', color: '#2e7d52', exampleNl: 'Wij gaan naar Spanje.',         exampleEs: 'Vamos a España.',                category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm2l2v-samen',      dutch: 'samen',         spanish: 'juntos / juntas',     article: null,  emoji: '🤝', color: '#0b7a4d', exampleNl: 'Wij werken samen.',             exampleEs: 'Trabajamos juntos.',             category: 'algemeen', difficulty: 'A0' },
        { id: 'm2l2v-restaurant', dutch: 'het restaurant', spanish: 'el restaurante',     article: 'het', emoji: '🍴', color: '#1a7a40', exampleNl: 'Het restaurant opent in Utrecht.', exampleEs: 'El restaurante abre en Utrecht.', category: 'algemeen', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm2l2p-1',  dutch: 'Mijn broer woont in Utrecht.',       spanish: 'Mi hermano vive en Utrecht.',         context: 'S+V+R' },
        { id: 'm2l2p-2',  dutch: 'Mijn ouders werken in Nederland.',   spanish: 'Mis padres trabajan en Países Bajos.', context: 'S+V+R' },
        { id: 'm2l2p-3',  dutch: 'Mijn moeder woont in Spanje.',       spanish: 'Mi madre vive en España.',            context: 'S+V+R' },
        { id: 'm2l2p-4',  dutch: 'Mijn vriend studeert in Amsterdam.', spanish: 'Mi novio estudia en Ámsterdam.',      context: 'S+V+R' },
        { id: 'm2l2p-5',  dutch: 'Mijn vader werkt in een winkel.',    spanish: 'Mi padre trabaja en una tienda.',     context: 'S+V+R' },
        { id: 'm2l2p-6',  dutch: 'Hij eet aardappels.',                spanish: 'Él come patatas.',                    context: 'El resto: qué' },
        { id: 'm2l2p-7',  dutch: 'Ik werk in de zomer.',               spanish: 'Trabajo en verano.',                  context: 'El resto: cuándo' },
        { id: 'm2l2p-8',  dutch: 'Zij werkt weinig.',                  spanish: 'Ella trabaja poco.',                  context: 'El resto: cuánto' },
        { id: 'm2l2p-9',  dutch: 'Ik droom in het Nederlands.',        spanish: 'Sueño en neerlandés.',                context: 'Verbos nuevos' },
        { id: 'm2l2p-10', dutch: 'Mijn zus zingt heel mooi.',          spanish: 'Mi hermana canta muy bonito.',        context: 'Verbos nuevos' },
        { id: 'm2l2p-11', dutch: 'Het kind slaapt.',                   spanish: 'El niño duerme.',                     context: 'Verbos nuevos' },
        { id: 'm2l2p-12', dutch: 'Wij gaan naar Spanje.',              spanish: 'Vamos a España.',                     context: 'Verbos nuevos' },
      ],
    },
    {
      type: 'lezen',
      title: 'Een Nederlandse zin is een trein',
      textNl: `Een Nederlandse zin is net een trein. Vooraan staat de conducteur: het onderwerp — wie doet iets? Dan komt de motor: het werkwoord — wat gebeurt er? En daarna komen de wagons: de rest — waar, wanneer, wat.

Kijk maar: Mijn broer (conducteur) woont (motor) in Utrecht (wagon). De motor staat ALTIJD op plek twee. Dat is de belangrijkste regel van het Nederlands.

In het Spaans rijdt de trein soms zonder conducteur: "Vive en Utrecht". In het Nederlands kan dat niet. Een trein zonder conducteur rijdt niet — een zin zonder onderwerp werkt niet. Dus: Hij woont in Utrecht.

Nog één ding over de motor: die moet passen bij de conducteur. Ik droom, mijn zus droomt, wij dromen. Kleine motor, grote motor — maar altijd op plek twee!`,
      textEs: `Una frase neerlandesa es como un tren. Delante va el conductor: el sujeto — ¿quién hace algo? Luego viene el motor: el verbo — ¿qué pasa? Y detrás vienen los vagones: el resto — dónde, cuándo, qué.

Míralo: Mijn broer (conductor) woont (motor) in Utrecht (vagón). El motor va SIEMPRE en el segundo lugar. Esa es la regla más importante del neerlandés.

En español el tren a veces circula sin conductor: "Vive en Utrecht". En neerlandés eso no puede ser. Un tren sin conductor no anda — una frase sin sujeto no funciona. Así que: Hij woont in Utrecht.

Una cosa más sobre el motor: tiene que encajar con el conductor. Ik droom, mijn zus droomt, wij dromen. Motor pequeño, motor grande — ¡pero siempre en el segundo lugar!`,
      exercises: [
        { id: 'm2l2lz-1', type: 'multiple_choice', prompt: 'En la metáfora del tren, ¿qué es el sujeto?', options: ['El conductor', 'El motor', 'El vagón', 'La vía'], correctAnswer: 'El conductor', explanation: 'El sujeto es quien "conduce" la frase: quién hace algo.' },
        { id: 'm2l2lz-2', type: 'multiple_choice', prompt: '¿Y el verbo?', options: ['El motor', 'El conductor', 'El vagón', 'La estación'], correctAnswer: 'El motor', explanation: 'El verbo es el motor: qué pasa. Y va SIEMPRE en el 2º lugar.' },
        { id: 'm2l2lz-3', type: 'multiple_choice', prompt: '¿Cuál es la regla más importante del neerlandés según el texto?', options: ['El verbo siempre en el segundo lugar', 'El sujeto al final', 'Las frases cortas', 'No usar verbos'], correctAnswer: 'El verbo siempre en el segundo lugar', explanation: '"De motor staat ALTIJD op plek twee."' },
        { id: 'm2l2lz-4', type: 'multiple_choice', prompt: '"Vive en Utrecht" (sin sujeto): ¿vale en neerlandés?', options: ['No: hace falta el sujeto → Hij woont in Utrecht', 'Sí, igual que en español', 'Solo por escrito', 'Solo hablando'], correctAnswer: 'No: hace falta el sujeto → Hij woont in Utrecht', explanation: 'Un tren sin conductor no anda: el sujeto es obligatorio.' },
        { id: 'm2l2lz-5', type: 'fill_blank', prompt: 'Mijn broer ___ in Utrecht. (vivir)', correctAnswer: 'woont', hint: 'wonen → hij: raíz + t (alarga la vocal)', explanation: 'wonen → woon → woont.' },
        { id: 'm2l2lz-6', type: 'fill_blank', prompt: 'Ik ___, mijn zus droomt, wij dromen. (soñar, yo)', correctAnswer: 'droom', hint: 'dromen → con ik va la raíz (alarga la vocal)', explanation: 'dromen → droom: la raíz alarga la vocal.' },
        { id: 'm2l2lz-7', type: 'multiple_choice', prompt: '¿Qué responde "el resto" (los vagones)?', options: ['Dónde, cuándo, qué', 'Solo quién', 'Solo el verbo', 'Nada'], correctAnswer: 'Dónde, cuándo, qué', explanation: '"De rest: waar, wanneer, wat."' },
        { id: 'm2l2lz-8', type: 'fill_blank', prompt: 'Een zin zonder onderwerp ___ niet.', correctAnswer: 'werkt', hint: 'werken → raíz + t', explanation: 'Una frase sin sujeto "no funciona" (werkt niet).' },
        { id: 'm2l2lz-9', type: 'multiple_choice', prompt: '¿Qué significa que el motor "encaje con el conductor"?', options: ['El verbo se conjuga según el sujeto', 'El verbo va al final', 'El sujeto se omite', 'Los dos van juntos al final'], correctAnswer: 'El verbo se conjuga según el sujeto', explanation: 'Ik droom · mijn zus droomt · wij dromen.' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'm2d2',
        title: 'De zinnenfabriek',
        context: 'David oefent zinnen maken over zijn familie. Anna helpt. Achtste ontmoeting.',
        lines: [
          { id: 'm2d2-1',  speaker: 'David', dutch: 'Hoi Anna! Vandaag maak ik zinnen. Luister: mijn zus… Buenos Aires… wonen!', spanish: '¡Hola Anna! Hoy hago frases. Escucha: mi hermana… Buenos Aires… ¡vivir!' },
          { id: 'm2d2-2',  speaker: 'Anna',  dutch: 'Haha, dat zijn woorden, geen zin! Maak er een trein van: wie, wat, waar.',  spanish: '¡Jaja, eso son palabras, no una frase! Haz un tren: quién, qué, dónde.' },
          { id: 'm2d2-3',  speaker: 'David', dutch: 'Oké… Mijn zus woont in Buenos Aires!',                                      spanish: 'Vale… ¡Mi hermana vive en Buenos Aires!' },
          { id: 'm2d2-4',  speaker: 'Anna',  dutch: 'Perfect! Sujeto, verbo op plek twee, en de rest. Nog een?',                 spanish: '¡Perfecto! Sujeto, verbo en el lugar dos, y el resto. ¿Otra?' },
          { id: 'm2d2-5',  speaker: 'David', dutch: 'Mijn ouders werken in een restaurant.',                                     spanish: 'Mis padres trabajan en un restaurante.' },
          { id: 'm2d2-6',  speaker: 'Anna',  dutch: 'Heel goed! En nu een moeilijke: slapen, met "het kind".',                   spanish: '¡Muy bien! Y ahora una difícil: dormir, con "el niño".' },
          { id: 'm2d2-7',  speaker: 'David', dutch: 'Het kind slaapt… met twee a’s? Slaapt?',                                    spanish: 'El niño duerme… ¿con dos aes? ¿Slaapt?' },
          { id: 'm2d2-8',  speaker: 'Anna',  dutch: 'Ja! De raíz alarga la vocal: slapen → slaap → slaapt.',                     spanish: '¡Sí! La raíz alarga la vocal: slapen → slaap → slaapt.' },
          { id: 'm2d2-9',  speaker: 'David', dutch: 'En ik? Ik slaap weinig. Ik droom in het Nederlands!',                       spanish: '¿Y yo? Duermo poco. ¡Sueño en neerlandés!' },
          { id: 'm2d2-10', speaker: 'Anna',  dutch: 'Haha! Dat is een heel goed teken. Laatste test: "canta en la ducha".',      spanish: '¡Jaja! Eso es muy buena señal. Última prueba: "canta en la ducha".' },
          { id: 'm2d2-11', speaker: 'David', dutch: 'Eh… wie zingt? Zonder sujeto kan het niet!',                                spanish: 'Eh… ¿quién canta? ¡Sin sujeto no se puede!' },
          { id: 'm2d2-12', speaker: 'Anna',  dutch: 'Bravo! Dat is DE regel. Oké: mijn broer zingt in de douche.',               spanish: '¡Bravo! Esa es LA regla. Vale: mi hermano canta en la ducha.' },
          { id: 'm2d2-13', speaker: 'David', dutch: 'Mijn broer zingt in de douche. Arme familie!',                              spanish: 'Mi hermano canta en la ducha. ¡Pobre familia!' },
          { id: 'm2d2-14', speaker: 'Anna',  dutch: 'Haha! Tot volgende week, zinnenmaker!',                                     spanish: '¡Jaja! ¡Hasta la semana que viene, fabricante de frases!' },
          { id: 'm2d2-15', speaker: 'David', dutch: 'Doei Anna!',                                                                spanish: '¡Adiós, Anna!' },
        ],
      },
    },
    {
      type: 'practice',
      exercises: [
        // ── Opción múltiple ──
        { id: 'm2l2e-1',  type: 'multiple_choice', prompt: '¿En qué lugar de la frase va SIEMPRE el verbo?', options: ['En el segundo', 'En el primero', 'Al final', 'Da igual'], correctAnswer: 'En el segundo', explanation: 'La regla de oro: S + V(2º) + Resto.' },
        { id: 'm2l2e-2',  type: 'multiple_choice', prompt: '¿Cuál es la frase CORRECTA?', options: ['Mijn vader werkt in een winkel.', 'Mijn vader in een winkel werkt.', 'Werkt mijn vader in een winkel.', 'In een winkel mijn vader werkt.'], correctAnswer: 'Mijn vader werkt in een winkel.', explanation: 'Sujeto (mijn vader) + verbo en 2º (werkt) + resto.' },
        { id: 'm2l2e-3',  type: 'multiple_choice', prompt: '"Vive en Utrecht" en neerlandés correcto es…', options: ['Hij woont in Utrecht.', 'Woont in Utrecht.', 'In Utrecht woont.', 'Utrecht woont.'], correctAnswer: 'Hij woont in Utrecht.', explanation: 'El sujeto es SIEMPRE obligatorio en neerlandés.' },
        { id: 'm2l2e-4',  type: 'multiple_choice', prompt: '¿Cuál es la raíz de "slapen"?', options: ['slaap', 'slap', 'slapen', 'slaapt'], correctAnswer: 'slaap', explanation: 'La raíz alarga la vocal para mantener el sonido: slapen → slaap.' },
        { id: 'm2l2e-5',  type: 'multiple_choice', prompt: '¿Y la raíz de "zingen"?', options: ['zing', 'ziing', 'zingt', 'zingen'], correctAnswer: 'zing', explanation: 'La raíz acaba en dos consonantes (ng): no hay que alargar nada.' },
        // ── Verdadero / Falso ──
        { id: 'm2l2e-6',  type: 'true_false', prompt: 'En neerlandés puedes omitir el sujeto como en español.', correctAnswer: 'falso', explanation: 'Nunca: la frase siempre necesita su sujeto.' },
        { id: 'm2l2e-7',  type: 'true_false', prompt: '"El resto" de la frase responde a dónde, cuándo o qué.', correctAnswer: 'verdadero', explanation: 'in Nederland (dónde), in februari (cuándo), aardappels (qué).' },
        { id: 'm2l2e-8',  type: 'true_false', prompt: '"Ik droom" está mal escrito: debería ser "ik drom".', correctAnswer: 'falso', explanation: 'La raíz de dromen alarga la vocal: droom.' },
        // ── Completar ──
        { id: 'm2l2e-9',  type: 'fill_blank', prompt: 'Mijn moeder ___ in Spanje. (vivir)', correctAnswer: 'woont', hint: 'raíz + t (vocal larga)' },
        { id: 'm2l2e-10', type: 'fill_blank', prompt: 'Ik ___ in Amsterdam. (trabajar)', correctAnswer: 'werk', hint: 'con ik va la raíz' },
        { id: 'm2l2e-11', type: 'fill_blank', prompt: 'Mijn broer ___ in Utrecht. (estudiar)', correctAnswer: 'studeert', hint: 'raíz + t (alarga la vocal: studeer)' },
        { id: 'm2l2e-12', type: 'fill_blank', prompt: 'Het kind ___. (dormir)', correctAnswer: 'slaapt', hint: 'raíz + t (vocal larga: aa)' },
        { id: 'm2l2e-13', type: 'fill_blank', prompt: 'Wij ___ naar Spanje. (ir)', correctAnswer: 'gaan', hint: 'plural → infinitivo' },
        // ── Ordenar frases (¡el corazón de esta lección!) ──
        { id: 'm2l2e-14', type: 'order_sentence', prompt: 'Ordena: "Yo vivo en Países Bajos."', options: ['Ik', 'woon', 'in', 'Nederland'], correctAnswer: 'Ik woon in Nederland' },
        { id: 'm2l2e-15', type: 'order_sentence', prompt: 'Ordena: "Mi padre trabaja en una tienda."', options: ['Mijn', 'vader', 'werkt', 'in', 'een', 'winkel'], correctAnswer: 'Mijn vader werkt in een winkel' },
        { id: 'm2l2e-16', type: 'order_sentence', prompt: 'Ordena: "Mi novio estudia en Ámsterdam."', options: ['Mijn', 'vriend', 'studeert', 'in', 'Amsterdam'], correctAnswer: 'Mijn vriend studeert in Amsterdam' },
        { id: 'm2l2e-17', type: 'order_sentence', prompt: 'Ordena: "Trabajamos juntos."', options: ['Wij', 'werken', 'samen'], correctAnswer: 'Wij werken samen' },
        // ── Sopa de letras ──
        { id: 'm2l2e-18', type: 'word_scramble', prompt: '¿Cómo se dice "soñar"?', correctAnswer: 'dromen', hint: 'soñar' },
        { id: 'm2l2e-19', type: 'word_scramble', prompt: '¿Cómo se dice "cantar"?', correctAnswer: 'zingen', hint: 'cantar' },
        // ── Letras que faltan ──
        { id: 'm2l2e-20', type: 'letter_dash', prompt: 'Completa: "dormir"', correctAnswer: 'slapen', hint: 'Het kind …' },
        { id: 'm2l2e-21', type: 'letter_dash', prompt: 'Completa: "llevar / traer"', correctAnswer: 'brengen', hint: 'Ik … koffie' },
        // ── Unir parejas ──
        { id: 'm2l2e-22', type: 'match_pairs', prompt: 'Une cada verbo con su traducción', correctAnswer: '', pairs: [
          { left: 'dromen', right: 'soñar' },
          { left: 'slapen', right: 'dormir' },
          { left: 'zingen', right: 'cantar' },
          { left: 'brengen', right: 'llevar / traer' },
          { left: 'eten', right: 'comer' },
          { left: 'gaan', right: 'ir' },
        ] },
        { id: 'm2l2e-23', type: 'match_pairs', prompt: 'Une cada infinitivo con su raíz', correctAnswer: '', pairs: [
          { left: 'dromen', right: 'droom' },
          { left: 'slapen', right: 'slaap' },
          { left: 'studeren', right: 'studeer' },
          { left: 'zingen', right: 'zing' },
          { left: 'brengen', right: 'breng' },
        ] },
        // ── Emoji ──
        { id: 'm2l2e-24', type: 'emoji_choice', prompt: '¿Qué emoji representa "slapen"?', options: ['😴', '🎤', '💭', '🍽️'], correctAnswer: '😴', explanation: '"Slapen" = dormir.' },
        { id: 'm2l2e-25', type: 'emoji_choice', prompt: '¿Qué emoji representa "zingen"?', options: ['🎤', '😴', '📦', '➡️'], correctAnswer: '🎤', explanation: '"Zingen" = cantar.' },
        // ── El intruso ──
        { id: 'm2l2e-26', type: 'odd_one_out', prompt: '¿Qué raíz NO alarga la vocal?', options: ['droom', 'slaap', 'zing', 'studeer'], correctAnswer: 'zing', explanation: 'Zingen acaba la raíz en dos consonantes (ng): no alarga. Las otras sí.' },
        { id: 'm2l2e-27', type: 'odd_one_out', prompt: '¿Cuál NO es una frase correcta?', options: ['Ik woon in Nederland', 'Mijn zus zingt mooi', 'Woont in Utrecht', 'Het kind slaapt'], correctAnswer: 'Woont in Utrecht', explanation: '¡Le falta el sujeto! En neerlandés es obligatorio.' },
        // ── Escribir ──
        { id: 'm2l2e-28', type: 'write_answer', prompt: 'Escribe en neerlandés: "Mi hermana vive en Madrid"', correctAnswer: 'Mijn zus woont in Madrid', hint: 'S + V(2º) + resto · sin punto final' },
        { id: 'm2l2e-29', type: 'write_answer', prompt: 'Escribe la raíz de "slapen"', correctAnswer: 'slaap', hint: 'Recuerda alargar la vocal' },
        // ── Escuchar ──
        { id: 'm2l2e-30', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "Mijn ouders werken in Nederland"', options: ['Mijn ouders werken in Nederland', 'Mijn ouders wonen in Nederland', 'Mijn ouders werken in een winkel', 'Mijn vader werkt in Nederland'], correctAnswer: 'Mijn ouders werken in Nederland' },
        { id: 'm2l2e-31', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "Het kind slaapt"', options: ['Het kind slaapt', 'Het kind slaat', 'De kinderen slapen', 'Het kind zingt'], correctAnswer: 'Het kind slaapt' },
        { id: 'm2l2e-32', type: 'listen_translate', prompt: 'Escucha y traduce: "Mijn zus zingt heel mooi"', options: ['Mi', 'hermana', 'canta', 'muy', 'bonito', 'duerme'], correctAnswer: 'Mi hermana canta muy bonito' },
        // ── Comprensión del diálogo (De zinnenfabriek) ──
        { id: 'm2l2e-33', type: 'multiple_choice', prompt: 'En el diálogo, ¿dónde vive la hermana de David?', options: ['En Buenos Aires', 'En Utrecht', 'En Madrid', 'En Ámsterdam'], correctAnswer: 'En Buenos Aires', explanation: '"Mijn zus woont in Buenos Aires!" — su primera frase-tren perfecta.' },
        { id: 'm2l2e-34', type: 'true_false', prompt: 'David sueña en neerlandés.', correctAnswer: 'verdadero', explanation: '"Ik droom in het Nederlands!" — muy buena señal, dice Anna.' },
        { id: 'm2l2e-35', type: 'true_false', prompt: '"Canta en la ducha" se puede traducir sin añadir sujeto.', correctAnswer: 'falso', explanation: 'David lo clava: sin sujeto no se puede → Mijn broer zingt in de douche.' },
      ],
    },
    { type: 'review' },
  ],
};
const m2_les3: Lesson = {
  id: 'm2-les-3-kalender',
  moduleId: 'familie-vrienden',
  title: 'Les 3 — Woordenschat | Kalender, dagen en momenten',
  subtitle: 'Días, meses y palabras de tiempo para hacer planes',
  order: 3,
  learningObjective: 'Decir cuándo pasa algo: días, meses y palabras de tiempo, con el tiempo al final de la frase',
  estimatedMinutes: 30,
  blocks: [
    {
      type: 'summary',
      title: 'Kalender, dagen en momenten',
      intro: 'Hoy aprendes a decir CUÁNDO pasa algo: citas, planes y momentos en familia. "Ik bezoek mijn oma morgen" — visito a mi abuela mañana.',
      objectives: [
        'Usar los días y los meses en frases',
        'Usar las palabras de tiempo (hoy, mañana, ayer…)',
        'Hacer frases sobre planes: S + V + resto + tiempo',
      ],
      sections: [
        {
          heading: '📅 Los días — con OP',
          body: 'Para decir EN QUÉ DÍA haces algo usas **op**: *Ik werk op maandag* · *Ik zie mijn familie op zaterdag*. Los días: maandag, dinsdag, woensdag, donderdag, vrijdag, zaterdag, zondag (los tienes como flashcards en la lección extra "Dagen").',
        },
        {
          heading: '🗓️ Los meses — con IN',
          body: 'Para el MES usas **in**: *Mijn moeder is jarig in juni* · *Ik ga op vakantie in augustus*. Los meses: januari, februari, maart, april, mei, juni, juli, augustus, september, oktober, november, december (flashcards en la extra "Maanden").',
        },
        {
          heading: '⏰ Las palabras de tiempo',
          items: [
            { nl: 'vandaag', es: 'hoy' },
            { nl: 'morgen', es: 'mañana' },
            { nl: 'gisteren', es: 'ayer' },
            { nl: 'overmorgen', es: 'pasado mañana' },
            { nl: 'dit weekend', es: 'este fin de semana' },
            { nl: 'volgende week', es: 'la semana que viene' },
          ],
        },
        {
          heading: '🚂 ¿Dónde va el tiempo en la frase?',
          body: 'El tiempo forma parte del "resto". Truco para hacerte la vida fácil: **ponlo al final**: *Ik bezoek mijn oma morgen* · *Wij zien onze vrienden dit weekend* · *Ik werk vandaag*.',
        },
        {
          heading: '🎂 Jarig zijn',
          body: '**Jarig zijn** = cumplir años (¡muy neerlandés!): *Mijn moeder is jarig in juni* = mi madre cumple años en junio.',
        },
      ],
      tip: 'OP para el día, IN para el mes — y el tiempo al final de la frase. "Ik bezoek mijn oma OP zaterdag" · "Ik ben jarig IN januari". (La hora llega en la lección 5.)',
    },
    {
      type: 'vocabulary',
      items: [
        { id: 'm2l3v-morgen',    dutch: 'morgen',          spanish: 'mañana',                    article: null, emoji: '🌤️', color: '#0b7a4d', exampleNl: 'Ik bezoek mijn oma morgen.',       exampleEs: 'Visito a mi abuela mañana.',        category: 'tijd', difficulty: 'A0' },
        { id: 'm2l3v-gisteren',  dutch: 'gisteren',        spanish: 'ayer',                      article: null, emoji: '⏪', color: '#1a7a40', exampleNl: 'Gisteren was het zondag.',         exampleEs: 'Ayer fue domingo.',                 category: 'tijd', difficulty: 'A0' },
        { id: 'm2l3v-overmorgen', dutch: 'overmorgen',     spanish: 'pasado mañana',             article: null, emoji: '⏩', color: '#0d6e33', exampleNl: 'Ik werk overmorgen.',              exampleEs: 'Trabajo pasado mañana.',            category: 'tijd', difficulty: 'A0' },
        { id: 'm2l3v-week',      dutch: 'de week',         spanish: 'la semana',                 article: 'de', emoji: '📆', color: '#2e7d52', exampleNl: 'De week heeft zeven dagen.',       exampleEs: 'La semana tiene siete días.',       category: 'tijd', difficulty: 'A0' },
        { id: 'm2l3v-volgendeweek', dutch: 'volgende week', spanish: 'la semana que viene',      article: null, emoji: '➡️', color: '#0b7a4d', exampleNl: 'Wij werken volgende week.',        exampleEs: 'Trabajamos la semana que viene.',   category: 'tijd', difficulty: 'A0' },
        { id: 'm2l3v-maand',     dutch: 'de maand',        spanish: 'el mes',                    article: 'de', emoji: '🗓️', color: '#1a7a40', exampleNl: 'Juni is een mooie maand.',         exampleEs: 'Junio es un mes bonito.',           category: 'tijd', difficulty: 'A0' },
        { id: 'm2l3v-afspraak',  dutch: 'de afspraak',     spanish: 'la cita / el compromiso',   article: 'de', emoji: '🤝', color: '#0d6e33', exampleNl: 'Ik heb een afspraak op dinsdag.',  exampleEs: 'Tengo una cita el martes.',         category: 'tijd', difficulty: 'A0' },
        { id: 'm2l3v-kalender',  dutch: 'de kalender',     spanish: 'el calendario',             article: 'de', emoji: '📅', color: '#2e7d52', exampleNl: 'De afspraak staat in de kalender.', exampleEs: 'La cita está en el calendario.',   category: 'tijd', difficulty: 'A0' },
        { id: 'm2l3v-bezoeken',  dutch: 'bezoeken',        spanish: 'visitar',                   article: null, emoji: '🚪', color: '#0b7a4d', exampleNl: 'Ik bezoek mijn oma morgen.',       exampleEs: 'Visito a mi abuela mañana.',        category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm2l3v-zien',      dutch: 'zien',            spanish: 'ver',                       article: null, emoji: '👀', color: '#1a7a40', exampleNl: 'Wij zien onze vrienden dit weekend.', exampleEs: 'Vemos a nuestros amigos este finde.', category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm2l3v-jarig',     dutch: 'jarig zijn',      spanish: 'cumplir años',              article: null, emoji: '🎂', color: '#0d6e33', exampleNl: 'Mijn moeder is jarig in juni.',    exampleEs: 'Mi madre cumple años en junio.',    category: 'tijd', difficulty: 'A0' },
        { id: 'm2l3v-vakantie',  dutch: 'de vakantie',     spanish: 'las vacaciones',            article: 'de', emoji: '🏖️', color: '#2e7d52', exampleNl: 'Ik ga op vakantie in augustus.',   exampleEs: 'Me voy de vacaciones en agosto.',   category: 'tijd', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm2l3p-1',  dutch: 'Ik werk op maandag.',                spanish: 'Trabajo el lunes.',                     context: 'OP + día' },
        { id: 'm2l3p-2',  dutch: 'Ik zie mijn familie op zaterdag.',   spanish: 'Veo a mi familia el sábado.',           context: 'OP + día' },
        { id: 'm2l3p-3',  dutch: 'Mijn moeder is jarig in juni.',      spanish: 'Mi madre cumple años en junio.',        context: 'IN + mes' },
        { id: 'm2l3p-4',  dutch: 'Ik ga op vakantie in augustus.',     spanish: 'Me voy de vacaciones en agosto.',       context: 'IN + mes' },
        { id: 'm2l3p-5',  dutch: 'Ik werk vandaag.',                   spanish: 'Trabajo hoy.',                          context: 'Tiempo' },
        { id: 'm2l3p-6',  dutch: 'Ik bezoek mijn oma morgen.',         spanish: 'Visito a mi abuela mañana.',            context: 'Tiempo' },
        { id: 'm2l3p-7',  dutch: 'Ik bezoek mijn oma overmorgen.',     spanish: 'Visito a mi abuela pasado mañana.',     context: 'Tiempo' },
        { id: 'm2l3p-8',  dutch: 'Wij zien onze vrienden dit weekend.', spanish: 'Vemos a nuestros amigos este finde.',  context: 'Tiempo' },
        { id: 'm2l3p-9',  dutch: 'Wij werken volgende week.',          spanish: 'Trabajamos la semana que viene.',       context: 'Tiempo' },
        { id: 'm2l3p-10', dutch: 'Ik heb een afspraak op dinsdag.',    spanish: 'Tengo una cita el martes.',             context: 'Citas' },
        { id: 'm2l3p-11', dutch: 'Mijn ouders gaan op vakantie in september.', spanish: 'Mis padres se van de vacaciones en septiembre.', context: 'Combinado' },
      ],
    },
    {
      type: 'lezen',
      title: 'De Nederlandse agenda',
      textNl: `Nederlanders leven met een agenda. Werk, sport, familie — alles staat in de kalender. Wil je een vriend zien? Dan maak je een afspraak. Spontaan op bezoek gaan? Dat is in Nederland niet normaal!

Ook familie-momenten staan in de agenda. Veel mensen bezoeken hun ouders op zondag. Op zaterdag zien ze vrienden. En de vakantie? Die plannen Nederlanders al in januari!

Eén dag is heel belangrijk: de verjaardag. Als je jarig bent, komt de hele familie. Veel Nederlanders hebben zelfs een verjaardagskalender — een kalender met alle verjaardagen van de familie. En die hangt… op het toilet! Echt waar.

Dus, een tip voor jou: koop een agenda. Ik bezoek mijn oma morgen. Ik zie mijn vrienden dit weekend. Wij eten samen volgende week. Zo klinkt een echte Nederlander!`,
      textEs: `Los neerlandeses viven con agenda. Trabajo, deporte, familia — todo está en el calendario. ¿Quieres ver a un amigo? Pues haces una cita. ¿Presentarte de visita sin avisar? ¡En Países Bajos eso no es normal!

Los momentos en familia también van a la agenda. Mucha gente visita a sus padres el domingo. El sábado ven a los amigos. ¿Y las vacaciones? ¡Los neerlandeses las planifican ya en enero!

Hay un día muy importante: el cumpleaños. Cuando cumples años, viene toda la familia. Muchos neerlandeses tienen incluso un "verjaardagskalender" — un calendario con todos los cumpleaños de la familia. ¿Y dónde lo cuelgan…? ¡En el baño! De verdad.

Así que, un consejo: cómprate una agenda. Visito a mi abuela mañana. Veo a mis amigos este fin de semana. Comemos juntos la semana que viene. ¡Así suena un neerlandés de verdad!`,
      exercises: [
        { id: 'm2l3lz-1', type: 'multiple_choice', prompt: '¿Con qué viven los neerlandeses según el texto?', options: ['Con una agenda', 'Sin planes', 'Con un mapa', 'Con un reloj de arena'], correctAnswer: 'Con una agenda', explanation: '"Nederlanders leven met een agenda."' },
        { id: 'm2l3lz-2', type: 'multiple_choice', prompt: '¿Qué haces si quieres ver a un amigo?', options: ['Una cita (afspraak)', 'Ir sin avisar', 'Esperar en su casa', 'Llamar a su madre'], correctAnswer: 'Una cita (afspraak)', explanation: 'Ir de visita sin avisar "is in Nederland niet normaal".' },
        { id: 'm2l3lz-3', type: 'multiple_choice', prompt: '¿Cuándo visita mucha gente a sus padres?', options: ['El domingo', 'El lunes', 'El miércoles', 'Nunca'], correctAnswer: 'El domingo', explanation: '"Veel mensen bezoeken hun ouders op zondag."' },
        { id: 'm2l3lz-4', type: 'multiple_choice', prompt: '¿Cuándo planifican los neerlandeses las vacaciones?', options: ['Ya en enero', 'El día antes', 'En agosto', 'No las planifican'], correctAnswer: 'Ya en enero', explanation: '"Die plannen Nederlanders al in januari!"' },
        { id: 'm2l3lz-5', type: 'multiple_choice', prompt: '¿Qué es un "verjaardagskalender"?', options: ['Un calendario con los cumpleaños de la familia', 'Una tarta', 'Una fiesta', 'Un regalo'], correctAnswer: 'Un calendario con los cumpleaños de la familia', explanation: 'Y se cuelga… ¡en el baño!' },
        { id: 'm2l3lz-6', type: 'multiple_choice', prompt: '¿Dónde cuelgan muchos neerlandeses ese calendario?', options: ['En el baño', 'En la cocina', 'En el salón', 'En la puerta'], correctAnswer: 'En el baño', explanation: '"En die hangt… op het toilet! Echt waar."' },
        { id: 'm2l3lz-7', type: 'fill_blank', prompt: 'Ik ___ mijn oma morgen. (visitar)', correctAnswer: 'bezoek', hint: 'bezoeken → con ik va la raíz', explanation: 'bezoeken → bezoek.' },
        { id: 'm2l3lz-8', type: 'fill_blank', prompt: 'Wil je een vriend zien? Dan maak je een ___.', correctAnswer: 'afspraak', hint: 'La palabra neerlandesa para cita', explanation: 'De afspraak = la cita.' },
        { id: 'm2l3lz-9', type: 'fill_blank', prompt: 'Ik zie mijn vrienden dit ___.', correctAnswer: 'weekend', hint: 'este fin de semana', explanation: '"Dit weekend" = este fin de semana.' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'm2d3',
        title: 'De agenda van Anna',
        context: 'David en Anna plannen hun week. Negende ontmoeting.',
        lines: [
          { id: 'm2d3-1',  speaker: 'David', dutch: 'Hoi Anna! Wanneer zien we elkaar volgende week?',                       spanish: '¡Hola Anna! ¿Cuándo nos vemos la semana que viene?' },
          { id: 'm2d3-2',  speaker: 'Anna',  dutch: 'Momentje, ik pak mijn agenda… Op maandag werk ik.',                     spanish: 'Un momento, cojo mi agenda… El lunes trabajo.' },
          { id: 'm2d3-3',  speaker: 'David', dutch: 'Dinsdag dan?',                                                          spanish: '¿El martes entonces?' },
          { id: 'm2d3-4',  speaker: 'Anna',  dutch: 'Nee, op dinsdag bezoek ik mijn oma. Zij is jarig!',                     spanish: 'No, el martes visito a mi abuela. ¡Cumple años!' },
          { id: 'm2d3-5',  speaker: 'David', dutch: 'Gefeliciteerd! Hoe oud wordt ze?',                                      spanish: '¡Felicidades! ¿Cuántos cumple?' },
          { id: 'm2d3-6',  speaker: 'Anna',  dutch: 'Tachtig! De hele familie komt. Mijn ouders, mijn broer, iedereen.',     spanish: '¡Ochenta! Viene toda la familia. Mis padres, mi hermano, todos.' },
          { id: 'm2d3-7',  speaker: 'David', dutch: 'Wat gezellig! En woensdag?',                                            spanish: '¡Qué bonito! ¿Y el miércoles?' },
          { id: 'm2d3-8',  speaker: 'Anna',  dutch: 'Woensdag kan! Ik zet het in mijn agenda: David, woensdag.',             spanish: '¡El miércoles puede ser! Lo apunto en mi agenda: David, miércoles.' },
          { id: 'm2d3-9',  speaker: 'David', dutch: 'Sta ik nu in jouw agenda? Wat officieel!',                              spanish: '¿Ya estoy en tu agenda? ¡Qué oficial!' },
          { id: 'm2d3-10', speaker: 'Anna',  dutch: 'Haha, zo werkt Nederland! Zonder afspraak geen koffie.',                spanish: '¡Jaja, así funciona Países Bajos! Sin cita no hay café.' },
          { id: 'm2d3-11', speaker: 'David', dutch: 'En in augustus? Ik ga op vakantie naar Argentinië.',                    spanish: '¿Y en agosto? Me voy de vacaciones a Argentina.' },
          { id: 'm2d3-12', speaker: 'Anna',  dutch: 'Leuk! Dan zie je je familie weer. Hoe lang?',                           spanish: '¡Qué bien! Verás a tu familia otra vez. ¿Cuánto tiempo?' },
          { id: 'm2d3-13', speaker: 'David', dutch: 'Drie weken. Mijn zus is jarig in augustus!',                            spanish: 'Tres semanas. ¡Mi hermana cumple años en agosto!' },
          { id: 'm2d3-14', speaker: 'Anna',  dutch: 'Perfect gepland. Tot woensdag, David!',                                 spanish: 'Perfectamente planeado. ¡Hasta el miércoles, David!' },
          { id: 'm2d3-15', speaker: 'David', dutch: 'Tot woensdag! Het staat in mijn agenda.',                               spanish: '¡Hasta el miércoles! Está en mi agenda.' },
        ],
      },
    },
    {
      type: 'practice',
      exercises: [
        // ── Opción múltiple ──
        { id: 'm2l3e-1',  type: 'multiple_choice', prompt: '¿Qué palabra usas para decir en qué DÍA haces algo?', options: ['op', 'in', 'om', 'bij'], correctAnswer: 'op', explanation: 'Op + día: Ik werk op maandag.' },
        { id: 'm2l3e-2',  type: 'multiple_choice', prompt: '¿Y para el MES?', options: ['in', 'op', 'om', 'naar'], correctAnswer: 'in', explanation: 'In + mes: Mijn moeder is jarig in juni.' },
        { id: 'm2l3e-3',  type: 'multiple_choice', prompt: '¿Qué significa "overmorgen"?', options: ['Pasado mañana', 'Ayer', 'Esta mañana', 'Anteayer'], correctAnswer: 'Pasado mañana', explanation: 'morgen = mañana · overmorgen = pasado mañana.' },
        { id: 'm2l3e-4',  type: 'multiple_choice', prompt: '"Mijn moeder is jarig in juni" significa…', options: ['Mi madre cumple años en junio', 'Mi madre trabaja en junio', 'Mi madre viaja en junio', 'Mi madre nació en Junio (ciudad)'], correctAnswer: 'Mi madre cumple años en junio', explanation: 'Jarig zijn = cumplir años.' },
        { id: 'm2l3e-5',  type: 'multiple_choice', prompt: '¿Dónde conviene poner el tiempo en la frase?', options: ['Al final', 'Al principio siempre', 'Entre sujeto y verbo', 'No se pone'], correctAnswer: 'Al final', explanation: 'S + V + resto + tiempo: Ik bezoek mijn oma morgen.' },
        // ── Verdadero / Falso ──
        { id: 'm2l3e-6',  type: 'true_false', prompt: '"Gisteren" significa ayer.', correctAnswer: 'verdadero', explanation: 'vandaag (hoy) · morgen (mañana) · gisteren (ayer).' },
        { id: 'm2l3e-7',  type: 'true_false', prompt: 'Se dice "Ik werk in maandag".', correctAnswer: 'falso', explanation: 'Con los días va OP: Ik werk op maandag.' },
        { id: 'm2l3e-8',  type: 'true_false', prompt: '"De afspraak" es la cita o el compromiso.', correctAnswer: 'verdadero', explanation: 'Palabra clave en Países Bajos: sin afspraak no hay café.' },
        // ── Completar ──
        { id: 'm2l3e-9',  type: 'fill_blank', prompt: 'Ik zie mijn familie ___ zaterdag. (día)', correctAnswer: 'op', hint: '¿op o in? Es un día' },
        { id: 'm2l3e-10', type: 'fill_blank', prompt: 'Ik ga op vakantie ___ augustus. (mes)', correctAnswer: 'in', hint: '¿op o in? Es un mes' },
        { id: 'm2l3e-11', type: 'fill_blank', prompt: 'Wij ___ onze vrienden dit weekend. (ver)', correctAnswer: 'zien', hint: 'plural → infinitivo' },
        { id: 'm2l3e-12', type: 'fill_blank', prompt: 'Ik ___ mijn oma morgen. (visitar)', correctAnswer: 'bezoek', hint: 'bezoeken → con ik va la raíz' },
        // ── Ordenar frases ──
        { id: 'm2l3e-13', type: 'order_sentence', prompt: 'Ordena: "Visito a mi abuela mañana."', options: ['Ik', 'bezoek', 'mijn', 'oma', 'morgen'], correctAnswer: 'Ik bezoek mijn oma morgen' },
        { id: 'm2l3e-14', type: 'order_sentence', prompt: 'Ordena: "Trabajamos hoy."', options: ['Wij', 'werken', 'vandaag'], correctAnswer: 'Wij werken vandaag' },
        { id: 'm2l3e-15', type: 'order_sentence', prompt: 'Ordena: "Veo a mi familia este fin de semana."', options: ['Ik', 'zie', 'mijn', 'familie', 'dit', 'weekend'], correctAnswer: 'Ik zie mijn familie dit weekend' },
        // ── Sopa de letras ──
        { id: 'm2l3e-16', type: 'word_scramble', prompt: '¿Cómo se dice "ayer"?', correctAnswer: 'gisteren', hint: 'ayer' },
        { id: 'm2l3e-17', type: 'word_scramble', prompt: '¿Cómo se dice "la cita"?', correctAnswer: 'afspraak', hint: 'de …' },
        // ── Letras que faltan ──
        { id: 'm2l3e-18', type: 'letter_dash', prompt: 'Completa: "pasado mañana"', correctAnswer: 'overmorgen', hint: 'El día después de mañana' },
        { id: 'm2l3e-19', type: 'letter_dash', prompt: 'Completa: "las vacaciones"', correctAnswer: 'vakantie', hint: 'de …' },
        // ── Unir parejas ──
        { id: 'm2l3e-20', type: 'match_pairs', prompt: 'Une cada palabra de tiempo con su traducción', correctAnswer: '', pairs: [
          { left: 'vandaag', right: 'hoy' },
          { left: 'morgen', right: 'mañana' },
          { left: 'gisteren', right: 'ayer' },
          { left: 'overmorgen', right: 'pasado mañana' },
          { left: 'dit weekend', right: 'este fin de semana' },
          { left: 'volgende week', right: 'la semana que viene' },
        ] },
        { id: 'm2l3e-21', type: 'match_pairs', prompt: 'Une cada palabra con su traducción', correctAnswer: '', pairs: [
          { left: 'de afspraak', right: 'la cita' },
          { left: 'de kalender', right: 'el calendario' },
          { left: 'bezoeken', right: 'visitar' },
          { left: 'zien', right: 'ver' },
          { left: 'jarig zijn', right: 'cumplir años' },
          { left: 'de vakantie', right: 'las vacaciones' },
        ] },
        // ── Emoji ──
        { id: 'm2l3e-22', type: 'emoji_choice', prompt: '¿Qué emoji representa "jarig zijn"?', options: ['🎂', '📅', '🏖️', '🤝'], correctAnswer: '🎂', explanation: 'Cumplir años → la tarta.' },
        { id: 'm2l3e-23', type: 'emoji_choice', prompt: '¿Qué emoji representa "de vakantie"?', options: ['🏖️', '🗓️', '🚪', '👀'], correctAnswer: '🏖️', explanation: 'De vakantie = las vacaciones.' },
        // ── El intruso ──
        { id: 'm2l3e-24', type: 'odd_one_out', prompt: '¿Cuál NO es una palabra de tiempo?', options: ['vandaag', 'morgen', 'gisteren', 'oma'], correctAnswer: 'oma', explanation: 'De oma es la abuela — a ella la VISITAS mañana.' },
        { id: 'm2l3e-25', type: 'odd_one_out', prompt: '¿Con cuál usas IN (las otras van con OP)?', options: ['maandag', 'zaterdag', 'juni', 'zondag'], correctAnswer: 'juni', explanation: 'Juni es un mes → in juni. Los días van con op.' },
        // ── Escribir ──
        { id: 'm2l3e-26', type: 'write_answer', prompt: 'Escribe en neerlandés: "Trabajo hoy"', correctAnswer: 'Ik werk vandaag', hint: 'S + V + tiempo · sin punto final' },
        { id: 'm2l3e-27', type: 'write_answer', prompt: 'Escribe la palabra para "cumplir años" (2 palabras)', correctAnswer: 'jarig zijn', hint: '… zijn' },
        // ── Escuchar ──
        { id: 'm2l3e-28', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "Ik bezoek mijn oma morgen"', options: ['Ik bezoek mijn oma morgen', 'Ik bezoek mijn oma overmorgen', 'Ik bezoek mijn opa morgen', 'Ik zie mijn oma morgen'], correctAnswer: 'Ik bezoek mijn oma morgen' },
        { id: 'm2l3e-29', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "overmorgen"', options: ['overmorgen', 'morgen', 'gisteren', 'vandaag'], correctAnswer: 'overmorgen' },
        { id: 'm2l3e-30', type: 'listen_translate', prompt: 'Escucha y traduce: "Wij werken volgende week"', options: ['Trabajamos', 'la', 'semana', 'que', 'viene', 'pasada'], correctAnswer: 'Trabajamos la semana que viene' },
        // ── Comprensión del diálogo (De agenda van Anna) ──
        { id: 'm2l3e-31', type: 'multiple_choice', prompt: 'En el diálogo, ¿por qué no puede Anna el martes?', options: ['Visita a su abuela, que cumple años', 'Trabaja', 'Está de vacaciones', 'Ve a sus amigos'], correctAnswer: 'Visita a su abuela, que cumple años', explanation: '"Op dinsdag bezoek ik mijn oma. Zij is jarig!" — ¡cumple 80!' },
        { id: 'm2l3e-32', type: 'multiple_choice', prompt: '¿Qué día quedan al final David y Anna?', options: ['El miércoles', 'El lunes', 'El martes', 'El domingo'], correctAnswer: 'El miércoles', explanation: '"Woensdag kan!" — y Anna lo apunta en su agenda.' },
        { id: 'm2l3e-33', type: 'true_false', prompt: 'David se va de vacaciones a Argentina en agosto.', correctAnswer: 'verdadero', explanation: 'Tres semanas — y su hermana cumple años en agosto.' },
      ],
    },
    { type: 'review' },
  ],
};
const m2_les4: Lesson = {
  id: 'm2-les-4-lidwoorden',
  moduleId: 'familie-vrienden',
  title: 'Les 4 — Grammatica | Lidwoorden & bezit',
  subtitle: 'Los artículos de/het/een y todos los posesivos',
  order: 4,
  learningObjective: 'Usar de/het/een y los posesivos (mijn, jouw, zijn, haar, ons/onze…) en frases correctas',
  estimatedMinutes: 30,
  blocks: [
    {
      type: 'summary',
      title: 'Lidwoorden & bezit',
      intro: 'Hoy dominas dos piezas pequeñas pero potentes: los artículos (de, het, een) y los posesivos (mi, tu, su…). Con ellas hablas de tu familia y de quién es cada cosa.',
      objectives: [
        'Usar de / het / een',
        'Usar todos los posesivos',
        'Elegir bien entre ons y onze',
      ],
      sections: [
        {
          heading: '🏷️ Los artículos: de, het, een',
          body: '**de / het** = el/la · **een** = un/una. ¿Cuándo de y cuándo het? **No hay regla clara → memoriza cada palabra CON su artículo**, en bloques: *de vader, de moeder, de familie · het kind, het gezin · een vriend, een vriendin*.',
        },
        {
          heading: '🔑 Los posesivos',
          items: [
            { nl: 'mijn', es: 'mi' },
            { nl: 'jouw', es: 'tu' },
            { nl: 'zijn', es: 'su (de él)' },
            { nl: 'haar', es: 'su (de ella)' },
            { nl: 'uw', es: 'su (formal, de usted)' },
            { nl: 'ons / onze', es: 'nuestro/a' },
            { nl: 'jullie', es: 'vuestro/a' },
            { nl: 'hun', es: 'su (de ellos)' },
          ],
        },
        {
          heading: '⚖️ ¿Ons u onze?',
          body: 'La única pareja que cambia: **ons** con palabras de *het* (*ons huis*, *ons gezin*) · **onze** con palabras de *de* Y SIEMPRE con plural (*onze moeder*, *onze ouders* — el plural siempre lleva "de").',
        },
        {
          heading: '👫 Zijn vs. haar — el error español',
          body: 'En español "su" vale para todo. En neerlandés depende del DUEÑO: **zijn** = de él · **haar** = de ella. *Zijn moeder* = la madre de él · *Haar moeder* = la madre de ella.',
        },
        {
          heading: '🚂 En la frase',
          body: 'El artículo o el posesivo va SIEMPRE delante de su sustantivo, dentro del tren S+V+R: *Mijn vader werkt in Nederland* · *Onze ouders wonen in Spanje* · *Jullie vrienden reizen in de zomer*.',
        },
      ],
      tip: 'Aprende cada palabra nueva CON su artículo (de moeder, het kind) — te regala el ons/onze gratis: het huis → ONS huis · de moeder → ONZE moeder · plural → siempre ONZE.',
    },
    {
      type: 'vocabulary',
      items: [
        { id: 'm2l4v-jouw',   dutch: 'jouw',      spanish: 'tu',                        article: null,  emoji: '👉', color: '#0b7a4d', exampleNl: 'Jouw broer werkt in het weekend.',  exampleEs: 'Tu hermano trabaja el fin de semana.', category: 'bezit', difficulty: 'A0' },
        { id: 'm2l4v-zijn',   dutch: 'zijn',      spanish: 'su (de él)',                article: null,  emoji: '👨', color: '#1a7a40', exampleNl: 'Dit zijn zijn vrienden.',           exampleEs: 'Estos son sus amigos (de él).',        category: 'bezit', difficulty: 'A0' },
        { id: 'm2l4v-haar',   dutch: 'haar',      spanish: 'su (de ella)',              article: null,  emoji: '👩', color: '#0d6e33', exampleNl: 'Dit is haar zus.',                  exampleEs: 'Esta es su hermana (de ella).',        category: 'bezit', difficulty: 'A0' },
        { id: 'm2l4v-uw',     dutch: 'uw',        spanish: 'su (formal, de usted)',     article: null,  emoji: '🎩', color: '#2e7d52', exampleNl: 'Is dit uw opa?',                    exampleEs: '¿Es este su abuelo (de usted)?',       category: 'bezit', difficulty: 'A0' },
        { id: 'm2l4v-ons',    dutch: 'ons',       spanish: 'nuestro (con palabras het)', article: null, emoji: '🏠', color: '#0b7a4d', exampleNl: 'Dit is ons huis.',                  exampleEs: 'Esta es nuestra casa.',                category: 'bezit', difficulty: 'A0' },
        { id: 'm2l4v-onze',   dutch: 'onze',      spanish: 'nuestro (con palabras de y plural)', article: null, emoji: '👥', color: '#1a7a40', exampleNl: 'Dit zijn onze ouders.',    exampleEs: 'Estos son nuestros padres.',           category: 'bezit', difficulty: 'A0' },
        { id: 'm2l4v-hun',    dutch: 'hun',       spanish: 'su (de ellos)',             article: null,  emoji: '👪', color: '#0d6e33', exampleNl: 'Hun vader is arts.',                exampleEs: 'Su padre (de ellos) es médico.',       category: 'bezit', difficulty: 'A0' },
        { id: 'm2l4v-een',    dutch: 'een',       spanish: 'un / una',                  article: null,  emoji: '1️⃣', color: '#2e7d52', exampleNl: 'Ik heb een vriendin.',              exampleEs: 'Tengo una novia.',                     category: 'lidwoorden', difficulty: 'A0' },
        { id: 'm2l4v-hebben', dutch: 'hebben',    spanish: 'tener',                     article: null,  emoji: '🤲', color: '#0b7a4d', exampleNl: 'Ik heb een vriend.',                exampleEs: 'Tengo un novio.',                      category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm2l4v-reizen', dutch: 'reizen',    spanish: 'viajar',                    article: null,  emoji: '✈️', color: '#1a7a40', exampleNl: 'Jullie vrienden reizen in de zomer.', exampleEs: 'Vuestros amigos viajan en verano.',  category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm2l4v-zomer',  dutch: 'de zomer',  spanish: 'el verano',                 article: 'de',  emoji: '☀️', color: '#0d6e33', exampleNl: 'Mijn moeder werkt in de zomer.',    exampleEs: 'Mi madre trabaja en verano.',          category: 'tijd', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm2l4p-1',  dutch: 'Ik heb een vriend.',              spanish: 'Tengo un novio.',                       context: 'Artículo een' },
        { id: 'm2l4p-2',  dutch: 'De familie woont in Nederland.',  spanish: 'La familia vive en Países Bajos.',      context: 'Artículo de' },
        { id: 'm2l4p-3',  dutch: 'Het kind is vijf jaar.',          spanish: 'El niño tiene cinco años.',             context: 'Artículo het' },
        { id: 'm2l4p-4',  dutch: 'Dit is jouw broer.',              spanish: 'Este es tu hermano.',                   context: 'Posesivos' },
        { id: 'm2l4p-5',  dutch: 'Dit zijn zijn vrienden.',         spanish: 'Estos son sus amigos (de él).',         context: 'Posesivos' },
        { id: 'm2l4p-6',  dutch: 'Dit is haar zus.',                spanish: 'Esta es su hermana (de ella).',         context: 'Posesivos' },
        { id: 'm2l4p-7',  dutch: 'Dit zijn onze ouders.',           spanish: 'Estos son nuestros padres.',            context: 'Posesivos' },
        { id: 'm2l4p-8',  dutch: 'Dit is ons huis.',                spanish: 'Esta es nuestra casa.',                 context: 'Ons/onze' },
        { id: 'm2l4p-9',  dutch: 'Onze familie woont in Spanje.',   spanish: 'Nuestra familia vive en España.',       context: 'Ons/onze' },
        { id: 'm2l4p-10', dutch: 'Hun vader is arts.',              spanish: 'Su padre (de ellos) es médico.',        context: 'Posesivos' },
        { id: 'm2l4p-11', dutch: 'Jouw broer werkt in het weekend.', spanish: 'Tu hermano trabaja el fin de semana.', context: 'En la frase' },
        { id: 'm2l4p-12', dutch: 'Jullie vrienden reizen in de zomer.', spanish: 'Vuestros amigos viajan en verano.', context: 'En la frase' },
      ],
    },
    {
      type: 'lezen',
      title: 'Twee huizen, één straat',
      textNl: `In de straat van Sofia en Pablo staan twee huizen naast elkaar. Het eerste huis is van Sofia en Pablo. Hun huis is klein, maar hun tuin is groot. Sofia zegt altijd: ons huis is klein, maar onze kat is de baas!

Het tweede huis is van Jan en Els, de schilders. Hun huis is groot en heel kleurrijk — logisch, met twee schilders! Zijn fiets staat voor de deur, en haar bloemen staan voor het raam. Jan zegt: mijn fiets. Els zegt: mijn bloemen. Samen zeggen ze: onze straat is de mooiste van Rotterdam.

Waarom is het "ons huis" maar "onze kat"? Simpel: huis is een het-woord, dus ons. Kat is een de-woord, dus onze. En bij meer dingen — onze bloemen, onze vrienden — is het altijd onze.

Eén straat, twee huizen, veel bezit: mijn, jouw, zijn, haar, ons, onze, hun. Nu ken jij ze allemaal!`,
      textEs: `En la calle de Sofía y Pablo hay dos casas una junto a la otra. La primera casa es de Sofía y Pablo. Su casa es pequeña, pero su jardín es grande. Sofía siempre dice: nuestra casa (ons huis) es pequeña, ¡pero nuestra gata (onze kat) es la jefa!

La segunda casa es de Jan y Els, los pintores. Su casa es grande y muy colorida — ¡lógico, con dos pintores! Su bici (de él, zijn fiets) está delante de la puerta, y sus flores (de ella, haar bloemen) están delante de la ventana. Jan dice: mijn fiets (mi bici). Els dice: mijn bloemen (mis flores). Y juntos dicen: onze straat (nuestra calle) es la más bonita de Róterdam.

¿Por qué es "ons huis" pero "onze kat"? Simple: huis es palabra de "het", así que ons. Kat es palabra de "de", así que onze. Y con varias cosas — onze bloemen, onze vrienden — siempre es onze.

Una calle, dos casas, mucho posesivo: mijn, jouw, zijn, haar, ons, onze, hun. ¡Ya los conoces todos!`,
      exercises: [
        { id: 'm2l4lz-1', type: 'multiple_choice', prompt: '¿De quién es la primera casa?', options: ['De Sofía y Pablo', 'De Jan y Els', 'De David', 'De la gata'], correctAnswer: 'De Sofía y Pablo', explanation: '"Het eerste huis is van Sofia en Pablo."' },
        { id: 'm2l4lz-2', type: 'multiple_choice', prompt: '¿Por qué se dice "ONS huis"?', options: ['Porque huis es palabra de "het"', 'Porque la casa es pequeña', 'Porque suena mejor', 'Porque es plural'], correctAnswer: 'Porque huis es palabra de "het"', explanation: 'het huis → ons huis · de kat → onze kat.' },
        { id: 'm2l4lz-3', type: 'multiple_choice', prompt: '¿Y por qué "ONZE kat"?', options: ['Porque kat es palabra de "de"', 'Porque la gata es la jefa', 'Porque es un animal', 'Porque es femenino'], correctAnswer: 'Porque kat es palabra de "de"', explanation: 'Palabras de "de" → onze.' },
        { id: 'm2l4lz-4', type: 'multiple_choice', prompt: '¿Cómo es la casa de Jan y Els?', options: ['Grande y muy colorida', 'Pequeña y blanca', 'Vieja y gris', 'Nueva y vacía'], correctAnswer: 'Grande y muy colorida', explanation: '"Hun huis is groot en heel kleurrijk" — ¡con dos pintores, lógico!' },
        { id: 'm2l4lz-5', type: 'multiple_choice', prompt: '"Zijn fiets" — ¿de quién es la bici?', options: ['De Jan (de él)', 'De Els (de ella)', 'De los dos', 'De Sofía'], correctAnswer: 'De Jan (de él)', explanation: 'zijn = su (de él) · haar = su (de ella): haar bloemen son de Els.' },
        { id: 'm2l4lz-6', type: 'fill_blank', prompt: 'Dit is ___ huis. (nuestra — het huis)', correctAnswer: 'ons', hint: '¿huis es de-woord o het-woord?', explanation: 'het huis → ons huis.' },
        { id: 'm2l4lz-7', type: 'fill_blank', prompt: '___ bloemen staan voor het raam. (de ella)', correctAnswer: 'Haar', hint: 'su, hablando de Els (mujer)', explanation: 'De una mujer → haar.' },
        { id: 'm2l4lz-8', type: 'fill_blank', prompt: 'Met meer dingen is het altijd ___: onze bloemen, onze vrienden.', correctAnswer: 'onze', hint: 'El plural siempre lleva "de" →', explanation: 'Plural → siempre onze.' },
        { id: 'm2l4lz-9', type: 'multiple_choice', prompt: 'Según el texto, ¿qué dicen Jan y Els juntos?', options: ['Onze straat es la más bonita de Róterdam', 'Ons straat es fea', 'Su calle es ruidosa', 'Quieren mudarse'], correctAnswer: 'Onze straat es la más bonita de Róterdam', explanation: 'de straat → onze straat.' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'm2d4',
        title: 'Bij de ouders van Anna',
        context: 'David gaat mee naar het huis van de ouders van Anna. Tiende ontmoeting.',
        lines: [
          { id: 'm2d4-1',  speaker: 'David', dutch: 'Wauw, wat een mooi huis!',                                             spanish: '¡Guau, qué casa tan bonita!' },
          { id: 'm2d4-2',  speaker: 'Anna',  dutch: 'Dank je! Dit is ons huis — nou ja, het huis van mijn ouders.',         spanish: '¡Gracias! Esta es nuestra casa — bueno, la casa de mis padres.' },
          { id: 'm2d4-3',  speaker: 'David', dutch: 'Ons huis… omdat huis een het-woord is, toch?',                          spanish: 'Ons huis… porque huis es palabra de "het", ¿verdad?' },
          { id: 'm2d4-4',  speaker: 'Anna',  dutch: 'Heel goed! Kom, dit is mijn moeder. Mama, dit is David.',              spanish: '¡Muy bien! Ven, esta es mi madre. Mamá, este es David.' },
          { id: 'm2d4-5',  speaker: 'David', dutch: 'Aangenaam, mevrouw! Uw huis is prachtig.',                              spanish: '¡Encantado, señora! Su casa (de usted) es preciosa.' },
          { id: 'm2d4-6',  speaker: 'Anna',  dutch: 'Haha, "uw"! Wat beleefd. Mijn moeder vindt het al leuk.',              spanish: '¡Jaja, "uw"! Qué educado. A mi madre ya le caes bien.' },
          { id: 'm2d4-7',  speaker: 'David', dutch: 'En wie is dat op de foto? Haar vader?',                                 spanish: '¿Y quién es ese de la foto? ¿Su padre (de ella)?' },
          { id: 'm2d4-8',  speaker: 'Anna',  dutch: 'Ja, dat is haar vader — mijn opa dus. En dat is zijn hond, Max.',      spanish: 'Sí, es su padre — o sea, mi abuelo. Y ese es su perro (de él), Max.' },
          { id: 'm2d4-9',  speaker: 'David', dutch: 'Zijn hond, haar vader, ons huis… bezit is overal!',                     spanish: 'Su perro, su padre, nuestra casa… ¡el posesivo está en todas partes!' },
          { id: 'm2d4-10', speaker: 'Anna',  dutch: 'Haha! En kijk: dit zijn onze kamers, van mijn broer en mij.',          spanish: '¡Jaja! Y mira: estas son nuestras habitaciones, de mi hermano y mías.' },
          { id: 'm2d4-11', speaker: 'David', dutch: 'Onze kamers — plural, dus altijd onze!',                                spanish: 'Onze kamers — ¡plural, así que siempre onze!' },
          { id: 'm2d4-12', speaker: 'Anna',  dutch: 'Je leert snel! Blijf je eten? Mijn ouders koken vanavond.',            spanish: '¡Aprendes rápido! ¿Te quedas a cenar? Mis padres cocinan esta noche.' },
          { id: 'm2d4-13', speaker: 'David', dutch: 'Heel graag! Hun eten ruikt nu al lekker.',                              spanish: '¡Encantado! Su comida (de ellos) ya huele bien.' },
          { id: 'm2d4-14', speaker: 'Anna',  dutch: 'Hun eten, heel goed! Kom, we gaan naar de keuken.',                     spanish: '"Hun eten", ¡muy bien! Ven, vamos a la cocina.' },
        ],
      },
    },
    {
      type: 'practice',
      exercises: [
        // ── Opción múltiple ──
        { id: 'm2l4e-1',  type: 'multiple_choice', prompt: '¿Cuál es la regla para saber si una palabra va con "de" o "het"?', options: ['No hay regla clara: se memoriza con cada palabra', 'Femenino = de, masculino = het', 'Las cortas van con het', 'Todas van con de'], correctAnswer: 'No hay regla clara: se memoriza con cada palabra', explanation: 'Por eso: aprende cada palabra CON su artículo, en bloques.' },
        { id: 'm2l4e-2',  type: 'multiple_choice', prompt: '"Su madre", hablando de ELLA, es…', options: ['haar moeder', 'zijn moeder', 'hun moeder', 'uw moeder'], correctAnswer: 'haar moeder', explanation: 'zijn = de él · haar = de ella · hun = de ellos · uw = de usted.' },
        { id: 'm2l4e-3',  type: 'multiple_choice', prompt: '¿"Ons" o "onze"? Nuestra casa (het huis):', options: ['ons huis', 'onze huis', 'onzen huis', 'ons huize'], correctAnswer: 'ons huis', explanation: 'Palabras de "het" → ons.' },
        { id: 'm2l4e-4',  type: 'multiple_choice', prompt: '¿"Ons" o "onze"? Nuestros padres (plural):', options: ['onze ouders', 'ons ouders', 'onzen ouders', 'ons oudere'], correctAnswer: 'onze ouders', explanation: 'El plural siempre lleva "de" → siempre onze.' },
        { id: 'm2l4e-5',  type: 'multiple_choice', prompt: '"Tengo un amigo" es…', options: ['Ik heb een vriend.', 'Ik heb de vriend.', 'Ik heb het vriend.', 'Ik heb vriend.'], correctAnswer: 'Ik heb een vriend.', explanation: 'Algo no concreto → artículo indefinido een.' },
        // ── Verdadero / Falso ──
        { id: 'm2l4e-6',  type: 'true_false', prompt: '"Zijn" y "haar" significan los dos "su": la diferencia es de quién es.', correctAnswer: 'verdadero', explanation: 'zijn = de él · haar = de ella. El dueño decide.' },
        { id: 'm2l4e-7',  type: 'true_false', prompt: 'Con el plural puedes elegir entre ons y onze.', correctAnswer: 'falso', explanation: 'Plural → SIEMPRE onze (el plural siempre lleva "de").' },
        { id: 'm2l4e-8',  type: 'true_false', prompt: '"Uw" es el posesivo formal (de usted).', correctAnswer: 'verdadero', explanation: 'Uw opa = su abuelo (de usted). Como "u" pero posesivo.' },
        // ── Completar ──
        { id: 'm2l4e-9',  type: 'fill_blank', prompt: 'Dit is ___ zus. (de ella)', correctAnswer: 'haar', hint: '¿De él o de ella? Es de ella' },
        { id: 'm2l4e-10', type: 'fill_blank', prompt: 'Dit zijn ___ vrienden. (de él)', correctAnswer: 'zijn', hint: '¿De él o de ella? Es de él' },
        { id: 'm2l4e-11', type: 'fill_blank', prompt: 'Dit is ___ gezin. (nuestro — het gezin)', correctAnswer: 'ons', hint: '¿gezin es de-woord o het-woord?' },
        { id: 'm2l4e-12', type: 'fill_blank', prompt: '___ vader is arts. (de ellos)', correctAnswer: 'Hun', hint: 'su, hablando de varias personas' },
        { id: 'm2l4e-13', type: 'fill_blank', prompt: 'Ik heb ___ vriendin. (una)', correctAnswer: 'een', hint: 'El artículo indefinido' },
        // ── Ordenar frases ──
        { id: 'm2l4e-14', type: 'order_sentence', prompt: 'Ordena: "Mi padre trabaja en Países Bajos."', options: ['Mijn', 'vader', 'werkt', 'in', 'Nederland'], correctAnswer: 'Mijn vader werkt in Nederland' },
        { id: 'm2l4e-15', type: 'order_sentence', prompt: 'Ordena: "Nuestros padres viven en España."', options: ['Onze', 'ouders', 'wonen', 'in', 'Spanje'], correctAnswer: 'Onze ouders wonen in Spanje' },
        { id: 'm2l4e-16', type: 'order_sentence', prompt: 'Ordena: "Vuestros amigos viajan en verano."', options: ['Jullie', 'vrienden', 'reizen', 'in', 'de', 'zomer'], correctAnswer: 'Jullie vrienden reizen in de zomer' },
        // ── Sopa de letras ──
        { id: 'm2l4e-17', type: 'word_scramble', prompt: '¿Cómo se dice "tener"?', correctAnswer: 'hebben', hint: 'tener' },
        { id: 'm2l4e-18', type: 'word_scramble', prompt: '¿Cómo se dice "viajar"?', correctAnswer: 'reizen', hint: 'viajar' },
        // ── Letras que faltan ──
        { id: 'm2l4e-19', type: 'letter_dash', prompt: 'Completa: "el verano"', correctAnswer: 'zomer', hint: 'de …' },
        { id: 'm2l4e-20', type: 'letter_dash', prompt: 'Completa: "nuestro (con palabras de y plural)"', correctAnswer: 'onze', hint: '… ouders' },
        // ── Unir parejas ──
        { id: 'm2l4e-21', type: 'match_pairs', prompt: 'Une cada posesivo con su significado', correctAnswer: '', pairs: [
          { left: 'jouw', right: 'tu' },
          { left: 'zijn', right: 'su (de él)' },
          { left: 'haar', right: 'su (de ella)' },
          { left: 'uw', right: 'su (de usted)' },
          { left: 'hun', right: 'su (de ellos)' },
          { left: 'jullie', right: 'vuestro' },
        ] },
        { id: 'm2l4e-22', type: 'match_pairs', prompt: 'Une cada palabra con su artículo (¡memoriza en bloques!)', correctAnswer: '', pairs: [
          { left: 'vader', right: 'de vader' },
          { left: 'kind', right: 'het kind' },
          { left: 'gezin', right: 'het gezin' },
          { left: 'familie', right: 'de familie' },
          { left: 'moeder', right: 'de moeder' },
        ] },
        // ── Emoji ──
        { id: 'm2l4e-23', type: 'emoji_choice', prompt: '¿Qué emoji representa "reizen"?', options: ['✈️', '☀️', '🤲', '🏠'], correctAnswer: '✈️', explanation: '"Reizen" = viajar.' },
        { id: 'm2l4e-24', type: 'emoji_choice', prompt: '¿Qué emoji representa "de zomer"?', options: ['☀️', '❄️', '🍂', '🌧️'], correctAnswer: '☀️', explanation: '"De zomer" = el verano.' },
        // ── El intruso ──
        { id: 'm2l4e-25', type: 'odd_one_out', prompt: '¿Cuál NO es un posesivo?', options: ['mijn', 'jouw', 'haar', 'een'], correctAnswer: 'een', explanation: '"Een" es el artículo un/una; los otros son posesivos.' },
        { id: 'm2l4e-26', type: 'odd_one_out', prompt: '¿Con cuál usas ONS? (con las otras, onze)', options: ['moeder', 'ouders', 'huis', 'familie'], correctAnswer: 'huis', explanation: 'Het huis → ons huis. Moeder, ouders y familie van con onze.' },
        // ── Escribir ──
        { id: 'm2l4e-27', type: 'write_answer', prompt: 'Escribe en neerlandés: "Tengo un novio"', correctAnswer: 'Ik heb een vriend', hint: 'hebben → con ik va la raíz · sin punto final' },
        { id: 'm2l4e-28', type: 'write_answer', prompt: '"Su hermana", hablando de ella: escribe el posesivo', correctAnswer: 'haar', hint: 'El dueño es una mujer' },
        // ── Escuchar ──
        { id: 'm2l4e-29', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "Dit is ons huis"', options: ['Dit is ons huis', 'Dit is onze huis', 'Dit is haar huis', 'Dit zijn onze huizen'], correctAnswer: 'Dit is ons huis' },
        { id: 'm2l4e-30', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "haar familie"', options: ['haar familie', 'hun familie', 'jouw familie', 'zijn familie'], correctAnswer: 'haar familie' },
        { id: 'm2l4e-31', type: 'listen_translate', prompt: 'Escucha y traduce: "Hun vader is arts"', options: ['Su', 'padre', 'es', 'médico', 'madre', 'Mi'], correctAnswer: 'Su padre es médico' },
        // ── Comprensión del diálogo (Bij de ouders van Anna) ──
        { id: 'm2l4e-32', type: 'multiple_choice', prompt: 'En el diálogo, ¿qué posesivo usa David con la madre de Anna?', options: ['Uw (formal): "Uw huis is prachtig"', 'Jouw', 'Hun', 'Ons'], correctAnswer: 'Uw (formal): "Uw huis is prachtig"', explanation: 'Con la madre de Anna usa el formal "uw" — muy educado.' },
        { id: 'm2l4e-33', type: 'multiple_choice', prompt: '¿Cómo se llama el perro del abuelo?', options: ['Max', 'Luna', 'Kees', 'Bello'], correctAnswer: 'Max', explanation: '"Dat is zijn hond, Max" — el perro DE ÉL (del abuelo).' },
        { id: 'm2l4e-34', type: 'true_false', prompt: 'David se queda a cenar en casa de los padres de Anna.', correctAnswer: 'verdadero', explanation: '"Heel graag! Hun eten ruikt nu al lekker."' },
      ],
    },
    { type: 'review' },
  ],
};
const m2_les5: Lesson = {
  id: 'm2-les-5-voorzetsels',
  moduleId: 'familie-vrienden',
  title: 'Les 5 — Grammatica | Om, op, in',
  subtitle: 'Las preposiciones del tiempo y tu rutina',
  order: 5,
  learningObjective: 'Decir cuándo pasa algo con om (hora), op (día) e in (mes/periodo), y contar tu rutina',
  estimatedMinutes: 30,
  blocks: [
    {
      type: 'summary',
      title: 'Om, op, in',
      intro: 'La lección 3 te dio los días y los meses. Hoy completas el sistema del tiempo con las tres preposiciones — om, op, in — y las partes del día. Al final puedes contar tu rutina entera.',
      objectives: [
        'Usar om (hora), op (día) e in (mes/periodo)',
        'Decir cuándo pasa algo',
        'Contar tu rutina diaria',
      ],
      sections: [
        {
          heading: '🕗 OM + hora → "a las"',
          body: '*Ik werk om 8 uur* · *Ik eet om 7 uur*. Siempre que digas una HORA, usa **om**.',
        },
        {
          heading: '📅 OP + día → "el …"',
          body: '*Ik werk op maandag* · *Wij eten samen op zondag*. En español dices "el lunes" (sin preposición); en neerlandés hace falta **op**.',
        },
        {
          heading: '🗓️ IN + mes / periodo / parte del día → "en"',
          body: '*Mijn moeder is jarig in juni* · *Ik werk in de ochtend*. Como el inglés "in the morning". Las partes del día: **de ochtend** (la mañana), **de middag** (el mediodía/tarde), **de avond** (la tarde-noche), **de nacht** (la noche).',
        },
        {
          heading: '⚠️ Los 4 errores típicos del hispanohablante',
          items: [
            { nl: '❌ Ik werk de maandag → ✔ op maandag', es: '"el lunes" lleva OP, no artículo' },
            { nl: '❌ Ik eet op 7 uur → ✔ om 7 uur', es: 'con horas es OM (op y om se parecen, ¡ojo!)' },
            { nl: '❌ Wij zien elkaar om zondag → ✔ op zondag', es: 'con días es OP' },
            { nl: '❌ Ik werk op de ochtend → ✔ in de ochtend', es: '"por la mañana" lleva IN' },
          ],
        },
        {
          heading: '🔁 Tu rutina',
          body: 'Con om/op/in ya puedes contar el día entero: *Ik word wakker om 7 uur* (me despierto) · *Ik ontbijt om 8 uur* (desayuno) · *Ik werk op maandag* · *Ik sport in de avond* · *Ik ga naar bed om 11 uur* (me voy a la cama).',
        },
      ],
      tip: 'El truco de bolsillo: **OM → a las (hora) · OP → el (día) · IN → en (mes, periodo, parte del día)**. Tres palabritas, todo el tiempo del mundo.',
    },
    {
      type: 'vocabulary',
      items: [
        { id: 'm2l5v-om',        dutch: 'om',              spanish: '"a las" (+ hora)',            article: null, emoji: '🕗', color: '#0b7a4d', exampleNl: 'Ik werk om 8 uur.',            exampleEs: 'Trabajo a las 8.',                 category: 'voorzetsels', difficulty: 'A0' },
        { id: 'm2l5v-op',        dutch: 'op',              spanish: '"el" (+ día)',                article: null, emoji: '📅', color: '#1a7a40', exampleNl: 'Ik werk op maandag.',          exampleEs: 'Trabajo el lunes.',                category: 'voorzetsels', difficulty: 'A0' },
        { id: 'm2l5v-in',        dutch: 'in',              spanish: '"en" (+ mes / periodo)',      article: null, emoji: '🗓️', color: '#0d6e33', exampleNl: 'Ik ben jarig in januari.',     exampleEs: 'Cumplo años en enero.',            category: 'voorzetsels', difficulty: 'A0' },
        { id: 'm2l5v-uur',       dutch: 'het uur',         spanish: 'la hora',                     article: 'het', emoji: '⏰', color: '#2e7d52', exampleNl: 'Ik eet om 7 uur.',            exampleEs: 'Como a las 7.',                    category: 'tijd', difficulty: 'A0' },
        { id: 'm2l5v-ochtend',   dutch: 'de ochtend',      spanish: 'la mañana',                   article: 'de', emoji: '🌅', color: '#0b7a4d', exampleNl: 'Ik studeer in de ochtend.',    exampleEs: 'Estudio por la mañana.',           category: 'tijd', difficulty: 'A0' },
        { id: 'm2l5v-middag',    dutch: 'de middag',       spanish: 'el mediodía / la tarde',      article: 'de', emoji: '☀️', color: '#1a7a40', exampleNl: 'Ik sport in de middag.',       exampleEs: 'Hago deporte al mediodía.',        category: 'tijd', difficulty: 'A0' },
        { id: 'm2l5v-avond',     dutch: 'de avond',        spanish: 'la tarde-noche',              article: 'de', emoji: '🌆', color: '#0d6e33', exampleNl: 'Wij eten in de avond.',        exampleEs: 'Cenamos por la tarde-noche.',      category: 'tijd', difficulty: 'A0' },
        { id: 'm2l5v-nacht',     dutch: 'de nacht',        spanish: 'la noche',                    article: 'de', emoji: '🌙', color: '#2e7d52', exampleNl: 'De baby slaapt in de nacht.',  exampleEs: 'El bebé duerme por la noche.',     category: 'tijd', difficulty: 'A0' },
        { id: 'm2l5v-routine',   dutch: 'de routine',      spanish: 'la rutina',                   article: 'de', emoji: '🔁', color: '#0b7a4d', exampleNl: 'Mijn routine op maandag is simpel.', exampleEs: 'Mi rutina del lunes es simple.', category: 'tijd', difficulty: 'A0' },
        { id: 'm2l5v-wakker',    dutch: 'wakker worden',   spanish: 'despertarse',                 article: null, emoji: '⏰', color: '#1a7a40', exampleNl: 'Ik word wakker om 7 uur.',     exampleEs: 'Me despierto a las 7.',            category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm2l5v-naarbed',   dutch: 'naar bed gaan',   spanish: 'irse a la cama',              article: null, emoji: '🛏️', color: '#0d6e33', exampleNl: 'Ik ga naar bed om 11 uur.',    exampleEs: 'Me voy a la cama a las 11.',       category: 'werkwoorden', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm2l5p-1',  dutch: 'Ik werk om 8 uur.',                 spanish: 'Trabajo a las 8.',                       context: 'OM + hora' },
        { id: 'm2l5p-2',  dutch: 'Ik eet om 7 uur.',                  spanish: 'Como a las 7.',                          context: 'OM + hora' },
        { id: 'm2l5p-3',  dutch: 'Wij eten samen op zondag.',         spanish: 'Comemos juntos el domingo.',             context: 'OP + día' },
        { id: 'm2l5p-4',  dutch: 'Ik werk niet op zaterdag.',         spanish: 'No trabajo el sábado.',                  context: 'OP + día' },
        { id: 'm2l5p-5',  dutch: 'Mijn oma is jarig in maart.',       spanish: 'Mi abuela cumple años en marzo.',        context: 'IN + mes' },
        { id: 'm2l5p-6',  dutch: 'Ik werk in de ochtend.',            spanish: 'Trabajo por la mañana.',                 context: 'IN + parte del día' },
        { id: 'm2l5p-7',  dutch: 'Ik sport in de avond.',             spanish: 'Hago deporte por la tarde-noche.',       context: 'IN + parte del día' },
        { id: 'm2l5p-8',  dutch: 'Wij eten op zondag bij mijn ouders.', spanish: 'El domingo comemos en casa de mis padres.', context: 'Combinado' },
        { id: 'm2l5p-9',  dutch: 'Ik werk op maandag om 8 uur.',      spanish: 'El lunes trabajo a las 8.',              context: 'Combinado' },
        { id: 'm2l5p-10', dutch: 'Ik word wakker om 7 uur.',          spanish: 'Me despierto a las 7.',                  context: 'Rutina' },
        { id: 'm2l5p-11', dutch: 'Ik ga naar bed om 11 uur.',         spanish: 'Me voy a la cama a las 11.',             context: 'Rutina' },
        { id: 'm2l5p-12', dutch: 'Wij zien onze familie in het weekend.', spanish: 'Vemos a nuestra familia el fin de semana.', context: 'Combinado' },
      ],
    },
    {
      type: 'lezen',
      title: 'De Nederlandse klok',
      textNl: `Nederland leeft op de klok. Alles heeft een vaste tijd — en die tijd is heilig!

De dag begint vroeg. Veel Nederlanders worden wakker om 7 uur. Ze ontbijten om 8 uur: brood met kaas, natuurlijk. Ze werken in de ochtend en in de middag. De lunch? Om 12 uur precies, vaak weer… brood met kaas.

En dan het beroemdste moment: het avondeten. Nederlanders eten heel vroeg — om 6 uur in de avond! Voor veel Spaanstaligen is dat lunchtijd. Kom je om 8 uur in de avond? Dan is het eten al lang klaar.

In het weekend is de klok minder streng. Op zaterdag doen mensen boodschappen en sporten ze. Op zondag zien ze hun familie. En in de zomer? Dan zit heel Nederland buiten — de zon is hier een feest!`,
      textEs: `Países Bajos vive con el reloj. Todo tiene su hora fija — ¡y esa hora es sagrada!

El día empieza pronto. Muchos neerlandeses se despiertan a las 7. Desayunan a las 8: pan con queso, claro. Trabajan por la mañana y por la tarde. ¿La comida? A las 12 en punto, muchas veces otra vez… pan con queso.

Y luego el momento más famoso: la cena. ¡Los neerlandeses cenan muy pronto — a las 6 de la tarde! Para muchos hispanohablantes esa es la hora de comer. ¿Llegas a las 8 de la tarde? La cena ya terminó hace rato.

El fin de semana el reloj es menos estricto. El sábado la gente hace la compra y hace deporte. El domingo ven a su familia. ¿Y en verano? ¡Todo Países Bajos se sienta fuera — el sol aquí es una fiesta!`,
      exercises: [
        { id: 'm2l5lz-1', type: 'multiple_choice', prompt: '¿A qué hora se despiertan muchos neerlandeses?', options: ['A las 7', 'A las 10', 'A las 5', 'A las 9'], correctAnswer: 'A las 7', explanation: '"Veel Nederlanders worden wakker om 7 uur."' },
        { id: 'm2l5lz-2', type: 'multiple_choice', prompt: '¿Qué desayunan (y comen… y a veces cenan)?', options: ['Pan con queso', 'Tortilla', 'Cereales', 'Fruta'], correctAnswer: 'Pan con queso', explanation: 'Brood met kaas, natuurlijk — ¡el clásico de la lección 6 del módulo 1!' },
        { id: 'm2l5lz-3', type: 'multiple_choice', prompt: '¿A qué hora cenan los neerlandeses?', options: ['A las 6 de la tarde', 'A las 9 de la noche', 'A las 10', 'A medianoche'], correctAnswer: 'A las 6 de la tarde', explanation: '"Om 6 uur in de avond" — para muchos hispanohablantes, ¡hora de comer!' },
        { id: 'm2l5lz-4', type: 'multiple_choice', prompt: '¿Qué pasa si llegas a las 8 de la tarde?', options: ['La cena ya terminó hace rato', 'Es la hora perfecta', 'Aún no han empezado', 'Te esperan'], correctAnswer: 'La cena ya terminó hace rato', explanation: '"Dan is het eten al lang klaar."' },
        { id: 'm2l5lz-5', type: 'multiple_choice', prompt: '¿Qué hace la gente el domingo?', options: ['Ven a su familia', 'Trabajan', 'Hacen la compra', 'Estudian'], correctAnswer: 'Ven a su familia', explanation: '"Op zondag zien ze hun familie."' },
        { id: 'm2l5lz-6', type: 'fill_blank', prompt: 'Ze ontbijten ___ 8 uur. (preposición)', correctAnswer: 'om', hint: 'Es una HORA', explanation: 'Hora → om.' },
        { id: 'm2l5lz-7', type: 'fill_blank', prompt: '___ zaterdag doen mensen boodschappen. (preposición)', correctAnswer: 'Op', hint: 'Es un DÍA', explanation: 'Día → op.' },
        { id: 'm2l5lz-8', type: 'fill_blank', prompt: 'Ze werken ___ de ochtend. (preposición)', correctAnswer: 'in', hint: 'Es una PARTE DEL DÍA', explanation: 'Parte del día → in.' },
        { id: 'm2l5lz-9', type: 'multiple_choice', prompt: '¿Qué hace todo el país en verano?', options: ['Sentarse fuera: el sol es una fiesta', 'Quedarse en casa', 'Trabajar más', 'Dormir'], correctAnswer: 'Sentarse fuera: el sol es una fiesta', explanation: '"Dan zit heel Nederland buiten!"' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'm2d5',
        title: 'De routine van David',
        context: 'David vertelt zijn dagritme en ontdekt het Nederlandse avondeten. Elfde ontmoeting.',
        lines: [
          { id: 'm2d5-1',  speaker: 'David', dutch: 'Anna, ik heb een vraag. Wanneer eten jullie in Nederland?',            spanish: 'Anna, tengo una pregunta. ¿Cuándo cenáis en Países Bajos?' },
          { id: 'm2d5-2',  speaker: 'Anna',  dutch: 'Om 6 uur in de avond. Hoezo?',                                          spanish: 'A las 6 de la tarde. ¿Por qué?' },
          { id: 'm2d5-3',  speaker: 'David', dutch: 'Om 6 uur?! In Argentinië eten wij om 10 uur!',                          spanish: '¿¡A las 6!? ¡En Argentina cenamos a las 10!' },
          { id: 'm2d5-4',  speaker: 'Anna',  dutch: 'Haha! Om 10 uur slaap ik al bijna. Vertel eens: jouw routine?',        spanish: '¡Jaja! A las 10 yo ya casi duermo. Cuenta: ¿tu rutina?' },
          { id: 'm2d5-5',  speaker: 'David', dutch: 'Ik word wakker om 8 uur. Ik ontbijt om half 9.',                        spanish: 'Me despierto a las 8. Desayuno a las 8 y media.' },
          { id: 'm2d5-6',  speaker: 'Anna',  dutch: 'En dan?',                                                               spanish: '¿Y luego?' },
          { id: 'm2d5-7',  speaker: 'David', dutch: 'Ik werk in de ochtend en in de middag. Ik sport in de avond.',          spanish: 'Trabajo por la mañana y por la tarde. Hago deporte por la tarde-noche.' },
          { id: 'm2d5-8',  speaker: 'Anna',  dutch: 'Heel goed! Om, in… alles klopt. En op zondag?',                         spanish: '¡Muy bien! Om, in… todo correcto. ¿Y el domingo?' },
          { id: 'm2d5-9',  speaker: 'David', dutch: 'Op zondag bel ik mijn familie in Argentinië. Om 3 uur — voor hun ontbijt!', spanish: 'El domingo llamo a mi familia en Argentina. A las 3 — ¡para su desayuno!' },
          { id: 'm2d5-10', speaker: 'Anna',  dutch: 'Slim! En wanneer ga je naar bed?',                                      spanish: '¡Listo! ¿Y cuándo te vas a la cama?' },
          { id: 'm2d5-11', speaker: 'David', dutch: 'Om 12 uur in de nacht. Argentijnse routine!',                           spanish: 'A las 12 de la noche. ¡Rutina argentina!' },
          { id: 'm2d5-12', speaker: 'Anna',  dutch: 'Haha! Oké, één test: ik eet OP 6 uur — goed of fout?',                  spanish: '¡Jaja! Vale, una prueba: "ik eet OP 6 uur" — ¿bien o mal?' },
          { id: 'm2d5-13', speaker: 'David', dutch: 'Fout! Met uren is het OM: ik eet om 6 uur.',                            spanish: '¡Mal! Con horas es OM: ik eet om 6 uur.' },
          { id: 'm2d5-14', speaker: 'Anna',  dutch: 'Perfect! Dan eten we morgen samen — om 6 uur, Nederlandse tijd!',       spanish: '¡Perfecto! Pues mañana cenamos juntos — ¡a las 6, hora neerlandesa!' },
          { id: 'm2d5-15', speaker: 'David', dutch: 'Deal. Maar ik neem een tweede diner om 10 uur, hoor!',                  spanish: 'Trato hecho. ¡Pero yo me tomo una segunda cena a las 10, eh!' },
        ],
      },
    },
    {
      type: 'practice',
      exercises: [
        // ── Opción múltiple ──
        { id: 'm2l5e-1',  type: 'multiple_choice', prompt: '¿Qué preposición va con las HORAS?', options: ['om', 'op', 'in', 'naar'], correctAnswer: 'om', explanation: 'OM + hora: Ik werk om 8 uur.' },
        { id: 'm2l5e-2',  type: 'multiple_choice', prompt: '¿Y con los DÍAS?', options: ['op', 'om', 'in', 'bij'], correctAnswer: 'op', explanation: 'OP + día: Ik werk op maandag.' },
        { id: 'm2l5e-3',  type: 'multiple_choice', prompt: '¿Y con los meses y las partes del día?', options: ['in', 'om', 'op', 'uit'], correctAnswer: 'in', explanation: 'IN + mes/periodo: in juni, in de ochtend.' },
        { id: 'm2l5e-4',  type: 'multiple_choice', prompt: '¿Cuál es la frase CORRECTA?', options: ['Ik eet om 7 uur.', 'Ik eet op 7 uur.', 'Ik eet in 7 uur.', 'Ik eet de 7 uur.'], correctAnswer: 'Ik eet om 7 uur.', explanation: 'Hora → om. El clásico error es "op 7 uur".' },
        { id: 'm2l5e-5',  type: 'multiple_choice', prompt: '"Trabajo por la mañana" es…', options: ['Ik werk in de ochtend.', 'Ik werk op de ochtend.', 'Ik werk om de ochtend.', 'Ik werk de ochtend.'], correctAnswer: 'Ik werk in de ochtend.', explanation: 'Parte del día → in (como el inglés "in the morning").' },
        // ── Verdadero / Falso ──
        { id: 'm2l5e-6',  type: 'true_false', prompt: '"Ik werk de maandag" es correcto, como "el lunes" en español.', correctAnswer: 'falso', explanation: 'En neerlandés hace falta OP: Ik werk op maandag.' },
        { id: 'm2l5e-7',  type: 'true_false', prompt: '"De avond" es la tarde-noche (después de las 18:00).', correctAnswer: 'verdadero', explanation: 'ochtend → middag → avond → nacht.' },
        { id: 'm2l5e-8',  type: 'true_false', prompt: '"Wakker worden" significa irse a la cama.', correctAnswer: 'falso', explanation: 'Wakker worden = despertarse; naar bed gaan = irse a la cama.' },
        // ── Completar (el corazón: elegir preposición) ──
        { id: 'm2l5e-9',  type: 'fill_blank', prompt: 'Ik werk ___ 8 uur.', correctAnswer: 'om', hint: '¿Hora, día o periodo?' },
        { id: 'm2l5e-10', type: 'fill_blank', prompt: 'Wij eten samen ___ zondag.', correctAnswer: 'op', hint: '¿Hora, día o periodo?' },
        { id: 'm2l5e-11', type: 'fill_blank', prompt: 'Mijn moeder is jarig ___ mei.', correctAnswer: 'in', hint: '¿Hora, día o periodo?' },
        { id: 'm2l5e-12', type: 'fill_blank', prompt: 'Ik studeer ___ de ochtend.', correctAnswer: 'in', hint: 'Parte del día' },
        { id: 'm2l5e-13', type: 'fill_blank', prompt: 'Ik werk op maandag ___ 8 uur. (combinada)', correctAnswer: 'om', hint: 'Lo segundo es una hora' },
        // ── Ordenar frases ──
        { id: 'm2l5e-14', type: 'order_sentence', prompt: 'Ordena: "Visito a mis padres el domingo."', options: ['Ik', 'bezoek', 'mijn', 'ouders', 'op', 'zondag'], correctAnswer: 'Ik bezoek mijn ouders op zondag' },
        { id: 'm2l5e-15', type: 'order_sentence', prompt: 'Ordena: "Trabajo a las 7."', options: ['Ik', 'werk', 'om', '7', 'uur'], correctAnswer: 'Ik werk om 7 uur' },
        { id: 'm2l5e-16', type: 'order_sentence', prompt: 'Ordena: "Me voy a la cama a las 11."', options: ['Ik', 'ga', 'naar', 'bed', 'om', '11', 'uur'], correctAnswer: 'Ik ga naar bed om 11 uur' },
        // ── Sopa de letras ──
        { id: 'm2l5e-17', type: 'word_scramble', prompt: '¿Cómo se dice "la mañana" (parte del día)?', correctAnswer: 'ochtend', hint: 'de …' },
        { id: 'm2l5e-18', type: 'word_scramble', prompt: '¿Cómo se dice "la rutina"?', correctAnswer: 'routine', hint: 'de …' },
        // ── Letras que faltan ──
        { id: 'm2l5e-19', type: 'letter_dash', prompt: 'Completa: "la tarde-noche"', correctAnswer: 'avond', hint: 'de … (desde las 18:00)' },
        { id: 'm2l5e-20', type: 'letter_dash', prompt: 'Completa: "el mediodía / la tarde"', correctAnswer: 'middag', hint: 'de … (12:00–18:00)' },
        // ── Unir parejas ──
        { id: 'm2l5e-21', type: 'match_pairs', prompt: 'Une cada preposición con su uso', correctAnswer: '', pairs: [
          { left: 'om', right: 'a las (hora)' },
          { left: 'op', right: 'el (día)' },
          { left: 'in', right: 'en (mes / periodo)' },
          { left: 'het uur', right: 'la hora' },
          { left: 'de routine', right: 'la rutina' },
        ] },
        { id: 'm2l5e-22', type: 'match_pairs', prompt: 'Une cada parte del día con su traducción', correctAnswer: '', pairs: [
          { left: 'de ochtend', right: 'la mañana' },
          { left: 'de middag', right: 'el mediodía / la tarde' },
          { left: 'de avond', right: 'la tarde-noche' },
          { left: 'de nacht', right: 'la noche' },
          { left: 'wakker worden', right: 'despertarse' },
          { left: 'naar bed gaan', right: 'irse a la cama' },
        ] },
        // ── Emoji ──
        { id: 'm2l5e-23', type: 'emoji_choice', prompt: '¿Qué emoji representa "de nacht"?', options: ['🌙', '🌅', '☀️', '🌆'], correctAnswer: '🌙', explanation: '"De nacht" = la noche.' },
        { id: 'm2l5e-24', type: 'emoji_choice', prompt: '¿Qué emoji representa "naar bed gaan"?', options: ['🛏️', '⏰', '🔁', '🍽️'], correctAnswer: '🛏️', explanation: 'Irse a la cama.' },
        // ── El intruso ──
        { id: 'm2l5e-25', type: 'odd_one_out', prompt: '¿Con cuál usas OM? (con las otras, otra preposición)', options: ['8 uur', 'maandag', 'juni', 'de ochtend'], correctAnswer: '8 uur', explanation: 'Solo la hora lleva om; maandag → op, juni/ochtend → in.' },
        { id: 'm2l5e-26', type: 'odd_one_out', prompt: '¿Cuál NO es una parte del día?', options: ['de ochtend', 'de middag', 'de avond', 'de afspraak'], correctAnswer: 'de afspraak', explanation: 'De afspraak es la cita (lección 3).' },
        // ── Escribir ──
        { id: 'm2l5e-27', type: 'write_answer', prompt: 'Escribe en neerlandés: "Trabajo el lunes"', correctAnswer: 'Ik werk op maandag', hint: 'Día → ¿qué preposición? · sin punto final' },
        { id: 'm2l5e-28', type: 'write_answer', prompt: 'Escribe la preposición: "Ik eet ___ 6 uur"', correctAnswer: 'om', hint: 'Es una hora' },
        // ── Escuchar ──
        { id: 'm2l5e-29', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "Ik werk om 8 uur"', options: ['Ik werk om 8 uur', 'Ik werk op 8 uur', 'Ik eet om 8 uur', 'Ik werk om 9 uur'], correctAnswer: 'Ik werk om 8 uur' },
        { id: 'm2l5e-30', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "in de ochtend"', options: ['in de ochtend', 'in de avond', 'in de middag', 'in de nacht'], correctAnswer: 'in de ochtend' },
        { id: 'm2l5e-31', type: 'listen_translate', prompt: 'Escucha y traduce: "Ik word wakker om 7 uur"', options: ['Me', 'despierto', 'a', 'las', '7', 'duermo'], correctAnswer: 'Me despierto a las 7' },
        // ── Comprensión del diálogo (De routine van David) ──
        { id: 'm2l5e-32', type: 'multiple_choice', prompt: 'En el diálogo, ¿a qué hora cenan en Países Bajos?', options: ['A las 6 de la tarde', 'A las 10 de la noche', 'A las 8', 'A las 12'], correctAnswer: 'A las 6 de la tarde', explanation: '"Om 6 uur in de avond" — ¡y en Argentina a las 10!' },
        { id: 'm2l5e-33', type: 'multiple_choice', prompt: '¿Cuándo llama David a su familia en Argentina?', options: ['El domingo a las 3', 'El lunes a las 8', 'Cada noche', 'En agosto'], correctAnswer: 'El domingo a las 3', explanation: '"Op zondag… om 3 uur — voor hun ontbijt!"' },
        { id: 'm2l5e-34', type: 'true_false', prompt: '"Ik eet op 6 uur" es correcto según el diálogo.', correctAnswer: 'falso', explanation: 'David lo clava: con horas es OM — ik eet om 6 uur.' },
      ],
    },
    { type: 'review' },
  ],
};
const m2_les6: Lesson = {
  id: 'm2-les-6-uitspraak-tweeklanken',
  moduleId: 'familie-vrienden',
  title: 'Les 6 — Uitspraak | ei, ij & ui',
  subtitle: 'Los diptongos + el gran repaso del módulo 2',
  order: 6,
  learningObjective: 'Distinguir y pronunciar ei/ij y ui, y repasar todo el módulo 2',
  estimatedMinutes: 30,
  blocks: [
    {
      type: 'summary',
      title: 'Ei, ij & ui + gran repaso',
      intro: 'Última lección del módulo: los dos sonidos más neerlandeses que existen — ei/ij y ui — y un repaso de todo lo aprendido sobre familia y relaciones.',
      objectives: [
        'Oír la diferencia entre ei/ij y ui',
        'Pronunciarlos mejor',
        'Repasar todo el módulo 2',
      ],
      sections: [
        {
          heading: '🗣️ Ei / ij — el mismo sonido',
          body: '**Ei** e **ij** se pronuncian IGUAL: parecido al "ei" español de "peine" o al "ay" inglés de "say". Palabras: *eigen* (propio), *klein* (pequeño), *meisje* (chica), *blijven* (quedarse), *mijn*, *jarig*. Que se escriba ei o ij… se memoriza con cada palabra.',
        },
        {
          heading: '👄 Ui — el sonido que no existe en español',
          body: 'El **ui** es 100% neerlandés: no existe en español. Sale desde la garganta, entre "au" y "eu". Palabras: *huis* (casa), *buiten* (fuera), *tuin* (jardín), *huisarts* (médico de cabecera). Solo hay una manera de aprenderlo: ¡escuchar y repetir muchas veces!',
        },
        {
          heading: '📚 Gran repaso del módulo 2',
          items: [
            { nl: 'Les 1', es: 'la familia (vader, moeder, broer…) · gezin vs familie · Dit is / Dit zijn' },
            { nl: 'Les 2', es: 'la frase-tren: S + V(2º) + Resto · el sujeto SIEMPRE' },
            { nl: 'Les 3', es: 'días (op), meses (in), palabras de tiempo · jarig zijn' },
            { nl: 'Les 4', es: 'de/het/een · posesivos (mijn, jouw, zijn, haar, ons/onze, hun)' },
            { nl: 'Les 5', es: 'om (hora) · op (día) · in (mes/periodo) · tu rutina' },
          ],
        },
      ],
      tip: 'Para el ui: di "casa" en neerlandés — huis — como si el sonido te saliera de la garganta bostezando un poco. ¿Suena raro? ¡Entonces lo estás haciendo bien! 😄',
    },
    {
      type: 'vocabulary',
      items: [
        { id: 'm2l6v-klein',    dutch: 'klein',        spanish: 'pequeño/a',                     article: null,  emoji: '🐜', color: '#0b7a4d', exampleNl: 'Ons huis is klein.',            exampleEs: 'Nuestra casa es pequeña.',          category: 'ei-ij', difficulty: 'A0' },
        { id: 'm2l6v-eigen',    dutch: 'eigen',        spanish: 'propio/a',                      article: null,  emoji: '🔐', color: '#1a7a40', exampleNl: 'Mijn eigen kamer.',             exampleEs: 'Mi propia habitación.',             category: 'ei-ij', difficulty: 'A0' },
        { id: 'm2l6v-meisje',   dutch: 'het meisje',   spanish: 'la chica',                      article: 'het', emoji: '👧', color: '#0d6e33', exampleNl: 'Het meisje zingt mooi.',        exampleEs: 'La chica canta bonito.',            category: 'ei-ij', difficulty: 'A0' },
        { id: 'm2l6v-jongen',   dutch: 'de jongen',    spanish: 'el chico',                      article: 'de',  emoji: '👦', color: '#2e7d52', exampleNl: 'De jongen is klein.',           exampleEs: 'El chico es pequeño.',              category: 'ei-ij', difficulty: 'A0' },
        { id: 'm2l6v-blijven',  dutch: 'blijven',      spanish: 'quedarse',                      article: null,  emoji: '🪑', color: '#0b7a4d', exampleNl: 'Ik blijf thuis vandaag.',       exampleEs: 'Hoy me quedo en casa.',             category: 'ei-ij', difficulty: 'A0' },
        { id: 'm2l6v-ei',       dutch: 'het ei',       spanish: 'el huevo',                      article: 'het', emoji: '🥚', color: '#1a7a40', exampleNl: 'Ik eet een ei bij het ontbijt.', exampleEs: 'Como un huevo en el desayuno.',    category: 'ei-ij', difficulty: 'A0' },
        { id: 'm2l6v-ijs',      dutch: 'het ijs',      spanish: 'el helado / el hielo',          article: 'het', emoji: '🍦', color: '#0d6e33', exampleNl: 'De kinderen eten een ijsje.',   exampleEs: 'Los niños comen un helado.',        category: 'ei-ij', difficulty: 'A0' },
        { id: 'm2l6v-huis',     dutch: 'het huis',     spanish: 'la casa',                       article: 'het', emoji: '🏠', color: '#2e7d52', exampleNl: 'Mijn huis is in Nederland.',    exampleEs: 'Mi casa está en Países Bajos.',     category: 'ui', difficulty: 'A0' },
        { id: 'm2l6v-buiten',   dutch: 'buiten',       spanish: 'fuera / afuera',                article: null,  emoji: '🌤️', color: '#0b7a4d', exampleNl: 'De kinderen spelen buiten.',    exampleEs: 'Los niños juegan fuera.',           category: 'ui', difficulty: 'A0' },
        { id: 'm2l6v-tuin',     dutch: 'de tuin',      spanish: 'el jardín',                     article: 'de',  emoji: '🌷', color: '#1a7a40', exampleNl: 'De tuin van Els is mooi.',      exampleEs: 'El jardín de Els es bonito.',       category: 'ui', difficulty: 'A0' },
        { id: 'm2l6v-huisarts', dutch: 'de huisarts',  spanish: 'el médico de cabecera',         article: 'de',  emoji: '🩺', color: '#0d6e33', exampleNl: 'Mijn huisarts woont dichtbij.', exampleEs: 'Mi médico de cabecera vive cerca.', category: 'ui', difficulty: 'A0' },
        { id: 'm2l6v-dichtbij', dutch: 'dichtbij',     spanish: 'cerca',                         article: null,  emoji: '📍', color: '#2e7d52', exampleNl: 'De winkel is dichtbij.',        exampleEs: 'La tienda está cerca.',             category: 'ui', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm2l6p-1',  dutch: 'Mijn huis is in Nederland.',        spanish: 'Mi casa está en Países Bajos.',        context: 'Sonido ui + ij' },
        { id: 'm2l6p-2',  dutch: 'Ons huis is klein.',                spanish: 'Nuestra casa es pequeña.',             context: 'Sonido ui + ei' },
        { id: 'm2l6p-3',  dutch: 'De kinderen spelen buiten.',        spanish: 'Los niños juegan fuera.',              context: 'Sonido ui' },
        { id: 'm2l6p-4',  dutch: 'De tuin is mooi.',                  spanish: 'El jardín es bonito.',                 context: 'Sonido ui' },
        { id: 'm2l6p-5',  dutch: 'Mijn huisarts woont dichtbij.',     spanish: 'Mi médico de cabecera vive cerca.',    context: 'Sonido ui' },
        { id: 'm2l6p-6',  dutch: 'Het meisje is klein.',              spanish: 'La chica es pequeña.',                 context: 'Sonido ei/ij' },
        { id: 'm2l6p-7',  dutch: 'Ik blijf thuis vandaag.',           spanish: 'Hoy me quedo en casa.',                context: 'Sonido ei/ij' },
        { id: 'm2l6p-8',  dutch: 'Ik heb mijn eigen kamer.',          spanish: 'Tengo mi propia habitación.',          context: 'Sonido ei/ij' },
        { id: 'm2l6p-9',  dutch: 'Ik eet een ei bij het ontbijt.',    spanish: 'Como un huevo en el desayuno.',        context: 'Sonido ei/ij' },
        { id: 'm2l6p-10', dutch: 'De kinderen eten een ijsje.',       spanish: 'Los niños comen un helado.',           context: 'Sonido ei/ij' },
        { id: 'm2l6p-11', dutch: 'Mijn kleine nichtje blijft thuis.', spanish: 'Mi sobrinita se queda en casa.',       context: 'Combinado' },
      ],
    },
    {
      type: 'lezen',
      title: 'De tuin van Els',
      textNl: `Achter het huis van buurvrouw Els ligt een kleine tuin. Klein, maar heel bijzonder: er staan tulpen in alle kleuren, er is een bankje, en er woont zelfs een egel!

In Nederland is de tuin belangrijk. Veel mensen drinken hun koffie buiten, ook in de lente als het fris is. Op zaterdag werkt half Nederland in de tuin. En wie geen tuin heeft? Die zet bloemen op het balkon.

Els is vaak buiten. In de ochtend drinkt zij thee in haar tuin. Haar kleinkinderen — een jongen en een meisje — spelen er in het weekend. Het meisje zoekt de egel, de jongen eet een ijsje. En hun oma? Zij blijft rustig op haar bankje zitten.

Luister goed naar de klanken van dit verhaal: tuin, huis, buiten — en klein, meisje, blijven, ijsje. Twee sonidos, één mooie Nederlandse tuin.`,
      textEs: `Detrás de la casa de la vecina Els hay un pequeño jardín. Pequeño, pero muy especial: hay tulipanes de todos los colores, hay un banquito… ¡y hasta vive un erizo!

En Países Bajos el jardín es importante. Mucha gente toma su café fuera, incluso en primavera cuando hace fresco. El sábado, medio Países Bajos trabaja en el jardín. ¿Y quien no tiene jardín? Pone flores en el balcón.

Els está mucho fuera. Por la mañana toma té en su jardín. Sus nietos — un chico y una chica — juegan allí el fin de semana. La chica busca al erizo, el chico come un helado. ¿Y su abuela? Ella se queda tranquila sentada en su banquito.

Escucha bien los sonidos de esta historia: tuin, huis, buiten — y klein, meisje, blijven, ijsje. Dos sonidos, un bonito jardín neerlandés.`,
      exercises: [
        { id: 'm2l6lz-1', type: 'multiple_choice', prompt: '¿Qué hay detrás de la casa de Els?', options: ['Un pequeño jardín', 'Un garaje', 'Una tienda', 'Un parque'], correctAnswer: 'Un pequeño jardín', explanation: '"Achter het huis ligt een kleine tuin."' },
        { id: 'm2l6lz-2', type: 'multiple_choice', prompt: '¿Qué animal vive en el jardín?', options: ['Un erizo', 'Un gato', 'Un perro', 'Un pájaro'], correctAnswer: 'Un erizo', explanation: '"Er woont zelfs een egel!" — un erizo.' },
        { id: 'm2l6lz-3', type: 'multiple_choice', prompt: '¿Qué hace medio Países Bajos el sábado?', options: ['Trabajar en el jardín', 'Dormir', 'Ir al cine', 'Viajar'], correctAnswer: 'Trabajar en el jardín', explanation: '"Op zaterdag werkt half Nederland in de tuin."' },
        { id: 'm2l6lz-4', type: 'multiple_choice', prompt: '¿Qué hace quien no tiene jardín?', options: ['Pone flores en el balcón', 'Compra uno', 'Va al parque', 'Nada'], correctAnswer: 'Pone flores en el balcón', explanation: '"Die zet bloemen op het balkon."' },
        { id: 'm2l6lz-5', type: 'multiple_choice', prompt: '¿Quiénes juegan en el jardín el fin de semana?', options: ['Los nietos de Els: un chico y una chica', 'Los vecinos', 'David y Anna', 'Nadie'], correctAnswer: 'Los nietos de Els: un chico y una chica', explanation: '"Haar kleinkinderen — een jongen en een meisje."' },
        { id: 'm2l6lz-6', type: 'fill_blank', prompt: 'Veel mensen drinken hun koffie ___. (fuera)', correctAnswer: 'buiten', hint: 'Con el sonido ui', explanation: '"Buiten" = fuera.' },
        { id: 'm2l6lz-7', type: 'fill_blank', prompt: 'De jongen eet een ___. (helado)', correctAnswer: 'ijsje', hint: 'Con el sonido ij (het ijs + -je)', explanation: 'Een ijsje = un heladito.' },
        { id: 'm2l6lz-8', type: 'fill_blank', prompt: 'En hun oma? Zij ___ rustig op haar bankje zitten.', correctAnswer: 'blijft', hint: 'blijven → raíz + t', explanation: 'Blijven (quedarse) → zij blijft.' },
        { id: 'm2l6lz-9', type: 'multiple_choice', prompt: '¿Qué palabras del texto llevan el sonido UI?', options: ['tuin, huis, buiten', 'klein, meisje, blijven', 'oma, opa, ouders', 'zon, bos, kat'], correctAnswer: 'tuin, huis, buiten', explanation: 'Las de ei/ij son klein, meisje, blijven, ijsje.' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'm2d6',
        title: 'Klanken in de tuin',
        context: 'David en Anna oefenen ei/ij en ui in de tuin van Els. Twaalfde ontmoeting — einde van module 2!',
        lines: [
          { id: 'm2d6-1',  speaker: 'David', dutch: 'Anna, help! Ik kan de "ui" niet zeggen. Höis? Hoeis?',                  spanish: 'Anna, ¡socorro! No me sale el "ui". ¿Höis? ¿Hoeis?' },
          { id: 'm2d6-2',  speaker: 'Anna',  dutch: 'Haha! Huis. Het komt uit je keel, alsof je een beetje gaapt.',          spanish: '¡Jaja! Huis. Sale de la garganta, como si bostezaras un poco.' },
          { id: 'm2d6-3',  speaker: 'David', dutch: 'Huis… huis! En de tuin van Els is… een tuin!',                          spanish: 'Huis… ¡huis! Y el jardín de Els es… ¡una tuin!' },
          { id: 'm2d6-4',  speaker: 'Anna',  dutch: 'Ja! En nu ei en ij: mijn, klein, meisje.',                              spanish: '¡Sí! Y ahora ei e ij: mijn, klein, meisje.' },
          { id: 'm2d6-5',  speaker: 'David', dutch: 'Die zijn makkelijk: als "peine" in het Spaans. Mijn kleine huis!',      spanish: 'Esos son fáciles: como "peine" en español. ¡Mi pequeña casa!' },
          { id: 'm2d6-6',  speaker: 'Anna',  dutch: 'Perfect! Test: wat eet je bij het ontbijt — een ei of een ui?',         spanish: '¡Perfecto! Prueba: ¿qué comes en el desayuno — un "ei" o un "ui"?' },
          { id: 'm2d6-7',  speaker: 'David', dutch: 'Een ei! Een ui is een cebolla — die eet ik niet als ontbijt!',          spanish: '¡Un huevo (ei)! Un "ui" es una cebolla — ¡esa no me la como de desayuno!' },
          { id: 'm2d6-8',  speaker: 'Anna',  dutch: 'Haha, heel goed! En nu het grote examen van module 2. Klaar?',          spanish: '¡Jaja, muy bien! Y ahora el gran examen del módulo 2. ¿Listo?' },
          { id: 'm2d6-9',  speaker: 'David', dutch: 'Klaar! Dit is mijn vriendin Anna. Haar familie woont in Groningen.',    spanish: '¡Listo! Esta es mi amiga Anna. Su familia vive en Groninga.' },
          { id: 'm2d6-10', speaker: 'Anna',  dutch: 'Een vriendin, hè? Niet mijn vriendin?',                                 spanish: '"Een vriendin", ¿eh? ¿No "mijn vriendin"?' },
          { id: 'm2d6-11', speaker: 'David', dutch: 'Eh… ik bezoek haar oma op dinsdag, ik eet om 6 uur, en ik blijf in Nederland!', spanish: 'Eh… ¡visito a su abuela el martes, ceno a las 6 y me quedo en Países Bajos!' },
          { id: 'm2d6-12', speaker: 'Anna',  dutch: 'Haha! Perfecte zinnen, perfecte klanken. Module 2: gehaald!',           spanish: '¡Jaja! Frases perfectas, sonidos perfectos. Módulo 2: ¡aprobado!' },
          { id: 'm2d6-13', speaker: 'David', dutch: 'En dat vieren we met een ijsje — buiten, in de tuin!',                  spanish: '¡Y lo celebramos con un helado — fuera, en el jardín!' },
          { id: 'm2d6-14', speaker: 'Anna',  dutch: 'Gezellig! Op naar module 3!',                                           spanish: '¡Qué bien! ¡Vamos a por el módulo 3!' },
        ],
      },
    },
    {
      type: 'practice',
      exercises: [
        // ── Opción múltiple ──
        { id: 'm2l6e-1',  type: 'multiple_choice', prompt: '¿Cómo se pronuncian "ei" e "ij"?', options: ['Igual: como el "ei" de "peine"', 'Distinto: ei suave, ij fuerte', 'Como la i española', 'Como "ui"'], correctAnswer: 'Igual: como el "ei" de "peine"', explanation: 'Ei e ij suenan IGUAL; la escritura se memoriza por palabra.' },
        { id: 'm2l6e-2',  type: 'multiple_choice', prompt: '¿Qué tiene de especial el sonido "ui"?', options: ['No existe en español: sale de la garganta', 'Es igual que "ui" en "cuidado"', 'Es una u larga', 'Suena como "oi"'], correctAnswer: 'No existe en español: sale de la garganta', explanation: 'Es EL sonido neerlandés. Solo se aprende escuchando y repitiendo.' },
        { id: 'm2l6e-3',  type: 'multiple_choice', prompt: '¿Qué significa "de huisarts"?', options: ['El médico de cabecera', 'El dentista', 'El vecino', 'El arquitecto'], correctAnswer: 'El médico de cabecera', explanation: 'Huis (casa) + arts (médico): tu médico de siempre. Palabra clave en NL.' },
        { id: 'm2l6e-4',  type: 'multiple_choice', prompt: '"Het ei" y "de ui" — ¿cuál es el huevo?', options: ['het ei', 'de ui', 'los dos', 'ninguno'], correctAnswer: 'het ei', explanation: 'Het ei = el huevo · de ui = la cebolla. ¡No los confundas en el súper!' },
        { id: 'm2l6e-5',  type: 'multiple_choice', prompt: '¿Qué significa "blijven"?', options: ['Quedarse', 'Irse', 'Jugar', 'Buscar'], correctAnswer: 'Quedarse', explanation: 'Ik blijf thuis = me quedo en casa.' },
        // ── Verdadero / Falso ──
        { id: 'm2l6e-6',  type: 'true_false', prompt: '"Ei" e "ij" se escriben distinto pero suenan igual.', correctAnswer: 'verdadero', explanation: 'Por eso la escritura se aprende palabra a palabra.' },
        { id: 'm2l6e-7',  type: 'true_false', prompt: 'El sonido "ui" existe también en español.', correctAnswer: 'falso', explanation: 'Es exclusivo del neerlandés — sale desde la garganta.' },
        { id: 'm2l6e-8',  type: 'true_false', prompt: '"Dichtbij" significa lejos.', correctAnswer: 'falso', explanation: 'Dichtbij = cerca. "Mijn huisarts woont dichtbij."' },
        // ── Completar ──
        { id: 'm2l6e-9',  type: 'fill_blank', prompt: 'De kinderen spelen ___. (fuera)', correctAnswer: 'buiten', hint: 'Sonido ui' },
        { id: 'm2l6e-10', type: 'fill_blank', prompt: 'Het ___ zingt mooi. (la chica)', correctAnswer: 'meisje', hint: 'Sonido ei/ij · palabra het' },
        { id: 'm2l6e-11', type: 'fill_blank', prompt: 'Ik ___ thuis vandaag. (quedarse)', correctAnswer: 'blijf', hint: 'blijven → con ik va la raíz' },
        { id: 'm2l6e-12', type: 'fill_blank', prompt: 'Ons huis is ___. (pequeña)', correctAnswer: 'klein', hint: 'Sonido ei' },
        // ── Ordenar frases ──
        { id: 'm2l6e-13', type: 'order_sentence', prompt: 'Ordena: "Mi casa está en Países Bajos."', options: ['Mijn', 'huis', 'is', 'in', 'Nederland'], correctAnswer: 'Mijn huis is in Nederland' },
        { id: 'm2l6e-14', type: 'order_sentence', prompt: 'Ordena: "Mi médico de cabecera vive cerca."', options: ['Mijn', 'huisarts', 'woont', 'dichtbij'], correctAnswer: 'Mijn huisarts woont dichtbij' },
        // ── Sopa de letras ──
        { id: 'm2l6e-15', type: 'word_scramble', prompt: '¿Cómo se dice "el jardín"?', correctAnswer: 'tuin', hint: 'de …' },
        { id: 'm2l6e-16', type: 'word_scramble', prompt: '¿Cómo se dice "quedarse"?', correctAnswer: 'blijven', hint: 'quedarse' },
        // ── Letras que faltan ──
        { id: 'm2l6e-17', type: 'letter_dash', prompt: 'Completa: "fuera"', correctAnswer: 'buiten', hint: 'De kinderen spelen …' },
        { id: 'm2l6e-18', type: 'letter_dash', prompt: 'Completa: "el médico de cabecera"', correctAnswer: 'huisarts', hint: 'de … (casa + médico)' },
        // ── Unir parejas ──
        { id: 'm2l6e-19', type: 'match_pairs', prompt: 'Une cada palabra con su traducción (sonido ei/ij)', correctAnswer: '', pairs: [
          { left: 'klein', right: 'pequeño' },
          { left: 'eigen', right: 'propio' },
          { left: 'het meisje', right: 'la chica' },
          { left: 'blijven', right: 'quedarse' },
          { left: 'het ei', right: 'el huevo' },
          { left: 'het ijs', right: 'el helado' },
        ] },
        { id: 'm2l6e-20', type: 'match_pairs', prompt: 'Une cada palabra con su traducción (sonido ui)', correctAnswer: '', pairs: [
          { left: 'het huis', right: 'la casa' },
          { left: 'buiten', right: 'fuera' },
          { left: 'de tuin', right: 'el jardín' },
          { left: 'de huisarts', right: 'el médico de cabecera' },
          { left: 'dichtbij', right: 'cerca' },
        ] },
        // ── Emoji ──
        { id: 'm2l6e-21', type: 'emoji_choice', prompt: '¿Qué emoji representa "de tuin"?', options: ['🌷', '🏠', '🥚', '🍦'], correctAnswer: '🌷', explanation: '"De tuin" = el jardín (¡con tulipanes, claro!).' },
        { id: 'm2l6e-22', type: 'emoji_choice', prompt: '¿Qué emoji representa "het ei"?', options: ['🥚', '🧅', '🍦', '👧'], correctAnswer: '🥚', explanation: 'Het ei = el huevo (¡la cebolla es "de ui"!).' },
        // ── El intruso ──
        { id: 'm2l6e-23', type: 'odd_one_out', prompt: '¿Cuál NO lleva el sonido ui?', options: ['huis', 'tuin', 'buiten', 'klein'], correctAnswer: 'klein', explanation: 'Klein lleva ei; huis, tuin y buiten llevan ui.' },
        { id: 'm2l6e-24', type: 'odd_one_out', prompt: '¿Cuál NO lleva el sonido ei/ij?', options: ['meisje', 'blijven', 'eigen', 'huisarts'], correctAnswer: 'huisarts', explanation: 'Huisarts lleva ui; los otros llevan ei/ij.' },
        // ── Escribir ──
        { id: 'm2l6e-25', type: 'write_answer', prompt: 'Escribe en neerlandés: "El jardín es bonito"', correctAnswer: 'De tuin is mooi', hint: 'Sin punto final' },
        { id: 'm2l6e-26', type: 'write_answer', prompt: '¿"Ei" o "ui"? Escribe la palabra para EL HUEVO', correctAnswer: 'ei', hint: 'La cebolla es la otra' },
        // ── Escuchar (el corazón de esta lección) ──
        { id: 'm2l6e-27', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "huis"', options: ['huis', 'hees', 'hais', 'hoos'], correctAnswer: 'huis' },
        { id: 'm2l6e-28', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "klein"', options: ['klein', 'kloon', 'kluin', 'kleun'], correctAnswer: 'klein' },
        { id: 'm2l6e-29', type: 'listen_and_choose', prompt: 'Escucha y elige lo que oyes: "buiten"', options: ['buiten', 'beten', 'boten', 'bijten'], correctAnswer: 'buiten' },
        { id: 'm2l6e-30', type: 'listen_translate', prompt: 'Escucha y traduce: "Mijn huisarts woont dichtbij"', options: ['Mi', 'médico', 'de', 'cabecera', 'vive', 'cerca', 'lejos'], correctAnswer: 'Mi médico de cabecera vive cerca' },
        // ── Gran repaso del módulo ──
        { id: 'm2l6e-31', type: 'multiple_choice', prompt: 'REPASO: "Estos son nuestros padres" es…', options: ['Dit zijn onze ouders.', 'Dit is onze ouders.', 'Dit zijn ons ouders.', 'Deze zijn onze ouders.'], correctAnswer: 'Dit zijn onze ouders.', explanation: 'Varias personas → dit zijn; plural → onze (lecciones 1 y 4).' },
        { id: 'm2l6e-32', type: 'fill_blank', prompt: 'REPASO: Ik bezoek mijn oma ___ zondag ___ 3 uur. (dos preposiciones, separadas por espacio)', correctAnswer: 'op om', hint: 'Día y hora (lecciones 3 y 5)', explanation: 'Día → op · hora → om.' },
        { id: 'm2l6e-33', type: 'multiple_choice', prompt: 'REPASO: ¿cuál es la frase-tren correcta?', options: ['Mijn zus woont in Madrid.', 'Mijn zus in Madrid woont.', 'Woont mijn zus in Madrid.', 'In Madrid mijn zus woont.'], correctAnswer: 'Mijn zus woont in Madrid.', explanation: 'S + V(2º) + Resto (lección 2).' },
        { id: 'm2l6e-34', type: 'true_false', prompt: 'REPASO: "haar familie" es la familia de él.', correctAnswer: 'falso', explanation: 'Haar = de ella; zijn = de él (lección 4).' },
      ],
    },
    { type: 'review' },
  ],
};

const m2_extra1: Lesson = {
  id: 'm2-extra-maanden',
  moduleId: 'familie-vrienden',
  title: 'Extra | Maanden van het jaar',
  subtitle: 'Los meses del año',
  order: 1,
  isExtra: true,
  learningObjective: 'Conocer y usar los meses del año en neerlandés',
  estimatedMinutes: 10,
  blocks: [
    {
      type: 'vocabulary',
      items: [
        { id: 'januari', dutch: 'januari', spanish: 'enero', article: null, emoji: '❄️', color: '#1D0084', exampleNl: 'In januari is het erg koud.', exampleEs: 'En enero hace mucho frío.', category: 'maanden', difficulty: 'A0' },
        { id: 'februari', dutch: 'februari', spanish: 'febrero', article: null, emoji: '💝', color: '#025dc7', exampleNl: 'Valentijnsdag is in februari.', exampleEs: 'San Valentín es en febrero.', category: 'maanden', difficulty: 'A0' },
        { id: 'maart', dutch: 'maart', spanish: 'marzo', article: null, emoji: '🌷', color: '#0b4db5', exampleNl: 'De lente begint in maart.', exampleEs: 'La primavera empieza en marzo.', category: 'maanden', difficulty: 'A0' },
        { id: 'april', dutch: 'april', spanish: 'abril', article: null, emoji: '🌸', color: '#0a3d9e', exampleNl: 'In april bloeien de tulpen.', exampleEs: 'En abril florecen los tulipanes.', category: 'maanden', difficulty: 'A0' },
        { id: 'mei', dutch: 'mei', spanish: 'mayo', article: null, emoji: '☀️', color: '#1440a0', exampleNl: 'Koningsdag is op 27 mei.', exampleEs: 'El Día del Rey es el 27 de mayo.', category: 'maanden', difficulty: 'A0' },
        { id: 'juni', dutch: 'juni', spanish: 'junio', article: null, emoji: '🌻', color: '#0d5bbf', exampleNl: 'In juni begint de zomer.', exampleEs: 'En junio empieza el verano.', category: 'maanden', difficulty: 'A0' },
        { id: 'juli', dutch: 'juli', spanish: 'julio', article: null, emoji: '🏖️', color: '#1D0084', exampleNl: 'In juli ga ik op vakantie.', exampleEs: 'En julio me voy de vacaciones.', category: 'maanden', difficulty: 'A0' },
        { id: 'augustus', dutch: 'augustus', spanish: 'agosto', article: null, emoji: '🌞', color: '#025dc7', exampleNl: 'Augustus is de warmste maand.', exampleEs: 'Agosto es el mes más cálido.', category: 'maanden', difficulty: 'A0' },
        { id: 'september', dutch: 'september', spanish: 'septiembre', article: null, emoji: '🍂', color: '#0b4db5', exampleNl: 'Het nieuwe schooljaar begint in september.', exampleEs: 'El nuevo curso escolar empieza en septiembre.', category: 'maanden', difficulty: 'A0' },
        { id: 'oktober', dutch: 'oktober', spanish: 'octubre', article: null, emoji: '🎃', color: '#0a3d9e', exampleNl: 'In oktober valt het eerste blad.', exampleEs: 'En octubre caen las primeras hojas.', category: 'maanden', difficulty: 'A0' },
        { id: 'november', dutch: 'november', spanish: 'noviembre', article: null, emoji: '🍁', color: '#1440a0', exampleNl: 'November is een grijze maand.', exampleEs: 'Noviembre es un mes gris.', category: 'maanden', difficulty: 'A0' },
        { id: 'december', dutch: 'december', spanish: 'diciembre', article: null, emoji: '🎄', color: '#0d5bbf', exampleNl: 'In december vieren we Sinterklaas en Kerst.', exampleEs: 'En diciembre celebramos San Nicolás y Navidad.', category: 'maanden', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'pmnd-1', dutch: 'In welke maand ben jij geboren?', spanish: '¿En qué mes naciste?', context: 'Cumpleaños' },
        { id: 'pmnd-2', dutch: 'Mijn verjaardag is in maart.', spanish: 'Mi cumpleaños es en marzo.', context: 'Cumpleaños' },
        { id: 'pmnd-3', dutch: 'In de zomer (juni, juli, augustus) is het warm.', spanish: 'En verano (junio, julio, agosto) hace calor.', context: 'Estaciones' },
        { id: 'pmnd-4', dutch: 'Het schooljaar loopt van september tot juni.', spanish: 'El año escolar va de septiembre a junio.', context: 'Calendario escolar' },
        { id: 'pmnd-5', dutch: 'We zijn nu in de maand maart.', spanish: 'Estamos ahora en el mes de marzo.', context: 'Mes actual' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        { id: 'emnd-1', type: 'multiple_choice', prompt: '¿Cuál es el cuarto mes del año?', options: ['maart', 'april', 'mei', 'juni'], correctAnswer: 'april' },
        { id: 'emnd-2', type: 'fill_blank', prompt: 'De lente begint in ___. (marzo)', correctAnswer: 'maart' },
        { id: 'emnd-3', type: 'multiple_choice', prompt: '"Augustus" en español es:', options: ['julio', 'agosto', 'septiembre', 'junio'], correctAnswer: 'agosto' },
        { id: 'emnd-4', type: 'fill_blank', prompt: 'In ___ vieren we Kerst. (diciembre)', correctAnswer: 'december' },
        { id: 'emnd-5', type: 'multiple_choice', prompt: '¿En qué mes empiezan las vacaciones de verano en los Países Bajos?', options: ['mei', 'juni', 'juli', 'augustus'], correctAnswer: 'juni' },
      ],
    },
    { type: 'review' },
  ],
};

const m2_extra2: Lesson = {
  id: 'm2-extra-dagen',
  moduleId: 'familie-vrienden',
  title: 'Extra | Dagen van de week',
  subtitle: 'Los días de la semana',
  order: 2,
  isExtra: true,
  learningObjective: 'Conocer los días de la semana y usarlos en contexto',
  estimatedMinutes: 10,
  blocks: [
    {
      type: 'vocabulary',
      items: [
        { id: 'maandag', dutch: 'maandag', spanish: 'lunes', article: null, emoji: '😐', color: '#1D0084', exampleNl: 'Op maandag begin ik de werkweek.', exampleEs: 'El lunes empiezo la semana laboral.', category: 'dagen', difficulty: 'A0' },
        { id: 'dinsdag', dutch: 'dinsdag', spanish: 'martes', article: null, emoji: '📝', color: '#025dc7', exampleNl: 'Op dinsdag heb ik een vergadering.', exampleEs: 'El martes tengo una reunión.', category: 'dagen', difficulty: 'A0' },
        { id: 'woensdag', dutch: 'woensdag', spanish: 'miércoles', article: null, emoji: '📚', color: '#0b4db5', exampleNl: 'Op woensdag ga ik naar de les.', exampleEs: 'El miércoles voy a clase.', category: 'dagen', difficulty: 'A0' },
        { id: 'donderdag', dutch: 'donderdag', spanish: 'jueves', article: null, emoji: '☕', color: '#0a3d9e', exampleNl: 'Op donderdag werk ik vanuit huis.', exampleEs: 'El jueves trabajo desde casa.', category: 'dagen', difficulty: 'A0' },
        { id: 'vrijdag', dutch: 'vrijdag', spanish: 'viernes', article: null, emoji: '🎉', color: '#1440a0', exampleNl: 'Vrijdag is mijn favoriete dag!', exampleEs: 'El viernes es mi día favorito.', category: 'dagen', difficulty: 'A0' },
        { id: 'zaterdag', dutch: 'zaterdag', spanish: 'sábado', article: null, emoji: '🛒', color: '#0d5bbf', exampleNl: 'Op zaterdag ga ik naar de markt.', exampleEs: 'El sábado voy al mercado.', category: 'dagen', difficulty: 'A0' },
        { id: 'zondag', dutch: 'zondag', spanish: 'domingo', article: null, emoji: '😴', color: '#1D0084', exampleNl: 'Op zondag slaap ik uit.', exampleEs: 'El domingo duermo hasta tarde.', category: 'dagen', difficulty: 'A0' },
        { id: 'weekend', dutch: 'het weekend', spanish: 'el fin de semana', article: 'het', emoji: '🏖️', color: '#025dc7', exampleNl: 'In het weekend ontspan ik.', exampleEs: 'El fin de semana me relajo.', category: 'dagen', difficulty: 'A0' },
        { id: 'werkweek', dutch: 'de werkweek', spanish: 'la semana laboral', article: 'de', emoji: '💼', color: '#0b4db5', exampleNl: 'De werkweek loopt van maandag tot vrijdag.', exampleEs: 'La semana laboral va de lunes a viernes.', category: 'dagen', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'pdag-1', dutch: 'Welke dag is het vandaag?', spanish: '¿Qué día es hoy?', context: 'Preguntar el día' },
        { id: 'pdag-2', dutch: 'Vandaag is het dinsdag.', spanish: 'Hoy es martes.', context: 'Decir el día' },
        { id: 'pdag-3', dutch: 'Op vrijdag gaan we altijd uit eten.', spanish: 'Los viernes siempre salimos a cenar.', context: 'Rutina semanal' },
        { id: 'pdag-4', dutch: 'De werkweek loopt van maandag tot vrijdag.', spanish: 'La semana laboral va de lunes a viernes.', context: 'Horario' },
        { id: 'pdag-5', dutch: 'In het weekend slaap ik altijd uit.', spanish: 'El fin de semana siempre duermo hasta tarde.', context: 'Fin de semana' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        { id: 'edag-1', type: 'multiple_choice', prompt: '¿Cómo se dice "miércoles" en neerlandés?', options: ['dinsdag', 'donderdag', 'woensdag', 'vrijdag'], correctAnswer: 'woensdag' },
        { id: 'edag-2', type: 'fill_blank', prompt: 'Op ___ gaan we altijd uit eten. (viernes)', correctAnswer: 'vrijdag' },
        { id: 'edag-3', type: 'multiple_choice', prompt: '"Zondag" significa:', options: ['sábado', 'domingo', 'viernes', 'lunes'], correctAnswer: 'domingo' },
        { id: 'edag-4', type: 'order_sentence', prompt: 'Ordena: "El fin de semana me relajo."', options: ['In', 'het', 'weekend', 'ontspan', 'ik'], correctAnswer: 'In het weekend ontspan ik' },
        { id: 'edag-5', type: 'multiple_choice', prompt: '¿Qué día viene después de "donderdag"?', options: ['maandag', 'woensdag', 'vrijdag', 'zaterdag'], correctAnswer: 'vrijdag' },
      ],
    },
    { type: 'review' },
  ],
};

const m2_extra3: Lesson = {
  id: 'm2-extra-routines',
  moduleId: 'familie-vrienden',
  title: 'Extra | Dagelijkse routines',
  subtitle: 'Rutinas diarias',
  order: 3,
  isExtra: true,
  learningObjective: 'Describir las actividades de tu día a día en neerlandés',
  estimatedMinutes: 10,
  blocks: [
    {
      type: 'vocabulary',
      items: [
        { id: 'opstaan', dutch: 'opstaan', spanish: 'levantarse', article: null, emoji: '🛏️', color: '#1D0084', exampleNl: 'Ik sta om zeven uur op.', exampleEs: 'Me levanto a las siete.', category: 'routine', difficulty: 'A0' },
        { id: 'douchen', dutch: 'douchen', spanish: 'ducharse', article: null, emoji: '🚿', color: '#025dc7', exampleNl: 'Ik douche elke ochtend.', exampleEs: 'Me ducho cada mañana.', category: 'routine', difficulty: 'A0' },
        { id: 'ontbijten', dutch: 'ontbijten', spanish: 'desayunar', article: null, emoji: '🍳', color: '#0b4db5', exampleNl: 'Ik ontbijt om half acht.', exampleEs: 'Desayuno a las siete y media.', category: 'routine', difficulty: 'A0' },
        { id: 'naar-werk', dutch: 'naar het werk gaan', spanish: 'ir al trabajo', article: null, emoji: '🚇', color: '#0a3d9e', exampleNl: 'Ik ga om acht uur naar het werk.', exampleEs: 'Voy al trabajo a las ocho.', category: 'routine', difficulty: 'A0' },
        { id: 'lunchen', dutch: 'lunchen', spanish: 'comer (al mediodía)', article: null, emoji: '🥗', color: '#1440a0', exampleNl: 'Ik lunch met collega\'s.', exampleEs: 'Como con compañeros de trabajo.', category: 'routine', difficulty: 'A0' },
        { id: 'thuiskomen', dutch: 'thuiskomen', spanish: 'llegar a casa', article: null, emoji: '🏠', color: '#0d5bbf', exampleNl: 'Ik kom om zes uur thuis.', exampleEs: 'Llego a casa a las seis.', category: 'routine', difficulty: 'A0' },
        { id: 'koken', dutch: 'koken', spanish: 'cocinar', article: null, emoji: '🍳', color: '#1D0084', exampleNl: 'Ik kook elke avond.', exampleEs: 'Cocino cada noche.', category: 'routine', difficulty: 'A0' },
        { id: 'avondeten', dutch: 'avondeten', spanish: 'cenar', article: null, emoji: '🍽️', color: '#025dc7', exampleNl: 'Wij eten om zeven uur avond.', exampleEs: 'Cenamos a las siete.', category: 'routine', difficulty: 'A0' },
        { id: 'televisie', dutch: 'televisie kijken', spanish: 'ver la televisión', article: null, emoji: '📺', color: '#0b4db5', exampleNl: 'Na het eten kijk ik televisie.', exampleEs: 'Después de cenar veo la televisión.', category: 'routine', difficulty: 'A0' },
        { id: 'lezen2', dutch: 'lezen', spanish: 'leer', article: null, emoji: '📖', color: '#0a3d9e', exampleNl: 'Voor het slapen lees ik een boek.', exampleEs: 'Antes de dormir leo un libro.', category: 'routine', difficulty: 'A0' },
        { id: 'slapen', dutch: 'slapen', spanish: 'dormir', article: null, emoji: '😴', color: '#1440a0', exampleNl: 'Ik slaap acht uur per nacht.', exampleEs: 'Duermo ocho horas por noche.', category: 'routine', difficulty: 'A0' },
        { id: 'sporten', dutch: 'sporten', spanish: 'hacer deporte', article: null, emoji: '🏃', color: '#0d5bbf', exampleNl: 'Ik sport drie keer per week.', exampleEs: 'Hago deporte tres veces a la semana.', category: 'routine', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'prou-1', dutch: 'Hoe laat sta jij op?', spanish: '¿A qué hora te levantas?', context: 'Rutina matutina' },
        { id: 'prou-2', dutch: 'Ik sta altijd vroeg op, om zes uur.', spanish: 'Siempre me levanto temprano, a las seis.', context: 'Rutina matutina' },
        { id: 'prou-3', dutch: 'Na het werk sport ik een uur.', spanish: 'Después del trabajo hago deporte una hora.', context: 'Rutina vespertina' },
        { id: 'prou-4', dutch: 'Ik kook graag, dus ik maak elke avond zelf eten.', spanish: 'Me gusta cocinar, así que cada noche preparo la comida yo mismo.', context: 'Rutina' },
        { id: 'prou-5', dutch: 'Ik ga om tien uur naar bed.', spanish: 'Me voy a la cama a las diez.', context: 'Rutina nocturna' },
        { id: 'prou-6', dutch: 'In het weekend slaap ik graag een beetje langer.', spanish: 'El fin de semana me gusta dormir un poco más.', context: 'Fin de semana' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        { id: 'erou-1', type: 'multiple_choice', prompt: '¿Cómo se dice "ducharse" en neerlandés?', options: ['koken', 'douchen', 'sporten', 'slapen'], correctAnswer: 'douchen' },
        { id: 'erou-2', type: 'fill_blank', prompt: 'Ik ___ om zeven uur op. (levantarse)', correctAnswer: 'sta', hint: 'opstaan (verbo separable)' },
        { id: 'erou-3', type: 'order_sentence', prompt: 'Ordena: "Después de cenar veo la televisión."', options: ['Na', 'het', 'avondeten', 'kijk', 'ik', 'televisie'], correctAnswer: 'Na het avondeten kijk ik televisie' },
        { id: 'erou-4', type: 'multiple_choice', prompt: '"Ontbijten" significa:', options: ['cocinar', 'cenar', 'desayunar', 'almorzar'], correctAnswer: 'desayunar' },
        { id: 'erou-5', type: 'fill_blank', prompt: 'Ik ___ drie keer per week. (hacer deporte)', correctAnswer: 'sport', hint: 'sporten' },
      ],
    },
    { type: 'review' },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE 3 — BOODSCHAPPEN
───────────────────────────────────────────────────────────────────────────── */

const m3_les1: Lesson = {
  id: 'm3-les-1-eten-en-drinken',
  moduleId: 'boodschappen',
  title: 'Les 1 — Eten en drinken',
  subtitle: 'Comida y bebida',
  order: 1,
  learningObjective: 'Nombrar alimentos y bebidas básicos y pedir en un café o restaurante',
  estimatedMinutes: 20,
  isExtra: false,
  blocks: [
    {
      type: 'summary',
      title: 'Eten en drinken — lo básico',
      intro: 'En esta lección aprendes el vocabulario más usado de comida y bebida, las tres comidas del día, las palabras del supermercado y cómo preguntar dónde está algo.',
      objectives: [
        'Usar las palabras más comunes de comida y bebida',
        'Nombrar las tres comidas principales (ontbijt, lunch, avondeten)',
        'Usar el vocabulario del supermercado y de los envases',
        'Preguntar "Waar vind ik…?" / "Waar is de kassa?"',
      ],
      sections: [
        {
          heading: '🍽️ Comida y bebida',
          items: [
            { nl: 'water', es: 'agua' }, { nl: 'brood', es: 'pan' }, { nl: 'kaas', es: 'queso' },
            { nl: 'melk', es: 'leche' }, { nl: 'fruit', es: 'fruta' }, { nl: 'groenten', es: 'verduras' },
            { nl: 'vlees', es: 'carne' }, { nl: 'vis', es: 'pescado' }, { nl: 'rijst', es: 'arroz' }, { nl: 'soep', es: 'sopa' },
          ],
        },
        {
          heading: '🕒 Las tres comidas',
          items: [
            { nl: 'het ontbijt', es: 'el desayuno' },
            { nl: 'de lunch', es: 'el almuerzo' },
            { nl: 'het avondeten', es: 'la cena' },
          ],
        },
        {
          heading: '🛒 En el supermercado',
          items: [
            { nl: 'de supermarkt', es: 'el supermercado' }, { nl: 'het mandje', es: 'la cesta' },
            { nl: 'het winkelwagentje', es: 'el carrito' }, { nl: 'het schap', es: 'el estante' },
            { nl: 'de aanbieding', es: 'la oferta' }, { nl: 'de kassa', es: 'la caja' }, { nl: 'de rij', es: 'la fila' },
          ],
        },
        {
          heading: '📦 Envases (verpakkingen)',
          body: 'Recuerda: **"een zak rijst"**, **"een pak melk"**, **"een fles water"**, **"een blik soep"**, **"een doos fruit"**.',
          items: [
            { nl: 'de zak', es: 'la bolsa' }, { nl: 'het pak', es: 'el cartón' }, { nl: 'de fles', es: 'la botella' },
            { nl: 'het blik', es: 'la lata' }, { nl: 'de doos', es: 'la caja' },
          ],
        },
        {
          heading: '❓ Preguntas clave',
          items: [
            { nl: 'Waar vind ik de melk?', es: '¿Dónde encuentro la leche?' },
            { nl: 'Waar is de kassa?', es: '¿Dónde está la caja?' },
            { nl: 'Mag ik pinnen, alstublieft?', es: '¿Puedo pagar con tarjeta, por favor?' },
          ],
        },
      ],
      tip: 'En la cena holandesa típica (AVG) hay Aardappelen, Vlees en Groente (patatas, carne y verdura).',
    },
    {
      type: 'vocabulary',
      items: [
        { id: 'm3v-brood',     dutch: 'het brood',    spanish: 'el pan',          article: 'het', emoji: '🍞', color: '#0b7a4d', exampleNl: 'Ik koop brood in de bakkerij.', exampleEs: 'Compro pan en la panadería.',      category: 'eten', difficulty: 'A1' },
        { id: 'm3v-melk',      dutch: 'de melk',      spanish: 'la leche',         article: 'de',  emoji: '🥛', color: '#1a7a40', exampleNl: 'Ik drink elke ochtend melk.', exampleEs: 'Bebo leche cada mañana.',          category: 'drinken', difficulty: 'A1' },
        { id: 'm3v-water',     dutch: 'het water',    spanish: 'el agua',          article: 'het', emoji: '💧', color: '#0d6e33', exampleNl: 'Mag ik een glas water?',      exampleEs: '¿Me pone un vaso de agua?',       category: 'drinken', difficulty: 'A1' },
        { id: 'm3v-koffie',    dutch: 'de koffie',    spanish: 'el café',          article: 'de',  emoji: '☕', color: '#2e7d52', exampleNl: 'Ik drink elke dag koffie.',   exampleEs: 'Tomo café todos los días.',        category: 'drinken', difficulty: 'A1' },
        { id: 'm3v-thee',      dutch: 'de thee',      spanish: 'el té',            article: 'de',  emoji: '🍵', color: '#0b7a4d', exampleNl: 'Wil je thee of koffie?',     exampleEs: '¿Quieres té o café?',             category: 'drinken', difficulty: 'A1' },
        { id: 'm3v-bier',      dutch: 'het bier',     spanish: 'la cerveza',       article: 'het', emoji: '🍺', color: '#1a7a40', exampleNl: 'Een biertje, alsjeblieft.',  exampleEs: 'Una cerveza, por favor.',         category: 'drinken', difficulty: 'A1' },
        { id: 'm3v-wijn',      dutch: 'de wijn',      spanish: 'el vino',          article: 'de',  emoji: '🍷', color: '#0d6e33', exampleNl: 'Welke wijn wil je?',         exampleEs: '¿Qué vino quieres?',              category: 'drinken', difficulty: 'A1' },
        { id: 'm3v-kaas',      dutch: 'de kaas',      spanish: 'el queso',         article: 'de',  emoji: '🧀', color: '#2e7d52', exampleNl: 'Gouda is een lekkere kaas.', exampleEs: 'El Gouda es un queso rico.',       category: 'eten', difficulty: 'A1' },
        { id: 'm3v-vlees',     dutch: 'het vlees',    spanish: 'la carne',         article: 'het', emoji: '🥩', color: '#0b7a4d', exampleNl: 'Ik eet niet veel vlees.',    exampleEs: 'No como mucha carne.',            category: 'eten', difficulty: 'A1' },
        { id: 'm3v-vis',       dutch: 'de vis',       spanish: 'el pescado',       article: 'de',  emoji: '🐟', color: '#1a7a40', exampleNl: 'Haring is een typisch vis.', exampleEs: 'El arenque es un pescado típico.', category: 'eten', difficulty: 'A1' },
        { id: 'm3v-groente',   dutch: 'de groente',   spanish: 'la verdura',       article: 'de',  emoji: '🥦', color: '#0d6e33', exampleNl: 'Ik eet veel groente.',       exampleEs: 'Como muchas verduras.',           category: 'eten', difficulty: 'A1' },
        { id: 'm3v-fruit',     dutch: 'het fruit',    spanish: 'la fruta',         article: 'het', emoji: '🍎', color: '#2e7d52', exampleNl: 'Vers fruit is gezond.',      exampleEs: 'La fruta fresca es sana.',        category: 'eten', difficulty: 'A1' },
        { id: 'm3v-soep',      dutch: 'de soep',      spanish: 'la sopa',          article: 'de',  emoji: '🍲', color: '#0b7a4d', exampleNl: 'De soep is lekker warm.',    exampleEs: 'La sopa está bien caliente.',     category: 'eten', difficulty: 'A1' },
        { id: 'm3v-eten',      dutch: 'eten',         spanish: 'comer',            article: null,  emoji: '🍽️', color: '#1a7a40', exampleNl: 'Wat eet jij het liefst?',   exampleEs: '¿Qué es lo que más te gusta comer?', category: '', difficulty: 'A1' },
        { id: 'm3v-drinken',   dutch: 'drinken',      spanish: 'beber',            article: null,  emoji: '🥤', color: '#0d6e33', exampleNl: 'Wat wil je drinken?',        exampleEs: '¿Qué quieres beber?',             category: '', difficulty: 'A1' },
        { id: 'm3v-lekker',    dutch: 'lekker',       spanish: 'rico / delicioso', article: null,  emoji: '😋', color: '#2e7d52', exampleNl: 'Dit is erg lekker!',         exampleEs: '¡Esto está muy rico!',            category: '', difficulty: 'A1' },
        // Las tres comidas
        { id: 'm3v-ontbijt',   dutch: 'het ontbijt',  spanish: 'el desayuno',      article: 'het', emoji: '🥐', color: '#0b7a4d', exampleNl: 'Wat eet jij als ontbijt?',   exampleEs: '¿Qué desayunas?',                 category: 'maaltijden', difficulty: 'A1' },
        { id: 'm3v-lunch',     dutch: 'de lunch',     spanish: 'el almuerzo',      article: 'de',  emoji: '🥪', color: '#1a7a40', exampleNl: 'Als lunch eet ik soep.',     exampleEs: 'De almuerzo como sopa.',          category: 'maaltijden', difficulty: 'A1' },
        { id: 'm3v-avondeten', dutch: 'het avondeten',spanish: 'la cena',          article: 'het', emoji: '🍛', color: '#0d6e33', exampleNl: 'Het avondeten is om zes uur.', exampleEs: 'La cena es a las seis.',        category: 'maaltijden', difficulty: 'A1' },
        // Supermercado
        { id: 'm3v-supermarkt',dutch: 'de supermarkt',spanish: 'el supermercado',  article: 'de',  emoji: '🏪', color: '#2e7d52', exampleNl: 'Ik ga naar de supermarkt.',  exampleEs: 'Voy al supermercado.',            category: 'supermarkt', difficulty: 'A1' },
        { id: 'm3v-schap',     dutch: 'het schap',    spanish: 'el estante',       article: 'het', emoji: '🗄️', color: '#0b7a4d', exampleNl: 'De melk staat in het schap.', exampleEs: 'La leche está en el estante.',   category: 'supermarkt', difficulty: 'A1' },
        { id: 'm3v-aanbieding',dutch: 'de aanbieding',spanish: 'la oferta',        article: 'de',  emoji: '🏷️', color: '#1a7a40', exampleNl: 'De kaas is in de aanbieding.', exampleEs: 'El queso está en oferta.',      category: 'supermarkt', difficulty: 'A1' },
        { id: 'm3v-kassa',     dutch: 'de kassa',     spanish: 'la caja',          article: 'de',  emoji: '🧾', color: '#0d6e33', exampleNl: 'Waar is de kassa?',          exampleEs: '¿Dónde está la caja?',            category: 'supermarkt', difficulty: 'A1' },
        // Envases
        { id: 'm3v-zak',       dutch: 'de zak',       spanish: 'la bolsa',         article: 'de',  emoji: '🛍️', color: '#2e7d52', exampleNl: 'Een zak rijst, alstublieft.', exampleEs: 'Una bolsa de arroz, por favor.', category: 'verpakkingen', difficulty: 'A1' },
        { id: 'm3v-pak',       dutch: 'het pak',      spanish: 'el cartón / paquete', article: 'het', emoji: '📦', color: '#0b7a4d', exampleNl: 'Een pak melk kost €1.',    exampleEs: 'Un cartón de leche cuesta 1 €.',  category: 'verpakkingen', difficulty: 'A1' },
        { id: 'm3v-fles',      dutch: 'de fles',      spanish: 'la botella',       article: 'de',  emoji: '🍾', color: '#1a7a40', exampleNl: 'Een fles water, graag.',     exampleEs: 'Una botella de agua, por favor.', category: 'verpakkingen', difficulty: 'A1' },
        { id: 'm3v-blik',      dutch: 'het blik',     spanish: 'la lata',          article: 'het', emoji: '🥫', color: '#0d6e33', exampleNl: 'Soep zit in een blik.',      exampleEs: 'La sopa viene en lata.',          category: 'verpakkingen', difficulty: 'A1' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm3p-1',  dutch: 'Ik heb honger.',                  spanish: 'Tengo hambre.',                    context: 'Expresar necesidad' },
        { id: 'm3p-2',  dutch: 'Ik heb dorst.',                   spanish: 'Tengo sed.',                       context: 'Expresar necesidad' },
        { id: 'm3p-3',  dutch: 'Wat wil je drinken?',             spanish: '¿Qué quieres beber?',              context: 'Pedir en un café' },
        { id: 'm3p-4',  dutch: 'Een koffie, alsjeblieft.',        spanish: 'Un café, por favor.',              context: 'Pedir en un café' },
        { id: 'm3p-5',  dutch: 'Mag ik de rekening?',             spanish: '¿Me trae la cuenta?',              context: 'En el restaurante' },
        { id: 'm3p-6',  dutch: 'Het is erg lekker!',              spanish: '¡Está muy rico!',                  context: 'Valorar la comida' },
        { id: 'm3p-7',  dutch: 'Smaakt het?',                     spanish: '¿Está rico? / ¿Te gusta?',         context: 'Valorar la comida' },
        { id: 'm3p-8',  dutch: 'Ik ben vegetariër.',              spanish: 'Soy vegetariano/a.',               context: 'Dieta' },
        { id: 'm3p-9',  dutch: 'Hoeveel kost dit?',               spanish: '¿Cuánto cuesta esto?',             context: 'En el supermercado' },
        { id: 'm3p-10', dutch: 'Heb je een tafel voor twee?',     spanish: '¿Tienes una mesa para dos?',       context: 'En el restaurante' },
      ],
    },
    {
      type: 'lezen',
      textNl: `Eten en drinken in Nederland

In Nederland eten mensen meestal drie keer per dag: het ontbijt in de ochtend, de lunch rond het middaguur en het avondeten 's avonds.

Het ontbijt en de lunch zijn vaak koud en simpel: een paar boterhammen met kaas, ham of hagelslag. Hagelslag is brood met chocolade — kinderen vinden dit heerlijk! Daarbij drinken veel mensen een glas melk, thee of koffie.

Koffie hoort echt bij Nederland. Een Nederlander drinkt gemiddeld meer dan drie kopjes per dag. Vaak krijg je er een klein koekje bij.

Het avondeten is meestal warm. Een klassiek bord heeft drie delen: aardappelen, groente en vlees of vis. Veel gezinnen eten rond zes uur samen aan tafel. Soep of een frisse salade is ook populair.

Kaas is heel belangrijk. Per jaar eet één persoon ongeveer veertien kilo kaas! In de supermarkt vind je veel soorten: jonge kaas, oude kaas en de bekende Goudse kaas. In sommige steden, zoals Alkmaar, is er zelfs een echte kaasmarkt.

Fruit en water horen er natuurlijk ook bij. Een appel of een banaan is een gezonde snack. Het kraanwater in Nederland is schoon, dus je kunt het gewoon drinken.

En jij? Wat eet jij het liefst? Eet je graag warm of koud?`,
      textEs: `Comida y bebida en los Países Bajos

En los Países Bajos la gente come normalmente tres veces al día: el desayuno por la mañana, el almuerzo a mediodía y la cena por la noche.

El desayuno y el almuerzo suelen ser fríos y sencillos: unas rebanadas de pan con queso, jamón o "hagelslag". El hagelslag es pan con chocolate — ¡a los niños les encanta! Con ello, mucha gente bebe un vaso de leche, té o café.

El café va muy unido a los Países Bajos. Un neerlandés bebe de media más de tres tazas al día. A menudo te ponen una galletita al lado.

La cena suele ser caliente. Un plato clásico tiene tres partes: patatas, verdura y carne o pescado. Muchas familias cenan juntas a la mesa sobre las seis. La sopa o una ensalada fresca también son populares.

El queso es muy importante. ¡Al año una persona come unos catorce kilos de queso! En el supermercado encuentras muchos tipos: queso joven, queso viejo y el conocido queso de Gouda. En algunas ciudades, como Alkmaar, hay incluso un mercado de quesos de verdad.

La fruta y el agua también forman parte, claro. Una manzana o un plátano son un snack sano. El agua del grifo en los Países Bajos es limpia, así que puedes beberla sin problema.

¿Y tú? ¿Qué es lo que más te gusta comer? ¿Te gusta comer caliente o frío?`,
      exercises: [
        { id: 'm3lz-1', type: 'multiple_choice', prompt: '¿Cuántas veces al día come normalmente la gente en los Países Bajos?', options: ['Una', 'Dos', 'Tres', 'Cinco'], correctAnswer: 'Tres', explanation: '"Mensen eten meestal drie keer per dag": desayuno, almuerzo y cena.' },
        { id: 'm3lz-2', type: 'multiple_choice', prompt: '¿Qué es la "hagelslag"?', options: ['Pan con chocolate', 'Una sopa caliente', 'Un tipo de queso', 'Una fruta'], correctAnswer: 'Pan con chocolate', explanation: '"Hagelslag is brood met chocolade" — pan con fideos de chocolate.' },
        { id: 'm3lz-3', type: 'multiple_choice', prompt: '¿Cómo suelen ser el desayuno y el almuerzo?', options: ['Calientes y grandes', 'Fríos y sencillos', 'Siempre sopa', 'Solo fruta'], correctAnswer: 'Fríos y sencillos', explanation: '"Het ontbijt en de lunch zijn vaak koud en simpel".' },
        { id: 'm3lz-4', type: 'multiple_choice', prompt: '¿Cuántas tazas de café bebe al día un neerlandés de media?', options: ['Menos de una', 'Más de tres', 'Exactamente dos', 'Ninguna'], correctAnswer: 'Más de tres', explanation: '"Een Nederlander drinkt gemiddeld meer dan drie kopjes per dag".' },
        { id: 'm3lz-5', type: 'multiple_choice', prompt: '¿Qué tres partes tiene un plato clásico de la cena?', options: ['Pan, queso y leche', 'Patatas, verdura y carne o pescado', 'Sopa, fruta y agua', 'Arroz, té y pan'], correctAnswer: 'Patatas, verdura y carne o pescado', explanation: '"Aardappelen, groente en vlees of vis".' },
        { id: 'm3lz-6', type: 'multiple_choice', prompt: '¿Sobre qué hora cenan muchas familias juntas?', options: ['A las seis', 'A medianoche', 'A las diez de la mañana', 'No cenan juntas'], correctAnswer: 'A las seis', explanation: '"Veel gezinnen eten rond zes uur samen aan tafel".' },
        { id: 'm3lz-7', type: 'true_false', prompt: 'Una persona come unos 14 kilos de queso al año.', correctAnswer: 'verdadero', explanation: '"Per jaar eet één persoon ongeveer veertien kilo kaas".' },
        { id: 'm3lz-8', type: 'true_false', prompt: 'En los Países Bajos puedes beber el agua del grifo.', correctAnswer: 'verdadero', explanation: '"Het kraanwater in Nederland is schoon": el agua del grifo es limpia.' },
        { id: 'm3lz-9', type: 'fill_blank', prompt: 'Het is goed om elke dag genoeg ___ te drinken. (agua)', correctAnswer: 'water', hint: 'lo que bebes cuando tienes sed', explanation: 'Conviene beber suficiente water (agua) cada día.' },
        { id: 'm3lz-10', type: 'order_sentence', prompt: 'Ordena la pregunta del texto: «¿Qué es lo que más te gusta comer?»', options: ['Wat', 'eet', 'jij', 'het', 'liefst?'], correctAnswer: 'Wat eet jij het liefst?' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'm3d1',
        title: 'In het café',
        context: 'María gaat voor het eerst naar een Nederlands café en bestelt iets.',
        lines: [
          { id: 'm3d1-1', speaker: 'Ober',  dutch: 'Goedemiddag! Wat mag het zijn?',                        spanish: '¡Buenas tardes! ¿Qué va a ser?' },
          { id: 'm3d1-2', speaker: 'María', dutch: 'Goedemiddag! Een koffie, alsjeblieft.',                  spanish: '¡Buenas tardes! Un café, por favor.' },
          { id: 'm3d1-3', speaker: 'Ober',  dutch: 'Met melk of zwart?',                                    spanish: '¿Con leche o solo?' },
          { id: 'm3d1-4', speaker: 'María', dutch: 'Met melk, graag. En heeft u ook iets te eten?',          spanish: 'Con leche, por favor. ¿Y tienen también algo para comer?' },
          { id: 'm3d1-5', speaker: 'Ober',  dutch: 'Ja, we hebben broodjes, soep en een stuk taart.',        spanish: 'Sí, tenemos bocadillos, sopa y un trozo de tarta.' },
          { id: 'm3d1-6', speaker: 'María', dutch: 'Een broodje kaas, alsjeblieft. Is het lekker?',          spanish: 'Un bocadillo de queso, por favor. ¿Está rico?' },
          { id: 'm3d1-7', speaker: 'Ober',  dutch: 'Ja, heel lekker! De kaas is van een lokale boerderij.',  spanish: 'Sí, ¡muy rico! El queso es de una granja local.' },
          { id: 'm3d1-8', speaker: 'María', dutch: 'Geweldig! En mag ik ook een glas water?',                spanish: '¡Genial! ¿Y me pone también un vaso de agua?' },
          { id: 'm3d1-9', speaker: 'Ober',  dutch: 'Natuurlijk. Ik breng het zo.',                           spanish: 'Por supuesto. Ahora mismo lo traigo.' },
          { id: 'm3d1-10', speaker: 'María', dutch: 'Dank u wel!',                                           spanish: '¡Muchas gracias!' },
        ],
      },
    },
    {
      type: 'practice',
      exercises: [
        { id: 'm3e-1', type: 'multiple_choice', prompt: '¿Cómo se dice "la leche" en neerlandés?', options: ['het water', 'de melk', 'de thee', 'het bier'], correctAnswer: 'de melk', explanation: '"Melk" es leche. Lleva artículo "de".' },
        { id: 'm3e-2', type: 'multiple_choice', prompt: '¿Qué significa "Ik heb honger"?', options: ['Tengo sed', 'Tengo hambre', 'Quiero comer', 'Estoy cansado'], correctAnswer: 'Tengo hambre', explanation: '"Honger" = hambre. "Dorst" = sed.' },
        { id: 'm3e-3', type: 'fill_blank', prompt: 'Een koffie, ___! (por favor)', correctAnswer: 'alsjeblieft', hint: 'La forma informal de "por favor"' },
        { id: 'm3e-4', type: 'fill_blank', prompt: 'Ik ___ elke dag koffie. (beber)', correctAnswer: 'drink', hint: 'drinken' },
        { id: 'm3e-5', type: 'multiple_choice', prompt: '¿Cómo pides la cuenta en un restaurante?', options: ['Smaakt het?', 'Mag ik de rekening?', 'Heb je een tafel?', 'Wat wil je eten?'], correctAnswer: 'Mag ik de rekening?', explanation: '"Rekening" = cuenta. "Mag ik" = ¿puedo / me pone?' },
        { id: 'm3e-6', type: 'order_sentence', prompt: 'Ordena: "Quiero un vaso de agua, por favor."', options: ['Ik', 'wil', 'een', 'glas', 'water,', 'alsjeblieft.'], correctAnswer: 'Ik wil een glas water, alsjeblieft.' },
        { id: 'm3e-7', type: 'fill_blank', prompt: 'Dit broodje is erg ___! (delicioso)', correctAnswer: 'lekker', hint: 'rico / delicioso' },
        { id: 'm3e-8', type: 'multiple_choice', prompt: '¿Qué artículo lleva "brood"?', options: ['de', 'het', 'een', 'geen'], correctAnswer: 'het', explanation: '"Het brood" — los sustantivos neutros llevan "het".' },
        { id: 'm3e-9',  type: 'match_pairs', prompt: 'Une cada producto con su envase (verpakking)', correctAnswer: '', pairs: [
          { left: 'rijst', right: 'de zak' },
          { left: 'melk', right: 'het pak' },
          { left: 'water', right: 'de fles' },
          { left: 'soep', right: 'het blik' },
        ] },
        { id: 'm3e-10', type: 'odd_one_out', prompt: '¿Cuál NO es un envase?', options: ['de zak', 'het pak', 'de kassa', 'de fles'], correctAnswer: 'de kassa', explanation: '"De kassa" es la caja del supermercado, no un envase.' },
        { id: 'm3e-11', type: 'letter_dash', prompt: 'Completa: "el supermercado"', correctAnswer: 'supermarkt', hint: 'de ___' },
        { id: 'm3e-12', type: 'true_false', prompt: '"Het ontbijt" significa "la cena".', correctAnswer: 'falso', explanation: '"Het ontbijt" es el desayuno. La cena es "het avondeten".' },
        { id: 'm3e-13', type: 'word_scramble', prompt: '¿Cómo se dice "el estante"?', correctAnswer: 'schap', hint: 'estante' },
        { id: 'm3e-14', type: 'order_sentence', prompt: 'Ordena: "¿Dónde encuentro la leche?"', options: ['Waar', 'vind', 'ik', 'de', 'melk?'], correctAnswer: 'Waar vind ik de melk?' },
        { id: 'm3e-15', type: 'emoji_choice', prompt: '¿Cuál es "de kaas"?', options: ['🧀', '🍞', '🥛', '🐟'], correctAnswer: '🧀', explanation: '"de kaas" = el queso 🧀.' },
        { id: 'm3e-16', type: 'emoji_choice', prompt: '¿Cuál es "de vis"?', options: ['🥩', '🐟', '🥦', '🍎'], correctAnswer: '🐟', explanation: '"de vis" = el pescado 🐟.' },
        { id: 'm3e-17', type: 'multiple_choice', prompt: '¿Qué significa "het schap"?', options: ['la caja', 'el estante', 'la oferta', 'el carrito'], correctAnswer: 'el estante', explanation: '"het schap" = el estante donde están los productos.' },
        { id: 'm3e-18', type: 'fill_blank', prompt: 'Ik ga naar de ___. (el supermercado)', correctAnswer: 'supermarkt', hint: 'de super...' },
        { id: 'm3e-19', type: 'match_pairs', prompt: 'Une cada alimento con su traducción', correctAnswer: '', pairs: [
          { left: 'de kaas', right: 'el queso' },
          { left: 'het vlees', right: 'la carne' },
          { left: 'de groente', right: 'la verdura' },
          { left: 'het fruit', right: 'la fruta' },
        ] },
        { id: 'm3e-20', type: 'true_false', prompt: '"Een pak melk" significa "una bolsa de leche".', correctAnswer: 'falso', explanation: '"pak" es cartón. "een pak melk" = un cartón de leche.' },
        { id: 'm3e-21', type: 'order_sentence', prompt: 'Ordena: "¿Dónde está la caja?"', options: ['Waar', 'is', 'de', 'kassa?'], correctAnswer: 'Waar is de kassa?' },
        { id: 'm3e-22', type: 'odd_one_out', prompt: '¿Cuál NO es una bebida?', options: ['water', 'melk', 'koffie', 'kaas'], correctAnswer: 'kaas', explanation: '"kaas" (queso) es comida; las demás son bebidas.' },
        { id: 'm3e-23', type: 'letter_dash', prompt: 'Completa: "la oferta"', correctAnswer: 'aanbieding', hint: 'de ___' },
        { id: 'm3e-24', type: 'multiple_choice', prompt: '¿Cuál es la cena en neerlandés?', options: ['het ontbijt', 'de lunch', 'het avondeten', 'de koffie'], correctAnswer: 'het avondeten', explanation: 'ontbijt = desayuno, lunch = almuerzo, avondeten = cena.' },
        { id: 'm3e-r1', type: 'match_pairs', prompt: 'Une cada comida del día con su traducción', correctAnswer: '', pairs: [ { left: 'het ontbijt', right: 'el desayuno' }, { left: 'de lunch', right: 'el almuerzo' }, { left: 'het avondeten', right: 'la cena' }, { left: 'de supermarkt', right: 'el supermercado' } ] },
        { id: 'm3e-r2', type: 'word_scramble', prompt: '¿Cómo se dice "el queso"?', correctAnswer: 'kaas', hint: 'de ___' },
        { id: 'm3e-r3', type: 'word_scramble', prompt: '¿Cómo se dice "el agua"?', correctAnswer: 'water', hint: 'het ___' },
        { id: 'm3e-r4', type: 'emoji_choice', prompt: '¿Cuál es "het brood"?', options: ['🍞', '🧀', '🥛', '🐟'], correctAnswer: '🍞', explanation: '"het brood" = el pan 🍞.' },
        { id: 'm3e-r5', type: 'odd_one_out', prompt: '¿Cuál NO es una bebida?', options: ['water', 'melk', 'koffie', 'brood'], correctAnswer: 'brood', explanation: '"brood" (pan) es comida; las demás son bebidas.' },
        { id: 'm3e-r6', type: 'letter_dash', prompt: 'Completa: "el pescado"', correctAnswer: 'vis', hint: 'de ___' },
      ],
    },
    { type: 'review' },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE 3 — BOODSCHAPPEN — Les 2
───────────────────────────────────────────────────────────────────────────── */

const m3_les2: Lesson = {
  id: 'm3-les-2-grammatica',
  moduleId: 'boodschappen',
  title: 'Les 2 — Grammatica | Ik wil… / Mag ik…?',
  subtitle: 'Pedir en un café o snackbar',
  order: 2,
  learningObjective: 'Pedir comida y bebida de forma natural y educada usando willen, nemen y mogen',
  estimatedMinutes: 25,
  isExtra: false,
  blocks: [
    {
      type: 'summary',
      title: 'Bestellen — Ik wil… / Mag ik…?',
      intro: 'En esta lección aprendes a pedir comida y bebida en un café o snackbar de forma natural y educada, usando los verbos willen, nemen y mogen.',
      objectives: [
        'Hacer un mini-diálogo en un café o snackbar',
        'Pedir con "Ik wil (graag)…" y "Ik neem…"',
        'Preguntar con "Mag ik een koffie / de rekening, alstublieft?"',
        'Usar los verbos willen, nemen y mogen',
        'Usar expresiones básicas: alstublieft, dank u wel, nog iets?, nee dat is alles',
      ],
      sections: [
        {
          heading: '💚 Willen — querer (deseo)',
          body: 'Expresa un deseo. Para sonar educado y natural añadimos **"graag"** justo después del verbo: **"Ik wil graag koffie"**.',
          items: [
            { nl: 'ik wil', es: 'yo quiero' },
            { nl: 'jij wil', es: 'tú quieres' },
            { nl: 'hij/zij wil', es: 'él/ella quiere' },
            { nl: 'wij/jullie/zij willen', es: 'nosotros/vosotros/ellos quieren' },
          ],
        },
        {
          heading: '🤲 Nemen — tomar (decisión tomada)',
          body: 'Lo usas cuando ya elegiste qué quieres. Con hij/zij añade **-t** (hij neemt). ¡Ojo! En preguntas con "jij" la **-t desaparece**: **"Neem jij…?"**.',
          items: [
            { nl: 'ik neem', es: 'yo tomo' },
            { nl: 'jij neemt → Neem jij…?', es: 'tú tomas → ¿tomas…?' },
            { nl: 'hij/zij neemt', es: 'él/ella toma' },
            { nl: 'wij/jullie/zij nemen', es: 'nosotros/vosotros/ellos toman' },
          ],
        },
        {
          heading: '✅ Mogen — poder / permiso',
          body: 'Para pedir permiso. **"Mag ik…?"** suena muy educado y es fundamental en Países Bajos.',
          items: [
            { nl: 'Mag ik een koffie?', es: '¿Me pone un café?' },
            { nl: 'Mag ik de rekening?', es: '¿Me trae la cuenta?' },
            { nl: 'Mag ik pinnen?', es: '¿Puedo pagar con tarjeta?' },
          ],
        },
        {
          heading: '🙏 Expresiones básicas',
          items: [
            { nl: 'Alstublieft', es: 'por favor / aquí tiene' },
            { nl: 'Dank u wel', es: 'gracias' },
            { nl: 'Nog iets?', es: '¿algo más?' },
            { nl: 'Nee, dat is alles', es: 'no, es todo' },
          ],
        },
        {
          heading: '⚠️ Errores comunes',
          body: 'Evita estos fallos típicos:',
          items: [
            { nl: 'Wil jij koffie? (no "Jij wil koffie?")', es: 'en preguntas el verbo va primero' },
            { nl: 'Neem jij soep? (no "Neemt jij…")', es: 'la -t desaparece con "jij"' },
            { nl: 'Ik wil graag koffie (no "…koffie graag")', es: '"graag" va tras el verbo' },
          ],
        },
      ],
      tip: 'Para sonar educado: "willen" + "graag", y "Mag ik…?" para pedir. ¡Son tu mejor carta en cualquier café holandés!',
    },
    {
      type: 'vocabulary',
      items: [
        // Bebidas
        { id: 'm3l2v-koffie',   dutch: 'de koffie',         spanish: 'el café',                 article: 'de',  emoji: '☕', color: '#0b7a4d', exampleNl: 'Ik wil graag een koffie.', exampleEs: 'Quiero un café.',               category: 'bestellen', difficulty: 'A0' },
        { id: 'm3l2v-thee',     dutch: 'de thee',            spanish: 'el té',                   article: 'de',  emoji: '🍵', color: '#1a7a40', exampleNl: 'Wil jij thee of koffie?',  exampleEs: '¿Quieres té o café?',           category: 'bestellen', difficulty: 'A0' },
        { id: 'm3l2v-cola',     dutch: 'de cola',            spanish: 'la cola',                 article: 'de',  emoji: '🥤', color: '#0d6e33', exampleNl: 'Ik neem een cola.',        exampleEs: 'Tomo una cola.',                category: 'bestellen', difficulty: 'A0' },
        { id: 'm3l2v-water',    dutch: 'het water',          spanish: 'el agua',                 article: 'het', emoji: '💧', color: '#2e7d52', exampleNl: 'Mag ik een glas water?',   exampleEs: '¿Me pone un vaso de agua?',     category: 'bestellen', difficulty: 'A0' },
        { id: 'm3l2v-sap',      dutch: 'het sap',            spanish: 'el zumo',                 article: 'het', emoji: '🧃', color: '#0b7a4d', exampleNl: 'Ik wil graag sap.',        exampleEs: 'Quiero zumo.',                  category: 'bestellen', difficulty: 'A0' },
        // Comida
        { id: 'm3l2v-broodje',  dutch: 'het broodje',        spanish: 'el bocadillo / panecillo',article: 'het', emoji: '🥖', color: '#1a7a40', exampleNl: 'Ik neem een broodje.',     exampleEs: 'Me pongo un bocadillo.',        category: 'bestellen', difficulty: 'A0' },
        { id: 'm3l2v-broodjekaas', dutch: 'het broodje kaas',spanish: 'el bocadillo de queso',   article: 'het', emoji: '🧀', color: '#0d6e33', exampleNl: 'Ik wil graag een broodje kaas.', exampleEs: 'Quiero un bocadillo de queso.', category: 'bestellen', difficulty: 'A0' },
        { id: 'm3l2v-soep',     dutch: 'de soep',            spanish: 'la sopa',                 article: 'de',  emoji: '🍲', color: '#2e7d52', exampleNl: 'Wij nemen soep.',          exampleEs: 'Pedimos sopa.',                 category: 'bestellen', difficulty: 'A0' },
        { id: 'm3l2v-friet',    dutch: 'de friet',           spanish: 'las patatas fritas',      article: 'de',  emoji: '🍟', color: '#0b7a4d', exampleNl: 'Hij neemt friet.',         exampleEs: 'Él pide patatas fritas.',       category: 'bestellen', difficulty: 'A0' },
        { id: 'm3l2v-salade',   dutch: 'de salade',          spanish: 'la ensalada',             article: 'de',  emoji: '🥗', color: '#1a7a40', exampleNl: 'Ik wil graag een salade.', exampleEs: 'Quiero una ensalada.',          category: 'bestellen', difficulty: 'A0' },
        // Verbos clave
        { id: 'm3l2v-willen',   dutch: 'willen',             spanish: 'querer',                  article: null,  emoji: '💚', color: '#0d6e33', exampleNl: 'Ik wil graag koffie.',     exampleEs: 'Quiero café.',                  category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm3l2v-nemen',    dutch: 'nemen',              spanish: 'tomar / coger / pedir',   article: null,  emoji: '🤲', color: '#2e7d52', exampleNl: 'Ik neem een broodje.',     exampleEs: 'Tomo un bocadillo.',            category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm3l2v-mogen',    dutch: 'mogen',              spanish: 'poder / tener permiso',   article: null,  emoji: '✅', color: '#0b7a4d', exampleNl: 'Mag ik pinnen?',           exampleEs: '¿Puedo pagar con tarjeta?',     category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm3l2v-betalen',  dutch: 'betalen',            spanish: 'pagar',                   article: null,  emoji: '💳', color: '#1a7a40', exampleNl: 'Ik wil betalen.',          exampleEs: 'Quiero pagar.',                 category: 'cafe', difficulty: 'A0' },
        { id: 'm3l2v-pinnen',   dutch: 'pinnen',             spanish: 'pagar con tarjeta',       article: null,  emoji: '💳', color: '#0d6e33', exampleNl: 'Mag ik pinnen?',           exampleEs: '¿Puedo pagar con tarjeta?',     category: 'cafe', difficulty: 'A0' },
        // Palabras del café
        { id: 'm3l2v-ober',     dutch: 'de ober',            spanish: 'el camarero',             article: 'de',  emoji: '🧑‍🍳', color: '#2e7d52', exampleNl: 'De ober komt eraan.',  exampleEs: 'El camarero viene en camino.',  category: 'cafe', difficulty: 'A0' },
        { id: 'm3l2v-klant',    dutch: 'de klant',           spanish: 'el cliente',              article: 'de',  emoji: '👤', color: '#0b7a4d', exampleNl: 'De klant wil betalen.',    exampleEs: 'El cliente quiere pagar.',      category: 'cafe', difficulty: 'A0' },
        { id: 'm3l2v-rekening', dutch: 'de rekening',        spanish: 'la cuenta',               article: 'de',  emoji: '🧾', color: '#1a7a40', exampleNl: 'Mag ik de rekening?',      exampleEs: '¿Me trae la cuenta?',           category: 'cafe', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm3l2p-1',  dutch: 'Ik wil graag een koffie.',          spanish: 'Quiero un café.',                    context: 'Bestellen' },
        { id: 'm3l2p-2',  dutch: 'Ik neem een broodje kaas.',         spanish: 'Tomo un bocadillo de queso.',        context: 'Bestellen' },
        { id: 'm3l2p-3',  dutch: 'Mag ik de rekening, alstublieft?',  spanish: '¿Me trae la cuenta, por favor?',     context: 'Betalen' },
        { id: 'm3l2p-4',  dutch: 'Mag ik pinnen?',                    spanish: '¿Puedo pagar con tarjeta?',          context: 'Betalen' },
        { id: 'm3l2p-5',  dutch: 'Nog iets?',                         spanish: '¿Algo más?',                         context: 'In het café' },
        { id: 'm3l2p-6',  dutch: 'Nee, dat is alles.',                spanish: 'No, eso es todo.',                   context: 'In het café' },
        { id: 'm3l2p-7',  dutch: 'Wil jij thee of koffie?',           spanish: '¿Quieres té o café?',                context: 'Bestellen' },
        { id: 'm3l2p-8',  dutch: 'Mag ik hier zitten?',               spanish: '¿Puedo sentarme aquí?',              context: 'In het café' },
        { id: 'm3l2p-9',  dutch: 'Wij willen graag soep en salade.',  spanish: 'Queremos sopa y ensalada.',          context: 'Bestellen' },
        { id: 'm3l2p-10', dutch: 'Dank u wel.',                       spanish: 'Gracias.',                           context: 'Beleefdheid' },
      ],
    },
    {
      type: 'lezen',
      textNl: `Betalen in Nederland

In Nederland betalen veel mensen met de pinpas. In een café of snackbar vraag je: «Mag ik pinnen?» De ober zegt dan «Ja, natuurlijk» en je houdt je kaart bij de machine.

Contant geld gebruiken mensen weinig. Sommige kleine cafés nemen zelfs geen briefjes of munten aan. Op de deur staat dan: «Alleen pinnen».

Een fooi geven is niet verplicht. Veel mensen ronden af of laten een klein bedrag achter als het lekker was. «Laat maar zitten» betekent: hou het wisselgeld.

En aan het einde vraag je gewoon: «Mag ik de rekening, alstublieft?» Makkelijk, toch?`,
      textEs: `Pagar en los Países Bajos

En los Países Bajos mucha gente paga con la tarjeta (pinpas). En un café o snackbar preguntas: «Mag ik pinnen?» (¿Puedo pagar con tarjeta?). El camarero dice «Sí, claro» y acercas la tarjeta a la máquina.

El efectivo se usa poco. Algunos cafés pequeños ni siquiera aceptan billetes o monedas. En la puerta pone entonces: «Alleen pinnen» (solo tarjeta).

Dejar propina no es obligatorio. Mucha gente redondea o deja una pequeña cantidad si estuvo rico. «Laat maar zitten» significa: quédate el cambio.

Y al final solo preguntas: «Mag ik de rekening, alstublieft?» Fácil, ¿no?`,
      exercises: [
        { id: 'm3l2lz-1', type: 'multiple_choice', prompt: '¿Con qué pagan mucho los neerlandeses?', options: ['Con tarjeta (pinpas)', 'Solo con efectivo', 'Con cheque', 'Con oro'], correctAnswer: 'Con tarjeta (pinpas)', explanation: '"In Nederland betalen veel mensen met de pinpas".' },
        { id: 'm3l2lz-2', type: 'multiple_choice', prompt: '¿Qué preguntas para pagar con tarjeta?', options: ['Mag ik pinnen?', 'Mag ik zitten?', 'Wat wil je drinken?', 'Nog iets?'], correctAnswer: 'Mag ik pinnen?', explanation: '"Mag ik pinnen?" = ¿Puedo pagar con tarjeta?' },
        { id: 'm3l2lz-3', type: 'true_false', prompt: 'Dejar propina es obligatorio en los Países Bajos.', correctAnswer: 'falso', explanation: '"Een fooi geven is niet verplicht": la propina no es obligatoria.' },
        { id: 'm3l2lz-4', type: 'multiple_choice', prompt: '¿Qué significa «Alleen pinnen»?', options: ['Solo se paga con tarjeta', 'Solo efectivo', 'Cerrado', 'Café gratis'], correctAnswer: 'Solo se paga con tarjeta', explanation: 'Algunos cafés no aceptan efectivo: «Alleen pinnen».' },
        { id: 'm3l2lz-5', type: 'fill_blank', prompt: 'Mag ik de ___, alstublieft? (la cuenta)', correctAnswer: 'rekening', hint: 'se la pides al camarero para pagar', explanation: '"Mag ik de rekening, alstublieft?"' },
        { id: 'm3l2lz-6', type: 'multiple_choice', prompt: '¿Qué significa «Laat maar zitten»?', options: ['Quédate el cambio', 'Siéntate aquí', 'Vuelve mañana', 'No hay sitio'], correctAnswer: 'Quédate el cambio', explanation: '«Laat maar zitten» = quédate el cambio (wisselgeld).' },
        { id: 'm3l2lz-7', type: 'true_false', prompt: 'Algunos cafés pequeños no aceptan efectivo.', correctAnswer: 'verdadero', explanation: '"Sommige kleine cafés nemen zelfs geen briefjes of munten aan".' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'm3d2',
        title: 'Dialoog – De rekening delen',
        context: 'Tom en Sara hebben samen gegeten en willen betalen. Ze delen de rekening met een tikkie — heel normaal in Nederland.',
        lines: [
          { id: 'm3d2-1',  speaker: 'Tom',  dutch: 'Dat was echt lekker! Zullen we afrekenen?',            spanish: '¡Estaba muy rico! ¿Pagamos?' },
          { id: 'm3d2-2',  speaker: 'Sara', dutch: 'Ja, goed. Wat is mijn deel?',                          spanish: 'Sí, vale. ¿Cuánto es lo mío?' },
          { id: 'm3d2-3',  speaker: 'Tom',  dutch: 'Jij had de soep en ik het broodje. Samen vijftien euro.', spanish: 'Tú tomaste la sopa y yo el bocadillo. En total 15 €.' },
          { id: 'm3d2-4',  speaker: 'Sara', dutch: 'Zullen we gewoon delen? Ieder de helft.',              spanish: '¿Lo dividimos sin más? Cada uno la mitad.' },
          { id: 'm3d2-5',  speaker: 'Tom',  dutch: 'Goed idee. Dat is zeven euro vijftig per persoon.',    spanish: 'Buena idea. Son 7,50 € por persona.' },
          { id: 'm3d2-6',  speaker: 'Sara', dutch: 'Ik heb geen cash bij me. Mag ik je een tikkie sturen?', spanish: 'No llevo efectivo. ¿Te puedo mandar un tikkie?' },
          { id: 'm3d2-7',  speaker: 'Tom',  dutch: 'Natuurlijk! Ik betaal nu met pinnen.',                 spanish: '¡Claro! Yo pago ahora con tarjeta.' },
          { id: 'm3d2-8',  speaker: 'Sara', dutch: 'Top. Ik stuur de tikkie naar je nummer.',             spanish: 'Genial. Te mando el tikkie a tu número.' },
          { id: 'm3d2-9',  speaker: 'Tom',  dutch: 'Super, dank je wel.',                                  spanish: 'Súper, gracias.' },
          { id: 'm3d2-10', speaker: 'Sara', dutch: 'Geen dank. De volgende keer trakteer ik!',            spanish: 'De nada. ¡La próxima vez invito yo!' },
        ],
      },
    },
    {
      type: 'practice',
      exercises: [
        { id: 'm3l2e-1',  type: 'fill_blank',      prompt: 'Ik ___ graag een koffie. (willen — ik)',                correctAnswer: 'wil',      hint: 'willen → con ik va la raíz' },
        { id: 'm3l2e-2',  type: 'fill_blank',      prompt: 'Hij ___ een broodje kaas. (nemen — hij)',               correctAnswer: 'neemt',    hint: 'nemen → hij: raíz + t (¡dobla la vocal!)' },
        { id: 'm3l2e-3',  type: 'fill_blank',      prompt: '___ ik de rekening, alstublieft? (mogen — ik)',         correctAnswer: 'Mag',      hint: 'mogen es irregular: cambia la vocal de la raíz' },
        { id: 'm3l2e-4',  type: 'multiple_choice', prompt: '¿Qué frase suena más educada y natural?', options: ['Ik wil koffie.', 'Ik wil graag koffie.', 'Koffie!', 'Geef koffie.'], correctAnswer: 'Ik wil graag koffie.', explanation: '"Graag" suaviza la frase y la hace más natural.' },
        { id: 'm3l2e-5',  type: 'multiple_choice', prompt: '¿Cuál es la forma correcta en una pregunta?', options: ['Jij wil koffie?', 'Wil jij koffie?', 'Wil jij koffiet?', 'Wilt jij koffie?'], correctAnswer: 'Wil jij koffie?', explanation: 'En preguntas, el verbo va primero: Wil jij…?' },
        { id: 'm3l2e-6',  type: 'order_sentence',  prompt: 'Ordena: "Quiero un café, por favor."', options: ['Ik', 'wil', 'graag', 'een', 'koffie,', 'alstublieft.'], correctAnswer: 'Ik wil graag een koffie, alstublieft.' },
        { id: 'm3l2e-7',  type: 'order_sentence',  prompt: 'Ordena: "¿Puedo pagar con tarjeta?"', options: ['Mag', 'ik', 'pinnen?'], correctAnswer: 'Mag ik pinnen?' },
        { id: 'm3l2e-8',  type: 'fill_blank',      prompt: 'Neem ___ soep? → pregunta con jij (nemen)',             correctAnswer: 'jij',      hint: 'la -t desaparece en preguntas informales' },
        { id: 'm3l2e-9',  type: 'multiple_choice', prompt: '¿Qué significa "Nog iets?"?', options: ['¿Algo más?', '¿Quiere pagar?', '¿Está aquí?', 'Aquí tiene.'], correctAnswer: '¿Algo más?', explanation: '"Nog iets?" = ¿Algo más? Se usa para preguntar si el cliente quiere otra cosa.' },
        { id: 'm3l2e-10', type: 'fill_blank',      prompt: 'Wij ___ graag soep en salade. (willen — wij)',          correctAnswer: 'willen',   hint: 'plural → infinitivo' },
        // Encuentra el error (de la presentación, pág. 11/15/16)
        { id: 'm3l2e-11', type: 'multiple_choice', prompt: 'Encuentra la frase CORRECTA:', options: ['Ik willen graag koffie.', 'Ik wil graag koffie.', 'Ik graag wil koffie.', 'Ik wil koffie graag.'], correctAnswer: 'Ik wil graag koffie.', explanation: 'Con "ik" el verbo es "wil" (no "willen"), y "graag" va justo después del verbo.' },
        { id: 'm3l2e-12', type: 'multiple_choice', prompt: 'Encuentra la frase CORRECTA:', options: ['Hij neem soep.', 'Hij nemen soep.', 'Hij neemt soep.', 'Hij neemt soept.'], correctAnswer: 'Hij neemt soep.', explanation: 'Con "hij/zij" añadimos -t: "hij neemt".' },
        { id: 'm3l2e-13', type: 'multiple_choice', prompt: 'Pregunta con "jij". ¿Cuál es CORRECTA?', options: ['Neemt jij soep?', 'Neem jij soep?', 'Jij neemt soep?', 'Neemt jij soept?'], correctAnswer: 'Neem jij soep?', explanation: 'En preguntas con "jij" la -t desaparece: "Neem jij…?".' },
        { id: 'm3l2e-14', type: 'multiple_choice', prompt: '¿Dónde va "graag"?', options: ['Ik wil koffie graag.', 'Ik graag wil koffie.', 'Ik wil graag koffie.', 'Graag ik wil koffie.'], correctAnswer: 'Ik wil graag koffie.', explanation: '"graag" va justo después del verbo conjugado: "Ik wil graag koffie".' },
        { id: 'm3l2e-15', type: 'order_sentence',  prompt: 'Ordena: "También tomo un café."', options: ['Ik', 'neem', 'ook', 'een', 'koffie.'], correctAnswer: 'Ik neem ook een koffie.' },
        { id: 'm3l2e-16', type: 'match_pairs', prompt: 'Une cada forma del verbo con su significado', correctAnswer: '', pairs: [
          { left: 'ik wil', right: 'yo quiero' },
          { left: 'hij neemt', right: 'él toma' },
          { left: 'wij willen', right: 'nosotros queremos' },
          { left: 'mag ik?', right: '¿puedo?' },
        ] },
        { id: 'm3l2e-17', type: 'fill_blank', prompt: 'Wij ___ soep. (nemen — wij)', correctAnswer: 'nemen', hint: 'plural → infinitivo' },
        { id: 'm3l2e-18', type: 'fill_blank', prompt: '___ ik hier zitten? (mogen — ik)', correctAnswer: 'Mag', hint: 'mogen es irregular: cambia la vocal de la raíz' },
        { id: 'm3l2e-19', type: 'multiple_choice', prompt: '"Ik neem koffie" expresa…', options: ['un deseo', 'una decisión ya tomada', 'una pregunta', 'una negación'], correctAnswer: 'una decisión ya tomada', explanation: '"nemen" = ya elegiste. "willen" = deseo.' },
        { id: 'm3l2e-20', type: 'true_false', prompt: '"Mag ik…?" suena educado para pedir.', correctAnswer: 'verdadero', explanation: 'Sí, es la forma más educada para pedir o pedir permiso.' },
        { id: 'm3l2e-21', type: 'order_sentence', prompt: 'Ordena: "¿Me trae la cuenta, por favor?"', options: ['Mag', 'ik', 'de', 'rekening,', 'alstublieft?'], correctAnswer: 'Mag ik de rekening, alstublieft?' },
        { id: 'm3l2e-22', type: 'word_scramble', prompt: '¿Cómo se dice "por favor" (formal)?', correctAnswer: 'alstublieft', hint: 'por favor / aquí tiene' },
        { id: 'm3l2e-23', type: 'letter_dash', prompt: 'Completa: "la cuenta"', correctAnswer: 'rekening', hint: 'de ___' },
        { id: 'm3l2e-24', type: 'multiple_choice', prompt: '¿Cómo pides un café de forma educada?', options: ['Koffie!', 'Ik wil koffie.', 'Ik wil graag een koffie.', 'Geef koffie.'], correctAnswer: 'Ik wil graag een koffie.', explanation: '"graag" hace la frase educada y natural.' },
        // ── Más emparejar (match_pairs) ──
        { id: 'm3l2e-25', type: 'match_pairs', prompt: 'Une cada expresión con su significado', correctAnswer: '', pairs: [
          { left: 'Alstublieft', right: 'por favor / aquí tiene' },
          { left: 'Dank u wel', right: 'gracias' },
          { left: 'Nog iets?', right: '¿algo más?' },
          { left: 'Mag ik pinnen?', right: '¿puedo pagar con tarjeta?' },
        ] },
        { id: 'm3l2e-26', type: 'match_pairs', prompt: 'Une cada bebida/comida con su traducción', correctAnswer: '', pairs: [
          { left: 'de koffie', right: 'el café' },
          { left: 'het broodje kaas', right: 'el bocadillo de queso' },
          { left: 'de friet', right: 'las patatas fritas' },
          { left: 'de rekening', right: 'la cuenta' },
        ] },
        // ── Más Verdadero/Falso ──
        { id: 'm3l2e-27', type: 'true_false', prompt: 'Con "ik" se dice "ik willen".', correctAnswer: 'falso', explanation: 'Con "ik" es "ik wil" (no "willen").' },
        { id: 'm3l2e-28', type: 'true_false', prompt: 'En "Neem jij soep?" la -t desaparece.', correctAnswer: 'verdadero', explanation: 'En preguntas con "jij" la -t desaparece: "Neem jij…?".' },
        { id: 'm3l2e-29', type: 'true_false', prompt: '"Ik neem een cola" expresa una decisión ya tomada.', correctAnswer: 'verdadero', explanation: '"nemen" = ya elegiste; "willen" = deseo.' },
        // ── Más word_scramble ──
        { id: 'm3l2e-30', type: 'word_scramble', prompt: '¿Cómo se dice "pagar con tarjeta"?', correctAnswer: 'pinnen', hint: 'pagar con tarjeta' },
        { id: 'm3l2e-31', type: 'word_scramble', prompt: '¿Cómo se dice "el camarero"?', correctAnswer: 'ober', hint: 'de ___' },
        // ── Más letter_dash ──
        { id: 'm3l2e-32', type: 'letter_dash', prompt: 'Completa: "tomar / pedir"', correctAnswer: 'nemen', hint: 'verbo: tomar' },
        { id: 'm3l2e-33', type: 'letter_dash', prompt: 'Completa: "pagar"', correctAnswer: 'betalen', hint: 'verbo: pagar' },
        // ── Odd one out (nuevo) ──
        { id: 'm3l2e-34', type: 'odd_one_out', prompt: '¿Cuál NO es una bebida?', options: ['koffie', 'thee', 'cola', 'broodje'], correctAnswer: 'broodje', explanation: '"broodje" (bocadillo) es comida; las demás son bebidas.' },
        { id: 'm3l2e-35', type: 'odd_one_out', prompt: '¿Cuál NO es un verbo de esta lección?', options: ['willen', 'nemen', 'mogen', 'rekening'], correctAnswer: 'rekening', explanation: '"rekening" (cuenta) es un sustantivo, no un verbo.' },
        // ── Emoji choice (nuevo) ──
        { id: 'm3l2e-36', type: 'emoji_choice', prompt: '¿Cuál es "de koffie"?', options: ['☕', '🍵', '🥤', '🍟'], correctAnswer: '☕', explanation: '"de koffie" = el café ☕.' },
        { id: 'm3l2e-37', type: 'emoji_choice', prompt: '¿Cuál es "de friet"?', options: ['🍟', '🥗', '🥖', '🍲'], correctAnswer: '🍟', explanation: '"de friet" = las patatas fritas 🍟.' },
        // ── Escucha y elige (nuevo, TTS) ──
        { id: 'm3l2e-38', type: 'listen_and_choose', prompt: 'Escucha y elige la traducción: "Ik wil graag koffie."', options: ['Quiero un café', 'Tomo un té', '¿Me trae la cuenta?', '¿Algo más?'], correctAnswer: 'Quiero un café', explanation: '"Ik wil graag koffie" = quiero un café.' },
        { id: 'm3l2e-39', type: 'listen_and_choose', prompt: 'Escucha y elige la traducción: "Mag ik de rekening, alstublieft?"', options: ['¿Me trae la cuenta, por favor?', 'Quiero un bocadillo', '¿Puedo sentarme?', 'No, es todo'], correctAnswer: '¿Me trae la cuenta, por favor?', explanation: '"Mag ik de rekening?" = ¿me trae la cuenta?' },
        // ── Memory NL↔ES (nuevo) ──
        { id: 'm3l2e-40', type: 'pair_memory', prompt: 'Empareja neerlandés y español', correctAnswer: '', pairs: [
          { left: 'willen', right: 'querer' },
          { left: 'nemen', right: 'tomar' },
          { left: 'mogen', right: 'poder' },
          { left: 'betalen', right: 'pagar' },
        ] },
        { id: 'm3l2e-r1', type: 'emoji_choice', prompt: '¿Cuál es "de cola"?', options: ['🥤', '☕', '🍵', '🍟'], correctAnswer: '🥤', explanation: '"de cola" = la cola 🥤.' },
        { id: 'm3l2e-r2', type: 'odd_one_out', prompt: '¿Cuál NO es comida?', options: ['broodje', 'soep', 'friet', 'betalen'], correctAnswer: 'betalen', explanation: '"betalen" (pagar) es un verbo, no comida.' },
      ],
    },
    { type: 'review' },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE 3 — BOODSCHAPPEN — Les 3
───────────────────────────────────────────────────────────────────────────── */

const m3_les3: Lesson = {
  id: 'm3-les-3-grammatica',
  moduleId: 'boodschappen',
  title: 'Les 3 — Grammatica | Vragende woorden',
  subtitle: 'Hacer preguntas en neerlandés',
  order: 3,
  learningObjective: 'Hacer preguntas de sí/no y con palabras interrogativas sobre comida y bebida',
  estimatedMinutes: 25,
  isExtra: false,
  blocks: [
    {
      type: 'summary',
      title: 'Vragende woorden — hacer preguntas',
      intro: 'En esta lección aprendes a hacer preguntas de sí/no y con palabras interrogativas, y a negar con "geen".',
      objectives: [
        'Hacer preguntas de sí/no (verbo + sujeto)',
        'Hacer preguntas con W-vragen (wat, waar, wanneer, wie, hoeveel)',
        'Negar con "geen"',
        'Decir el orden de palabras correcto en una pregunta',
      ],
      sections: [
        {
          heading: '❓ Preguntas sí/no',
          body: 'Empiezan con el **verbo + sujeto**. ¡Con "jij" la -t desaparece!',
          items: [
            { nl: 'Drink je koffie?', es: '¿Bebes café?' },
            { nl: 'Eet hij vlees?', es: '¿Come él carne?' },
            { nl: 'Wil je nog iets?', es: '¿Quieres algo más?' },
          ],
        },
        {
          heading: '🔤 W-vragen',
          items: [
            { nl: 'wat', es: 'qué' }, { nl: 'waar', es: 'dónde' }, { nl: 'wanneer', es: 'cuándo' },
            { nl: 'wie', es: 'quién' }, { nl: 'hoeveel', es: 'cuánto/cuántos' },
          ],
        },
        {
          heading: '🚫 Negación con "geen"',
          body: '**"geen"** niega un sustantivo: **"Nee, ik drink geen koffie."**',
          items: [
            { nl: 'Nee, ik drink geen koffie.', es: 'No, no bebo café.' },
            { nl: 'Ik eet geen vlees.', es: 'No como carne.' },
          ],
        },
        {
          heading: '⚠️ Errores comunes',
          items: [
            { nl: 'Drink jij koffie? (no "Jij drinkt koffie?")', es: 'el verbo va primero y sin -t' },
            { nl: 'Wat drink jij? (no "Wat jij drinkt?")', es: 'palabra interrogativa + verbo + sujeto' },
          ],
        },
      ],
      tip: 'Entonación: en una pregunta de sí/no la voz sube al final ↗.',
    },
    {
      type: 'vocabulary',
      items: [
        // Palabras interrogativas
        { id: 'm3l3v-wat',      dutch: 'wat',      spanish: 'qué',                   article: null,  emoji: '❓', color: '#0b7a4d', exampleNl: 'Wat drink je?',            exampleEs: '¿Qué bebes?',               category: 'vraagwoorden', difficulty: 'A0' },
        { id: 'm3l3v-waar',     dutch: 'waar',     spanish: 'dónde',                 article: null,  emoji: '📍', color: '#1a7a40', exampleNl: 'Waar eet je?',             exampleEs: '¿Dónde comes?',             category: 'vraagwoorden', difficulty: 'A0' },
        { id: 'm3l3v-wanneer',  dutch: 'wanneer',  spanish: 'cuándo',                article: null,  emoji: '⏰', color: '#0d6e33', exampleNl: 'Wanneer eten we?',          exampleEs: '¿Cuándo comemos?',          category: 'vraagwoorden', difficulty: 'A0' },
        { id: 'm3l3v-wie',      dutch: 'wie',      spanish: 'quién',                 article: null,  emoji: '👤', color: '#2e7d52', exampleNl: 'Wie komt er?',             exampleEs: '¿Quién viene?',             category: 'vraagwoorden', difficulty: 'A0' },
        { id: 'm3l3v-hoeveel',  dutch: 'hoeveel',  spanish: 'cuánto / cuánta / cuántos', article: null, emoji: '🔢', color: '#0b7a4d', exampleNl: 'Hoeveel suiker wil je?', exampleEs: '¿Cuánta azúcar quieres?',  category: 'vraagwoorden', difficulty: 'A0' },
        // Comida y bebida
        { id: 'm3l3v-koffie',   dutch: 'de koffie',  spanish: 'el café',     article: 'de',  emoji: '☕', color: '#1a7a40', exampleNl: 'Drink je koffie?',         exampleEs: '¿Bebes café?',              category: 'eten-drinken', difficulty: 'A0' },
        { id: 'm3l3v-thee',     dutch: 'de thee',    spanish: 'el té',       article: 'de',  emoji: '🍵', color: '#0d6e33', exampleNl: 'Wil je thee?',             exampleEs: '¿Quieres té?',              category: 'eten-drinken', difficulty: 'A0' },
        { id: 'm3l3v-water',    dutch: 'het water',  spanish: 'el agua',     article: 'het', emoji: '💧', color: '#2e7d52', exampleNl: 'Mag ik een glas water?',   exampleEs: '¿Me pone un vaso de agua?', category: 'eten-drinken', difficulty: 'A0' },
        { id: 'm3l3v-broodje',  dutch: 'het broodje',spanish: 'el bocadillo',article: 'het', emoji: '🥖', color: '#0b7a4d', exampleNl: 'Ik neem een broodje.',     exampleEs: 'Tomo un bocadillo.',        category: 'eten-drinken', difficulty: 'A0' },
        { id: 'm3l3v-suiker',   dutch: 'de suiker',  spanish: 'el azúcar',   article: 'de',  emoji: '🍬', color: '#1a7a40', exampleNl: 'Hoeveel suiker wil je?',   exampleEs: '¿Cuánta azúcar quieres?',  category: 'eten-drinken', difficulty: 'A0' },
        { id: 'm3l3v-vlees',    dutch: 'het vlees',  spanish: 'la carne',    article: 'het', emoji: '🥩', color: '#0d6e33', exampleNl: 'Ik eet geen vlees.',       exampleEs: 'No como carne.',            category: 'eten-drinken', difficulty: 'A0' },
        { id: 'm3l3v-vis',      dutch: 'de vis',     spanish: 'el pescado',  article: 'de',  emoji: '🐟', color: '#2e7d52', exampleNl: 'Eet jij vis?',             exampleEs: '¿Comes pescado?',           category: 'eten-drinken', difficulty: 'A0' },
        // Verbos útiles
        { id: 'm3l3v-drinken',  dutch: 'drinken',  spanish: 'beber',   article: null,  emoji: '🥤', color: '#0b7a4d', exampleNl: 'Wat drink je?',            exampleEs: '¿Qué bebes?',               category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm3l3v-eten',     dutch: 'eten',     spanish: 'comer',   article: null,  emoji: '🍽️', color: '#1a7a40', exampleNl: 'Wanneer eten we?',          exampleEs: '¿Cuándo comemos?',          category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm3l3v-willen',   dutch: 'willen',   spanish: 'querer',  article: null,  emoji: '💚', color: '#0d6e33', exampleNl: 'Wil je thee?',             exampleEs: '¿Quieres té?',              category: 'werkwoorden', difficulty: 'A0' },
        { id: 'm3l3v-komen',    dutch: 'komen',    spanish: 'venir',   article: null,  emoji: '🚶', color: '#2e7d52', exampleNl: 'Wie komt er?',             exampleEs: '¿Quién viene?',             category: 'werkwoorden', difficulty: 'A0' },
        // Negación
        { id: 'm3l3v-geen',     dutch: 'geen',     spanish: 'no / ningún / ninguna', article: null, emoji: '🚫', color: '#0b7a4d', exampleNl: 'Ik drink geen koffie.', exampleEs: 'No bebo café.',           category: 'grammatica', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm3l3p-1',  dutch: 'Drink je koffie?',           spanish: '¿Bebes café?',                context: 'Ja/nee-vraag' },
        { id: 'm3l3p-2',  dutch: 'Wil je thee?',               spanish: '¿Quieres té?',                context: 'Ja/nee-vraag' },
        { id: 'm3l3p-3',  dutch: 'Wat drink je?',              spanish: '¿Qué bebes?',                 context: 'W-vraag' },
        { id: 'm3l3p-4',  dutch: 'Waar eet je?',               spanish: '¿Dónde comes?',               context: 'W-vraag' },
        { id: 'm3l3p-5',  dutch: 'Wanneer eten we?',            spanish: '¿Cuándo comemos?',            context: 'W-vraag' },
        { id: 'm3l3p-6',  dutch: 'Wie komt er?',               spanish: '¿Quién viene?',               context: 'W-vraag' },
        { id: 'm3l3p-7',  dutch: 'Hoeveel suiker wil je?',     spanish: '¿Cuánta azúcar quieres?',     context: 'W-vraag' },
        { id: 'm3l3p-8',  dutch: 'Nee, ik drink geen koffie.', spanish: 'No, no bebo café.',           context: 'Negatie met geen' },
        { id: 'm3l3p-9',  dutch: 'Ja, ik wil thee.',           spanish: 'Sí, quiero té.',              context: 'Bevestigend antwoord' },
        { id: 'm3l3p-10', dutch: 'Ik eet geen vlees.',         spanish: 'No como carne.',              context: 'Negatie met geen' },
      ],
    },
    {
      type: 'lezen',
      textNl: `Vragen stellen in Nederland

Nederlanders stellen graag directe vragen. Dat is heel normaal en niet onbeleefd. In een café vraagt de ober bijvoorbeeld: «Wat wilt u drinken?» of «Wilt u nog iets?»

Met vrienden hoor je vaak korte vragen: «Heb je honger?», «Wat eten we?», «Wie kookt vandaag?». Zo plannen mensen samen een maaltijd.

Een ja/nee-vraag begint met het werkwoord: «Drink je koffie?», «Eet jij vlees?». Aan het einde gaat je stem omhoog.

Met een W-woord vraag je naar informatie: wat, waar, wanneer, wie en hoeveel. Bijvoorbeeld: «Hoeveel suiker wil je?» of «Waar is de supermarkt?»

Wil je iets weigeren? Gebruik «geen»: «Nee, ik drink geen koffie.» Kort en duidelijk.

Tip: in Nederland mag je gewoon vragen. Vraag je niets, dan krijg je ook niets!`,
      textEs: `Hacer preguntas en los Países Bajos

A los neerlandeses les gusta hacer preguntas directas. Es muy normal y no es de mala educación. En un café, el camarero pregunta por ejemplo: «Wat wilt u drinken?» (¿Qué quiere beber?) o «Wilt u nog iets?» (¿Algo más?).

Con los amigos oyes muchas preguntas cortas: «Heb je honger?» (¿Tienes hambre?), «Wat eten we?» (¿Qué comemos?), «Wie kookt vandaag?» (¿Quién cocina hoy?). Así planean juntos una comida.

Una pregunta de sí/no empieza por el verbo: «Drink je koffie?», «Eet jij vlees?». Al final la voz sube.

Con una palabra en W preguntas por información: wat, waar, wanneer, wie y hoeveel. Por ejemplo: «Hoeveel suiker wil je?» (¿Cuánta azúcar quieres?) o «Waar is de supermarkt?» (¿Dónde está el supermercado?).

¿Quieres rechazar algo? Usa «geen»: «Nee, ik drink geen koffie» (No, no bebo café). Corto y claro.

Consejo: en los Países Bajos puedes preguntar sin más. ¡Si no preguntas nada, tampoco recibes nada!`,
      exercises: [
        { id: 'm3l3lz-1', type: 'multiple_choice', prompt: '¿Cómo son las preguntas de los neerlandeses según el texto?', options: ['Directas y normales', 'De mala educación', 'Muy largas', 'Prohibidas'], correctAnswer: 'Directas y normales', explanation: '"Nederlanders stellen graag directe vragen. Dat is heel normaal en niet onbeleefd."' },
        { id: 'm3l3lz-2', type: 'multiple_choice', prompt: '¿Con qué empieza una pregunta de sí/no?', options: ['Con el verbo', 'Con el sujeto', 'Con "geen"', 'Con una coma'], correctAnswer: 'Con el verbo', explanation: '"Een ja/nee-vraag begint met het werkwoord".' },
        { id: 'm3l3lz-3', type: 'multiple_choice', prompt: '¿Qué hace la voz al final de una pregunta de sí/no?', options: ['Sube', 'Baja', 'No cambia', 'Se calla'], correctAnswer: 'Sube', explanation: '"Aan het einde gaat je stem omhoog".' },
        { id: 'm3l3lz-4', type: 'multiple_choice', prompt: '¿Para qué sirven las palabras en W (wat, waar…)?', options: ['Para pedir información', 'Para negar', 'Para saludar', 'Para pagar'], correctAnswer: 'Para pedir información', explanation: '"Met een W-woord vraag je naar informatie".' },
        { id: 'm3l3lz-5', type: 'fill_blank', prompt: 'Nee, ik drink ___ koffie. (negación)', correctAnswer: 'geen', hint: 'negar un sustantivo', explanation: '"geen" niega un sustantivo: no bebo café.' },
        { id: 'm3l3lz-6', type: 'true_false', prompt: 'En los Países Bajos hacer preguntas directas es de mala educación.', correctAnswer: 'falso', explanation: '"Dat is heel normaal en niet onbeleefd": es normal y no es maleducado.' },
        { id: 'm3l3lz-7', type: 'multiple_choice', prompt: '¿Qué pregunta usas para saber CUÁNTA azúcar?', options: ['Hoeveel suiker wil je?', 'Waar is de suiker?', 'Wie wil suiker?', 'Wanneer suiker?'], correctAnswer: 'Hoeveel suiker wil je?', explanation: '"hoeveel" = cuánto/cuánta.' },
        { id: 'm3l3lz-8', type: 'order_sentence', prompt: 'Ordena la pregunta: «¿Qué comemos?»', options: ['Wat', 'eten', 'we?'], correctAnswer: 'Wat eten we?' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'm3d3',
        title: 'Dialoog – Wat eten we vanavond?',
        context: 'Tom en Sara plannen samen het avondeten thuis. Ze stellen elkaar veel vragen.',
        lines: [
          { id: 'm3d3-1',  speaker: 'Tom',  dutch: 'Hé Sara, heb jij honger?',                       spanish: 'Oye Sara, ¿tienes hambre?' },
          { id: 'm3d3-2',  speaker: 'Sara', dutch: 'Ja, een beetje. Wat eten we vanavond?',          spanish: 'Sí, un poco. ¿Qué comemos esta noche?' },
          { id: 'm3d3-3',  speaker: 'Tom',  dutch: 'Goede vraag. Wie kookt vandaag?',                spanish: 'Buena pregunta. ¿Quién cocina hoy?' },
          { id: 'm3d3-4',  speaker: 'Sara', dutch: 'Jij kookt! Ik kook morgen. Wat kun je maken?',   spanish: '¡Cocinas tú! Yo cocino mañana. ¿Qué sabes hacer?' },
          { id: 'm3d3-5',  speaker: 'Tom',  dutch: 'Ik kan soep of pasta maken. Wat wil jij?',       spanish: 'Puedo hacer sopa o pasta. ¿Qué quieres tú?' },
          { id: 'm3d3-6',  speaker: 'Sara', dutch: 'Pasta klinkt lekker. Eet jij ook groente?',      spanish: 'La pasta suena rica. ¿Tú también comes verdura?' },
          { id: 'm3d3-7',  speaker: 'Tom',  dutch: 'Ja, natuurlijk. Hoeveel mensen komen er?',       spanish: 'Sí, claro. ¿Cuánta gente viene?' },
          { id: 'm3d3-8',  speaker: 'Sara', dutch: 'Alleen wij twee. Misschien komt Lisa ook.',      spanish: 'Solo nosotros dos. Quizá venga Lisa también.' },
          { id: 'm3d3-9',  speaker: 'Tom',  dutch: 'Oké. Waar is de supermarkt? Ik heb geen pasta meer.', spanish: 'Vale. ¿Dónde está el supermercado? Ya no tengo pasta.' },
          { id: 'm3d3-10', speaker: 'Sara', dutch: 'Om de hoek. Wanneer gaan we?',                   spanish: 'A la vuelta de la esquina. ¿Cuándo vamos?' },
          { id: 'm3d3-11', speaker: 'Tom',  dutch: 'Nu! Kom, we gaan samen.',                        spanish: '¡Ahora! Venga, vamos juntos.' },
          { id: 'm3d3-12', speaker: 'Sara', dutch: 'Leuk! Ik heb geen geld bij me. Mag ik later betalen?', spanish: '¡Genial! No llevo dinero. ¿Puedo pagar luego?' },
          { id: 'm3d3-13', speaker: 'Tom',  dutch: 'Geen probleem!',                                 spanish: '¡Sin problema!' },
        ],
      },
    },
    {
      type: 'practice',
      exercises: [
        { id: 'm3l3e-1', type: 'fill_blank',      prompt: '______ drink je?',                                             correctAnswer: 'Wat',            hint: 'Pista: qué' },
        { id: 'm3l3e-2', type: 'fill_blank',      prompt: '______ eet je?',                                               correctAnswer: 'Waar',           hint: 'Pista: dónde' },
        { id: 'm3l3e-3', type: 'fill_blank',      prompt: '______ eten we?',                                              correctAnswer: 'Wanneer',        hint: 'Pista: cuándo' },
        { id: 'm3l3e-4', type: 'fill_blank',      prompt: 'Nee, ik drink ______ koffie.',                                 correctAnswer: 'geen',           hint: 'Pista: negación con sustantivos' },
        { id: 'm3l3e-5', type: 'multiple_choice', prompt: '¿Cuál es la pregunta correcta para preguntar "¿qué bebes?"?', options: ['Wat drink jij?', 'Wat jij drinkt?', 'Drink wat jij?'], correctAnswer: 'Wat drink jij?', explanation: 'W-vraag: palabra interrogativa + verbo + sujeto.' },
        { id: 'm3l3e-6', type: 'multiple_choice', prompt: '¿Cuál es la forma correcta de hacer una pregunta sí/no?',     options: ['Jij drinkt koffie?', 'Drink jij koffie?', 'Koffie drink jij?'], correctAnswer: 'Drink jij koffie?', explanation: 'Ja/nee-vraag: verbo + sujeto + complemento.' },
        { id: 'm3l3e-7', type: 'order_sentence',  prompt: 'Ordena: "¿Cuánta azúcar quieres?" → suiker / hoeveel / wil / je', options: ['suiker', 'hoeveel', 'wil', 'je'], correctAnswer: 'Hoeveel suiker wil je?' },
        { id: 'm3l3e-8', type: 'fill_blank',      prompt: 'Wil je thee? → Nee, ik wil ______ thee.',                     correctAnswer: 'geen',           hint: 'Pista: negación con sustantivos' },
        { id: 'm3l3e-9',  type: 'match_pairs',     prompt: 'Une cada palabra interrogativa con su significado', correctAnswer: '', pairs: [
          { left: 'wat', right: 'qué' },
          { left: 'waar', right: 'dónde' },
          { left: 'wanneer', right: 'cuándo' },
          { left: 'wie', right: 'quién' },
        ] },
        { id: 'm3l3e-10', type: 'true_false',      prompt: 'En una pregunta sí/no el verbo va PRIMERO: "Drink jij koffie?".', correctAnswer: 'verdadero', explanation: 'Correcto: verbo + sujeto. "Jij drinkt koffie?" es incorrecto.' },
        { id: 'm3l3e-11', type: 'odd_one_out',     prompt: '¿Cuál NO es una palabra interrogativa?', options: ['wat', 'waar', 'geen', 'wie'], correctAnswer: 'geen', explanation: '"geen" es una negación, no una pregunta.' },
        { id: 'm3l3e-12', type: 'order_sentence',  prompt: 'Ordena la pregunta: "¿Qué bebes?"', options: ['Wat', 'drink', 'jij?'], correctAnswer: 'Wat drink jij?' },
        { id: 'm3l3e-13', type: 'multiple_choice', prompt: 'Corrige: "Jij drinkt koffie?"', options: ['Drink jij koffie?', 'Drinkt jij koffie?', 'Koffie jij drinkt?'], correctAnswer: 'Drink jij koffie?', explanation: 'Verbo primero y sin -t con "jij".' },
        { id: 'm3l3e-14', type: 'fill_blank', prompt: '______ komt er? (quién)', correctAnswer: 'Wie', hint: 'quién' },
        { id: 'm3l3e-15', type: 'fill_blank', prompt: 'Eet je vis? → Nee, ik eet ______ vis.', correctAnswer: 'geen', hint: 'negación de un sustantivo' },
        { id: 'm3l3e-16', type: 'order_sentence', prompt: 'Ordena: "¿Cuándo comemos?"', options: ['Wanneer', 'eten', 'we?'], correctAnswer: 'Wanneer eten we?' },
        { id: 'm3l3e-17', type: 'true_false', prompt: '"geen" se usa para negar un sustantivo.', correctAnswer: 'verdadero', explanation: 'Sí: "Ik drink geen koffie" = no bebo café.' },
        { id: 'm3l3e-18', type: 'multiple_choice', prompt: '¿Qué significa "Hoeveel suiker wil je?"?', options: ['¿Quieres azúcar?', '¿Cuánta azúcar quieres?', '¿Dónde está el azúcar?', '¿Tienes azúcar?'], correctAnswer: '¿Cuánta azúcar quieres?', explanation: '"hoeveel" = cuánto/cuánta.' },
        { id: 'm3l3e-19', type: 'word_scramble', prompt: '¿Cómo se dice "cuándo"?', correctAnswer: 'wanneer', hint: 'cuándo' },
        { id: 'm3l3e-20', type: 'letter_dash', prompt: 'Completa: "cuánto / cuántos"', correctAnswer: 'hoeveel', hint: 'palabra interrogativa' },
        { id: 'm3l3e-21', type: 'order_sentence', prompt: 'Responde negando: "No, no como pescado."', options: ['Nee,', 'ik', 'eet', 'geen', 'vis.'], correctAnswer: 'Nee, ik eet geen vis.' },
        // Emoji
        { id: 'm3l3e-22', type: 'emoji_choice', prompt: '¿Cuál es "het water"?', options: ['💧', '☕', '🍵', '🥩'], correctAnswer: '💧', explanation: '"het water" = el agua 💧.' },
        { id: 'm3l3e-23', type: 'emoji_choice', prompt: '¿Cuál es "de vis"?', options: ['🐟', '🥩', '🥖', '🍬'], correctAnswer: '🐟', explanation: '"de vis" = el pescado 🐟.' },
        // Escucha y elige (TTS)
        { id: 'm3l3e-24', type: 'listen_and_choose', prompt: 'Escucha y elige la traducción: "Wie kookt vandaag?"', options: ['¿Quién cocina hoy?', '¿Qué comemos?', '¿Dónde comes?', '¿Cuándo comemos?'], correctAnswer: '¿Quién cocina hoy?', explanation: '"wie" = quién.' },
        { id: 'm3l3e-25', type: 'listen_and_choose', prompt: 'Escucha y elige la traducción: "Heb jij honger?"', options: ['¿Tienes hambre?', '¿Bebes café?', '¿Quieres té?', '¿Vienes hoy?'], correctAnswer: '¿Tienes hambre?', explanation: '"honger" = hambre.' },
        // Memory NL↔ES de palabras interrogativas
        { id: 'm3l3e-26', type: 'pair_memory', prompt: 'Empareja la palabra interrogativa con su significado', correctAnswer: '', pairs: [
          { left: 'wat', right: 'qué' },
          { left: 'waar', right: 'dónde' },
          { left: 'wanneer', right: 'cuándo' },
          { left: 'hoeveel', right: 'cuánto' },
        ] },
        { id: 'm3l3e-r1', type: 'match_pairs', prompt: 'Une la palabra interrogativa con su significado', correctAnswer: '', pairs: [ { left: 'wat', right: 'qué' }, { left: 'waar', right: 'dónde' }, { left: 'wanneer', right: 'cuándo' }, { left: 'wie', right: 'quién' } ] },
        { id: 'm3l3e-r2', type: 'match_pairs', prompt: 'Une cada palabra con su traducción', correctAnswer: '', pairs: [ { left: 'hoeveel', right: 'cuánto' }, { left: 'koffie', right: 'café' }, { left: 'water', right: 'agua' }, { left: 'vlees', right: 'carne' } ] },
        { id: 'm3l3e-r3', type: 'word_scramble', prompt: '¿Cómo se dice "dónde"?', correctAnswer: 'waar', hint: 'palabra interrogativa' },
        { id: 'm3l3e-r4', type: 'word_scramble', prompt: '¿Cómo se dice "quién"?', correctAnswer: 'wie', hint: 'palabra interrogativa' },
        { id: 'm3l3e-r5', type: 'emoji_choice', prompt: '¿Cuál es "de koffie"?', options: ['☕', '🍵', '💧', '🥩'], correctAnswer: '☕', explanation: '"de koffie" = el café ☕.' },
        { id: 'm3l3e-r6', type: 'odd_one_out', prompt: '¿Cuál NO es una palabra interrogativa?', options: ['wie', 'hoeveel', 'drinken', 'wat'], correctAnswer: 'drinken', explanation: '"drinken" (beber) es un verbo.' },
        { id: 'm3l3e-r7', type: 'odd_one_out', prompt: '¿Cuál NO es una bebida?', options: ['koffie', 'thee', 'water', 'vlees'], correctAnswer: 'vlees', explanation: '"vlees" (carne) es comida.' },
        { id: 'm3l3e-r8', type: 'letter_dash', prompt: 'Completa: "qué"', correctAnswer: 'wat', hint: 'palabra interrogativa' },
        { id: 'm3l3e-r9', type: 'letter_dash', prompt: 'Completa: "dónde"', correctAnswer: 'waar', hint: 'palabra interrogativa' },
      ],
    },
    { type: 'review' },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE 3 — BOODSCHAPPEN — Les 4 (Voegwoorden)
───────────────────────────────────────────────────────────────────────────── */

const m3_les4: Lesson = {
  id: 'm3-les-4-voegwoorden',
  moduleId: 'boodschappen',
  title: 'Les 4 — Grammatica | Voegwoorden',
  subtitle: 'Conectar frases: en, maar, of, want',
  order: 4,
  learningObjective: 'Unir dos frases cortas con en, maar, of y want manteniendo el orden de palabras',
  estimatedMinutes: 25,
  isExtra: false,
  blocks: [
    {
      type: 'summary',
      title: 'Voegwoorden — conectar frases',
      intro: 'Las conjunciones unen dos frases o palabras. Con en, maar, of y want el orden de palabras se mantiene igual.',
      objectives: [
        'Reconocer las conjunciones en, maar, of, want',
        'Unir dos frases cortas en una sola',
        'Entender que el orden de palabras no cambia',
      ],
      sections: [
        {
          heading: '🔗 Las cuatro conjunciones',
          items: [
            { nl: 'en', es: 'y (añadir información)' },
            { nl: 'maar', es: 'pero (contraste)' },
            { nl: 'of', es: 'o (elección)' },
            { nl: 'want', es: 'porque (dar una razón)' },
          ],
        },
        {
          heading: '🧩 Ejemplos',
          items: [
            { nl: 'Ik drink koffie en ik eet een koekje.', es: 'Bebo café y como una galleta.' },
            { nl: 'Ik hou van pizza, maar ik eet niet elke dag pizza.', es: 'Me gusta la pizza, pero no como pizza cada día.' },
            { nl: 'Wil je thee of koffie?', es: '¿Quieres té o café?' },
            { nl: 'Ik ga naar de supermarkt, want ik heb geen brood.', es: 'Voy al super porque no tengo pan.' },
          ],
        },
        {
          heading: '📐 Orden de palabras',
          body: 'sujeto + verbo + resto **+ voegwoord +** sujeto + verbo + resto. El orden **no cambia**.',
        },
      ],
      tip: 'Usa "want" para dar una razón y "maar" solo cuando hay un contraste de verdad.',
    },
    {
      type: 'vocabulary',
      items: [
        { id: 'm3l4v-en',     dutch: 'en',     spanish: 'y',                article: null, emoji: '➕', color: '#0b7a4d', exampleNl: 'brood en kaas',                       exampleEs: 'pan y queso',                      category: 'voegwoorden', difficulty: 'A1' },
        { id: 'm3l4v-maar',   dutch: 'maar',   spanish: 'pero',             article: null, emoji: '↔️', color: '#1a7a40', exampleNl: 'lekker, maar koud',                   exampleEs: 'rico, pero frío',                  category: 'voegwoorden', difficulty: 'A1' },
        { id: 'm3l4v-of',     dutch: 'of',     spanish: 'o',                article: null, emoji: '🔀', color: '#0d6e33', exampleNl: 'soep of salade',                      exampleEs: 'sopa o ensalada',                  category: 'voegwoorden', difficulty: 'A1' },
        { id: 'm3l4v-want',   dutch: 'want',   spanish: 'porque',           article: null, emoji: '💡', color: '#2e7d52', exampleNl: 'Ik drink water, want ik heb dorst.',  exampleEs: 'Bebo agua porque tengo sed.',      category: 'voegwoorden', difficulty: 'A1' },
        { id: 'm3l4v-koekje', dutch: 'het koekje', spanish: 'la galleta',   article: 'het', emoji: '🍪', color: '#0b7a4d', exampleNl: 'Ik eet een koekje bij de koffie.',  exampleEs: 'Como una galleta con el café.',    category: 'eten', difficulty: 'A1' },
        { id: 'm3l4v-honger', dutch: 'de honger', spanish: 'el hambre',     article: 'de',  emoji: '😋', color: '#1a7a40', exampleNl: 'Ik heb honger.',                     exampleEs: 'Tengo hambre.',                    category: 'gevoel', difficulty: 'A1' },
        { id: 'm3l4v-dorst',  dutch: 'de dorst',  spanish: 'la sed',        article: 'de',  emoji: '💦', color: '#0d6e33', exampleNl: 'Ik heb dorst.',                      exampleEs: 'Tengo sed.',                       category: 'gevoel', difficulty: 'A1' },
        { id: 'm3l4v-moe',    dutch: 'moe',    spanish: 'cansado/a',        article: null, emoji: '😴', color: '#2e7d52', exampleNl: 'Ik ga naar huis, want ik ben moe.',  exampleEs: 'Voy a casa porque estoy cansado.', category: 'gevoel', difficulty: 'A1' },
        { id: 'm3l4v-dicht',  dutch: 'dicht',  spanish: 'cerrado',          article: null, emoji: '🔒', color: '#0b7a4d', exampleNl: 'Het restaurant is dicht.',           exampleEs: 'El restaurante está cerrado.',     category: 'plek', difficulty: 'A1' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm3l4p-1',  dutch: 'Ik drink koffie en ik eet een koekje.',          spanish: 'Bebo café y como una galleta.',           context: 'en' },
        { id: 'm3l4p-2',  dutch: 'Ik wil koffie, maar ik neem thee.',              spanish: 'Quiero café, pero tomo té.',              context: 'maar' },
        { id: 'm3l4p-3',  dutch: 'Wil je thee of koffie?',                          spanish: '¿Quieres té o café?',                     context: 'of' },
        { id: 'm3l4p-4',  dutch: 'Ik ga naar de supermarkt, want ik heb geen brood.', spanish: 'Voy al super porque no tengo pan.',     context: 'want' },
        { id: 'm3l4p-5',  dutch: 'Ik drink water, want ik heb dorst.',             spanish: 'Bebo agua porque tengo sed.',             context: 'want' },
        { id: 'm3l4p-6',  dutch: 'Hij eet vlees, maar zij eet vis.',               spanish: 'Él come carne, pero ella come pescado.',  context: 'maar' },
        { id: 'm3l4p-7',  dutch: 'Eet je brood of rijst?',                          spanish: '¿Comes pan o arroz?',                     context: 'of' },
        { id: 'm3l4p-8',  dutch: 'Ik eet thuis, want het restaurant is dicht.',    spanish: 'Como en casa porque el restaurante está cerrado.', context: 'want' },
      ],
    },
    {
      type: 'lezen',
      textNl: `Eten met smaak

Veel Nederlanders houden van eenvoudig eten, maar gezelligheid vinden ze heel belangrijk. 's Ochtends eten ze brood met kaas of hagelslag, en ze drinken koffie of thee.

's Middags is de lunch vaak koud. Mensen nemen een broodje of een salade, want ze hebben weinig tijd. Sommigen eten op het werk, maar anderen gaan naar huis.

's Avonds eten Nederlanders warm. Ze koken aardappelen, groente en vlees of vis. Houd je niet van vlees? Dan eet je gewoon groente en pasta, want er is altijd een optie.

Drinken is ook belangrijk. Veel mensen drinken water of thee, maar koffie blijft favoriet. En op een feestje drinken ze vaak bier of wijn.

Eten in Nederland is dus simpel, maar gezellig. En jij? Eet je liever zoet of hartig?`,
      textEs: `Comer con gusto

A muchos neerlandeses les gusta la comida sencilla, pero la "gezelligheid" (el buen ambiente) les parece muy importante. Por la mañana comen pan con queso o "hagelslag", y beben café o té.

A mediodía el almuerzo suele ser frío. La gente toma un bocadillo o una ensalada, porque tienen poco tiempo. Algunos comen en el trabajo, pero otros van a casa.

Por la noche los neerlandeses comen caliente. Cocinan patatas, verdura y carne o pescado. ¿No te gusta la carne? Pues comes simplemente verdura y pasta, porque siempre hay una opción.

Beber también es importante. Mucha gente bebe agua o té, pero el café sigue siendo el favorito. Y en una fiesta beben a menudo cerveza o vino.

Comer en los Países Bajos es, pues, sencillo pero agradable. ¿Y tú? ¿Prefieres dulce o salado?`,
      exercises: [
        { id: 'm3l4lz-1', type: 'multiple_choice', prompt: '¿Qué les parece muy importante a los neerlandeses al comer?', options: ['La gezelligheid (el buen ambiente)', 'Comer muy rápido', 'Comer caro', 'Comer solos'], correctAnswer: 'La gezelligheid (el buen ambiente)', explanation: '"Gezelligheid vinden ze heel belangrijk".' },
        { id: 'm3l4lz-2', type: 'multiple_choice', prompt: '¿Por qué el almuerzo suele ser un bocadillo o ensalada?', options: ['Porque tienen poco tiempo', 'Porque es caro', 'Porque no hay comida caliente', 'Porque están cansados'], correctAnswer: 'Porque tienen poco tiempo', explanation: '"…want ze hebben weinig tijd".' },
        { id: 'm3l4lz-3', type: 'multiple_choice', prompt: '¿Qué conjunción usa el texto para dar una razón (porque)?', options: ['want', 'maar', 'of', 'en'], correctAnswer: 'want', explanation: '"want" = porque (da una razón).' },
        { id: 'm3l4lz-4', type: 'fill_blank', prompt: 'Veel mensen drinken water ___ thee. (elección: o)', correctAnswer: 'of', hint: 'o = of', explanation: '"of" da a elegir entre dos opciones.' },
        { id: 'm3l4lz-5', type: 'fill_blank', prompt: 'Eten in Nederland is simpel, ___ gezellig. (contraste: pero)', correctAnswer: 'maar', hint: 'la conjunción de contraste', explanation: '"maar" marca un contraste.' },
        { id: 'm3l4lz-6', type: 'true_false', prompt: 'Si no te gusta la carne, no puedes cenar nada caliente.', correctAnswer: 'falso', explanation: '"Dan eet je gewoon groente en pasta, want er is altijd een optie": siempre hay una opción.' },
        { id: 'm3l4lz-7', type: 'multiple_choice', prompt: '¿Qué se bebe a menudo en una fiesta, según el texto?', options: ['Cerveza o vino', 'Solo agua', 'Café con leche', 'Zumo'], correctAnswer: 'Cerveza o vino', explanation: '"Op een feestje drinken ze vaak bier of wijn".' },
        { id: 'm3l4lz-8', type: 'order_sentence', prompt: 'Ordena: «Bebo café y como una galleta.»', options: ['Ik', 'drink', 'koffie', 'en', 'ik', 'eet', 'een', 'koekje.'], correctAnswer: 'Ik drink koffie en ik eet een koekje.' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'm3d4',
        title: 'Radio Nawar – Eten bestellen in Nederland',
        context: 'Een nieuwsbericht op de radio over eten bestellen in Nederland. Eén presentatrice met cijfers en statistieken. Vol voegwoorden (en, maar, of, want).',
        lines: [
          { id: 'm3d4-1',  speaker: 'Presentatrice', dutch: 'Goedemiddag en welkom bij Radio Nawar. Vandaag praten we over eten in Nederland.', spanish: 'Buenas tardes y bienvenidos a Radio Nawar. Hoy hablamos sobre la comida en los Países Bajos.' },
          { id: 'm3d4-2',  speaker: 'Presentatrice', dutch: 'Steeds minder mensen koken zelf, want sinds twintig twintig bestellen we veel meer eten thuis.', spanish: 'Cada vez menos gente cocina, porque desde 2020 pedimos mucha más comida a casa.' },
          { id: 'm3d4-3',  speaker: 'Presentatrice', dutch: 'Een nieuw onderzoek zegt: bijna veertig procent van de Nederlanders bestelt elke week eten.', spanish: 'Un nuevo estudio dice: casi el 40% de los neerlandeses pide comida cada semana.' },
          { id: 'm3d4-4',  speaker: 'Presentatrice', dutch: 'In twintig negentien was dat maar vijfentwintig procent, dus de groei is heel groot.', spanish: 'En 2019 eso era solo el 25%, así que el crecimiento es muy grande.' },
          { id: 'm3d4-5',  speaker: 'Presentatrice', dutch: 'Vooral jonge mensen bestellen veel: zeven van de tien mensen onder de dertig jaar gebruiken een app.', spanish: 'Sobre todo la gente joven pide mucho: siete de cada diez personas menores de 30 años usan una app.' },
          { id: 'm3d4-6',  speaker: 'Presentatrice', dutch: 'En in welke steden bestellen mensen het meest? Amsterdam staat op nummer één.', spanish: '¿Y en qué ciudades pide la gente más? Ámsterdam está en el número uno.' },
          { id: 'm3d4-7',  speaker: 'Presentatrice', dutch: 'Daarna komen Rotterdam en Den Haag, maar ook in Utrecht en Eindhoven groeit het snel.', spanish: 'Después vienen Róterdam y La Haya, pero también en Utrecht y Eindhoven crece rápido.' },
          { id: 'm3d4-8',  speaker: 'Presentatrice', dutch: 'Wat eten Nederlanders het liefst? Pizza is favoriet, en daarna komen sushi en friet.', spanish: '¿Qué comen los neerlandeses con más gusto? La pizza es la favorita, y después vienen el sushi y las patatas fritas.' },
          { id: 'm3d4-9',  speaker: 'Presentatrice', dutch: 'Een gemiddelde bestelling kost ongeveer twintig euro, en mensen bestellen meestal in het weekend.', spanish: 'Un pedido medio cuesta unos 20 euros, y la gente suele pedir el fin de semana.' },
          { id: 'm3d4-10', speaker: 'Presentatrice', dutch: 'Waarom bestellen we zo veel? Mensen hebben weinig tijd, en bestellen is snel en makkelijk.', spanish: '¿Por qué pedimos tanto? La gente tiene poco tiempo, y pedir es rápido y fácil.' },
          { id: 'm3d4-11', speaker: 'Presentatrice', dutch: 'Maar er is ook kritiek, want eten bestellen is duurder en vaak minder gezond dan zelf koken.', spanish: 'Pero también hay críticas, porque pedir comida es más caro y a menudo menos sano que cocinar uno mismo.' },
          { id: 'm3d4-12', speaker: 'Presentatrice', dutch: 'Veel mensen willen weer vaker koken, of ze koken samen met vrienden, want dat is gezellig.', spanish: 'Mucha gente quiere volver a cocinar más a menudo, o cocinan con amigos, porque es agradable.' },
          { id: 'm3d4-13', speaker: 'Presentatrice', dutch: 'Onze tip voor vandaag: kook twee keer per week zelf, en bestel alleen in het weekend.', spanish: 'Nuestro consejo de hoy: cocina dos veces por semana, y pide solo el fin de semana.' },
          { id: 'm3d4-14', speaker: 'Presentatrice', dutch: 'Dat was het nieuws over eten. Bedankt voor het luisteren, en tot morgen bij Radio Nawar. Eet smakelijk!', spanish: 'Esas fueron las noticias sobre la comida. Gracias por escuchar, y hasta mañana en Radio Nawar. ¡Buen provecho!' },
        ],
      },
    },
    {
      type: 'practice',
      exercises: [
        { id: 'm3l4e-1',  type: 'multiple_choice', prompt: 'Wil je thee ___ koffie?', options: ['en', 'maar', 'of', 'want'], correctAnswer: 'of', explanation: '"of" = elección entre dos opciones.' },
        { id: 'm3l4e-2',  type: 'multiple_choice', prompt: 'Ik ga naar de supermarkt, ___ ik heb geen melk.', options: ['en', 'maar', 'of', 'want'], correctAnswer: 'want', explanation: '"want" da una razón.' },
        { id: 'm3l4e-3',  type: 'multiple_choice', prompt: 'Ik wil pizza, ___ ik neem soep.', options: ['en', 'maar', 'of', 'want'], correctAnswer: 'maar', explanation: '"maar" = contraste.' },
        { id: 'm3l4e-4',  type: 'multiple_choice', prompt: 'Ik drink koffie ___ ik eet een koekje.', options: ['en', 'maar', 'of', 'want'], correctAnswer: 'en', explanation: '"en" añade información.' },
        { id: 'm3l4e-5',  type: 'match_pairs', prompt: 'Une cada conjunción con su función', correctAnswer: '', pairs: [
          { left: 'en', right: 'añadir (y)' },
          { left: 'maar', right: 'contraste (pero)' },
          { left: 'of', right: 'elección (o)' },
          { left: 'want', right: 'razón (porque)' },
        ] },
        { id: 'm3l4e-6',  type: 'order_sentence', prompt: 'Ordena: "Bebo café y como pan."', options: ['Ik', 'drink', 'koffie', 'en', 'ik', 'eet', 'brood.'], correctAnswer: 'Ik drink koffie en ik eet brood.' },
        { id: 'm3l4e-7',  type: 'order_sentence', prompt: 'Ordena: "Voy a casa porque estoy cansado."', options: ['Ik', 'ga', 'naar', 'huis,', 'want', 'ik', 'ben', 'moe.'], correctAnswer: 'Ik ga naar huis, want ik ben moe.' },
        { id: 'm3l4e-8',  type: 'fill_blank', prompt: 'Ik hou van pizza, ___ ik eet niet elke dag pizza. (pero)', correctAnswer: 'maar', hint: 'contraste' },
        { id: 'm3l4e-9',  type: 'true_false', prompt: '"want" significa "pero".', correctAnswer: 'falso', explanation: '"want" = porque. "maar" = pero.' },
        { id: 'm3l4e-10', type: 'odd_one_out', prompt: '¿Cuál NO es una conjunción?', options: ['en', 'maar', 'want', 'koffie'], correctAnswer: 'koffie', explanation: '"koffie" es café; las demás son conjunciones.' },
        { id: 'm3l4e-11', type: 'multiple_choice', prompt: 'Corrige: "Ik wil thee want ik neem koffie."', options: ['Ik wil thee, maar ik neem koffie.', 'Ik wil thee of ik neem koffie.', 'Ik wil thee en ik neem koffie.'], correctAnswer: 'Ik wil thee, maar ik neem koffie.', explanation: 'Hay contraste (querer una cosa, tomar otra) → "maar".' },
        { id: 'm3l4e-12', type: 'fill_blank', prompt: 'Wij eten soep, ___ het is koud. (porque)', correctAnswer: 'want', hint: 'razón' },
        { id: 'm3l4e-13', type: 'word_scramble', prompt: '¿Cómo se dice "galleta"?', correctAnswer: 'koekje', hint: 'galleta' },
        { id: 'm3l4e-14', type: 'fill_blank', prompt: 'Hij eet vlees, ___ zij eet vis. (contraste)', correctAnswer: 'maar', hint: 'pero' },
        { id: 'm3l4e-15', type: 'fill_blank', prompt: 'Eet je brood ___ rijst? (elección)', correctAnswer: 'of', hint: 'o' },
        { id: 'm3l4e-16', type: 'true_false', prompt: '"of" se usa para una elección entre dos opciones.', correctAnswer: 'verdadero', explanation: '"Wil je thee of koffie?" = elección.' },
        { id: 'm3l4e-17', type: 'order_sentence', prompt: 'Ordena: "Bebo agua porque tengo sed."', options: ['Ik', 'drink', 'water,', 'want', 'ik', 'heb', 'dorst.'], correctAnswer: 'Ik drink water, want ik heb dorst.' },
        { id: 'm3l4e-18', type: 'multiple_choice', prompt: 'Corrige: "Wil je thee en koffie?" (es una elección)', options: ['Wil je thee of koffie?', 'Wil je thee want koffie?', 'Wil je thee maar koffie?'], correctAnswer: 'Wil je thee of koffie?', explanation: 'Elección entre dos → "of".' },
        { id: 'm3l4e-19', type: 'word_scramble', prompt: '¿Cómo se dice "porque"?', correctAnswer: 'want', hint: 'porque (dar una razón)' },
        { id: 'm3l4e-20', type: 'letter_dash', prompt: 'Completa: "tengo hambre" → Ik heb ___', correctAnswer: 'honger', hint: 'hambre' },
        { id: 'm3l4e-21', type: 'order_sentence', prompt: 'Ordena: "Como en casa porque el restaurante está cerrado."', options: ['Ik', 'eet', 'thuis,', 'want', 'het', 'restaurant', 'is', 'dicht.'], correctAnswer: 'Ik eet thuis, want het restaurant is dicht.' },
        // Emoji
        { id: 'm3l4e-22', type: 'emoji_choice', prompt: '¿Cuál es "het koekje"?', options: ['🍪', '🍞', '🧀', '🥤'], correctAnswer: '🍪', explanation: '"het koekje" = la galleta 🍪.' },
        // Escucha y elige (TTS)
        { id: 'm3l4e-23', type: 'listen_and_choose', prompt: 'Escucha y elige la traducción: "Ik drink water, want ik heb dorst."', options: ['Bebo agua porque tengo sed', 'Quiero té o café', 'Como pan y queso', 'No bebo café'], correctAnswer: 'Bebo agua porque tengo sed', explanation: '"want" = porque; "dorst" = sed.' },
        { id: 'm3l4e-24', type: 'listen_and_choose', prompt: 'Escucha y elige la traducción: "Wil je thee of koffie?"', options: ['¿Quieres té o café?', '¿Bebes café y té?', '¿Tienes hambre?', '¿Comes pan?'], correctAnswer: '¿Quieres té o café?', explanation: '"of" = o (elección).' },
        // Memory NL↔ES de conjunciones
        { id: 'm3l4e-25', type: 'pair_memory', prompt: 'Empareja la conjunción con su significado', correctAnswer: '', pairs: [
          { left: 'en', right: 'y' },
          { left: 'maar', right: 'pero' },
          { left: 'of', right: 'o' },
          { left: 'want', right: 'porque' },
        ] },
        { id: 'm3l4e-r1', type: 'match_pairs', prompt: 'Une cada palabra con su traducción', correctAnswer: '', pairs: [ { left: 'het koekje', right: 'la galleta' }, { left: 'de honger', right: 'el hambre' }, { left: 'de dorst', right: 'la sed' }, { left: 'moe', right: 'cansado' } ] },
        { id: 'm3l4e-r2', type: 'match_pairs', prompt: 'Une cada conjunción con su función', correctAnswer: '', pairs: [ { left: 'en', right: 'añadir' }, { left: 'maar', right: 'contraste' }, { left: 'of', right: 'elección' }, { left: 'want', right: 'razón' } ] },
        { id: 'm3l4e-r3', type: 'word_scramble', prompt: '¿Cómo se dice "pero"?', correctAnswer: 'maar', hint: 'contraste' },
        { id: 'm3l4e-r4', type: 'emoji_choice', prompt: '¿Cuál es "de honger" (hambre)?', options: ['😋', '💦', '😴', '🔒'], correctAnswer: '😋', explanation: '"honger" = hambre 😋.' },
        { id: 'm3l4e-r5', type: 'emoji_choice', prompt: '¿Cuál es "de dorst" (sed)?', options: ['💦', '😋', '🍪', '🧈'], correctAnswer: '💦', explanation: '"dorst" = sed 💦.' },
        { id: 'm3l4e-r6', type: 'odd_one_out', prompt: '¿Cuál NO es una conjunción?', options: ['want', 'of', 'en', 'dorst'], correctAnswer: 'dorst', explanation: '"dorst" (sed) no es conjunción.' },
        { id: 'm3l4e-r7', type: 'odd_one_out', prompt: '¿Cuál NO es una conjunción?', options: ['maar', 'en', 'of', 'moe'], correctAnswer: 'moe', explanation: '"moe" (cansado) no es conjunción.' },
        { id: 'm3l4e-r8', type: 'letter_dash', prompt: 'Completa: "pero"', correctAnswer: 'maar', hint: 'contraste' },
        { id: 'm3l4e-r9', type: 'letter_dash', prompt: 'Completa: "porque"', correctAnswer: 'want', hint: 'dar una razón' },
        // Comprensión del informativo de Radio Nawar (Luisteren) — preguntas sobre lo que entendieron
        { id: 'm3l4e-c1', type: 'multiple_choice', prompt: 'Radio Nawar: ¿qué porcentaje de neerlandeses pide comida cada semana?', options: ['Casi el 40%', 'El 25%', 'El 70%', 'El 10%'], correctAnswer: 'Casi el 40%', explanation: '"bijna veertig procent" = casi el 40%.' },
        { id: 'm3l4e-c2', type: 'multiple_choice', prompt: 'Radio Nawar: ¿qué ciudad está en el número uno pidiendo comida?', options: ['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht'], correctAnswer: 'Amsterdam', explanation: '"Amsterdam staat op nummer één."' },
        { id: 'm3l4e-c3', type: 'multiple_choice', prompt: 'Radio Nawar: ¿cuál es la comida favorita?', options: ['Pizza', 'Sushi', 'Friet', 'Pasta'], correctAnswer: 'Pizza', explanation: '"Pizza is favoriet, en daarna komen sushi en friet."' },
        { id: 'm3l4e-c4', type: 'true_false', prompt: 'Radio Nawar dice que pedir comida es más barato que cocinar uno mismo.', correctAnswer: 'falso', explanation: 'Dice lo contrario: "eten bestellen is duurder" (es más caro).' },
        { id: 'm3l4e-c5', type: 'multiple_choice', prompt: 'Radio Nawar: ¿cuánto cuesta de media un pedido?', options: ['Unos 20 euros', 'Unos 5 euros', 'Unos 50 euros', 'Unos 100 euros'], correctAnswer: 'Unos 20 euros', explanation: '"ongeveer twintig euro" = unos 20 euros.' },
        { id: 'm3l4e-c6', type: 'true_false', prompt: 'Según Radio Nawar, sobre todo la gente joven pide comida con apps.', correctAnswer: 'verdadero', explanation: '"Vooral jonge mensen bestellen veel... gebruiken een app."' },
      ],
    },
    { type: 'review' },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE 3 — BOODSCHAPPEN — Les 5 (Aantallen, graag & houden van)
───────────────────────────────────────────────────────────────────────────── */

const m3_les5: Lesson = {
  id: 'm3-les-5-aantallen',
  moduleId: 'boodschappen',
  title: 'Les 5 — Grammatica | Aantallen & graag',
  subtitle: 'Cantidades, pedir más y decir qué te gusta',
  order: 5,
  learningObjective: 'Pedir cantidades (números, kilos, veel/een beetje), ser educado con graag y decir qué te gusta con houden van',
  estimatedMinutes: 25,
  isExtra: false,
  blocks: [
    {
      type: 'summary',
      title: 'Aantallen, graag & houden van',
      intro: 'En esta lección pides cantidades (números, kilos y gramos, veel / een beetje), pides "uno más" (nog een), eres más educado con graag y dices lo que te gusta con houden van.',
      objectives: [
        'Usar números y cantidades (veel, een beetje, weinig)',
        'Pedir en kilos y gramos y pedir "nog een"',
        'Preguntar con "hoeveel"',
        'Usar "graag" para ser educado',
        'Decir lo que te gusta con "houden van"',
      ],
      sections: [
        {
          heading: '🔢 Contable vs. no contable',
          body: 'Con cosas **contables** usa números (twee koffie). Con **no contables** usa veel / een beetje (veel water).',
          items: [
            { nl: 'veel', es: 'mucho' }, { nl: 'een beetje', es: 'un poco' }, { nl: 'weinig', es: 'poco' },
            { nl: 'nog een koffie', es: 'otro café' },
          ],
        },
        {
          heading: '⚖️ Kilos y gramos',
          items: [
            { nl: 'Ik wil graag een kilo kip.', es: 'Quiero un kilo de pollo.' },
            { nl: 'Ik wil graag 500 gram druiven.', es: 'Quiero 500 gramos de uvas.' },
          ],
        },
        {
          heading: '🙏 La palabra "graag"',
          body: 'Va **después del verbo**: "Ik wil **graag** koffie" (no "Ik wil koffie graag"). Hace la frase más educada y natural.',
        },
        {
          heading: '❤️ Houden van — gustar',
          body: 'Para decir lo que te gusta: **"Ik hou van friet."** La negación lleva **niet** entre houden y van: "Ik hou **niet** van vis."',
          items: [
            { nl: 'Ik hou van koffie.', es: 'Me gusta el café.' },
            { nl: 'Hou je van pizza?', es: '¿Te gusta la pizza?' },
            { nl: 'Ik hou niet van vis.', es: 'No me gusta el pescado.' },
          ],
        },
      ],
      tip: '"nog een" va siempre junto (otro/una más). "hoeveel" + producto + verbo + sujeto: "Hoeveel koffie wil je?".',
    },
    {
      type: 'vocabulary',
      items: [
        { id: 'm3l5v-veel',     dutch: 'veel',          spanish: 'mucho',           article: null,  emoji: '🔝', color: '#0b7a4d', exampleNl: 'Ik wil veel water.',           exampleEs: 'Quiero mucha agua.',            category: 'hoeveelheid', difficulty: 'A1' },
        { id: 'm3l5v-beetje',   dutch: 'een beetje',    spanish: 'un poco',         article: null,  emoji: '🤏', color: '#1a7a40', exampleNl: 'Een beetje melk, graag.',      exampleEs: 'Un poco de leche, por favor.',  category: 'hoeveelheid', difficulty: 'A1' },
        { id: 'm3l5v-weinig',   dutch: 'weinig',        spanish: 'poco',            article: null,  emoji: '📉', color: '#0d6e33', exampleNl: 'Ik eet weinig vlees.',         exampleEs: 'Como poca carne.',              category: 'hoeveelheid', difficulty: 'A1' },
        { id: 'm3l5v-nogeen',   dutch: 'nog een',       spanish: 'otro / uno más',  article: null,  emoji: '➕', color: '#2e7d52', exampleNl: 'Nog een broodje, alstublieft.', exampleEs: 'Otro bocadillo, por favor.',   category: 'hoeveelheid', difficulty: 'A1' },
        { id: 'm3l5v-kilo',     dutch: 'de kilo',       spanish: 'el kilo',         article: 'de',  emoji: '⚖️', color: '#0b7a4d', exampleNl: 'Een kilo aardappels.',         exampleEs: 'Un kilo de patatas.',           category: 'hoeveelheid', difficulty: 'A1' },
        { id: 'm3l5v-gram',     dutch: 'het gram',      spanish: 'el gramo',        article: 'het', emoji: '🧮', color: '#1a7a40', exampleNl: '500 gram druiven.',            exampleEs: '500 gramos de uvas.',           category: 'hoeveelheid', difficulty: 'A1' },
        { id: 'm3l5v-houvan',   dutch: 'houden van',    spanish: 'gustar / amar',   article: null,  emoji: '❤️', color: '#0d6e33', exampleNl: 'Ik hou van friet.',            exampleEs: 'Me gusta la patata frita.',     category: 'werkwoorden', difficulty: 'A1' },
        { id: 'm3l5v-lieveling',dutch: 'het lievelingseten', spanish: 'la comida favorita', article: 'het', emoji: '😍', color: '#2e7d52', exampleNl: 'Wat is jouw lievelingseten?', exampleEs: '¿Cuál es tu comida favorita?', category: 'eten', difficulty: 'A1' },
        { id: 'm3l5v-kip',      dutch: 'de kip',        spanish: 'el pollo',        article: 'de',  emoji: '🍗', color: '#0b7a4d', exampleNl: 'Ik wil graag een kilo kip.',   exampleEs: 'Quiero un kilo de pollo.',      category: 'eten', difficulty: 'A1' },
        { id: 'm3l5v-appel',    dutch: 'de appel',      spanish: 'la manzana',      article: 'de',  emoji: '🍏', color: '#1a7a40', exampleNl: 'Ik koop twee appels.',         exampleEs: 'Compro dos manzanas.',          category: 'eten', difficulty: 'A1' },
        { id: 'm3l5v-aardappel',dutch: 'de aardappel',  spanish: 'la patata',       article: 'de',  emoji: '🥔', color: '#0d6e33', exampleNl: 'Twee kilo aardappels, graag.', exampleEs: 'Dos kilos de patatas, por favor.', category: 'eten', difficulty: 'A1' },
        { id: 'm3l5v-druiven',  dutch: 'de druiven',    spanish: 'las uvas',        article: 'de',  emoji: '🍇', color: '#2e7d52', exampleNl: '250 gram druiven.',            exampleEs: '250 gramos de uvas.',           category: 'eten', difficulty: 'A1' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm3l5p-1',  dutch: 'Ik wil graag twee koffie.',            spanish: 'Quiero dos cafés, por favor.',     context: 'Aantallen' },
        { id: 'm3l5p-2',  dutch: 'Nog een broodje, alstublieft.',        spanish: 'Otro bocadillo, por favor.',       context: 'Nog een' },
        { id: 'm3l5p-3',  dutch: 'Ik wil graag een kilo appels.',        spanish: 'Quiero un kilo de manzanas.',      context: 'Kilo/gram' },
        { id: 'm3l5p-4',  dutch: 'Vijfhonderd gram druiven, graag.',     spanish: 'Quinientos gramos de uvas, por favor.', context: 'Kilo/gram' },
        { id: 'm3l5p-5',  dutch: 'Een beetje melk, alstublieft.',        spanish: 'Un poco de leche, por favor.',     context: 'Veel / een beetje' },
        { id: 'm3l5p-6',  dutch: 'Hoeveel suiker wil je?',               spanish: '¿Cuánto azúcar quieres?',          context: 'Hoeveel' },
        { id: 'm3l5p-7',  dutch: 'Ik hou van friet.',                    spanish: 'Me gusta la patata frita.',        context: 'Houden van' },
        { id: 'm3l5p-8',  dutch: 'Wat is jouw lievelingseten?',          spanish: '¿Cuál es tu comida favorita?',     context: 'Houden van' },
      ],
    },
    {
      type: 'lezen',
      textNl: `Wat eten Nederlanders graag?

Nederlanders houden van lekker en simpel eten. Veel mensen houden van friet met mayonaise, een broodje haring of een warme stroopwafel.

Op de markt kopen mensen graag verse groente en fruit. Je zegt bijvoorbeeld: «Ik wil graag een kilo appels» of «Twee kilo aardappels, alstublieft». Voor kleine dingen gebruik je gram: «vijfhonderd gram druiven».

Niet alles tel je. Water, melk en suiker zijn niet telbaar. Daarom zeg je «veel water» of «een beetje suiker», en niet «twee water».

Wil je iets extra? Vraag dan om «nog een»: «Nog een koffie, alstublieft.» En met het woord «graag» klink je altijd beleefd.

En jij? Wat is jouw lievelingseten? Hou je van zoet of van hartig?`,
      textEs: `¿Qué les gusta comer a los neerlandeses?

A los neerlandeses les gusta la comida rica y sencilla. A mucha gente le gustan las patatas fritas con mayonesa, un bocadillo de arenque o un "stroopwafel" calentito.

En el mercado la gente compra con gusto verdura y fruta fresca. Dices por ejemplo: «Ik wil graag een kilo appels» (quiero un kilo de manzanas) o «Twee kilo aardappels, alstublieft» (dos kilos de patatas, por favor). Para cosas pequeñas usas gramos: «vijfhonderd gram druiven» (500 gramos de uvas).

No todo se cuenta. El agua, la leche y el azúcar no son contables. Por eso dices «veel water» (mucha agua) o «een beetje suiker» (un poco de azúcar), y no «twee water».

¿Quieres algo extra? Pide entonces «nog een»: «Nog een koffie, alstublieft» (otro café, por favor). Y con la palabra «graag» siempre suenas educado.

¿Y tú? ¿Cuál es tu comida favorita? ¿Te gusta lo dulce o lo salado?`,
      exercises: [
        { id: 'm3l5lz-1', type: 'multiple_choice', prompt: '¿Qué les gusta a muchos neerlandeses según el texto?', options: ['Patatas fritas con mayonesa', 'Sushi', 'Paella', 'Tacos'], correctAnswer: 'Patatas fritas con mayonesa', explanation: '"Veel mensen houden van friet met mayonaise".' },
        { id: 'm3l5lz-2', type: 'multiple_choice', prompt: '¿Dónde compra la gente verdura y fruta fresca?', options: ['En el mercado', 'En la farmacia', 'En el banco', 'En el café'], correctAnswer: 'En el mercado', explanation: '"Op de markt kopen mensen graag verse groente en fruit".' },
        { id: 'm3l5lz-3', type: 'multiple_choice', prompt: '¿Qué tres cosas NO son contables según el texto?', options: ['Agua, leche y azúcar', 'Manzanas, patatas y uvas', 'Café, té y pan', 'Pollo, pescado y carne'], correctAnswer: 'Agua, leche y azúcar', explanation: '"Water, melk en suiker zijn niet telbaar".' },
        { id: 'm3l5lz-4', type: 'fill_blank', prompt: 'Ik wil graag een ___ appels. (kilo)', correctAnswer: 'kilo', hint: 'la unidad de peso (1000 gramos)', explanation: '"Ik wil graag een kilo appels".' },
        { id: 'm3l5lz-5', type: 'fill_blank', prompt: 'Met agua (no contable): «___ water». (mucho)', correctAnswer: 'veel', hint: 'lo contrario de weinig (poco)', explanation: 'Con lo no contable: "veel water", no "twee water".' },
        { id: 'm3l5lz-6', type: 'true_false', prompt: '"twee water" es correcto.', correctAnswer: 'falso', explanation: 'El agua no es contable: se dice "veel water" o "een beetje water".' },
        { id: 'm3l5lz-7', type: 'multiple_choice', prompt: '¿Para qué sirve la palabra «graag»?', options: ['Para sonar educado', 'Para negar', 'Para contar', 'Para pagar'], correctAnswer: 'Para sonar educado', explanation: '"Met het woord graag klink je altijd beleefd".' },
        { id: 'm3l5lz-8', type: 'order_sentence', prompt: 'Ordena: «Quiero un kilo de manzanas.» (educado)', options: ['Ik', 'wil', 'graag', 'een', 'kilo', 'appels.'], correctAnswer: 'Ik wil graag een kilo appels.' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'm3d5',
        title: 'Dialoog – Op de markt',
        context: 'Sara koopt groente en fruit op de markt. Ze gebruikt aantallen, kilo/gram, veel/een beetje en graag.',
        lines: [
          { id: 'm3d5-1',  speaker: 'Verkoper', dutch: 'Goedemorgen! Wat mag het zijn?',                 spanish: '¡Buenos días! ¿Qué va a ser?' },
          { id: 'm3d5-2',  speaker: 'Sara',     dutch: 'Goedemorgen. Ik wil graag een kilo appels.',     spanish: 'Buenos días. Quiero un kilo de manzanas.' },
          { id: 'm3d5-3',  speaker: 'Verkoper', dutch: 'Alstublieft. Wilt u nog iets?',                  spanish: 'Aquí tiene. ¿Quiere algo más?' },
          { id: 'm3d5-4',  speaker: 'Sara',     dutch: 'Ja, twee kilo aardappels, alstublieft.',         spanish: 'Sí, dos kilos de patatas, por favor.' },
          { id: 'm3d5-5',  speaker: 'Verkoper', dutch: 'Prima. Houdt u van druiven? Ze zijn vandaag heel zoet.', spanish: 'Perfecto. ¿Le gustan las uvas? Hoy están muy dulces.' },
          { id: 'm3d5-6',  speaker: 'Sara',     dutch: 'Lekker! Doe maar vijfhonderd gram.',             spanish: '¡Qué ricas! Ponme quinientos gramos.' },
          { id: 'm3d5-7',  speaker: 'Verkoper', dutch: 'En verder nog iets?',                            spanish: '¿Y algo más?' },
          { id: 'm3d5-8',  speaker: 'Sara',     dutch: 'Een beetje spinazie, niet te veel. Ik kook voor twee personen.', spanish: 'Un poco de espinacas, no demasiado. Cocino para dos personas.' },
          { id: 'm3d5-9',  speaker: 'Verkoper', dutch: 'Geen probleem. Wilt u ook tomaten?',             spanish: 'Sin problema. ¿Quiere también tomates?' },
          { id: 'm3d5-10', speaker: 'Sara',     dutch: 'Nee, dank u. Maar nog een bos wortels, graag.',  spanish: 'No, gracias. Pero otro manojo de zanahorias, por favor.' },
          { id: 'm3d5-11', speaker: 'Verkoper', dutch: 'Top. Is dat alles?',                             spanish: 'Genial. ¿Es todo?' },
          { id: 'm3d5-12', speaker: 'Sara',     dutch: 'Ja, dat is alles. Dank u wel!',                  spanish: 'Sí, eso es todo. ¡Muchas gracias!' },
        ],
      },
    },
    {
      type: 'practice',
      exercises: [
        { id: 'm3l5e-1',  type: 'multiple_choice', prompt: 'Con algo NO contable usamos…', options: ['twee water', 'veel water', 'water twee', 'een water'], correctAnswer: 'veel water', explanation: '"water" no es contable → veel water (no "twee water").' },
        { id: 'm3l5e-2',  type: 'fill_blank', prompt: 'Ik wil ___ koffie. (educado: usa "graag")', correctAnswer: 'graag', hint: 'va después del verbo' },
        { id: 'm3l5e-3',  type: 'match_pairs', prompt: 'Une cada palabra de cantidad con su significado', correctAnswer: '', pairs: [
          { left: 'veel', right: 'mucho' },
          { left: 'een beetje', right: 'un poco' },
          { left: 'weinig', right: 'poco' },
          { left: 'nog een', right: 'otro' },
        ] },
        { id: 'm3l5e-4',  type: 'order_sentence', prompt: 'Ordena: "Quiero dos cafés." (educado)', options: ['Ik', 'wil', 'graag', 'twee', 'koffie.'], correctAnswer: 'Ik wil graag twee koffie.' },
        { id: 'm3l5e-5',  type: 'true_false', prompt: '"een beetje appels" es correcto.', correctAnswer: 'falso', explanation: 'Las manzanas son contables → "twee appels" o "een paar appels", no "een beetje".' },
        { id: 'm3l5e-6',  type: 'multiple_choice', prompt: '¿Dónde va "graag"?', options: ['Ik wil koffie graag.', 'Ik wil graag koffie.', 'Graag ik wil koffie.'], correctAnswer: 'Ik wil graag koffie.', explanation: 'Después del verbo conjugado.' },
        { id: 'm3l5e-7',  type: 'fill_blank', prompt: 'Ik ___ van pizza. (gustar: houden van — ik)', correctAnswer: 'hou', hint: 'houden van → con ik la raíz se acorta' },
        { id: 'm3l5e-8',  type: 'multiple_choice', prompt: '¿Cómo se dice "No me gusta el pescado"?', options: ['Ik hou geen van vis.', 'Ik hou niet van vis.', 'Ik niet hou van vis.'], correctAnswer: 'Ik hou niet van vis.', explanation: '"niet" va entre houden y van.' },
        { id: 'm3l5e-9',  type: 'order_sentence', prompt: 'Ordena la pregunta: "¿Cuánto café quieres?"', options: ['Hoeveel', 'koffie', 'wil', 'je?'], correctAnswer: 'Hoeveel koffie wil je?' },
        { id: 'm3l5e-10', type: 'odd_one_out', prompt: '¿Cuál NO es una palabra de cantidad?', options: ['veel', 'weinig', 'een beetje', 'lekker'], correctAnswer: 'lekker', explanation: '"lekker" significa rico; las demás son cantidades.' },
        { id: 'm3l5e-11', type: 'letter_dash', prompt: 'Completa: "la patata"', correctAnswer: 'aardappel', hint: 'de ___' },
        { id: 'm3l5e-12', type: 'word_scramble', prompt: '¿Cómo se dice "poco"?', correctAnswer: 'weinig', hint: 'poco' },
        { id: 'm3l5e-13', type: 'fill_blank', prompt: '___ een koffie, alstublieft. (otro / uno más)', correctAnswer: 'Nog', hint: 'la palabrita de \'todavía / uno más\'' },
        { id: 'm3l5e-14', type: 'emoji_choice', prompt: '¿Cuál es "de appel"?', options: ['🍏', '🍇', '🥔', '🍗'], correctAnswer: '🍏', explanation: '"de appel" = la manzana 🍏.' },
        { id: 'm3l5e-15', type: 'emoji_choice', prompt: '¿Cuál es "de kip"?', options: ['🥔', '🍗', '🍇', '🧈'], correctAnswer: '🍗', explanation: '"de kip" = el pollo 🍗.' },
        { id: 'm3l5e-16', type: 'fill_blank', prompt: 'Ik ___ niet van vis. (gustar: houden van — ik, negación)', correctAnswer: 'hou', hint: 'houden van → con ik la raíz se acorta' },
        { id: 'm3l5e-17', type: 'true_false', prompt: '"veel" significa "poco".', correctAnswer: 'falso', explanation: '"veel" = mucho. "weinig" = poco.' },
        { id: 'm3l5e-18', type: 'order_sentence', prompt: 'Ordena: "Quiero medio kilo de uvas." (graag)', options: ['Ik', 'wil', 'graag', '500', 'gram', 'druiven.'], correctAnswer: 'Ik wil graag 500 gram druiven.' },
        { id: 'm3l5e-19', type: 'multiple_choice', prompt: '¿Cuál es correcta con un producto NO contable?', options: ['twee water', 'een beetje water', 'water twee', 'drie water'], correctAnswer: 'een beetje water', explanation: '"water" no es contable → een beetje water.' },
        { id: 'm3l5e-20', type: 'match_pairs', prompt: 'Une cada alimento con su traducción', correctAnswer: '', pairs: [
          { left: 'de kip', right: 'el pollo' },
          { left: 'de appel', right: 'la manzana' },
          { left: 'de aardappel', right: 'la patata' },
          { left: 'de druiven', right: 'las uvas' },
        ] },
        { id: 'm3l5e-21', type: 'word_scramble', prompt: '¿Cómo se dice "mucho"?', correctAnswer: 'veel', hint: 'mucho' },
        { id: 'm3l5e-22', type: 'listen_and_choose', prompt: 'Escucha y elige la traducción: "Ik wil graag een kilo appels."', options: ['Quiero un kilo de manzanas', 'Quiero dos cafés', 'Me gusta la patata frita', 'Otro bocadillo'], correctAnswer: 'Quiero un kilo de manzanas', explanation: '"kilo appels" = kilo de manzanas; "graag" = por favor.' },
        { id: 'm3l5e-23', type: 'listen_and_choose', prompt: 'Escucha y elige la traducción: "Hoeveel suiker wil je?"', options: ['¿Cuánto azúcar quieres?', '¿Quieres otro café?', '¿Te gusta el pescado?', '¿Cuántas manzanas?'], correctAnswer: '¿Cuánto azúcar quieres?', explanation: '"hoeveel" = cuánto.' },
        { id: 'm3l5e-24', type: 'pair_memory', prompt: 'Empareja la palabra de cantidad con su significado', correctAnswer: '', pairs: [
          { left: 'veel', right: 'mucho' },
          { left: 'weinig', right: 'poco' },
          { left: 'een beetje', right: 'un poco' },
          { left: 'nog een', right: 'otro más' },
        ] },
        { id: 'm3l5e-r1', type: 'match_pairs', prompt: 'Une cada alimento con su traducción', correctAnswer: '', pairs: [ { left: 'de kip', right: 'el pollo' }, { left: 'de appel', right: 'la manzana' }, { left: 'de aardappel', right: 'la patata' }, { left: 'de druiven', right: 'las uvas' } ] },
        { id: 'm3l5e-r2', type: 'word_scramble', prompt: '¿Cómo se dice "el kilo"?', correctAnswer: 'kilo', hint: 'cantidad' },
        { id: 'm3l5e-r3', type: 'emoji_choice', prompt: '¿Cuál es "de druiven"?', options: ['🍇', '🍏', '🥔', '🍗'], correctAnswer: '🍇', explanation: '"de druiven" = las uvas 🍇.' },
        { id: 'm3l5e-r4', type: 'odd_one_out', prompt: '¿Cuál NO es una palabra de cantidad?', options: ['nog een', 'veel', 'een beetje', 'koffie'], correctAnswer: 'koffie', explanation: '"koffie" (café) no es cantidad.' },
        { id: 'm3l5e-r5', type: 'odd_one_out', prompt: '¿Cuál NO es una palabra de cantidad?', options: ['kilo', 'gram', 'weinig', 'vis'], correctAnswer: 'vis', explanation: '"vis" (pescado) no es cantidad.' },
        { id: 'm3l5e-r6', type: 'letter_dash', prompt: 'Completa: "el pollo"', correctAnswer: 'kip', hint: 'de ___' },
        { id: 'm3l5e-r7', type: 'letter_dash', prompt: 'Completa: "la manzana"', correctAnswer: 'appel', hint: 'de ___' },
        // Comprensión del diálogo del mercado (Op de markt) — preguntas fáciles (nivel 0)
        { id: 'm3l5e-c1', type: 'multiple_choice', prompt: 'En el mercado, ¿qué compra Sara primero?', options: ['Un kilo de manzanas', 'Dos kilos de tomates', 'Un poco de pescado', 'Pan y queso'], correctAnswer: 'Un kilo de manzanas', explanation: '"Ik wil graag een kilo appels" = un kilo de manzanas.' },
        { id: 'm3l5e-c2', type: 'multiple_choice', prompt: '¿Cuántos kilos de patatas pide Sara?', options: ['Dos kilos', 'Un kilo', 'Medio kilo', 'Tres kilos'], correctAnswer: 'Dos kilos', explanation: '"twee kilo aardappels" = dos kilos de patatas.' },
        { id: 'm3l5e-c3', type: 'multiple_choice', prompt: '¿Para cuántas personas cocina Sara?', options: ['Dos personas', 'Una persona', 'Tres personas', 'Cuatro personas'], correctAnswer: 'Dos personas', explanation: '"Ik kook voor twee personen" = cocino para dos personas.' },
        { id: 'm3l5e-c4', type: 'multiple_choice', prompt: 'Según el vendedor, ¿cómo están hoy las uvas?', options: ['Muy dulces', 'Muy caras', 'Muy verdes', 'Muy pequeñas'], correctAnswer: 'Muy dulces', explanation: '"Ze zijn vandaag heel zoet" = hoy están muy dulces.' },
        { id: 'm3l5e-c5', type: 'true_false', prompt: 'Sara compra tomates.', correctAnswer: 'falso', explanation: 'Sara dice "Nee, dank u" (no, gracias) a los tomates.' },
        { id: 'm3l5e-c6', type: 'true_false', prompt: 'Sara pide quinientos gramos de uvas.', correctAnswer: 'verdadero', explanation: '"Doe maar vijfhonderd gram" = ponme quinientos gramos.' },
      ],
    },
    { type: 'review' },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE 3 — BOODSCHAPPEN — Les 6 (Boodschappen doen + gran repaso)
───────────────────────────────────────────────────────────────────────────── */

const m3_les6: Lesson = {
  id: 'm3-les-6-repaso',
  moduleId: 'boodschappen',
  title: 'Les 6 — Boodschappen doen | El gran repaso',
  subtitle: 'Pronunciación OO/OE y repaso de todo el módulo',
  order: 6,
  learningObjective: 'Distinguir los sonidos OO y OE y repasar todo lo aprendido en el módulo (verbos, preguntas, conjunciones y cantidades)',
  estimatedMinutes: 25,
  isExtra: false,
  blocks: [
    {
      type: 'summary',
      title: 'Boodschappen doen & el gran repaso',
      intro: 'En esta última lección practicas la diferencia entre los sonidos OO y OE, y repasas todo lo aprendido en el módulo: pedir (willen/nemen/mogen), preguntar, unir frases y cantidades.',
      objectives: [
        'Oír y pronunciar la diferencia entre OO y OE',
        'Reconocer palabras con estos sonidos',
        'Repasar la lengua clave de las lecciones 1–5',
      ],
      sections: [
        {
          heading: '🅾️ El sonido OO (vocal larga)',
          body: 'Boca abierta, sonido largo: **brood, koken, boter, boodschappen**. ¡No es "brod"!',
          items: [
            { nl: 'brood', es: 'pan' }, { nl: 'koken', es: 'cocinar' }, { nl: 'de boter', es: 'la mantequilla' },
          ],
        },
        {
          heading: '🆗 El sonido OE (labios redondos)',
          body: 'Como la "u" española pero más larga: **soep, koek, bloemen, schoenen**.',
          items: [
            { nl: 'soep', es: 'sopa' }, { nl: 'de koek', es: 'el bizcocho' }, { nl: 'boodschappen doen', es: 'hacer la compra' },
          ],
        },
        {
          heading: '🔁 Repaso del módulo',
          items: [
            { nl: 'Ik wil graag… / Ik neem… / Mag ik…?', es: 'pedir (les 2)' },
            { nl: 'Drink je koffie? / Wat drink je?', es: 'preguntar (les 3)' },
            { nl: 'en · maar · of · want', es: 'unir frases (les 4)' },
            { nl: 'twee koffie · veel water · graag · houden van', es: 'cantidades (les 5)' },
          ],
        },
      ],
      tip: 'Repite en voz alta: "Wij doen boodschappen in de supermarkt. Ik koop brood en soep. Ik kook met boter."',
    },
    {
      type: 'vocabulary',
      items: [
        { id: 'm3l6v-koken',    dutch: 'koken',            spanish: 'cocinar',          article: null,  emoji: '🍳', color: '#0b7a4d', exampleNl: 'Ik kook met boter.',           exampleEs: 'Cocino con mantequilla.',        category: 'koken', difficulty: 'A1' },
        { id: 'm3l6v-boter',    dutch: 'de boter',         spanish: 'la mantequilla',   article: 'de',  emoji: '🧈', color: '#1a7a40', exampleNl: 'Brood met boter.',             exampleEs: 'Pan con mantequilla.',           category: 'eten', difficulty: 'A1' },
        { id: 'm3l6v-koek',     dutch: 'de koek',          spanish: 'el bizcocho',      article: 'de',  emoji: '🍰', color: '#0d6e33', exampleNl: 'Een stuk koek, graag.',        exampleEs: 'Un trozo de bizcocho, por favor.', category: 'eten', difficulty: 'A1' },
        { id: 'm3l6v-boodsch',  dutch: 'boodschappen doen',spanish: 'hacer la compra',  article: null,  emoji: '🛒', color: '#2e7d52', exampleNl: 'Wij doen boodschappen.',       exampleEs: 'Hacemos la compra.',             category: 'supermarkt', difficulty: 'A1' },
        { id: 'm3l6v-winkel',   dutch: 'de winkel',        spanish: 'la tienda',        article: 'de',  emoji: '🏬', color: '#0b7a4d', exampleNl: 'De winkel is open.',           exampleEs: 'La tienda está abierta.',        category: 'supermarkt', difficulty: 'A1' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm3l6p-1', dutch: 'Wij doen boodschappen.',                 spanish: 'Hacemos la compra.',                context: 'Boodschappen' },
        { id: 'm3l6p-2', dutch: 'Ik kook met boter.',                     spanish: 'Cocino con mantequilla.',           context: 'Koken (OO)' },
        { id: 'm3l6p-3', dutch: 'Een kom soep, alstublieft.',             spanish: 'Un bol de sopa, por favor.',        context: 'OE-klank' },
        { id: 'm3l6p-4', dutch: 'Brood en boter, graag.',                 spanish: 'Pan y mantequilla, por favor.',     context: 'OO-klank' },
        { id: 'm3l6p-5', dutch: 'De winkel is open.',                     spanish: 'La tienda está abierta.',           context: 'Supermarkt' },
        { id: 'm3l6p-6', dutch: 'Mag ik pinnen?',                         spanish: '¿Puedo pagar con tarjeta?',         context: 'Betalen (repaso)' },
      ],
    },
    {
      type: 'lezen',
      textNl: `Boodschappen doen in Nederland

In Nederland doen mensen meestal één of twee keer per week boodschappen. Ze maken eerst een lijstje: brood, boter, melk, soep en groente.

Veel mensen gaan naar de supermarkt, want daar vind je bijna alles. Maar voor verse groente, fruit of bloemen gaan ze graag naar de markt.

Let op de uitspraak! Woorden met «oo» klinken lang en open: brood, koken, boter. Woorden met «oe» klinken rond, een beetje als de Spaanse u: soep, koek, bloemen.

Bij de kassa betaal je bijna altijd met de pinpas. «Mag ik pinnen?» — «Ja, natuurlijk.»

En jij? Doe jij graag boodschappen? Wat staat er op jouw lijstje?`,
      textEs: `Hacer la compra en los Países Bajos

En los Países Bajos la gente hace la compra normalmente una o dos veces por semana. Primero hacen una lista: pan, mantequilla, leche, sopa y verdura.

Mucha gente va al supermercado, porque allí encuentras casi todo. Pero para verdura fresca, fruta o flores van con gusto al mercado.

¡Atención a la pronunciación! Las palabras con «oo» suenan largas y abiertas: brood, koken, boter. Las palabras con «oe» suenan redondas, un poco como la u española: soep, koek, bloemen.

En la caja pagas casi siempre con la tarjeta. «Mag ik pinnen?» (¿Puedo pagar con tarjeta?) — «Ja, natuurlijk» (Sí, claro).

¿Y tú? ¿Te gusta hacer la compra? ¿Qué hay en tu lista?`,
      exercises: [
        { id: 'm3l6lz-1', type: 'multiple_choice', prompt: '¿Cada cuánto hace la compra la gente normalmente?', options: ['Una o dos veces por semana', 'Cada hora', 'Una vez al año', 'Nunca'], correctAnswer: 'Una o dos veces por semana', explanation: '"meestal één of twee keer per week".' },
        { id: 'm3l6lz-2', type: 'multiple_choice', prompt: '¿Adónde van para verdura fresca, fruta o flores?', options: ['Al mercado', 'A la farmacia', 'Al banco', 'Al café'], correctAnswer: 'Al mercado', explanation: '"voor verse groente, fruit of bloemen gaan ze graag naar de markt".' },
        { id: 'm3l6lz-3', type: 'multiple_choice', prompt: '¿Cuál de estas palabras tiene el sonido OE (como la "u")?', options: ['soep', 'brood', 'koken', 'boter'], correctAnswer: 'soep', explanation: '"soep" tiene «oe»; brood/koken/boter tienen «oo».' },
        { id: 'm3l6lz-4', type: 'multiple_choice', prompt: '¿Cuál tiene el sonido OO (largo y abierto)?', options: ['brood', 'soep', 'koek', 'bloemen'], correctAnswer: 'brood', explanation: '"brood" tiene «oo»; las demás «oe».' },
        { id: 'm3l6lz-5', type: 'fill_blank', prompt: 'Eerst maak je een ___ : brood, boter, melk… (lista)', correctAnswer: 'lijstje', hint: 'el diminutivo de lijst', explanation: '"Ze maken eerst een lijstje".' },
        { id: 'm3l6lz-6', type: 'true_false', prompt: 'En la caja casi siempre se paga con tarjeta.', correctAnswer: 'verdadero', explanation: '"Bij de kassa betaal je bijna altijd met de pinpas".' },
        { id: 'm3l6lz-7', type: 'multiple_choice', prompt: '¿Por qué va mucha gente al supermercado?', options: ['Porque allí encuentras casi todo', 'Porque es gratis', 'Porque está lejos', 'Porque no hay mercado'], correctAnswer: 'Porque allí encuentras casi todo', explanation: '"want daar vind je bijna alles".' },
        { id: 'm3l6lz-8', type: 'order_sentence', prompt: 'Ordena: «Hacemos la compra.»', options: ['Wij', 'doen', 'boodschappen.'], correctAnswer: 'Wij doen boodschappen.' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'm3d6',
        title: 'Dialoog – Het boodschappenlijstje',
        context: 'Tom en Sara maken samen een boodschappenlijstje. Ze herhalen alles uit het hele module.',
        lines: [
          { id: 'm3d6-1',  speaker: 'Tom',  dutch: 'Sara, we hebben bijna niks meer. Zullen we boodschappen doen?', spanish: 'Sara, ya casi no tenemos nada. ¿Hacemos la compra?' },
          { id: 'm3d6-2',  speaker: 'Sara', dutch: 'Ja! Wat hebben we nodig?',                       spanish: '¡Sí! ¿Qué necesitamos?' },
          { id: 'm3d6-3',  speaker: 'Tom',  dutch: 'Brood en boter, want het ontbijt is op. En melk.', spanish: 'Pan y mantequilla, porque se acabó el desayuno. Y leche.' },
          { id: 'm3d6-4',  speaker: 'Sara', dutch: 'Oké. Wil je soep of maak je liever pasta?',       spanish: 'Vale. ¿Quieres sopa o prefieres hacer pasta?' },
          { id: 'm3d6-5',  speaker: 'Tom',  dutch: 'Pasta! Dan kopen we tomaten en een beetje kaas.', spanish: '¡Pasta! Entonces compramos tomates y un poco de queso.' },
          { id: 'm3d6-6',  speaker: 'Sara', dutch: 'Hou jij van groente? Dan neem ik ook spinazie.',  spanish: '¿Te gusta la verdura? Entonces cojo también espinacas.' },
          { id: 'm3d6-7',  speaker: 'Tom',  dutch: 'Lekker. Hoeveel brood kopen we?',                 spanish: 'Rico. ¿Cuánto pan compramos?' },
          { id: 'm3d6-8',  speaker: 'Sara', dutch: 'Twee broden, want we eten veel boterhammen.',     spanish: 'Dos panes, porque comemos muchas rebanadas.' },
          { id: 'm3d6-9',  speaker: 'Tom',  dutch: 'Goed. Gaan we naar de supermarkt of naar de markt?', spanish: 'Bien. ¿Vamos al supermercado o al mercado?' },
          { id: 'm3d6-10', speaker: 'Sara', dutch: 'Naar de markt voor het fruit, en daarna de supermarkt.', spanish: 'Al mercado por la fruta, y después al supermercado.' },
          { id: 'm3d6-11', speaker: 'Tom',  dutch: 'Top. Betalen we met pin?',                        spanish: 'Genial. ¿Pagamos con tarjeta?' },
          { id: 'm3d6-12', speaker: 'Sara', dutch: 'Ja, met pin. Kom, we gaan!',                      spanish: 'Sí, con tarjeta. ¡Venga, vamos!' },
        ],
      },
    },
    {
      type: 'practice',
      exercises: [
        // OO / OE pronunciación
        { id: 'm3l6e-1',  type: 'odd_one_out', prompt: '¿Cuál tiene el sonido OE (como "u")?', options: ['brood', 'soep', 'koken', 'boter'], correctAnswer: 'soep', explanation: '"soep" suena OE; las otras tienen OO.' },
        { id: 'm3l6e-2',  type: 'odd_one_out', prompt: '¿Cuál tiene el sonido OO (vocal larga)?', options: ['soep', 'koek', 'brood', 'bloemen'], correctAnswer: 'brood', explanation: '"brood" suena OO; las otras OE.' },
        { id: 'm3l6e-3',  type: 'letter_dash', prompt: 'Completa: "cocinar"', correctAnswer: 'koken', hint: 'sonido OO' },
        { id: 'm3l6e-4',  type: 'word_scramble', prompt: '¿Cómo se dice "hacer la compra"? (2 palabras)', correctAnswer: 'boodschappen doen', hint: 'OO + OE' },
        // Repaso les 2 (verbos)
        { id: 'm3l6e-5',  type: 'fill_blank', prompt: 'Repaso: Ik ___ graag koffie. (willen — ik)', correctAnswer: 'wil', hint: 'willen → con ik va la raíz' },
        { id: 'm3l6e-6',  type: 'multiple_choice', prompt: 'Repaso: ¿forma educada para pedir permiso?', options: ['Ik wil de rekening!', 'Mag ik de rekening?', 'De rekening!'], correctAnswer: 'Mag ik de rekening?', explanation: '"Mag ik…?" es lo más educado.' },
        // Repaso les 3 (preguntas)
        { id: 'm3l6e-7',  type: 'multiple_choice', prompt: 'Repaso: corrige "Jij drinkt koffie?"', options: ['Drink jij koffie?', 'Drinkt jij koffie?', 'Koffie jij drinkt?'], correctAnswer: 'Drink jij koffie?', explanation: 'Verbo primero y sin -t con "jij".' },
        // Repaso les 4 (conjunciones)
        { id: 'm3l6e-8',  type: 'fill_blank', prompt: 'Repaso: Ik koop brood ___ ik heb honger. (porque)', correctAnswer: 'want', hint: 'razón' },
        { id: 'm3l6e-9',  type: 'multiple_choice', prompt: 'Repaso: "¿Quieres té ___ café?"', options: ['en', 'maar', 'of', 'want'], correctAnswer: 'of', explanation: 'elección → of.' },
        // Repaso les 5 (cantidades + houden van)
        { id: 'm3l6e-10', type: 'true_false', prompt: 'Repaso: "twee koffie’s" es la forma correcta del plural.', correctAnswer: 'falso', explanation: '"koffie" no es contable como plural → "twee koffie".' },
        { id: 'm3l6e-11', type: 'multiple_choice', prompt: 'Repaso: "No me gusta el pescado"', options: ['Ik hou niet van vis.', 'Ik hou geen vis.', 'Ik niet van vis hou.'], correctAnswer: 'Ik hou niet van vis.' },
        // Frase grande con todo
        { id: 'm3l6e-12', type: 'order_sentence', prompt: 'Ordena: "Quiero un café y dos bocadillos porque tengo hambre."', options: ['Ik', 'wil', 'graag', 'een', 'koffie', 'en', 'twee', 'broodjes', 'want', 'ik', 'heb', 'honger.'], correctAnswer: 'Ik wil graag een koffie en twee broodjes want ik heb honger.' },
        { id: 'm3l6e-13', type: 'match_pairs', prompt: 'Repaso: une cada palabra con su traducción', correctAnswer: '', pairs: [
          { left: 'koken', right: 'cocinar' },
          { left: 'de boter', right: 'la mantequilla' },
          { left: 'boodschappen doen', right: 'hacer la compra' },
          { left: 'de winkel', right: 'la tienda' },
        ] },
        { id: 'm3l6e-14', type: 'emoji_choice', prompt: '¿Cuál representa "boodschappen doen"?', options: ['🛒', '🍳', '🧈', '🏬'], correctAnswer: '🛒', explanation: '"boodschappen doen" = hacer la compra 🛒.' },
        { id: 'm3l6e-15', type: 'letter_dash', prompt: 'Completa: "la mantequilla"', correctAnswer: 'boter', hint: 'de ___ (sonido OO)' },
        { id: 'm3l6e-16', type: 'word_scramble', prompt: '¿Cómo se dice "cocinar"?', correctAnswer: 'koken', hint: 'sonido OO' },
        { id: 'm3l6e-17', type: 'odd_one_out', prompt: '¿Cuál tiene el sonido OE?', options: ['boter', 'koken', 'koek', 'brood'], correctAnswer: 'koek', explanation: '"koek" suena OE; las demás OO.' },
        { id: 'm3l6e-18', type: 'fill_blank', prompt: 'Repaso: Hoeveel koffie ___ je? (querer — jij)', correctAnswer: 'wil', hint: 'willen: en pregunta con jij, sin -t' },
        { id: 'm3l6e-19', type: 'true_false', prompt: 'Repaso: "boodschappen doen" significa "cocinar".', correctAnswer: 'falso', explanation: '"boodschappen doen" = hacer la compra. "koken" = cocinar.' },
        { id: 'm3l6e-20', type: 'order_sentence', prompt: 'Repaso: "Hacemos la compra en el supermercado."', options: ['Wij', 'doen', 'boodschappen', 'in', 'de', 'supermarkt.'], correctAnswer: 'Wij doen boodschappen in de supermarkt.' },
        { id: 'm3l6e-21', type: 'listen_and_choose', prompt: 'Escucha y elige la palabra con sonido OE: ', options: ['soep', 'brood', 'koken', 'boter'], correctAnswer: 'soep', explanation: '"soep" suena OE (como la u española).' },
        { id: 'm3l6e-22', type: 'listen_and_choose', prompt: 'Escucha y elige la traducción: "Wij doen boodschappen."', options: ['Hacemos la compra', 'Cocinamos sopa', 'Pago con tarjeta', 'Quiero pan'], correctAnswer: 'Hacemos la compra', explanation: '"boodschappen doen" = hacer la compra.' },
        { id: 'm3l6e-23', type: 'pair_memory', prompt: 'Empareja la palabra con su sonido (OO / OE)', correctAnswer: '', pairs: [
          { left: 'brood', right: 'OO' },
          { left: 'soep', right: 'OE' },
          { left: 'koken', right: 'OO' },
          { left: 'koek', right: 'OE' },
        ] },
        { id: 'm3l6e-r1', type: 'match_pairs', prompt: 'Une cada palabra con su traducción', correctAnswer: '', pairs: [ { left: 'brood', right: 'pan' }, { left: 'soep', right: 'sopa' }, { left: 'de boter', right: 'la mantequilla' }, { left: 'de winkel', right: 'la tienda' } ] },
        { id: 'm3l6e-r2', type: 'match_pairs', prompt: 'Une cada palabra con su sonido (OO / OE)', correctAnswer: '', pairs: [ { left: 'brood', right: 'OO' }, { left: 'koken', right: 'OO' }, { left: 'soep', right: 'OE' }, { left: 'bloemen', right: 'OE' } ] },
        { id: 'm3l6e-r3', type: 'word_scramble', prompt: '¿Cómo se dice "la tienda"?', correctAnswer: 'winkel', hint: 'de ___' },
        { id: 'm3l6e-r4', type: 'emoji_choice', prompt: '¿Cuál es "de boter"?', options: ['🧈', '🍞', '🍰', '🛒'], correctAnswer: '🧈', explanation: '"de boter" = la mantequilla 🧈.' },
        { id: 'm3l6e-r5', type: 'emoji_choice', prompt: '¿Cuál representa "koken"?', options: ['🍳', '🛒', '🧈', '🏬'], correctAnswer: '🍳', explanation: '"koken" = cocinar 🍳.' },
        { id: 'm3l6e-r6', type: 'letter_dash', prompt: 'Completa: "la sopa"', correctAnswer: 'soep', hint: 'de ___ (sonido OE)' },
      ],
    },
    { type: 'review' },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE 4 — HET WERK
───────────────────────────────────────────────────────────────────────────── */

const m4_les1: Lesson = {
  id: 'm4-les-1-werk-beroep',
  moduleId: 'het-werk',
  title: 'Les 1 — Woordenschat | Werk & Beroep',
  subtitle: 'Vocabulario de trabajo y profesiones',
  order: 1,
  learningObjective: 'Hablar de tu profesión, sector y contrato de trabajo',
  estimatedMinutes: 25,
  blocks: [
    {
      type: 'summary',
      title: 'Werk & Beroep',
      intro: 'En esta lección aprenderás a hablar de tu trabajo: qué profesión tienes, en qué sector trabajas, con quién y para quién, y el vocabulario esencial de entrevistas y contratos en Países Bajos.',
      objectives: [
        'Identificar profesiones y sectores laborales',
        'Decir dónde trabajas, con quién y para quién',
        'Usar vocabulario clave de entrevistas, contratos y empleo',
      ],
      sections: [
        {
          heading: '🏢 Sectores laborales',
          body: 'Para decir en qué sector trabajas usamos **"Ik werk in de/het ..."** o **"Ik werk bij ..."**.',
          items: [
            { nl: 'de zorg / de gezondheidszorg', es: 'sanidad' },
            { nl: 'de horeca', es: 'hostelería' },
            { nl: 'de schoonmaak', es: 'limpieza' },
            { nl: 'de retail sector', es: 'comercio minorista' },
            { nl: 'de landbouw / de vee-industrie', es: 'agricultura / ganadería' },
            { nl: 'het onderwijs', es: 'educación' },
            { nl: 'ICT', es: 'tecnologías de la información' },
            { nl: 'de industriële sector', es: 'sector industrial' },
          ],
        },
        {
          heading: '👥 Con quién trabajas',
          body: 'Usamos **"Ik werk met ..."** para hablar de las personas con las que trabajas.',
          items: [
            { nl: "met mijn collega's", es: 'con mis compañeros' },
            { nl: 'met mijn baas / leidinggevende', es: 'con mi jefe/a' },
            { nl: 'in een team', es: 'en un equipo' },
          ],
        },
        {
          heading: '🏛️ Para quién trabajas',
          body: 'Usamos **"Ik werk voor ..."** para indicar el empleador.',
          items: [
            { nl: 'Ik werk voor een bedrijf', es: 'Trabajo para una empresa' },
            { nl: 'Ik werk voor de Gemeente', es: 'Trabajo para el Ayuntamiento' },
            { nl: 'Ik werk voor mezelf', es: 'Trabajo por cuenta propia' },
          ],
        },
        {
          heading: '📝 Vocabulario clave',
          body: 'Palabras que aparecerán en entrevistas, ofertas y contratos.',
          items: [
            { nl: 'de baan', es: 'el empleo, puesto de trabajo' },
            { nl: 'de vacature', es: 'la vacante' },
            { nl: 'solliciteren', es: 'postularse, candidatearse' },
            { nl: 'het sollicitatiegesprek', es: 'la entrevista de trabajo' },
            { nl: 'de werkervaring', es: 'la experiencia laboral' },
            { nl: "zzp'er zijn", es: 'ser trabajador autónomo' },
            { nl: 'in dienst zijn', es: 'estar en nómina' },
          ],
        },
        {
          heading: '⏱️ Tipos de jornada y contrato',
          items: [
            { nl: 'parttime / fulltime werken', es: 'tiempo parcial / completo' },
            { nl: 'werken op oproepbasis', es: 'trabajo flexible sin horario fijo' },
            { nl: 'het bandbreedtecontract', es: 'contrato con horas máx/mín por trimestre' },
            { nl: 'een vast contract', es: 'contrato fijo / indefinido' },
            { nl: 'een tijdelijk contract', es: 'contrato temporal' },
          ],
        },
      ],
      tip: 'En NL, **het uitzendbureau** (empresa de trabajo temporal) es la puerta de entrada al mercado laboral para muchos. Suelen buscarte empleo rápido con contrato temporal a través de ellos.',
    },
    {
      type: 'vocabulary',
      items: [
        { id: 'm4l1v-kapper', dutch: 'de kapper', spanish: 'peluquero', article: 'de', emoji: '💇', color: '#1D0084', exampleNl: 'Mijn broer is kapper.', exampleEs: 'Mi hermano es peluquero.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-kapster', dutch: 'de kapster', spanish: 'peluquera', article: 'de', emoji: '💇‍♀️', color: '#025dc7', exampleNl: 'Zij is kapster in het centrum.', exampleEs: 'Ella es peluquera en el centro.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-verpleger', dutch: 'de verpleger', spanish: 'enfermero', article: 'de', emoji: '🩺', color: '#4da3ff', exampleNl: 'Hij werkt als verpleger.', exampleEs: 'Él trabaja de enfermero.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-verpleegster', dutch: 'de verpleegster', spanish: 'enfermera', article: 'de', emoji: '👩‍⚕️', color: '#1D0084', exampleNl: 'De verpleegster helpt de patiënt.', exampleEs: 'La enfermera ayuda al paciente.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-medewerker', dutch: 'de medewerker', spanish: 'empleado', article: 'de', emoji: '🧑‍💼', color: '#025dc7', exampleNl: 'Hij is medewerker bij een bedrijf.', exampleEs: 'Es empleado en una empresa.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-verkoopmedewerker', dutch: 'de verkoopmedewerker', spanish: 'dependiente de ventas', article: 'de', emoji: '🛍️', color: '#4da3ff', exampleNl: 'Ik zoek werk als verkoopmedewerker.', exampleEs: 'Busco trabajo de dependiente.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-kassamedewerker', dutch: 'de kassamedewerker', spanish: 'cajero', article: 'de', emoji: '🧾', color: '#1D0084', exampleNl: 'De kassamedewerker scant de producten.', exampleEs: 'El cajero escanea los productos.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-ober', dutch: 'de ober', spanish: 'camarero', article: 'de', emoji: '🧑‍🍳', color: '#025dc7', exampleNl: 'De ober brengt het eten.', exampleEs: 'El camarero trae la comida.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-serveerster', dutch: 'de serveerster', spanish: 'camarera', article: 'de', emoji: '🍽️', color: '#4da3ff', exampleNl: 'De serveerster werkt in de horeca.', exampleEs: 'La camarera trabaja en hostelería.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-advocaat', dutch: 'de advocaat', spanish: 'abogado', article: 'de', emoji: '⚖️', color: '#1D0084', exampleNl: 'Mijn buurman is advocaat.', exampleEs: 'Mi vecino es abogado.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-receptionist', dutch: 'de receptionist', spanish: 'recepcionista', article: 'de', emoji: '🛎️', color: '#025dc7', exampleNl: 'De receptionist werkt bij de ingang.', exampleEs: 'El recepcionista trabaja en la entrada.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-politieagent', dutch: 'de politieagent', spanish: 'policía', article: 'de', emoji: '👮', color: '#4da3ff', exampleNl: 'De politieagent helpt op straat.', exampleEs: 'El policía ayuda en la calle.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-boer', dutch: 'de boer', spanish: 'granjero', article: 'de', emoji: '🚜', color: '#1D0084', exampleNl: 'De boer werkt in de landbouw.', exampleEs: 'El granjero trabaja en la agricultura.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-leraar', dutch: 'de leraar', spanish: 'profesor', article: 'de', emoji: '👨‍🏫', color: '#025dc7', exampleNl: 'De leraar werkt op een school.', exampleEs: 'El profesor trabaja en una escuela.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-lerares', dutch: 'de lerares', spanish: 'profesora', article: 'de', emoji: '👩‍🏫', color: '#4da3ff', exampleNl: 'Zij is lerares Nederlands.', exampleEs: 'Ella es profesora de neerlandés.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-chauffeur', dutch: 'de chauffeur', spanish: 'chófer, conductor', article: 'de', emoji: '🚌', color: '#1D0084', exampleNl: 'De chauffeur rijdt de bus.', exampleEs: 'El conductor conduce el autobús.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-postbode', dutch: 'de postbode', spanish: 'cartero', article: 'de', emoji: '📮', color: '#025dc7', exampleNl: 'De postbode komt elke ochtend.', exampleEs: 'El cartero viene cada mañana.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-metselaar', dutch: 'de metselaar', spanish: 'albañil', article: 'de', emoji: '🧱', color: '#4da3ff', exampleNl: 'De metselaar bouwt een muur.', exampleEs: 'El albañil construye una pared.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-automonteur', dutch: 'de automonteur', spanish: 'mecánico de coches', article: 'de', emoji: '🔧', color: '#1D0084', exampleNl: 'De automonteur repareert mijn auto.', exampleEs: 'El mecánico repara mi coche.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-electricien', dutch: 'de electricien', spanish: 'electricista', article: 'de', emoji: '💡', color: '#025dc7', exampleNl: 'De electricien komt morgen.', exampleEs: 'El electricista viene mañana.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-loodgieter', dutch: 'de loodgieter', spanish: 'fontanero', article: 'de', emoji: '🚰', color: '#4da3ff', exampleNl: 'De loodgieter maakt de kraan.', exampleEs: 'El fontanero arregla el grifo.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-bakker', dutch: 'de bakker', spanish: 'panadero', article: 'de', emoji: '🥖', color: '#1D0084', exampleNl: 'De bakker begint heel vroeg.', exampleEs: 'El panadero empieza muy temprano.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-winkelier', dutch: 'de winkelier', spanish: 'comerciante, tendero', article: 'de', emoji: '🏪', color: '#025dc7', exampleNl: 'De winkelier opent om negen uur.', exampleEs: 'El tendero abre a las nueve.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-verpleegkundige', dutch: 'de verpleegkundige', spanish: 'enfermero titulado', article: 'de', emoji: '🏥', color: '#4da3ff', exampleNl: 'Zij is verpleegkundige in het ziekenhuis.', exampleEs: 'Es enfermera titulada en el hospital.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-huisarts', dutch: 'de huisarts', spanish: 'médico de cabecera', article: 'de', emoji: '👨‍⚕️', color: '#1D0084', exampleNl: 'Ik ga naar de huisarts.', exampleEs: 'Voy al médico de cabecera.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-arts', dutch: 'de arts', spanish: 'médico', article: 'de', emoji: '🩻', color: '#025dc7', exampleNl: 'De arts werkt in een ziekenhuis.', exampleEs: 'El médico trabaja en un hospital.', category: 'beroepen', difficulty: 'A1' },
        { id: 'm4l1v-rechter', dutch: 'de rechter', spanish: 'juez', article: 'de', emoji: '👨‍⚖️', color: '#4da3ff', exampleNl: 'De rechter werkt bij de rechtbank.', exampleEs: 'El juez trabaja en el juzgado.', category: 'beroepen', difficulty: 'A1' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm4l1f-1', dutch: 'Waar werk jij?', spanish: '¿Dónde trabajas?' },
        { id: 'm4l1f-2', dutch: 'Ik werk in een ziekenhuis.', spanish: 'Trabajo en un hospital.' },
        { id: 'm4l1f-3', dutch: 'Ik werk bij een bedrijf.', spanish: 'Trabajo en una empresa.' },
        { id: 'm4l1f-4', dutch: 'Ik werk op een school.', spanish: 'Trabajo en una escuela.' },
        { id: 'm4l1f-5', dutch: 'Ik werk op de tweede etage.', spanish: 'Trabajo en la segunda planta.' },
        { id: 'm4l1f-6', dutch: 'Ik werk thuis.', spanish: 'Trabajo en casa.' },
        { id: 'm4l1f-7', dutch: 'In welke sector werk je?', spanish: '¿En qué sector trabajas?' },
        { id: 'm4l1f-8', dutch: 'Ik werk in de zorg.', spanish: 'Trabajo en el sector de los cuidados.' },
        { id: 'm4l1f-9', dutch: 'Ik werk in de horeca.', spanish: 'Trabajo en hostelería.' },
        { id: 'm4l1f-10', dutch: 'Ik werk in het onderwijs.', spanish: 'Trabajo en educación.' },
        { id: 'm4l1f-11', dutch: 'Met wie werk je?', spanish: '¿Con quién trabajas?' },
        { id: 'm4l1f-12', dutch: "Ik werk met mijn collega's.", spanish: 'Trabajo con mis compañeros.' },
        { id: 'm4l1f-13', dutch: 'Voor wie werk jij?', spanish: '¿Para quién trabajas?' },
        { id: 'm4l1f-14', dutch: 'Ik werk voor mezelf.', spanish: 'Trabajo por mi cuenta.' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        { id: 'm4l1e-1',  type: 'multiple_choice', prompt: '¿Cuál es el femenino de "de kapper"?', options: ['de kapster', 'de kapperin', 'de kappes', 'de kappere'], correctAnswer: 'de kapster', explanation: 'Muchas profesiones forman el femenino con -ster: kapper → kapster.' },
        { id: 'm4l1e-2',  type: 'multiple_choice', prompt: '¿Y el femenino de "de verpleger"?', options: ['de verpleegster', 'de verplegerin', 'de verplegeres', 'de verpleger'], correctAnswer: 'de verpleegster', explanation: 'verpleger → verpleegster. Ojo, la raíz cambia un poco: verpleeg-.' },
        { id: 'm4l1e-3',  type: 'multiple_choice', prompt: '"De ober" en femenino es…', options: ['de serveerster', 'de oberster', 'de oberin', 'de oberes'], correctAnswer: 'de serveerster', explanation: 'Es la excepción de la lección: no se forma con -ster sobre "ober", es una palabra totalmente distinta.' },
        { id: 'm4l1e-4',  type: 'multiple_choice', prompt: '¿Qué profesión NO cambia entre hombre y mujer?', options: ['de chauffeur', 'de kapper', 'de leraar', 'de boer'], correctAnswer: 'de chauffeur', explanation: 'Chauffeur, minister, postbode, arts… valen igual para todos; solo cambia el plural.' },
        { id: 'm4l1e-5',  type: 'multiple_choice', prompt: '¿Cuál es el plural de "de arts"?', options: ['artsen', 'artss', 'arten', 'artsers'], correctAnswer: 'artsen', explanation: 'arts → artsen, y huisarts → huisartsen.' },
        { id: 'm4l1e-6',  type: 'multiple_choice', prompt: '¿Qué diferencia hay entre "de arts" y "de huisarts"?', options: ['El huisarts es el médico de cabecera', 'El huisarts trabaja en casa', 'Son lo mismo', 'El arts es el enfermero'], correctAnswer: 'El huisarts es el médico de cabecera', explanation: 'Arts = médico en general. Huisarts = tu médico de cabecera, el primero al que vas en NL.' },
        { id: 'm4l1e-7',  type: 'fill_blank', prompt: 'Ik werk ___ een ziekenhuis. (en un hospital)', correctAnswer: 'in', hint: 'dentro de un edificio grande', explanation: 'Con ziekenhuis se usa "in": Ik werk in een ziekenhuis.' },
        { id: 'm4l1e-8',  type: 'fill_blank', prompt: 'Ik werk ___ een school. (en una escuela)', correctAnswer: 'op', hint: 'con school NO se usa "in"', explanation: 'School y etage llevan "op": Ik werk op een school.' },
        { id: 'm4l1e-9',  type: 'fill_blank', prompt: 'Ik werk ___ een bedrijf. (en una empresa)', correctAnswer: 'bij', hint: 'la preposición de las empresas', explanation: 'Con bedrijf se usa "bij": Ik werk bij een bedrijf.' },
        { id: 'm4l1e-10', type: 'true_false', prompt: 'Se dice "Ik werk in thuis".', correctAnswer: 'falso', explanation: '"Thuis" no lleva preposición: Ik werk thuis. Es el aviso de la profe en la presentación.' },
        { id: 'm4l1e-11', type: 'multiple_choice', prompt: 'Trabajas en hostelería. ¿Cómo lo dices?', options: ['Ik werk in de horeca', 'Ik werk op de horeca', 'Ik werk bij horeca', 'Ik werk horeca'], correctAnswer: 'Ik werk in de horeca', explanation: 'El patrón es "Ik werk in de + sector".' },
        { id: 'm4l1e-12', type: 'multiple_choice', prompt: '¿Cuál de estos sectores va SIN artículo?', options: ['in het onderwijs', 'in de zorg', 'in de horeca', 'in de landbouw'], correctAnswer: 'in het onderwijs', explanation: 'Onderwijs lleva "het", no "de". Y ICT y klantendienst van sin artículo: in ICT, bij de klantendienst.' },
        { id: 'm4l1e-13', type: 'multiple_choice', prompt: '"Ik werk voor mezelf" significa…', options: ['Soy autónomo', 'Trabajo solo en la oficina', 'Trabajo gratis', 'Trabajo desde casa'], correctAnswer: 'Soy autónomo', explanation: 'Trabajar para uno mismo = ser zzp\'er (zelfstandige zonder personeel).' },
        { id: 'm4l1e-14', type: 'multiple_choice', prompt: '¿Qué preposición usas para decir CON QUIÉN trabajas?', options: ['met', 'voor', 'in', 'op'], correctAnswer: 'met', explanation: 'met = con (personas) · voor = para (empleador).' },
        { id: 'm4l1e-15', type: 'multiple_choice', prompt: '¿Qué es una "vacature"?', options: ['Una vacante, un puesto libre', 'Unas vacaciones', 'Una entrevista', 'Un contrato fijo'], correctAnswer: 'Una vacante, un puesto libre', explanation: 'Cuidado con el falso amigo: vacature NO son vacaciones (eso es vakantie).' },
        { id: 'm4l1e-16', type: 'multiple_choice', prompt: '¿Qué haces cuando "solliciteren"?', options: ['Te presentas a un puesto', 'Firmas el contrato', 'Pides un aumento', 'Te despides'], correctAnswer: 'Te presentas a un puesto', explanation: 'Solliciteren = postularse. Y el sollicitatiegesprek es la entrevista.' },
        { id: 'm4l1e-17', type: 'word_scramble', prompt: '¿Cómo se dice "vacante"?', correctAnswer: 'vacature', hint: 'un puesto libre en una empresa' },
        { id: 'm4l1e-18', type: 'word_scramble', prompt: '¿Cómo se dice "el empleo, el puesto"?', correctAnswer: 'baan', hint: 'een ___ zoeken = buscar empleo' },
        { id: 'm4l1e-19', type: 'order_sentence', prompt: 'Ordena: "Trabajo con mis compañeros."', options: ['Ik', 'werk', 'met', 'mijn', "collega's"], correctAnswer: "Ik werk met mijn collega's" },
        { id: 'm4l1e-20', type: 'order_sentence', prompt: 'Ordena: "¿En qué sector trabajas?"', options: ['In', 'welke', 'sector', 'werk', 'je?'], correctAnswer: 'In welke sector werk je?' },
      ],
    },
    { type: 'review' },
  ],
};

const m4_les2: Lesson = {
  id: 'm4-les-2-hebben-zijn',
  moduleId: 'het-werk',
  title: 'Les 2 — Grammatica | Hebben & Zijn',
  subtitle: 'Tener y ser/estar en el trabajo',
  order: 2,
  learningObjective: 'Usar hebben y zijn para decir dónde estás, cómo estás, si estás listo y qué tienes',
  estimatedMinutes: 25,
  blocks: [
    {
      type: 'summary',
      title: 'Hebben & Zijn',
      intro: 'Los dos verbos que más vas a usar. Con ellos dices dónde estás, cómo estás, si has terminado y qué tienes — todo lo que hace falta en un día de trabajo.',
      objectives: [
        'Conjugar hebben (tener) y zijn (ser / estar)',
        'Decir dónde estás y cómo estás, y por qué',
        'Decir si estás listo y qué tienes ahora',
      ],
      sections: [
        {
          heading: '📗 Hebben — tener',
          body: 'La **h** se pronuncia siempre, con aspiración. Fíjate en que solo cambian las tres formas del singular.',
          items: [
            { nl: 'ik heb', es: 'yo tengo' },
            { nl: 'jij hebt', es: 'tú tienes' },
            { nl: 'hij / zij heeft', es: 'él / ella tiene' },
            { nl: 'wij · jullie · zij hebben', es: 'nosotros · vosotros · ellos tenemos/tenéis/tienen' },
          ],
        },
        {
          heading: '📘 Zijn — ser / estar',
          body: 'Se pronuncia como «záin». En plural es **siempre zijn**, sin excepciones.',
          items: [
            { nl: 'ik ben', es: 'yo soy / estoy' },
            { nl: 'jij bent', es: 'tú eres / estás' },
            { nl: 'hij / zij is', es: 'él / ella es / está' },
            { nl: 'wij · jullie · zij zijn', es: 'nosotros · vosotros · ellos somos/sois/son' },
          ],
        },
        {
          heading: '📍 Dónde estás',
          body: 'La preposición depende del sitio. Y **thuis va sin preposición**.',
          items: [
            { nl: 'Ik ben thuis', es: 'Estoy en casa' },
            { nl: 'Ik ben op het werk', es: 'Estoy en el trabajo' },
            { nl: 'Ik ben in de trein', es: 'Estoy en el tren' },
            { nl: 'Ik ben op het station', es: 'Estoy en la estación' },
          ],
        },
        {
          heading: '💬 Cómo estás, y por qué',
          body: 'Combina una respuesta de **cómo** con un motivo. "Hoe gaat het?" y "Hoe is het?" son lo mismo.',
          items: [
            { nl: 'Het gaat goed / prima', es: 'Va bien / genial' },
            { nl: 'Niet zo goed / min of meer / redelijk', es: 'No muy bien / más o menos / regular' },
            { nl: 'Ik ben moe · ik heb het druk', es: 'Estoy cansado · estoy muy liado' },
            { nl: 'Ik heb hard gewerkt', es: 'He trabajado duro' },
            { nl: 'Ik ben vrij vandaag', es: 'Hoy tengo el día libre' },
          ],
        },
        {
          heading: '✅ ¿Estás listo? ¿Qué tienes?',
          items: [
            { nl: 'Ben je klaar? — Ja, ik ben klaar', es: '¿Estás listo? — Sí, estoy listo' },
            { nl: 'Nee, ik ben nog niet klaar', es: 'No, todavía no' },
            { nl: 'Ik heb nu pauze / Nederlandse les', es: 'Ahora tengo pausa / clase de neerlandés' },
            { nl: 'Wij hebben avonddienst / een afspraak', es: 'Tenemos turno de tarde / una cita' },
          ],
        },
      ],
      tip: 'Los dos errores típicos: decir **"ik ben honger"** (es *ik heb honger*, el hambre se tiene) y meter preposición en **thuis**. Si dominas eso, ya hablas mejor que muchos.',
    },
    {
      type: 'vocabulary',
      items: [
        { id: 'm4l2v-thuis', dutch: 'thuis', spanish: 'en casa', article: null, emoji: '🏠', color: '#1D0084', exampleNl: 'Ik ben thuis.', exampleEs: 'Estoy en casa.', category: 'plaats', difficulty: 'A1' },
        { id: 'm4l2v-werk', dutch: 'het werk', spanish: 'el trabajo', article: 'het', emoji: '🏢', color: '#025dc7', exampleNl: 'Ik ben op het werk.', exampleEs: 'Estoy en el trabajo.', category: 'plaats', difficulty: 'A1' },
        { id: 'm4l2v-trein', dutch: 'de trein', spanish: 'el tren', article: 'de', emoji: '🚆', color: '#4da3ff', exampleNl: 'Ik ben in de trein.', exampleEs: 'Estoy en el tren.', category: 'plaats', difficulty: 'A1' },
        { id: 'm4l2v-station', dutch: 'het station', spanish: 'la estación', article: 'het', emoji: '🚉', color: '#1D0084', exampleNl: 'Ik ben op het station.', exampleEs: 'Estoy en la estación.', category: 'plaats', difficulty: 'A1' },
        { id: 'm4l2v-kantoor', dutch: 'het kantoor', spanish: 'la oficina', article: 'het', emoji: '🏙️', color: '#025dc7', exampleNl: 'Wij zijn op kantoor.', exampleEs: 'Estamos en la oficina.', category: 'plaats', difficulty: 'A1' },
        { id: 'm4l2v-kantine', dutch: 'de kantine', spanish: 'la cantina', article: 'de', emoji: '🍽️', color: '#4da3ff', exampleNl: 'Wij zijn in de kantine.', exampleEs: 'Estamos en la cantina.', category: 'plaats', difficulty: 'A1' },
        { id: 'm4l2v-moe', dutch: 'moe', spanish: 'cansado', article: null, emoji: '😴', color: '#1D0084', exampleNl: 'Ik ben moe.', exampleEs: 'Estoy cansado.', category: 'gevoel', difficulty: 'A1' },
        { id: 'm4l2v-blij', dutch: 'blij', spanish: 'contento', article: null, emoji: '😄', color: '#025dc7', exampleNl: 'Ik ben blij.', exampleEs: 'Estoy contento.', category: 'gevoel', difficulty: 'A1' },
        { id: 'm4l2v-boos', dutch: 'boos', spanish: 'enfadado', article: null, emoji: '😠', color: '#4da3ff', exampleNl: 'Ik ben boos.', exampleEs: 'Estoy enfadado.', category: 'gevoel', difficulty: 'A1' },
        { id: 'm4l2v-verdrietig', dutch: 'verdrietig', spanish: 'triste', article: null, emoji: '😢', color: '#1D0084', exampleNl: 'Ik ben verdrietig.', exampleEs: 'Estoy triste.', category: 'gevoel', difficulty: 'A1' },
        { id: 'm4l2v-ziek', dutch: 'ziek', spanish: 'enfermo', article: null, emoji: '🤒', color: '#025dc7', exampleNl: 'Ik ben ziek.', exampleEs: 'Estoy enfermo.', category: 'gevoel', difficulty: 'A1' },
        { id: 'm4l2v-druk', dutch: 'het druk hebben', spanish: 'estar muy liado', article: null, emoji: '😰', color: '#4da3ff', exampleNl: 'Ik heb het druk.', exampleEs: 'Estoy muy liado.', category: 'gevoel', difficulty: 'A1' },
        { id: 'm4l2v-vrij', dutch: 'vrij zijn', spanish: 'estar libre, tener el día libre', article: null, emoji: '🎉', color: '#1D0084', exampleNl: 'Ik ben vrij vandaag.', exampleEs: 'Hoy tengo el día libre.', category: 'werk', difficulty: 'A1' },
        { id: 'm4l2v-klaar', dutch: 'klaar', spanish: 'listo, terminado', article: null, emoji: '✅', color: '#025dc7', exampleNl: 'Ik ben klaar.', exampleEs: 'Estoy listo.', category: 'werk', difficulty: 'A1' },
        { id: 'm4l2v-nognietklaar', dutch: 'nog niet', spanish: 'todavía no', article: null, emoji: '⏳', color: '#4da3ff', exampleNl: 'Ik ben nog niet klaar.', exampleEs: 'Todavía no he terminado.', category: 'werk', difficulty: 'A1' },
        { id: 'm4l2v-pauze', dutch: 'de pauze', spanish: 'la pausa, el descanso', article: 'de', emoji: '☕', color: '#1D0084', exampleNl: 'Ik heb nu pauze.', exampleEs: 'Ahora tengo pausa.', category: 'werk', difficulty: 'A1' },
        { id: 'm4l2v-dienst', dutch: 'de dienst', spanish: 'el turno', article: 'de', emoji: '🕐', color: '#025dc7', exampleNl: 'Wij hebben avonddienst.', exampleEs: 'Tenemos turno de tarde.', category: 'werk', difficulty: 'A1' },
        { id: 'm4l2v-afspraak', dutch: 'de afspraak', spanish: 'la cita, el compromiso', article: 'de', emoji: '📅', color: '#4da3ff', exampleNl: 'Wij hebben een afspraak.', exampleEs: 'Tenemos una cita.', category: 'werk', difficulty: 'A1' },
        { id: 'm4l2v-les', dutch: 'de les', spanish: 'la clase', article: 'de', emoji: '📚', color: '#1D0084', exampleNl: 'Ik heb nu Nederlandse les.', exampleEs: 'Ahora tengo clase de neerlandés.', category: 'werk', difficulty: 'A1' },
        { id: 'm4l2v-zoon', dutch: 'de zoon', spanish: 'el hijo', article: 'de', emoji: '👦', color: '#025dc7', exampleNl: 'Ik heb een zoon.', exampleEs: 'Tengo un hijo.', category: 'familie', difficulty: 'A1' },
        { id: 'm4l2v-dochter', dutch: 'de dochter', spanish: 'la hija', article: 'de', emoji: '👧', color: '#4da3ff', exampleNl: 'Ik heb een dochter.', exampleEs: 'Tengo una hija.', category: 'familie', difficulty: 'A1' },
        { id: 'm4l2v-honger', dutch: 'honger hebben', spanish: 'tener hambre', article: null, emoji: '🍔', color: '#1D0084', exampleNl: 'Wij hebben honger.', exampleEs: 'Tenemos hambre.', category: 'gevoel', difficulty: 'A1' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm4l2f-1', dutch: 'Waar ben je?', spanish: '¿Dónde estás?' },
        { id: 'm4l2f-2', dutch: 'Ik ben op het werk.', spanish: 'Estoy en el trabajo.' },
        { id: 'm4l2f-3', dutch: 'Ik ben in de trein.', spanish: 'Estoy en el tren.' },
        { id: 'm4l2f-4', dutch: 'Waar zijn jullie?', spanish: '¿Dónde estáis?' },
        { id: 'm4l2f-5', dutch: 'Wij zijn op kantoor.', spanish: 'Estamos en la oficina.' },
        { id: 'm4l2f-6', dutch: 'Hoe gaat het met je?', spanish: '¿Cómo te va?' },
        { id: 'm4l2f-7', dutch: 'Het gaat goed!', spanish: '¡Va bien!' },
        { id: 'm4l2f-8', dutch: 'Het gaat niet goed.', spanish: 'No va bien.' },
        { id: 'm4l2f-9', dutch: 'Ik ben moe, ik heb het druk.', spanish: 'Estoy cansado, estoy muy liado.' },
        { id: 'm4l2f-10', dutch: 'Ben je klaar?', spanish: '¿Estás listo?' },
        { id: 'm4l2f-11', dutch: 'Nee, ik ben nog niet klaar.', spanish: 'No, todavía no he terminado.' },
        { id: 'm4l2f-12', dutch: 'Wat heb je nu?', spanish: '¿Qué tienes ahora?' },
        { id: 'm4l2f-13', dutch: 'Ik heb nu pauze.', spanish: 'Ahora tengo pausa.' },
        { id: 'm4l2f-14', dutch: 'Wij hebben avonddienst.', spanish: 'Tenemos turno de tarde.' },
        { id: 'm4l2f-15', dutch: 'Heb jij kinderen?', spanish: '¿Tienes hijos?' },
        { id: 'm4l2f-16', dutch: 'Nee, ik heb geen kinderen.', spanish: 'No, no tengo hijos.' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        { id: 'm4l2e-1',  type: 'multiple_choice', prompt: '¿Cuál es la forma correcta con "jij" del verbo hebben?', options: ['jij hebt', 'jij heb', 'jij heeft', 'jij hebben'], correctAnswer: 'jij hebt', explanation: 'ik heb · jij hebt · hij/zij heeft.' },
        { id: 'm4l2e-2',  type: 'multiple_choice', prompt: '¿Y con "hij"?', options: ['hij heeft', 'hij hebt', 'hij heb', 'hij hebben'], correctAnswer: 'hij heeft', explanation: 'La tercera persona del singular es "heeft", con doble e.' },
        { id: 'm4l2e-3',  type: 'multiple_choice', prompt: '¿Cuál es la forma correcta con "jij" del verbo zijn?', options: ['jij bent', 'jij ben', 'jij is', 'jij zijn'], correctAnswer: 'jij bent', explanation: 'ik ben · jij bent · hij/zij is.' },
        { id: 'm4l2e-4',  type: 'multiple_choice', prompt: 'En plural, el verbo zijn es…', options: ['siempre zijn', 'siempre bent', 'siempre is', 'depende del pronombre'], correctAnswer: 'siempre zijn', explanation: 'wij zijn · jullie zijn · zij zijn. En plural no cambia nunca.' },
        { id: 'm4l2e-5',  type: 'fill_blank', prompt: 'Ik ___ Carlos en ik ___ leraar. (ser)', correctAnswer: 'ben', hint: 'la misma forma las dos veces', explanation: 'Ik ben Carlos en ik ben leraar.' },
        { id: 'm4l2e-6',  type: 'fill_blank', prompt: 'Zij ___ een auto. (tener)', correctAnswer: 'heeft', hint: 'tercera persona del singular' },
        { id: 'm4l2e-7',  type: 'fill_blank', prompt: 'Wij ___ honger. (tener)', correctAnswer: 'hebben', hint: 'plural' },
        { id: 'm4l2e-8',  type: 'true_false', prompt: 'Para decir "tengo hambre" se dice "ik ben honger".', correctAnswer: 'falso', explanation: 'El hambre se TIENE: "ik heb honger". Es el calco del español que más se oye.' },
        { id: 'm4l2e-9',  type: 'multiple_choice', prompt: '¿Cómo dices "Estoy en casa"?', options: ['Ik ben thuis', 'Ik ben in thuis', 'Ik ben op thuis', 'Ik ben in het thuis'], correctAnswer: 'Ik ben thuis', explanation: 'Thuis no lleva preposición nunca.' },
        { id: 'm4l2e-10', type: 'fill_blank', prompt: 'Ik ben ___ het werk. (en el trabajo)', correctAnswer: 'op', hint: 'no es "in"' },
        { id: 'm4l2e-11', type: 'fill_blank', prompt: 'Ik ben ___ de trein. (en el tren)', correctAnswer: 'in', hint: 'dentro del vagón' },
        { id: 'm4l2e-12', type: 'fill_blank', prompt: 'Ik ben ___ het station. (en la estación)', correctAnswer: 'op', hint: 'la misma que con "het werk"' },
        { id: 'm4l2e-13', type: 'multiple_choice', prompt: 'Te preguntan "Ben je klaar?" y todavía no has terminado. ¿Qué contestas?', options: ['Nee, ik ben nog niet klaar', 'Nee, ik ben niet klaar nog', 'Nee, ik heb nog niet klaar', 'Nee, ik ben klaar niet'], correctAnswer: 'Nee, ik ben nog niet klaar', explanation: '"Nog niet" = todavía no, y va junto delante de klaar.' },
        { id: 'm4l2e-14', type: 'multiple_choice', prompt: '"Wij hebben avonddienst" significa…', options: ['Tenemos turno de tarde', 'Tenemos una cita por la tarde', 'Estamos cansados', 'Salimos por la tarde'], correctAnswer: 'Tenemos turno de tarde', explanation: 'De dienst = el turno. Avond = tarde/noche.' },
        { id: 'm4l2e-15', type: 'multiple_choice', prompt: '¿Qué contestas a "Heb jij kinderen?" si no tienes?', options: ['Nee, ik heb geen kinderen', 'Nee, ik heb niet kinderen', 'Nee, ik ben geen kinderen', 'Nee, ik heb kinderen niet'], correctAnswer: 'Nee, ik heb geen kinderen', explanation: 'Para negar un sustantivo se usa "geen", no "niet".' },
        { id: 'm4l2e-16', type: 'multiple_choice', prompt: '"Hoe is het?" es lo mismo que…', options: ['Hoe gaat het?', 'Wat heb je?', 'Waar ben je?', 'Ben je klaar?'], correctAnswer: 'Hoe gaat het?', explanation: 'Son sinónimos: las dos preguntan cómo estás.' },
        { id: 'm4l2e-17', type: 'order_sentence', prompt: 'Ordena: "Estamos un poco cansados."', options: ['Wij', 'zijn', 'een', 'beetje', 'moe'], correctAnswer: 'Wij zijn een beetje moe' },
        { id: 'm4l2e-18', type: 'order_sentence', prompt: 'Ordena: "Tenemos mucho trabajo hoy."', options: ['Wij', 'hebben', 'veel', 'werk', 'vandaag'], correctAnswer: 'Wij hebben veel werk vandaag' },
        { id: 'm4l2e-19', type: 'word_scramble', prompt: '¿Cómo se dice "listo, terminado"?', correctAnswer: 'klaar', hint: 'Ben je ___?' },
        { id: 'm4l2e-20', type: 'word_scramble', prompt: '¿Cómo se dice "la pausa"?', correctAnswer: 'pauze', hint: 'Ik heb nu ___.' },
      ],
    },
    { type: 'review' },
  ],
};

const m4_les3: Lesson = {
  id: 'm4-les-3-om-te',
  moduleId: 'het-werk',
  title: 'Les 3 — Grammatica | Om…te',
  subtitle: 'Decir para qué haces las cosas',
  order: 3,
  learningObjective: 'Expresar el objetivo de una acción con om…te + infinitivo',
  estimatedMinutes: 25,
  blocks: [
    {
      type: 'summary',
      title: 'Om…te',
      intro: 'Con "om…te" dices PARA QUÉ haces algo. Es la respuesta a "Waarvoor doe je dat?", y una vez que la tienes, tus frases dejan de ser sueltas y empiezan a explicar tus motivos.',
      objectives: [
        'Formar frases con om + te + infinitivo',
        'Colocar el complemento entre "om" y "te"',
        'Contestar a "¿para qué?" en el día a día',
      ],
      sections: [
        {
          heading: '🔧 La estructura',
          body: 'La regla que no falla: **el verbo va SIEMPRE al final**, con "te" justo delante.',
          items: [
            { nl: 'Ik werk om te leven', es: 'Trabajo para vivir — sin complemento: om + te + infinitivo' },
            { nl: 'Ik werk om geld te sparen', es: 'Trabajo para ahorrar dinero — con complemento: om + complemento + te + infinitivo' },
          ],
        },
        {
          heading: '🎯 Para qué trabajas',
          items: [
            { nl: 'Ik werk om de huur te betalen', es: 'Trabajo para pagar el alquiler' },
            { nl: 'Ik werk om een huis te kopen', es: 'Trabajo para comprar una casa' },
            { nl: 'Ik studeer Nederlands om de taal te leren', es: 'Estudio neerlandés para aprender el idioma' },
          ],
        },
        {
          heading: '🧰 Para qué sirve cada cosa',
          body: 'La pregunta es **"Waarvoor gebruik je…?"** y se contesta con om … te …',
          items: [
            { nl: 'Een computer? Om te werken', es: '¿Un ordenador? Para trabajar' },
            { nl: 'Een pen? Om notities te maken', es: '¿Un bolígrafo? Para tomar notas' },
            { nl: 'Een telefoon? Om mijn moeder te bellen', es: '¿Un teléfono? Para llamar a mi madre' },
            { nl: 'Een koelkast? Om het eten te bewaren', es: '¿Una nevera? Para conservar la comida' },
          ],
        },
        {
          heading: '⚠️ Los verbos separables',
          body: 'Si el verbo es separable, **"te" se mete en medio**: afspreken → om met hem **af te spreken**.',
          items: [
            { nl: 'Ik bel Kees om met hem af te spreken', es: 'Llamo a Kees para quedar con él' },
            { nl: 'Wij fietsen naar de stad om te gaan winkelen', es: 'Vamos en bici al centro para ir de compras' },
          ],
        },
      ],
      tip: 'En español el verbo va justo detrás de "para" (*para pagar el alquiler*). En neerlandés se va al final: **om de huur te betalen**. Piensa la frase entera antes de empezar a hablar y no te quedarás colgado a mitad.',
    },
    {
      type: 'vocabulary',
      items: [
        { id: 'm4l3v-sparen', dutch: 'sparen', spanish: 'ahorrar', article: null, emoji: '💶', color: '#1D0084', exampleNl: 'Ik werk om geld te sparen.', exampleEs: 'Trabajo para ahorrar dinero.', category: 'werkwoorden', difficulty: 'A1' },
        { id: 'm4l3v-betalen', dutch: 'betalen', spanish: 'pagar', article: null, emoji: '🧾', color: '#025dc7', exampleNl: 'Ik werk om de huur te betalen.', exampleEs: 'Trabajo para pagar el alquiler.', category: 'werkwoorden', difficulty: 'A1' },
        { id: 'm4l3v-huur', dutch: 'de huur', spanish: 'el alquiler', article: 'de', emoji: '🏠', color: '#4da3ff', exampleNl: 'De huur is hoog in Amsterdam.', exampleEs: 'El alquiler es alto en Ámsterdam.', category: 'wonen', difficulty: 'A1' },
        { id: 'm4l3v-kopen', dutch: 'kopen', spanish: 'comprar', article: null, emoji: '🛒', color: '#1D0084', exampleNl: 'Ik werk om een huis te kopen.', exampleEs: 'Trabajo para comprar una casa.', category: 'werkwoorden', difficulty: 'A1' },
        { id: 'm4l3v-huren', dutch: 'huren', spanish: 'alquilar', article: null, emoji: '🔑', color: '#025dc7', exampleNl: 'Wij zoeken een appartement om te huren.', exampleEs: 'Buscamos un piso para alquilar.', category: 'wonen', difficulty: 'A1' },
        { id: 'm4l3v-boterham', dutch: 'de boterham', spanish: 'el sándwich', article: 'de', emoji: '🥪', color: '#4da3ff', exampleNl: 'Ik koop brood om een boterham te maken.', exampleEs: 'Compro pan para hacer un sándwich.', category: 'eten', difficulty: 'A1' },
        { id: 'm4l3v-afspreken', dutch: 'afspreken', spanish: 'quedar (con alguien)', article: null, emoji: '📞', color: '#1D0084', exampleNl: 'Ik bel Kees om met hem af te spreken.', exampleEs: 'Llamo a Kees para quedar con él.', category: 'werkwoorden', difficulty: 'A1' },
        { id: 'm4l3v-verlaten', dutch: 'verlaten', spanish: 'salir de, abandonar', article: null, emoji: '🚪', color: '#025dc7', exampleNl: 'Ik verlaat mijn huis om te gaan werken.', exampleEs: 'Salgo de casa para ir a trabajar.', category: 'werkwoorden', difficulty: 'A1' },
        { id: 'm4l3v-notities', dutch: 'notities maken', spanish: 'tomar notas', article: null, emoji: '🖊️', color: '#4da3ff', exampleNl: 'Ik gebruik een pen om notities te maken.', exampleEs: 'Uso un bolígrafo para tomar notas.', category: 'studie', difficulty: 'A1' },
        { id: 'm4l3v-bewaren', dutch: 'bewaren', spanish: 'conservar, guardar', article: null, emoji: '🧊', color: '#1D0084', exampleNl: 'Een koelkast is om het eten te bewaren.', exampleEs: 'Una nevera es para conservar la comida.', category: 'huis', difficulty: 'A1' },
        { id: 'm4l3v-koelkast', dutch: 'de koelkast', spanish: 'la nevera', article: 'de', emoji: '🧊', color: '#025dc7', exampleNl: 'De koelkast is leeg.', exampleEs: 'La nevera está vacía.', category: 'huis', difficulty: 'A1' },
        { id: 'm4l3v-mes', dutch: 'het mes', spanish: 'el cuchillo', article: 'het', emoji: '🔪', color: '#4da3ff', exampleNl: 'Ik gebruik een mes om brood te snijden.', exampleEs: 'Uso un cuchillo para cortar pan.', category: 'huis', difficulty: 'A1' },
        { id: 'm4l3v-bezoeken', dutch: 'bezoeken', spanish: 'visitar', article: null, emoji: '✈️', color: '#1D0084', exampleNl: 'Ik ga naar Spanje om mijn familie te bezoeken.', exampleEs: 'Voy a España para visitar a mi familia.', category: 'werkwoorden', difficulty: 'A1' },
        { id: 'm4l3v-winkelen', dutch: 'winkelen', spanish: 'ir de compras', article: null, emoji: '🛍️', color: '#025dc7', exampleNl: 'Wij fietsen naar de stad om te gaan winkelen.', exampleEs: 'Vamos en bici al centro para ir de compras.', category: 'vrije tijd', difficulty: 'A1' },
        { id: 'm4l3v-halen', dutch: 'halen', spanish: 'sacar, conseguir', article: null, emoji: '🎓', color: '#4da3ff', exampleNl: 'Zij gaat naar school om haar diploma te halen.', exampleEs: 'Va a la escuela para sacarse el título.', category: 'studie', difficulty: 'A1' },
        { id: 'm4l3v-diploma', dutch: 'het diploma', spanish: 'el título, el diploma', article: 'het', emoji: '📜', color: '#1D0084', exampleNl: 'Ik wil mijn diploma halen.', exampleEs: 'Quiero sacarme el título.', category: 'studie', difficulty: 'A1' },
        { id: 'm4l3v-oefenen', dutch: 'oefenen', spanish: 'practicar', article: null, emoji: '💪', color: '#025dc7', exampleNl: 'Oefenen is belangrijk om de taal te leren.', exampleEs: 'Practicar es importante para aprender el idioma.', category: 'studie', difficulty: 'A1' },
        { id: 'm4l3v-belangrijk', dutch: 'belangrijk', spanish: 'importante', article: null, emoji: '⭐', color: '#4da3ff', exampleNl: 'Dat is heel belangrijk.', exampleEs: 'Eso es muy importante.', category: 'algemeen', difficulty: 'A1' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm4l3f-1', dutch: 'Waarvoor doe je dat?', spanish: '¿Para qué haces eso?' },
        { id: 'm4l3f-2', dutch: 'Ik werk om te leven.', spanish: 'Trabajo para vivir.' },
        { id: 'm4l3f-3', dutch: 'Ik werk om geld te sparen.', spanish: 'Trabajo para ahorrar dinero.' },
        { id: 'm4l3f-4', dutch: 'Ik werk om de huur te betalen.', spanish: 'Trabajo para pagar el alquiler.' },
        { id: 'm4l3f-5', dutch: 'Ik werk om een huis te kopen.', spanish: 'Trabajo para comprar una casa.' },
        { id: 'm4l3f-6', dutch: 'Ik studeer Nederlands om de taal te leren.', spanish: 'Estudio neerlandés para aprender el idioma.' },
        { id: 'm4l3f-7', dutch: 'Ik koop brood om een boterham te maken.', spanish: 'Compro pan para hacer un sándwich.' },
        { id: 'm4l3f-8', dutch: 'Ik verlaat mijn huis om te gaan werken.', spanish: 'Salgo de casa para ir a trabajar.' },
        { id: 'm4l3f-9', dutch: 'Ik bel Kees om met hem af te spreken.', spanish: 'Llamo a Kees para quedar con él.' },
        { id: 'm4l3f-10', dutch: 'Waarvoor gebruik je een computer?', spanish: '¿Para qué usas un ordenador?' },
        { id: 'm4l3f-11', dutch: 'Om te werken.', spanish: 'Para trabajar.' },
        { id: 'm4l3f-12', dutch: 'Om notities te maken.', spanish: 'Para tomar notas.' },
        { id: 'm4l3f-13', dutch: 'Om het eten te bewaren.', spanish: 'Para conservar la comida.' },
        { id: 'm4l3f-14', dutch: 'Om mijn moeder te bellen.', spanish: 'Para llamar a mi madre.' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        { id: 'm4l3e-1',  type: 'multiple_choice', prompt: '¿Dónde va el verbo en una frase con om…te?', options: ['Al final', 'Justo detrás de "om"', 'Delante del sujeto', 'Da igual'], correctAnswer: 'Al final', explanation: 'om + (complemento) + te + infinitivo, y el infinitivo cierra la frase.' },
        { id: 'm4l3e-2',  type: 'multiple_choice', prompt: '¿Cuál es correcta?', options: ['Ik werk om geld te sparen', 'Ik werk om te sparen geld', 'Ik werk om sparen te geld', 'Ik werk te om geld sparen'], correctAnswer: 'Ik werk om geld te sparen', explanation: 'El complemento (geld) va entre "om" y "te".' },
        { id: 'm4l3e-3',  type: 'multiple_choice', prompt: '"Trabajo para vivir" es…', options: ['Ik werk om te leven', 'Ik werk om leven te', 'Ik werk te leven om', 'Ik werk voor leven'], correctAnswer: 'Ik werk om te leven', explanation: 'Sin complemento se quedan juntos: om te + infinitivo.' },
        { id: 'm4l3e-4',  type: 'fill_blank', prompt: 'Ik studeer Nederlands ___ de taal te leren.', correctAnswer: 'om', hint: 'la palabra que abre el objetivo' },
        { id: 'm4l3e-5',  type: 'fill_blank', prompt: 'Ik koop brood om een boterham ___ maken.', correctAnswer: 'te', hint: 'va justo delante del infinitivo' },
        { id: 'm4l3e-6',  type: 'multiple_choice', prompt: 'Con un verbo separable como "afspreken", ¿dónde va el "te"?', options: ['En medio: af te spreken', 'Delante: te afspreken', 'Detrás: afspreken te', 'No se pone te'], correctAnswer: 'En medio: af te spreken', explanation: 'El prefijo se separa y el "te" se cuela dentro: om met hem af te spreken.' },
        { id: 'm4l3e-7',  type: 'multiple_choice', prompt: '¿Para qué usas una nevera?', options: ['Om het eten te bewaren', 'Om te eten bewaren', 'Om bewaren het eten te', 'Voor het eten bewaren'], correctAnswer: 'Om het eten te bewaren', explanation: 'Bewaren = conservar, guardar.' },
        { id: 'm4l3e-8',  type: 'multiple_choice', prompt: '¿Qué pregunta usas para saber el objetivo?', options: ['Waarvoor doe je dat?', 'Waar doe je dat?', 'Wanneer doe je dat?', 'Hoe doe je dat?'], correctAnswer: 'Waarvoor doe je dat?', explanation: 'Waarvoor = para qué. Waar = dónde.' },
        { id: 'm4l3e-9',  type: 'multiple_choice', prompt: '"Wij zoeken een appartement…" ¿cómo sigue?', options: ['om te huren of te kopen', 'om huren of kopen te', 'om te huren of kopen te', 'te huren om kopen'], correctAnswer: 'om te huren of te kopen', explanation: 'Con dos infinitivos, cada uno lleva su "te".' },
        { id: 'm4l3e-10', type: 'multiple_choice', prompt: '"Zij gaat naar school…" ¿para qué?', options: ['om haar diploma te halen', 'om te halen haar diploma', 'om haar diploma halen te', 'voor haar diploma halen'], correctAnswer: 'om haar diploma te halen', explanation: 'Een diploma halen = sacarse el título.' },
        { id: 'm4l3e-11', type: 'true_false', prompt: 'En "om ... te ...", el complemento va detrás del infinitivo.', correctAnswer: 'falso', explanation: 'Va DELANTE: om + complemento + te + infinitivo.' },
        { id: 'm4l3e-12', type: 'order_sentence', prompt: 'Ordena: "Trabajo para pagar el alquiler."', options: ['Ik', 'werk', 'om', 'de', 'huur', 'te', 'betalen'], correctAnswer: 'Ik werk om de huur te betalen' },
        { id: 'm4l3e-13', type: 'order_sentence', prompt: 'Ordena: "Salgo de casa para ir a trabajar."', options: ['Ik', 'verlaat', 'mijn', 'huis', 'om', 'te', 'gaan', 'werken'], correctAnswer: 'Ik verlaat mijn huis om te gaan werken' },
        { id: 'm4l3e-14', type: 'order_sentence', prompt: 'Ordena: "Voy a España para visitar a mi familia."', options: ['Ik', 'ga', 'naar', 'Spanje', 'om', 'mijn', 'familie', 'te', 'bezoeken'], correctAnswer: 'Ik ga naar Spanje om mijn familie te bezoeken' },
        { id: 'm4l3e-15', type: 'word_scramble', prompt: '¿Cómo se dice "ahorrar"?', correctAnswer: 'sparen', hint: 'geld ___' },
        { id: 'm4l3e-16', type: 'word_scramble', prompt: '¿Cómo se dice "el alquiler"?', correctAnswer: 'huur', hint: 'lo que pagas cada mes por tu casa' },
        { id: 'm4l3e-17', type: 'multiple_choice', prompt: '¿Qué significa "oefenen"?', options: ['Practicar', 'Trabajar', 'Descansar', 'Enseñar'], correctAnswer: 'Practicar', explanation: 'Oefenen is belangrijk om de taal te leren.' },
        { id: 'm4l3e-18', type: 'multiple_choice', prompt: '¿Qué significa "bezoeken"?', options: ['Visitar', 'Buscar', 'Llamar', 'Recoger'], correctAnswer: 'Visitar', explanation: 'Mijn familie bezoeken = visitar a mi familia.' },
      ],
    },
    { type: 'review' },
  ],
};

const m4_les4: Lesson = {
  id: 'm4-les-4-hoe-laat',
  moduleId: 'het-werk',
  title: 'Les 4 — Hoe laat is het?',
  subtitle: 'La hora y los horarios',
  order: 4,
  learningObjective: 'Leer el reloj y hablar de tus horarios en el trabajo',
  estimatedMinutes: 30,
  blocks: [
    {
      type: 'summary',
      title: 'Hoe laat is het?',
      intro: 'La hora en neerlandés tiene una trampa que hace tropezar a todos los hispanohablantes. Si entiendes solo una cosa de esta lección, que sea la del "half".',
      objectives: [
        'Repasar los números y decir qué hora es',
        'Decir a qué hora pasa algo y en qué parte del día',
        'Hablar de tu horario: de cuándo a cuándo trabajas',
      ],
      sections: [
        {
          heading: '⚠️ La trampa del "half"',
          body: '**"Half twee" NO es las dos y media: es la UNA y media.** El neerlandés cuenta hacia la hora siguiente, o sea "media hora PARA las dos". Si piensas en español te equivocas una hora entera, y llegas tarde a la reunión.',
          items: [
            { nl: 'half twee', es: 'la 1:30 — media para las dos' },
            { nl: 'half negen', es: 'las 8:30 — media para las nueve' },
          ],
        },
        {
          heading: '🕐 Las cuatro piezas del reloj',
          items: [
            { nl: 'over', es: 'y (pasada la hora): tien over zeven = 7:10' },
            { nl: 'voor', es: 'menos (antes de la hora): vijf voor acht = 7:55' },
            { nl: 'kwart', es: 'cuarto: kwart voor negen = 8:45' },
            { nl: 'half', es: 'media, hacia la hora siguiente' },
          ],
        },
        {
          heading: '🗣️ Siempre "Het is…"',
          body: 'Se empieza siempre igual, y **siempre en singular**, aunque en español digas "son las".',
          items: [
            { nl: 'Het is drie uur', es: 'Son las tres' },
            { nl: 'Het is elf uur', es: 'Son las once' },
            { nl: 'Het is vijf voor half twee', es: 'Es la 1:25' },
            { nl: 'Het is tien over half negen', es: 'Son las 8:40' },
          ],
        },
        {
          heading: '📅 A qué hora, y de cuándo a cuándo',
          items: [
            { nl: 'Om drie uur', es: 'A las tres — para la hora concreta se usa "om"' },
            { nl: 'Ik werk van negen tot vijf', es: 'Trabajo de nueve a cinco' },
            { nl: 'We spreken rond vier uur af', es: 'Quedamos sobre las cuatro' },
            { nl: 'Ik werk acht uur ongeveer', es: 'Trabajo unas ocho horas' },
          ],
        },
        {
          heading: '🌅 Las partes del día',
          body: 'Se escriben con ese apóstrofo delante, que despista pero es lo normal.',
          items: [
            { nl: "'s morgens", es: 'por la mañana' },
            { nl: "'s middags", es: 'por la tarde (mediodía)' },
            { nl: "'s avonds", es: 'por la noche' },
          ],
        },
      ],
      tip: 'Truco para el "half": cuando oigas **half X**, resta una hora y pon 30 minutos. Half twee → una y media. Half negen → ocho y media. Con diez veces que lo hagas, te sale solo.',
    },
    {
      type: 'vocabulary',
      items: [
        { id: 'm4l4v-uur', dutch: 'het uur', spanish: 'la hora', article: 'het', emoji: '🕐', color: '#1D0084', exampleNl: 'Het is drie uur.', exampleEs: 'Son las tres.', category: 'klok', difficulty: 'A1' },
        { id: 'm4l4v-half', dutch: 'half', spanish: 'y media (¡pero hacia la hora siguiente!)', article: null, emoji: '🕜', color: '#025dc7', exampleNl: 'Het is half twee.', exampleEs: 'Es la una y media.', category: 'klok', difficulty: 'A1' },
        { id: 'm4l4v-kwart', dutch: 'het kwart', spanish: 'el cuarto', article: 'het', emoji: '🕘', color: '#4da3ff', exampleNl: 'Het is kwart voor negen.', exampleEs: 'Son las nueve menos cuarto.', category: 'klok', difficulty: 'A1' },
        { id: 'm4l4v-over', dutch: 'over', spanish: 'pasadas, y (después de la hora)', article: null, emoji: '➕', color: '#1D0084', exampleNl: 'Het is tien over zeven.', exampleEs: 'Son las siete y diez.', category: 'klok', difficulty: 'A1' },
        { id: 'm4l4v-voor', dutch: 'voor', spanish: 'menos (antes de la hora)', article: null, emoji: '➖', color: '#025dc7', exampleNl: 'Het is vijf voor acht.', exampleEs: 'Son las ocho menos cinco.', category: 'klok', difficulty: 'A1' },
        { id: 'm4l4v-vergadering', dutch: 'de vergadering', spanish: 'la reunión', article: 'de', emoji: '📋', color: '#4da3ff', exampleNl: 'De vergadering is om tien uur.', exampleEs: 'La reunión es a las diez.', category: 'werk', difficulty: 'A1' },
        { id: 'm4l4v-afspreken4', dutch: 'afspreken', spanish: 'quedar', article: null, emoji: '🤝', color: '#1D0084', exampleNl: 'Hoe laat spreken we af?', exampleEs: '¿A qué hora quedamos?', category: 'werk', difficulty: 'A1' },
        { id: 'm4l4v-bijna', dutch: 'bijna', spanish: 'casi', article: null, emoji: '⏳', color: '#025dc7', exampleNl: 'Het is bijna twaalf uur.', exampleEs: 'Son casi las doce.', category: 'klok', difficulty: 'A1' },
        { id: 'm4l4v-rond', dutch: 'rond', spanish: 'alrededor de', article: null, emoji: '🔄', color: '#4da3ff', exampleNl: 'We spreken rond vier uur af.', exampleEs: 'Quedamos sobre las cuatro.', category: 'klok', difficulty: 'A1' },
        { id: 'm4l4v-ongeveer', dutch: 'ongeveer', spanish: 'aproximadamente', article: null, emoji: '≈', color: '#1D0084', exampleNl: 'Ik werk acht uur ongeveer.', exampleEs: 'Trabajo unas ocho horas.', category: 'klok', difficulty: 'A1' },
        { id: 'm4l4v-morgens', dutch: "'s morgens", spanish: 'por la mañana', article: null, emoji: '🌅', color: '#025dc7', exampleNl: "Ik sport 's morgens.", exampleEs: 'Hago deporte por la mañana.', category: 'dagdeel', difficulty: 'A1' },
        { id: 'm4l4v-middags', dutch: "'s middags", spanish: 'por la tarde (mediodía)', article: null, emoji: '🌤️', color: '#4da3ff', exampleNl: "Ik doe 's middags de boodschappen.", exampleEs: 'Hago la compra por la tarde.', category: 'dagdeel', difficulty: 'A1' },
        { id: 'm4l4v-avonds', dutch: "'s avonds", spanish: 'por la noche', article: null, emoji: '🌙', color: '#1D0084', exampleNl: "We gaan om acht uur 's avonds naar huis.", exampleEs: 'Nos vamos a casa a las ocho de la noche.', category: 'dagdeel', difficulty: 'A1' },
        { id: 'm4l4v-duren', dutch: 'duren', spanish: 'durar', article: null, emoji: '⏱️', color: '#025dc7', exampleNl: 'De film duurt anderhalf uur.', exampleEs: 'La película dura hora y media.', category: 'klok', difficulty: 'A1' },
        { id: 'm4l4v-sporten', dutch: 'sporten', spanish: 'hacer deporte', article: null, emoji: '🏃', color: '#4da3ff', exampleNl: 'Wanneer ga je sporten?', exampleEs: '¿Cuándo haces deporte?', category: 'vrije tijd', difficulty: 'A1' },
        { id: 'm4l4v-boodschappen', dutch: 'de boodschappen', spanish: 'la compra', article: 'de', emoji: '🛒', color: '#1D0084', exampleNl: 'Ik doe de boodschappen.', exampleEs: 'Hago la compra.', category: 'dagelijks', difficulty: 'A1' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'm4l4f-1', dutch: 'Hoe laat is het?', spanish: '¿Qué hora es?' },
        { id: 'm4l4f-2', dutch: 'Het is drie uur.', spanish: 'Son las tres.' },
        { id: 'm4l4f-3', dutch: 'Het is half twee.', spanish: 'Es la una y media.' },
        { id: 'm4l4f-4', dutch: 'Het is kwart voor negen.', spanish: 'Son las nueve menos cuarto.' },
        { id: 'm4l4f-5', dutch: 'Het is tien over zeven.', spanish: 'Son las siete y diez.' },
        { id: 'm4l4f-6', dutch: 'Het is bijna twaalf uur.', spanish: 'Son casi las doce.' },
        { id: 'm4l4f-7', dutch: 'Hoe laat is de vergadering?', spanish: '¿A qué hora es la reunión?' },
        { id: 'm4l4f-8', dutch: 'Om drie uur.', spanish: 'A las tres.' },
        { id: 'm4l4f-9', dutch: 'Hoe laat spreken we af?', spanish: '¿A qué hora quedamos?' },
        { id: 'm4l4f-10', dutch: 'We spreken rond vier uur af.', spanish: 'Quedamos sobre las cuatro.' },
        { id: 'm4l4f-11', dutch: 'Van hoe laat tot hoe laat werk je?', spanish: '¿De qué hora a qué hora trabajas?' },
        { id: 'm4l4f-12', dutch: 'Ik werk van negen tot vijf.', spanish: 'Trabajo de nueve a cinco.' },
        { id: 'm4l4f-13', dutch: 'Hoe lang werk je?', spanish: '¿Cuánto tiempo trabajas?' },
        { id: 'm4l4f-14', dutch: "Ik sport 's morgens.", spanish: 'Hago deporte por la mañana.' },
        { id: 'm4l4f-15', dutch: 'Ik ben rond zes uur thuis.', spanish: 'Estoy en casa sobre las seis.' },
      ],
    },
    {
      // Spreken: decir la hora es de las cosas que más se dicen en voz alta,
      // así que aquí la consigna va también en neerlandés y con audio.
      type: 'spreken',
      title: 'Hoe laat?',
      intro: 'Escucha la pregunta y elige lo que dirías tú. Ojo con el "half": es la trampa de esta lección.',
      exercises: [
        { id: 'm4l4sp-1', type: 'spreken_choose', promptNl: 'Hoe laat is het?', prompt: 'Te preguntan la hora y son las 13:30.', options: ['Het is half twee.', 'Het is half een.', 'Het is twee uur.'], correctAnswer: 'Het is half twee.', explanation: 'Las 13:30 son media hora PARA las dos: half twee. "Half een" serían las 12:30.' },
        { id: 'm4l4sp-2', type: 'spreken_choose', promptNl: 'Hoe laat is het?', prompt: 'Son las 19:55.', options: ['Het is vijf voor acht.', 'Het is vijf over acht.', 'Het is vijf voor half acht.'], correctAnswer: 'Het is vijf voor acht.', explanation: 'Faltan cinco para las ocho: vijf voor acht. "Over" sería después.' },
        { id: 'm4l4sp-3', type: 'spreken_choose', promptNl: 'Hoe laat is de vergadering?', prompt: 'La reunión es a las tres.', options: ['Om drie uur.', 'Op drie uur.', 'In drie uur.'], correctAnswer: 'Om drie uur.', explanation: 'Para la hora concreta siempre "om".' },
        { id: 'm4l4sp-4', type: 'spreken_choose', promptNl: 'Van hoe laat tot hoe laat werk je?', prompt: 'Trabajas de nueve a cinco.', options: ['Ik werk van negen tot vijf.', 'Ik werk om negen tot vijf.', 'Ik werk van negen naar vijf.'], correctAnswer: 'Ik werk van negen tot vijf.', explanation: 'El par es van … tot …, como "de … a …".' },
        { id: 'm4l4sp-5', type: 'spreken_choose', promptNl: 'Wanneer doe je de boodschappen?', prompt: 'Haces la compra por la tarde.', options: ["Ik doe 's middags de boodschappen.", "Ik doe 's morgens de boodschappen.", "Ik doe 's avonds de boodschappen."], correctAnswer: "Ik doe 's middags de boodschappen.", explanation: "'s middags = por la tarde (mediodía). 's morgens = mañana, 's avonds = noche." },
      ],
    },
    {
      type: 'practice',
      exercises: [
        { id: 'm4l4e-1',  type: 'multiple_choice', prompt: '"Half twee" son las…', options: ['1:30', '2:30', '2:00', '1:00'], correctAnswer: '1:30', explanation: 'El neerlandés cuenta hacia la hora siguiente: media PARA las dos.' },
        { id: 'm4l4e-2',  type: 'multiple_choice', prompt: 'Entonces, ¿cómo se dicen las 8:30?', options: ['half negen', 'half acht', 'acht en half', 'half over acht'], correctAnswer: 'half negen', explanation: 'Media para las nueve. Suma una a la hora española.' },
        { id: 'm4l4e-3',  type: 'multiple_choice', prompt: '¿Cómo se dicen las 7:10?', options: ['tien over zeven', 'tien voor zeven', 'tien over half zeven', 'zeven over tien'], correctAnswer: 'tien over zeven', explanation: 'Over = pasada la hora.' },
        { id: 'm4l4e-4',  type: 'multiple_choice', prompt: '¿Y las 8:45?', options: ['kwart voor negen', 'kwart over acht', 'kwart voor acht', 'half negen'], correctAnswer: 'kwart voor negen', explanation: 'Un cuarto para las nueve.' },
        { id: 'm4l4e-5',  type: 'multiple_choice', prompt: '¿Cómo se dicen las 13:25?', options: ['vijf voor half twee', 'vijf over half twee', 'vijfentwintig over een', 'half twee over vijf'], correctAnswer: 'vijf voor half twee', explanation: 'Cinco antes de la media: vijf voor half twee.' },
        { id: 'm4l4e-6',  type: 'multiple_choice', prompt: '¿Y las 20:40?', options: ['tien over half negen', 'tien voor negen', 'twintig voor negen', 'half negen over tien'], correctAnswer: 'tien over half negen', explanation: 'Diez pasada la media: tien over half negen.' },
        { id: 'm4l4e-7',  type: 'true_false', prompt: 'Para decir la hora se empieza con "Het is…", siempre en singular.', correctAnswer: 'verdadero', explanation: 'Aunque en español digas "son las tres", en neerlandés es "Het is drie uur".' },
        { id: 'm4l4e-8',  type: 'fill_blank', prompt: 'De vergadering is ___ tien uur. (a las diez)', correctAnswer: 'om', hint: 'la preposición de la hora concreta' },
        { id: 'm4l4e-9',  type: 'fill_blank', prompt: 'Ik werk ___ negen tot vijf.', correctAnswer: 'van', hint: 'van … tot …' },
        { id: 'm4l4e-10', type: 'multiple_choice', prompt: '"We spreken rond vier uur af" significa…', options: ['Quedamos sobre las cuatro', 'Quedamos a las cuatro en punto', 'Quedamos antes de las cuatro', 'Quedamos durante cuatro horas'], correctAnswer: 'Quedamos sobre las cuatro', explanation: 'Rond = alrededor de, aproximadamente.' },
        { id: 'm4l4e-11', type: 'multiple_choice', prompt: '¿Qué significa "De film duurt anderhalf uur"?', options: ['Dura hora y media', 'Empieza a la una y media', 'Dura una hora', 'Termina a las dos'], correctAnswer: 'Dura hora y media', explanation: 'Duren = durar. Anderhalf = uno y medio.' },
        { id: 'm4l4e-12', type: 'multiple_choice', prompt: '"Het is bijna twaalf uur" quiere decir…', options: ['Son casi las doce', 'Son las doce en punto', 'Son las doce y pico', 'Faltan doce minutos'], correctAnswer: 'Son casi las doce', explanation: 'Bijna = casi.' },
        { id: 'm4l4e-13', type: 'multiple_choice', prompt: '¿Cuál es "por la noche"?', options: ["'s avonds", "'s morgens", "'s middags", "'s nachts uur"], correctAnswer: "'s avonds", explanation: "'s morgens (mañana) · 's middags (tarde) · 's avonds (noche)." },
        { id: 'm4l4e-14', type: 'multiple_choice', prompt: '¿Cómo se dice 25?', options: ['vijfentwintig', 'twintigenvijf', 'vijftwintig', 'twintigvijf'], correctAnswer: 'vijfentwintig', explanation: 'Primero la unidad: vijf-en-twintig. Al revés que en español.' },
        { id: 'm4l4e-15', type: 'multiple_choice', prompt: '¿Y 42?', options: ['tweeënveertig', 'veertigtwee', 'vierentwintig', 'tweeveertig'], correctAnswer: 'tweeënveertig', explanation: 'twee-en-veertig, con diéresis en la e.' },
        { id: 'm4l4e-16', type: 'order_sentence', prompt: 'Ordena: "¿A qué hora quedamos?"', options: ['Hoe', 'laat', 'spreken', 'we', 'af?'], correctAnswer: 'Hoe laat spreken we af?' },
        { id: 'm4l4e-17', type: 'order_sentence', prompt: 'Ordena: "Estoy en casa sobre las seis."', options: ['Ik', 'ben', 'rond', 'zes', 'uur', 'thuis'], correctAnswer: 'Ik ben rond zes uur thuis' },
        { id: 'm4l4e-18', type: 'word_scramble', prompt: '¿Cómo se dice "la reunión"?', correctAnswer: 'vergadering', hint: 'lo que tienes en el trabajo a las diez' },
      ],
    },
    { type: 'review' },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────────
   EXPORT
───────────────────────────────────────────────────────────────────────────── */

export const LESSONS: Lesson[] = [
  // Module 1
  m1_les1, m1_les2, m1_les3, m1_les4, m1_les5, m1_les6,
  m1_extra1, m1_extra2, m1_extra3,
  // Module 2
  m2_les1, m2_les2, m2_les3, m2_les4, m2_les5, m2_les6,
  m2_extra1, m2_extra2, m2_extra3,
  // Module 3
  m3_les1, m3_les2, m3_les3, m3_les4, m3_les5, m3_les6,
  // Module 4
  m4_les1, m4_les2, m4_les3, m4_les4,
];
