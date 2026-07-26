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
    emoji: '👨‍👩‍👧',
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
      title: 'Een dag in Amsterdam',
      textNl: `Het is ochtend in Amsterdam. David loopt naar de bakker. ‘Goedemorgen!’ zegt de bakker. ‘Goedemorgen! Ik heet David. Ik ben nieuw hier,’ zegt David. ‘Welkom! Ik ben Kees. Waar kom je vandaan?’ ‘Ik kom uit Argentinië. En ik woon nu hier, in Amsterdam.’ ‘Wat leuk! Tot ziens, David!’ ‘Dag Kees! Fijne dag!’

Het is middag. David ontmoet zijn taalbuddy Anna in een café. ‘Goedemiddag, Anna!’ ‘Hoi David! Hoe is het met je?’ ‘Goed, dank je!’ Zij drinken koffie en praten. Het is gezellig.

Het is avond. David gaat naar huis. Bij de deur staat een vrouw. ‘Goedenavond!’ zegt de vrouw. ‘Goedenavond, mevrouw! Ik ben David. Ik woon hier nu.’ ‘Aha, welkom! Ik heet Els. Prettig kennis te maken!’ ‘Prettig kennis te maken, mevrouw!’

Het is nacht. David is moe, maar blij. Zijn eerste dag! De bakker, Anna, mevrouw Els… Hij zegt zacht: ‘Goedenacht, Amsterdam. Tot morgen!’`,
      textEs: `Es de mañana en Ámsterdam. David camina hacia la panadería. «¡Buenos días!», dice el panadero. «¡Buenos días! Me llamo David. Soy nuevo aquí», dice David. «¡Bienvenido! Yo soy Kees. ¿De dónde vienes?» «Vengo de Argentina. Y ahora vivo aquí, en Ámsterdam.» «¡Qué bien! ¡Hasta la vista, David!» «¡Adiós, Kees! ¡Que tengas un buen día!»

Es mediodía. David se encuentra con su compañera de idiomas Anna en un café. «¡Buenas tardes, Anna!» «¡Hola David! ¿Cómo estás?» «¡Bien, gracias!» Toman café y charlan. El ambiente es muy agradable (gezellig).

Es de noche. David va a casa. En la puerta hay una mujer. «¡Buenas noches!», dice la mujer. «¡Buenas noches, señora! Soy David. Ahora vivo aquí.» «¡Ah, bienvenido! Me llamo Els. ¡Encantada de conocerte!» «¡Encantado de conocerla, señora!»

Es de noche cerrada. David está cansado, pero contento. ¡Su primer día! El panadero, Anna, la señora Els… Dice bajito: «Buenas noches, Ámsterdam. ¡Hasta mañana!»`,
      exercises: [
        { id: 'm1l1lz-1', type: 'multiple_choice', prompt: '¿Quién es Kees?', options: ['El panadero', 'El vecino', 'El profesor', 'El camarero'], correctAnswer: 'El panadero', explanation: 'David loopt naar de bakker (la panadería) y allí conoce a Kees.' },
        { id: 'm1l1lz-2', type: 'multiple_choice', prompt: '¿Qué saludo usa David por la mañana?', options: ['Goedemorgen', 'Goedenavond', 'Goedenacht', 'Tot straks'], correctAnswer: 'Goedemorgen', explanation: 'Por la mañana (hasta las 12:00) se dice "goedemorgen".' },
        { id: 'm1l1lz-3', type: 'multiple_choice', prompt: '¿Con quién toma café David al mediodía?', options: ['Con Anna', 'Con Kees', 'Con Els', 'Con nadie'], correctAnswer: 'Con Anna', explanation: '"David ontmoet zijn taalbuddy Anna in een café."' },
        { id: 'm1l1lz-4', type: 'fill_blank', prompt: 'Ik ___ nu hier, in Amsterdam. (vivir)', correctAnswer: 'woon', hint: 'wonen → ik woon', explanation: 'El verbo "wonen" (vivir) con "ik" es "woon".' },
        { id: 'm1l1lz-5', type: 'multiple_choice', prompt: '¿Cómo se llama la señora de la puerta?', options: ['Els', 'Anna', 'Maria', 'Sofia'], correctAnswer: 'Els', explanation: '"Ik heet Els" — la vecina de David.' },
        { id: 'm1l1lz-6', type: 'multiple_choice', prompt: '¿Qué le dice David a la señora Els?', options: ['Prettig kennis te maken', 'Tot volgende week', 'Doei!', 'Hoe oud ben je?'], correctAnswer: 'Prettig kennis te maken', explanation: '"Encantado de conocerla" — la fórmula de cortesía al conocer a alguien.' },
        { id: 'm1l1lz-7', type: 'fill_blank', prompt: '‘Dag Kees! ___ dag!’', correctAnswer: 'Fijne', hint: '¡Que tengas un buen día!', explanation: '"Fijne dag!" = ¡que tengas un buen día!' },
        { id: 'm1l1lz-8', type: 'multiple_choice', prompt: '¿De dónde viene David?', options: ['De Argentina', 'De Italia', 'De Chile', 'De Países Bajos'], correctAnswer: 'De Argentina', explanation: '"Ik kom uit Argentinië."' },
        { id: 'm1l1lz-9', type: 'fill_blank', prompt: 'David zegt zacht: ‘___, Amsterdam. Tot morgen!’', correctAnswer: 'Goedenacht', hint: 'La despedida al final del día', explanation: 'Al final del día, para dormir: "goedenacht".' },
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
        { id: 'm1l1e-10', type: 'fill_blank', prompt: 'Ik ___ David. (llamarse)', correctAnswer: 'heet', hint: 'heten → ik heet' },
        { id: 'm1l1e-11', type: 'fill_blank', prompt: 'Ik ___ 35 jaar. (ser)', correctAnswer: 'ben', hint: 'zijn → ik ben', explanation: 'La edad en neerlandés va con el verbo "zijn" (ser): Ik ben 35 jaar.' },
        { id: 'm1l1e-12', type: 'fill_blank', prompt: 'Ik ___ in Groningen. (vivir)', correctAnswer: 'woon', hint: 'wonen → ik woon' },
        { id: 'm1l1e-13', type: 'fill_blank', prompt: 'Ik kom ___ Colombia. (venir de)', correctAnswer: 'uit', hint: '"komen uit" = venir de' },
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

’s Ochtends zegt Sofia: ‘Ben je klaar, Pablo? We gaan!’ Maar Pablo drinkt koffie. Hij zegt: ‘Momentje! Eerst mijn koffie.’ Sofia lacht: ‘Jij en je koffie!’

Jan en Els wonen ook in de straat. Zij zijn schilders. Ze werken vandaag niet. Het regent, dus zij zijn thuis. Luna, de kat, zit bij het raam. Zij kijkt naar de regen.

’s Avonds leren Sofia en Pablo samen Nederlands. Sofia leert snel, Pablo leert langzaam. Hij zegt: ‘Nederlands is moeilijk!’ Sofia zegt: ‘Nee hoor! Wij leren samen. En jij leert goed!’ Pablo lacht: ‘Jij bent lief. Maar eerst… koffie!’

En jullie? Leren jullie ook Nederlands? Dan zijn jullie net als Sofia en Pablo!`,
      textEs: `Esta es Sofía. Ella es de Chile y está aprendiendo neerlandés. Pablo es el marido de Sofía. Él trabaja en casa. Sofía y Pablo viven en Róterdam. Tienen un gato. La gata se llama Luna.

Por la mañana, Sofía dice: «¿Estás listo, Pablo? ¡Nos vamos!» Pero Pablo está tomando café. Él dice: «¡Un momento! Primero mi café.» Sofía se ríe: «¡Tú y tu café!»

Jan y Els también viven en la calle. Ellos son pintores. Hoy no trabajan. Llueve, así que están en casa. Luna, la gata, está sentada junto a la ventana. Ella mira la lluvia.

Por la noche, Sofía y Pablo aprenden neerlandés juntos. Sofía aprende rápido, Pablo aprende despacio. Él dice: «¡El neerlandés es difícil!» Sofía dice: «¡Que no! Nosotros aprendemos juntos. ¡Y tú aprendes bien!» Pablo se ríe: «Eres un encanto. Pero primero… ¡café!»

¿Y vosotros? ¿También estáis aprendiendo neerlandés? ¡Entonces sois como Sofía y Pablo!`,
      exercises: [
        { id: 'm1l2lz-1', type: 'multiple_choice', prompt: '¿De dónde es Sofía?', options: ['De Chile', 'De Colombia', 'De España', 'De Argentina'], correctAnswer: 'De Chile', explanation: '"Zij komt uit Chili."' },
        { id: 'm1l2lz-2', type: 'multiple_choice', prompt: '¿Quién trabaja en casa?', options: ['Pablo', 'Sofía', 'Jan', 'Els'], correctAnswer: 'Pablo', explanation: '"Hij werkt thuis" — hij = él = Pablo.' },
        { id: 'm1l2lz-3', type: 'multiple_choice', prompt: '¿Cómo se llama la gata?', options: ['Luna', 'Els', 'Minoes', 'Sofia'], correctAnswer: 'Luna', explanation: '"De kat heet Luna."' },
        { id: 'm1l2lz-4', type: 'fill_blank', prompt: 'Sofia en Pablo ___ in Rotterdam. (vivir, ellos)', correctAnswer: 'wonen', hint: 'Con "zij" (ellos) se usa el infinitivo', explanation: 'Plural → infinitivo: zij wonen.' },
        { id: 'm1l2lz-5', type: 'multiple_choice', prompt: '¿Qué hacen Jan y Els?', options: ['Son pintores', 'Son médicos', 'Son panaderos', 'Son profesores'], correctAnswer: 'Son pintores', explanation: '"Zij zijn schilders."' },
        { id: 'm1l2lz-6', type: 'multiple_choice', prompt: '¿Por qué están Jan y Els en casa?', options: ['Porque llueve', 'Porque es de noche', 'Porque están enfermos', 'Porque es fiesta'], correctAnswer: 'Porque llueve', explanation: '"Het regent, dus zij zijn thuis" — llueve, así que están en casa.' },
        { id: 'm1l2lz-7', type: 'fill_blank', prompt: '___ regent, dus zij zijn thuis. (impersonal)', correctAnswer: 'Het', hint: 'El pronombre del clima', explanation: '"Het regent" = llueve. Het es el sujeto impersonal.' },
        { id: 'm1l2lz-8', type: 'multiple_choice', prompt: '¿Quién aprende rápido?', options: ['Sofía', 'Pablo', 'Luna', 'Jan'], correctAnswer: 'Sofía', explanation: '"Sofia leert snel, Pablo leert langzaam."' },
        { id: 'm1l2lz-9', type: 'fill_blank', prompt: 'Pablo ___ koffie. (beber)', correctAnswer: 'drinkt', hint: 'drinken → hij drink+t', explanation: 'Con "hij" el verbo lleva -t: drinkt.' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'm1d2',
        title: 'De tweede ontmoeting',
        context: 'David en Anna ontmoeten elkaar voor de tweede keer. Vandaag oefenen ze de voornaamwoorden.',
        lines: [
          { id: 'm1d2-1',  speaker: 'David', dutch: 'Hoi Anna! Fijn je weer te zien.',                              spanish: '¡Hola Anna! Qué bien verte otra vez.' },
          { id: 'm1d2-2',  speaker: 'Anna',  dutch: 'Hallo David! Kom, we zitten binnen. Het regent!',              spanish: '¡Hola David! Ven, nos sentamos dentro. ¡Llueve!' },
          { id: 'm1d2-3',  speaker: 'David', dutch: 'Ja, het is echt Nederlands weer.',                             spanish: 'Sí, es tiempo típico neerlandés.' },
          { id: 'm1d2-4',  speaker: 'Anna',  dutch: 'Haha! Vandaag oefenen we: ik, jij, hij, zij…',                 spanish: '¡Jaja! Hoy practicamos: yo, tú, él, ella…' },
          { id: 'm1d2-5',  speaker: 'David', dutch: 'Oké. Ik ben David, jij bent Anna.',                            spanish: 'Vale. Yo soy David, tú eres Anna.' },
          { id: 'm1d2-6',  speaker: 'Anna',  dutch: 'Heel goed! Kijk, die man daar: hij is arts.',                  spanish: '¡Muy bien! Mira, ese hombre de ahí: él es médico.' },
          { id: 'm1d2-7',  speaker: 'David', dutch: 'En die vrouw? Wie is zij?',                                    spanish: '¿Y esa mujer? ¿Quién es ella?' },
          { id: 'm1d2-8',  speaker: 'Anna',  dutch: 'Zij is schilder. Ze werkt vandaag niet.',                      spanish: 'Ella es pintora. Hoy no trabaja.' },
          { id: 'm1d2-9',  speaker: 'David', dutch: 'En wij? Wij leren samen Nederlands!',                          spanish: '¿Y nosotros? ¡Nosotros aprendemos neerlandés juntos!' },
          { id: 'm1d2-10', speaker: 'Anna',  dutch: 'Precies! Zeg, drinken jullie in Argentinië veel koffie?',      spanish: '¡Exacto! Oye, ¿en Argentina tomáis mucho café?' },
          { id: 'm1d2-11', speaker: 'David', dutch: 'Ja! Wij drinken veel koffie, en ook mate.',                    spanish: '¡Sí! Tomamos mucho café, y también mate.' },
          { id: 'm1d2-12', speaker: 'Anna',  dutch: 'Leuk! Nog een vraag: zeg je ‘u’ of ‘jij’ tegen mij?',          spanish: '¡Qué bien! Otra pregunta: ¿me dices "u" (usted) o "jij" (tú)?' },
          { id: 'm1d2-13', speaker: 'David', dutch: '‘Jij’! ‘U’ is formeel, toch?',                                 spanish: '¡"Jij"! "U" es formal, ¿no?' },
          { id: 'm1d2-14', speaker: 'Anna',  dutch: 'Klopt! Tegen vrienden zeg je ‘jij’ of ‘je’.',                  spanish: '¡Correcto! A los amigos les dices "jij" o "je".' },
          { id: 'm1d2-15', speaker: 'David', dutch: 'Mooi. We gaan naar huis?',                                     spanish: 'Genial. ¿Nos vamos a casa?' },
          { id: 'm1d2-16', speaker: 'Anna',  dutch: 'Ja! Tot volgende week. Doei!',                                 spanish: '¡Sí! Hasta la semana que viene. ¡Adiós!' },
        ],
      },
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
      textNl: `Anna werkt op een school in Haarlem. Zij helpt de kinderen. De kinderen leren snel. Een kind vraagt: ‘Juf Anna, help je mij?’ ‘Natuurlijk!’ zegt Anna. Ze denkt: ‘Ik heb het mooiste werk van Nederland.’

Na het werk wacht Anna op de bus. Maar de bus komt niet. Anna denkt: ‘Waar is de bus?’ Ze wacht en wacht. Dan belt ze haar zus: ‘Hoi! Ik wacht al heel lang op de bus!’ Haar zus lacht: ‘Kom, ik ben in de stad. We gaan samen naar huis.’

Thuis koken Anna en haar zus pasta. Anna kookt, haar zus helpt. Zij maken samen het eten. Het is gezellig in de keuken.

David werkt vandaag thuis. Hij leert Nederlands en denkt de hele dag aan de nieuwe woorden. ’s Avonds belt hij met Anna. Hij vraagt: ‘Wat doe je?’ Anna zegt: ‘Ik eet pasta!’ Zij spreken samen Nederlands en lachen veel. David denkt: ‘Werken, wachten, koken, bellen… ik leer alle werkwoorden!’`,
      textEs: `Anna trabaja en una escuela en Haarlem. Ella ayuda a los niños. Los niños aprenden rápido. Un niño pregunta: «Señorita Anna, ¿me ayudas?» «¡Claro!», dice Anna. Ella piensa: «Tengo el trabajo más bonito de Países Bajos.»

Después del trabajo, Anna espera el autobús. Pero el autobús no viene. Anna piensa: «¿Dónde está el autobús?» Espera y espera. Entonces llama a su hermana: «¡Hola! ¡Llevo esperando el autobús muchísimo tiempo!» Su hermana se ríe: «Ven, estoy en la ciudad. Nos vamos a casa juntas.»

En casa, Anna y su hermana cocinan pasta. Anna cocina, su hermana ayuda. Preparan la comida juntas. Hay muy buen ambiente en la cocina.

David hoy trabaja en casa. Aprende neerlandés y piensa todo el día en las palabras nuevas. Por la noche llama a Anna. Él pregunta: «¿Qué haces?» Anna dice: «¡Estoy comiendo pasta!» Hablan neerlandés juntos y se ríen mucho. David piensa: «Trabajar, esperar, cocinar, llamar… ¡estoy aprendiendo todos los verbos!»`,
      exercises: [
        { id: 'm1l3lz-1', type: 'multiple_choice', prompt: '¿Dónde trabaja Anna?', options: ['En una escuela', 'En una oficina', 'En casa', 'En un café'], correctAnswer: 'En una escuela', explanation: '"Anna werkt op een school in Haarlem."' },
        { id: 'm1l3lz-2', type: 'multiple_choice', prompt: '¿A quién ayuda Anna?', options: ['A los niños', 'A David', 'A su hermana', 'A los médicos'], correctAnswer: 'A los niños', explanation: '"Zij helpt de kinderen."' },
        { id: 'm1l3lz-3', type: 'multiple_choice', prompt: '¿Qué pasa con el autobús?', options: ['No viene', 'Llega pronto', 'Está lleno', 'Es gratis'], correctAnswer: 'No viene', explanation: '"Maar de bus komt niet" — por eso Anna espera y espera.' },
        { id: 'm1l3lz-4', type: 'multiple_choice', prompt: '¿A quién llama Anna?', options: ['A su hermana', 'A David', 'A la escuela', 'A un taxi'], correctAnswer: 'A su hermana', explanation: '"Dan belt ze haar zus" — belt = llama (bellen).' },
        { id: 'm1l3lz-5', type: 'fill_blank', prompt: 'Thuis ___ zij pasta. (cocinar, ella)', correctAnswer: 'kookt', hint: 'koken → raíz kook + t', explanation: 'Con "zij" (ella): raíz + t → kookt. ¡La vocal se dobla: koken → kook!' },
        { id: 'm1l3lz-6', type: 'fill_blank', prompt: 'Hij ___ Nederlands. (aprender)', correctAnswer: 'leert', hint: 'leren → raíz leer + t' },
        { id: 'm1l3lz-7', type: 'multiple_choice', prompt: '¿Quién llama a quién por la noche?', options: ['David llama a Anna', 'Anna llama a David', 'La hermana llama a Anna', 'Nadie llama'], correctAnswer: 'David llama a Anna', explanation: '"’s Avonds belt hij met Anna" — hij = David.' },
        { id: 'm1l3lz-8', type: 'multiple_choice', prompt: '¿Qué está comiendo Anna cuando llama David?', options: ['Pasta', 'Pan con queso', 'Sopa', 'Una pera'], correctAnswer: 'Pasta', explanation: '"Ik eet pasta!"' },
        { id: 'm1l3lz-9', type: 'fill_blank', prompt: 'Het kind vraagt: ‘Juf Anna, help ___ mij?’', correctAnswer: 'je', hint: 'En preguntas: verbo + je (¡sin -t!)', explanation: 'En preguntas con "je", el verbo va primero y pierde la -t: "help je mij?"' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'm1d3',
        title: 'De derde ontmoeting',
        context: 'David en Anna praten over hun dag. Vandaag oefenen ze de werkwoorden.',
        lines: [
          { id: 'm1d3-1',  speaker: 'David', dutch: 'Hoi Anna! Sorry, wacht je al lang?',                       spanish: '¡Hola Anna! Perdona, ¿llevas mucho esperando?' },
          { id: 'm1d3-2',  speaker: 'Anna',  dutch: 'Hallo David! Nee hoor, ik wacht vijf minuten.',            spanish: '¡Hola David! Qué va, llevo esperando cinco minutos.' },
          { id: 'm1d3-3',  speaker: 'David', dutch: 'Wat doe je op een dag, Anna? Werk je veel?',               spanish: '¿Qué haces en un día, Anna? ¿Trabajas mucho?' },
          { id: 'm1d3-4',  speaker: 'Anna',  dutch: 'Ja, ik werk op een school. Ik help de kinderen.',          spanish: 'Sí, trabajo en una escuela. Ayudo a los niños.' },
          { id: 'm1d3-5',  speaker: 'David', dutch: 'Wat leuk! Ik werk thuis. Ik denk de hele dag aan Nederlands!', spanish: '¡Qué bonito! Yo trabajo en casa. ¡Pienso en neerlandés todo el día!' },
          { id: 'm1d3-6',  speaker: 'Anna',  dutch: 'Haha! En je leert snel, David.',                           spanish: '¡Jaja! Y aprendes rápido, David.' },
          { id: 'm1d3-7',  speaker: 'David', dutch: 'Dank je. Kook jij vanavond?',                              spanish: 'Gracias. ¿Cocinas tú esta noche?' },
          { id: 'm1d3-8',  speaker: 'Anna',  dutch: 'Ja, ik kook pasta. Mijn zus helpt.',                       spanish: 'Sí, cocino pasta. Mi hermana ayuda.' },
          { id: 'm1d3-9',  speaker: 'David', dutch: 'Wij eten vanavond bij vrienden. Zij koken heel lekker.',   spanish: 'Nosotros cenamos esta noche en casa de unos amigos. Ellos cocinan riquísimo.' },
          { id: 'm1d3-10', speaker: 'Anna',  dutch: 'Gezellig! Zeg, ik ga naar huis.',                          spanish: '¡Qué bien! Oye, me voy a casa.' },
          { id: 'm1d3-11', speaker: 'David', dutch: 'Oké! Ik bel je morgen.',                                   spanish: '¡Vale! Te llamo mañana.' },
          { id: 'm1d3-12', speaker: 'Anna',  dutch: 'Prima! Bel je in de ochtend?',                             spanish: '¡Perfecto! ¿Me llamas por la mañana?' },
          { id: 'm1d3-13', speaker: 'David', dutch: 'Ja! Tot morgen, Anna.',                                    spanish: '¡Sí! Hasta mañana, Anna.' },
          { id: 'm1d3-14', speaker: 'Anna',  dutch: 'Doei!',                                                    spanish: '¡Adiós!' },
        ],
      },
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
      title: 'Een dag vol nummers',
      textNl: `Vandaag gaan David en Anna naar de stad. Eerst drinken ze koffie. Eén koffie kost vier euro. Twee koffie is acht euro. David heeft tien euro: acht euro voor de koffie, dus hij heeft nog twee euro.

Dan lopen ze door de stad. Anna ziet een boek. ‘Hoeveel kost het?’ vraagt ze. ‘Het kost twaalf euro,’ zegt de man. ‘Twaalf euro? Dat is veel!’ zegt Anna. Ze koopt het boek niet.

Later spelen ze een spelletje met nummers. David vraagt: ‘Hoeveel is negen plus negen?’ ‘Achttien!’ zegt Anna. ‘En vier keer vijf?’ ‘Twintig! Makkelijk!’ ‘Oké, een moeilijke: honderd min één?’ Anna lacht: ‘Negenennegentig!’

’s Avonds gaat David met de bus naar huis. Het is bus nummer vijfentwintig. Hij woont op nummer acht. Thuis denkt hij: ‘Eén dag in de stad… en ik ken alle nummers van Nederland!’`,
      textEs: `Hoy David y Anna van a la ciudad. Primero toman café. Un café cuesta cuatro euros. Dos cafés son ocho euros. David tiene diez euros: ocho para el café, así que le quedan dos euros.

Después pasean por la ciudad. Anna ve un libro. «¿Cuánto cuesta?», pregunta. «Cuesta doce euros», dice el hombre. «¿Doce euros? ¡Eso es mucho!», dice Anna. No compra el libro.

Más tarde juegan a un juego con números. David pregunta: «¿Cuánto es nueve más nueve?» «¡Dieciocho!», dice Anna. «¿Y cuatro por cinco?» «¡Veinte! ¡Fácil!» «Vale, una difícil: ¿cien menos uno?» Anna se ríe: «¡Noventa y nueve!»

Por la noche, David va a casa en autobús. Es el autobús número veinticinco. Él vive en el número ocho. En casa piensa: «Un día en la ciudad… ¡y ya me sé todos los números de Países Bajos!»`,
      exercises: [
        { id: 'm1l4lz-1', type: 'multiple_choice', prompt: '¿Cuánto cuesta UN café?', options: ['Cuatro euros', 'Ocho euros', 'Dos euros', 'Doce euros'], correctAnswer: 'Cuatro euros', explanation: '"Eén koffie kost vier euro."' },
        { id: 'm1l4lz-2', type: 'multiple_choice', prompt: '¿Cuántos euros tiene David al empezar?', options: ['Diez', 'Ocho', 'Dos', 'Veinte'], correctAnswer: 'Diez', explanation: '"David heeft tien euro" — tien = 10.' },
        { id: 'm1l4lz-3', type: 'fill_blank', prompt: 'Twee koffie is ___ euro. (en letras)', correctAnswer: 'acht', hint: '4 + 4 = …', explanation: 'Dos cafés a cuatro euros: acht (ocho) euros.' },
        { id: 'm1l4lz-4', type: 'multiple_choice', prompt: '¿Cuánto cuesta el libro que ve Anna?', options: ['Doce euros', 'Diez euros', 'Ocho euros', 'Veinte euros'], correctAnswer: 'Doce euros', explanation: '"Het kost twaalf euro" — twaalf = 12. Y a Anna le parece caro.' },
        { id: 'm1l4lz-5', type: 'multiple_choice', prompt: '"Dat is veel!" significa…', options: ['¡Eso es mucho!', '¡Qué barato!', '¡Me lo llevo!', '¡Es bonito!'], correctAnswer: '¡Eso es mucho!', explanation: 'veel = mucho. Por eso Anna no compra el libro.' },
        { id: 'm1l4lz-6', type: 'fill_blank', prompt: 'Negen plus negen is ___. (en letras)', correctAnswer: 'achttien', hint: '9 + 9 = 18 (¡con dos t!)', explanation: 'Achttien (18) se escribe con dos t: acht + tien.' },
        { id: 'm1l4lz-7', type: 'fill_blank', prompt: 'Honderd min één is ___en negentig. (la unidad)', correctAnswer: 'negen', hint: '99 = "nueve y noventa"', explanation: '99 = negenennegentig: primero la unidad (negen), luego la decena.' },
        { id: 'm1l4lz-8', type: 'multiple_choice', prompt: '¿Qué número tiene el autobús de David?', options: ['El veinticinco', 'El ocho', 'El doce', 'El dieciocho'], correctAnswer: 'El veinticinco', explanation: '"Bus nummer vijfentwintig" = vijf-en-twintig = 25.' },
        { id: 'm1l4lz-9', type: 'multiple_choice', prompt: '¿En qué número vive David?', options: ['En el ocho', 'En el quince', 'En el veinticinco', 'En el cuatro'], correctAnswer: 'En el ocho', explanation: '"Hij woont op nummer acht."' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'm1d4',
        title: 'De vierde ontmoeting',
        context: 'David en Anna wisselen nummers uit en spelen een rekenspelletje.',
        lines: [
          { id: 'm1d4-1',  speaker: 'David', dutch: 'Hoi Anna! Vandaag leren we nummers, toch?',                                     spanish: '¡Hola Anna! Hoy aprendemos los números, ¿verdad?' },
          { id: 'm1d4-2',  speaker: 'Anna',  dutch: 'Ja! Eerst een vraag: hoe oud ben je, David?',                                   spanish: '¡Sí! Primero una pregunta: ¿cuántos años tienes, David?' },
          { id: 'm1d4-3',  speaker: 'David', dutch: 'Ik ben tweeëndertig jaar. En jij?',                                             spanish: 'Tengo treinta y dos años. ¿Y tú?' },
          { id: 'm1d4-4',  speaker: 'Anna',  dutch: 'Ik ben negenentwintig.',                                                       spanish: 'Tengo veintinueve.' },
          { id: 'm1d4-5',  speaker: 'David', dutch: 'Op welk nummer woon je in Haarlem?',                                            spanish: '¿En qué número vives en Haarlem?' },
          { id: 'm1d4-6',  speaker: 'Anna',  dutch: 'Ik woon op nummer vijftien. En jij?',                                           spanish: 'Vivo en el número quince. ¿Y tú?' },
          { id: 'm1d4-7',  speaker: 'David', dutch: 'Nummer acht, in Amsterdam.',                                                    spanish: 'En el número ocho, en Ámsterdam.' },
          { id: 'm1d4-8',  speaker: 'Anna',  dutch: 'Wat is je telefoonnummer?',                                                     spanish: '¿Cuál es tu número de teléfono?' },
          { id: 'm1d4-9',  speaker: 'David', dutch: 'Mijn nummer is nul zes, één twee, drie vier, vijf zes, zeven acht.',            spanish: 'Mi número es cero seis, uno dos, tres cuatro, cinco seis, siete ocho.' },
          { id: 'm1d4-10', speaker: 'Anna',  dutch: 'Dank je! Nu een spelletje: hoeveel is drie keer drie?',                         spanish: '¡Gracias! Ahora un juego: ¿cuánto es tres por tres?' },
          { id: 'm1d4-11', speaker: 'David', dutch: 'Makkelijk! Drie keer drie is negen.',                                           spanish: '¡Fácil! Tres por tres son nueve.' },
          { id: 'm1d4-12', speaker: 'Anna',  dutch: 'En twintig min elf?',                                                          spanish: '¿Y veinte menos once?' },
          { id: 'm1d4-13', speaker: 'David', dutch: 'Eh… twintig min elf is negen!',                                                 spanish: 'Eh… ¡veinte menos once son nueve!' },
          { id: 'm1d4-14', speaker: 'Anna',  dutch: 'Heel goed! Twee keer negen voor David!',                                        spanish: '¡Muy bien! ¡Dos veces nueve para David!' },
          { id: 'm1d4-15', speaker: 'David', dutch: 'Haha! Tot volgende week, Anna!',                                                spanish: '¡Jaja! ¡Hasta la semana que viene, Anna!' },
          { id: 'm1d4-16', speaker: 'Anna',  dutch: 'Doei!',                                                                         spanish: '¡Adiós!' },
        ],
      },
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
      title: 'David gaat naar de taalschool',
      textNl: `David gaat naar een taalschool. De school heet ‘De Windmolen’. Hij is een beetje nerveus. Zijn eerste echte les!

Een vrouw zegt: ‘Goedemorgen! Welkom. Wat is je naam?’ ‘David Moreno.’ ‘Moreno… hoe spel je dat?’ ‘M-O-R-E-N-O.’ ‘Dank je. En je voornaam?’ ‘David. D-A-V-I-D.’

De vrouw vraagt: ‘Wat is je e-mailadres?’ David spelt: ‘d-a-v-i-d, punt, m-o-r-e-n-o, apenstaartje, mail, punt, nl.’ De vrouw lacht: ‘Perfect gespeld!’

Dan vraagt ze: ‘En je straatnaam?’ ‘De Willemstraat.’ ‘Met een V of met een W?’ ‘Met een W! W-I-L-L-E-M.’ ‘Heel goed! De W en de V zijn moeilijk voor veel mensen.’

‘Sorry, kun je dat herhalen?’ vraagt David. ‘Wanneer begint de les?’ ‘Je les begint volgende week!’ zegt de vrouw. ‘Dank u wel! Tot ziens!’ ‘Tot ziens, David!’`,
      textEs: `David va a una escuela de idiomas. La escuela se llama «De Windmolen» (El Molino). Está un poco nervioso. ¡Su primera clase de verdad!

Una mujer dice: «¡Buenos días! Bienvenido. ¿Cuál es tu nombre?» «David Moreno.» «Moreno… ¿cómo se deletrea?» «M-O-R-E-N-O.» «Gracias. ¿Y tu nombre de pila?» «David. D-A-V-I-D.»

La mujer pregunta: «¿Cuál es tu dirección de correo?» David deletrea: «d-a-v-i-d, punto, m-o-r-e-n-o, arroba, mail, punto, nl.» La mujer se ríe: «¡Deletreado perfecto!»

Luego pregunta: «¿Y el nombre de tu calle?» «La Willemstraat.» «¿Con V o con W?» «¡Con W! W-I-L-L-E-M.» «¡Muy bien! La W y la V son difíciles para mucha gente.»

«Perdona, ¿puedes repetirlo?», pregunta David. «¿Cuándo empieza la clase?» «¡Tu clase empieza la semana que viene!», dice la mujer. «¡Muchas gracias! ¡Hasta la vista!» «¡Hasta la vista, David!»`,
      exercises: [
        { id: 'm1l5lz-1', type: 'multiple_choice', prompt: '¿Cómo se llama la escuela?', options: ['De Windmolen', 'De Taalschool', 'De Letter', 'Het Alfabet'], correctAnswer: 'De Windmolen', explanation: '"De school heet De Windmolen" — el molino de viento.' },
        { id: 'm1l5lz-2', type: 'multiple_choice', prompt: '¿Cuál es el apellido de David?', options: ['Moreno', 'Molina', 'Romero', 'Montero'], correctAnswer: 'Moreno', explanation: 'Lo deletrea: M-O-R-E-N-O.' },
        { id: 'm1l5lz-3', type: 'multiple_choice', prompt: '¿Qué significa "apenstaartje" en el email?', options: ['La arroba (@)', 'El punto (.)', 'El guion (-)', 'La eñe (ñ)'], correctAnswer: 'La arroba (@)', explanation: 'Literalmente "colita de mono" = @.' },
        { id: 'm1l5lz-4', type: 'fill_blank', prompt: 'David ___ zijn e-mailadres. (deletrear)', correctAnswer: 'spelt', hint: 'spellen → hij spel+t' },
        { id: 'm1l5lz-5', type: 'multiple_choice', prompt: '¿Con qué letra empieza el apellido de David?', options: ['Con la M', 'Con la D', 'Con la W', 'Con la N'], correctAnswer: 'Con la M', explanation: 'Moreno empieza con M.' },
        { id: 'm1l5lz-6', type: 'multiple_choice', prompt: '¿Cómo se llama la calle de David?', options: ['Willemstraat', 'Victorstraat', 'Molenstraat', 'Davidstraat'], correctAnswer: 'Willemstraat', explanation: '"De Willemstraat" — ¡con W, no con V!' },
        { id: 'm1l5lz-7', type: 'multiple_choice', prompt: 'Willemstraat, ¿con V o con W?', options: ['Con W', 'Con V', 'Con las dos', 'Con B'], correctAnswer: 'Con W', explanation: 'El clásico contraste V-W: Willem va con W (wee).' },
        { id: 'm1l5lz-8', type: 'fill_blank', prompt: '‘Sorry, kun je dat ___?’ (repetir)', correctAnswer: 'herhalen', hint: 'La frase para pedir que lo repitan' },
        { id: 'm1l5lz-9', type: 'multiple_choice', prompt: '¿Cuándo empieza la clase de David?', options: ['La semana que viene', 'Mañana', 'Hoy', 'El mes que viene'], correctAnswer: 'La semana que viene', explanation: '"Je les begint volgende week!"' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'm1d5',
        title: 'De vijfde ontmoeting',
        context: 'David oefent het alfabet en leert zijn naam en e-mailadres te spellen.',
        lines: [
          { id: 'm1d5-1',  speaker: 'David', dutch: 'Hoi Anna! Vandaag leer ik het alfabet.',                        spanish: '¡Hola Anna! Hoy aprendo el alfabeto.' },
          { id: 'm1d5-2',  speaker: 'Anna',  dutch: 'Perfect! Hoe spel je je naam?',                                  spanish: '¡Perfecto! ¿Cómo se deletrea tu nombre?' },
          { id: 'm1d5-3',  speaker: 'David', dutch: 'D-A-V-I-D. Makkelijk!',                                          spanish: 'D-A-V-I-D. ¡Fácil!' },
          { id: 'm1d5-4',  speaker: 'Anna',  dutch: 'En wat is je achternaam?',                                       spanish: '¿Y cuál es tu apellido?' },
          { id: 'm1d5-5',  speaker: 'David', dutch: 'Moreno. M-O-R-E-N-O.',                                           spanish: 'Moreno. M-O-R-E-N-O.' },
          { id: 'm1d5-6',  speaker: 'Anna',  dutch: 'Goed zo! Nu een moeilijke: spel ‘Willem’.',                      spanish: '¡Muy bien! Ahora una difícil: deletrea "Willem".' },
          { id: 'm1d5-7',  speaker: 'David', dutch: 'V… nee, W! W-I-L-L-E-M.',                                        spanish: 'V… ¡no, W! W-I-L-L-E-M.' },
          { id: 'm1d5-8',  speaker: 'Anna',  dutch: 'Ja! De W en de V zijn lastig, hè?',                              spanish: '¡Sí! La W y la V son complicadas, ¿eh?' },
          { id: 'm1d5-9',  speaker: 'David', dutch: 'Ja! En de G… ‘gee’. Die klinkt uit de keel!',                    spanish: '¡Sí! Y la G… "gee". ¡Esa suena desde la garganta!' },
          { id: 'm1d5-10', speaker: 'Anna',  dutch: 'Haha, heel goed! Kun je je e-mailadres spellen?',                spanish: '¡Jaja, muy bien! ¿Puedes deletrear tu email?' },
          { id: 'm1d5-11', speaker: 'David', dutch: 'Ja: david, punt, moreno, apenstaartje, mail, punt, nl.',         spanish: 'Sí: david, punto, moreno, arroba, mail, punto, nl.' },
          { id: 'm1d5-12', speaker: 'Anna',  dutch: '‘Apenstaartje’! Mooi woord, toch?',                              spanish: '¡"Apenstaartje" (colita de mono)! Bonita palabra, ¿verdad?' },
          { id: 'm1d5-13', speaker: 'David', dutch: 'Ja! Het Nederlands is gezellig.',                                spanish: '¡Sí! El neerlandés es "gezellig".' },
          { id: 'm1d5-14', speaker: 'Anna',  dutch: 'Haha! Tot volgende week, David.',                                spanish: '¡Jaja! Hasta la semana que viene, David.' },
          { id: 'm1d5-15', speaker: 'David', dutch: 'Doei!',                                                          spanish: '¡Adiós!' },
        ],
      },
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
        { id: 'm1l5e-8',  type: 'fill_blank', prompt: 'Mijn achternaam begint ___ een Z.', correctAnswer: 'met', hint: 'beginnen met = empezar con' },
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
      title: 'De man, de maan en het park',
      textNl: `De zon schijnt. David zit in het park onder een boom. Hij eet brood met kaas en leest de krant. In de krant staat: ‘Mooi weer vandaag!’

Een man loopt met een hond. De man zegt: ‘Dag!’ ‘Dag meneer!’ zegt David. De hond kijkt naar het brood van David. ‘Nee nee,’ lacht David, ‘dit brood is voor mij!’

Dan komt de bus. Zijn buur Els stapt uit de bus. ‘Hallo David! Wat doe je?’ ‘Ik lees de krant. Kom je zitten?’ Ze praten over de taal. Els vraagt: ‘Ken je het verschil tussen man en maan?’ ‘Ja!’ zegt David. ‘De man loopt in het park, en de maan staat in de lucht!’ ‘Heel goed! En tussen bus en buur?’ ‘Makkelijk: jij bent mijn buur, en de bus is… weg!’ Ze lachen samen.

’s Avonds is David thuis. Hij kijkt uit het raam. De maan is groot en geel. De stad is stil. David denkt: ‘Nederland is mooi. De taal is niet makkelijk, maar ik leer elke dag. En morgen… eet ik weer brood met kaas in het park!’`,
      textEs: `El sol brilla. David está sentado en el parque bajo un árbol. Come pan con queso y lee el periódico. En el periódico pone: «¡Buen tiempo hoy!»

Un hombre pasea con un perro. El hombre dice: «¡Buenas!» «¡Buenas, señor!», dice David. El perro mira el pan de David. «No, no», se ríe David, «¡este pan es para mí!»

Entonces llega el autobús. Su vecina Els se baja del autobús. «¡Hola David! ¿Qué haces?» «Leo el periódico. ¿Te sientas?» Charlan sobre el idioma. Els pregunta: «¿Sabes la diferencia entre "man" y "maan"?» «¡Sí!», dice David. «¡El hombre camina por el parque, y la luna está en el cielo!» «¡Muy bien! ¿Y entre "bus" y "buur"?» «Fácil: tú eres mi vecina, y el autobús… ¡ya se ha ido!» Se ríen juntos.

Por la noche, David está en casa. Mira por la ventana. La luna es grande y amarilla. La ciudad está en silencio. David piensa: «Países Bajos es bonito. El idioma no es fácil, pero aprendo cada día. Y mañana… ¡otra vez pan con queso en el parque!»`,
      exercises: [
        { id: 'm1l6lz-1', type: 'multiple_choice', prompt: '¿Dónde está sentado David?', options: ['Bajo un árbol', 'En el autobús', 'En casa', 'En la playa'], correctAnswer: 'Bajo un árbol', explanation: '"David zit in het park onder een boom."' },
        { id: 'm1l6lz-2', type: 'multiple_choice', prompt: '¿Qué come David?', options: ['Pan con queso', 'Una pera', 'Pasta', 'Sopa'], correctAnswer: 'Pan con queso', explanation: '"Hij eet brood met kaas."' },
        { id: 'm1l6lz-3', type: 'multiple_choice', prompt: '¿Qué pone en el periódico?', options: ['Buen tiempo hoy', 'Llueve mañana', 'La luna es amarilla', 'El parque cierra'], correctAnswer: 'Buen tiempo hoy', explanation: '"In de krant staat: Mooi weer vandaag!"' },
        { id: 'm1l6lz-4', type: 'multiple_choice', prompt: '¿Qué mira el perro?', options: ['El pan de David', 'La luna', 'El periódico', 'El autobús'], correctAnswer: 'El pan de David', explanation: '"De hond kijkt naar het brood van David" — ¡y David le dice que no!' },
        { id: 'm1l6lz-5', type: 'multiple_choice', prompt: '¿Quién se baja del autobús?', options: ['Su vecina Els', 'Anna', 'Su hermana', 'Un médico'], correctAnswer: 'Su vecina Els', explanation: '"Zijn buur Els stapt uit de bus" — de buur = el vecino/la vecina.' },
        { id: 'm1l6lz-6', type: 'fill_blank', prompt: 'De maan is groot en ___. (amarilla)', correctAnswer: 'geel', hint: 'Vocal larga: ee', explanation: '"Geel" (amarillo) lleva vocal larga; "geld" (dinero) corta.' },
        { id: 'm1l6lz-7', type: 'multiple_choice', prompt: 'Según David, ¿cuál es la diferencia entre "man" y "maan"?', options: ['El hombre camina por el parque y la luna está en el cielo', 'Son la misma palabra', 'Man es luna y maan es hombre', 'Ninguna'], correctAnswer: 'El hombre camina por el parque y la luna está en el cielo', explanation: 'man (a corta) = hombre · maan (aa larga) = luna.' },
        { id: 'm1l6lz-8', type: 'fill_blank', prompt: 'Hij leest de ___. (el periódico)', correctAnswer: 'krant', hint: 'de …', explanation: '"De krant" = el periódico.' },
        { id: 'm1l6lz-9', type: 'multiple_choice', prompt: '¿Qué va a hacer David mañana?', options: ['Comer pan con queso en el parque otra vez', 'Ir a Argentina', 'Comprar un perro', 'Tomar el autobús 25'], correctAnswer: 'Comer pan con queso en el parque otra vez', explanation: '"En morgen… eet ik weer brood met kaas in het park!"' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'm1d6',
        title: 'De zesde ontmoeting',
        context: 'David en Anna oefenen de korte en lange klinkers met woordparen.',
        lines: [
          { id: 'm1d6-1',  speaker: 'David', dutch: 'Hoi Anna! Ik heb een vraag. Wat is het verschil tussen ‘man’ en ‘maan’?',  spanish: '¡Hola Anna! Tengo una pregunta. ¿Cuál es la diferencia entre "man" y "maan"?' },
          { id: 'm1d6-2',  speaker: 'Anna',  dutch: 'Goede vraag! De ‘a’ in ‘man’ is kort. De ‘aa’ in ‘maan’ is lang.',         spanish: '¡Buena pregunta! La "a" de "man" es corta. La "aa" de "maan" es larga.' },
          { id: 'm1d6-3',  speaker: 'David', dutch: 'Dus ik zeg: de man kijkt naar de maan?',                                    spanish: 'Entonces digo: ¿el hombre mira la luna?' },
          { id: 'm1d6-4',  speaker: 'Anna',  dutch: 'Precies! En ken je ‘bol’ en ‘boom’?',                                       spanish: '¡Exacto! ¿Y conoces "bol" y "boom"?' },
          { id: 'm1d6-5',  speaker: 'David', dutch: 'Ja! De bol is rond, en de boom is groot.',                                  spanish: '¡Sí! La bola es redonda y el árbol es grande.' },
          { id: 'm1d6-6',  speaker: 'Anna',  dutch: 'Heel goed! Nu een lastige: ‘bus’ en ‘buur’.',                               spanish: '¡Muy bien! Ahora una difícil: "bus" y "buur".' },
          { id: 'm1d6-7',  speaker: 'David', dutch: 'De bus komt, en mijn buur… drinkt koffie?',                                 spanish: 'El autobús viene, y mi vecino… ¿toma café?' },
          { id: 'm1d6-8',  speaker: 'Anna',  dutch: 'Haha, perfect! Nog één: ik eet kaas met een kam.',                          spanish: '¡Jaja, perfecto! Una más: yo como queso con un peine.' },
          { id: 'm1d6-9',  speaker: 'David', dutch: 'Nee! Je eet kaas, niet met een kam! Een kam is voor je haar!',              spanish: '¡No! ¡Comes queso, no con un peine! ¡El peine es para el pelo!' },
          { id: 'm1d6-10', speaker: 'Anna',  dutch: 'Heel goed, David! Je hoort het verschil al.',                               spanish: '¡Muy bien, David! Ya oyes la diferencia.' },
          { id: 'm1d6-11', speaker: 'David', dutch: 'Ja! Vandaag eet ik brood met kaas, en vanavond kijk ik naar de maan.',      spanish: '¡Sí! Hoy como pan con queso, y esta noche miro la luna.' },
          { id: 'm1d6-12', speaker: 'Anna',  dutch: 'Wat gezellig! Tot volgende week!',                                          spanish: '¡Qué bien! ¡Hasta la semana que viene!' },
          { id: 'm1d6-13', speaker: 'David', dutch: 'Doei Anna!',                                                                spanish: '¡Adiós, Anna!' },
        ],
      },
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
  title: 'Les 1 — Woordenschat | Familie en relaties',
  subtitle: 'Vocabulario de familia y relaciones',
  order: 1,
  learningObjective: 'Hablar de tu familia y describir relaciones',
  estimatedMinutes: 20,
  blocks: [
    {
      type: 'vocabulary',
      items: [
        { id: 'vader', dutch: 'de vader', spanish: 'el padre', article: 'de', emoji: '👨', color: '#1D0084', exampleNl: 'Mijn vader heet Peter.', exampleEs: 'Mi padre se llama Peter.', category: 'familie', difficulty: 'A0' },
        { id: 'moeder', dutch: 'de moeder', spanish: 'la madre', article: 'de', emoji: '👩', color: '#025dc7', exampleNl: 'Mijn moeder werkt als verpleegkundige.', exampleEs: 'Mi madre trabaja como enfermera.', category: 'familie', difficulty: 'A0' },
        { id: 'broer', dutch: 'de broer', spanish: 'el hermano', article: 'de', emoji: '👦', color: '#0b4db5', exampleNl: 'Ik heb één broer.', exampleEs: 'Tengo un hermano.', category: 'familie', difficulty: 'A0' },
        { id: 'zus', dutch: 'de zus', spanish: 'la hermana', article: 'de', emoji: '👧', color: '#0a3d9e', exampleNl: 'Mijn zus woont in Spanje.', exampleEs: 'Mi hermana vive en España.', category: 'familie', difficulty: 'A0' },
        { id: 'kind', dutch: 'het kind', spanish: 'el/la hijo/hija / niño/niña', article: 'het', emoji: '🧒', color: '#1440a0', exampleNl: 'Wij hebben twee kinderen.', exampleEs: 'Tenemos dos hijos.', category: 'familie', difficulty: 'A0' },
        { id: 'zoon', dutch: 'de zoon', spanish: 'el hijo', article: 'de', emoji: '👦', color: '#0d5bbf', exampleNl: 'Mijn zoon heet Luca.', exampleEs: 'Mi hijo se llama Luca.', category: 'familie', difficulty: 'A0' },
        { id: 'dochter', dutch: 'de dochter', spanish: 'la hija', article: 'de', emoji: '👧', color: '#1D0084', exampleNl: 'Mijn dochter studeert medicijnen.', exampleEs: 'Mi hija estudia medicina.', category: 'familie', difficulty: 'A0' },
        { id: 'opa', dutch: 'de opa', spanish: 'el abuelo', article: 'de', emoji: '👴', color: '#025dc7', exampleNl: 'Mijn opa is tachtig jaar oud.', exampleEs: 'Mi abuelo tiene ochenta años.', category: 'familie', difficulty: 'A0' },
        { id: 'oma', dutch: 'de oma', spanish: 'la abuela', article: 'de', emoji: '👵', color: '#0b4db5', exampleNl: 'Mijn oma woont in Spanje.', exampleEs: 'Mi abuela vive en España.', category: 'familie', difficulty: 'A0' },
        { id: 'oom', dutch: 'de oom', spanish: 'el tío', article: 'de', emoji: '🧔', color: '#0a3d9e', exampleNl: 'Mijn oom heet Carlos.', exampleEs: 'Mi tío se llama Carlos.', category: 'familie', difficulty: 'A0' },
        { id: 'tante', dutch: 'de tante', spanish: 'la tía', article: 'de', emoji: '👩‍🦱', color: '#1440a0', exampleNl: 'Mijn tante bakt graag taart.', exampleEs: 'A mi tía le gusta hacer tartas.', category: 'familie', difficulty: 'A0' },
        { id: 'neef', dutch: 'de neef', spanish: 'el primo / el sobrino', article: 'de', emoji: '👦', color: '#0d5bbf', exampleNl: 'Mijn neef studeert in Amsterdam.', exampleEs: 'Mi primo estudia en Ámsterdam.', category: 'familie', difficulty: 'A0' },
        { id: 'nicht', dutch: 'de nicht', spanish: 'la prima / la sobrina', article: 'de', emoji: '👧', color: '#1D0084', exampleNl: 'Mijn nicht is twaalf jaar oud.', exampleEs: 'Mi prima tiene doce años.', category: 'familie', difficulty: 'A0' },
        { id: 'vriend', dutch: 'de vriend', spanish: 'el amigo / el novio', article: 'de', emoji: '🤝', color: '#025dc7', exampleNl: 'Mijn beste vriend heet Daan.', exampleEs: 'Mi mejor amigo se llama Daan.', category: 'relaties', difficulty: 'A0' },
        { id: 'vriendin', dutch: 'de vriendin', spanish: 'la amiga / la novia', article: 'de', emoji: '💛', color: '#0b4db5', exampleNl: 'Mijn vriendin komt uit België.', exampleEs: 'Mi novia/amiga viene de Bélgica.', category: 'relaties', difficulty: 'A0' },
        { id: 'partner', dutch: 'de partner', spanish: 'la pareja', article: 'de', emoji: '💑', color: '#0a3d9e', exampleNl: 'Mijn partner werkt als architect.', exampleEs: 'Mi pareja trabaja como arquitecto/a.', category: 'relaties', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'pm2-1', dutch: 'Ik heb één broer en twee zussen.', spanish: 'Tengo un hermano y dos hermanas.', context: 'Familia' },
        { id: 'pm2-2', dutch: 'Mijn vader heet... en hij is...', spanish: 'Mi padre se llama... y es...', context: 'Descripción' },
        { id: 'pm2-3', dutch: 'Ze zijn al twintig jaar getrouwd.', spanish: 'Llevan veinte años casados.', context: 'Estado civil' },
        { id: 'pm2-4', dutch: 'Heb jij kinderen?', spanish: '¿Tienes hijos?', context: 'Preguntar' },
        { id: 'pm2-5', dutch: 'Mijn oma woont in Spanje maar belt elke week.', spanish: 'Mi abuela vive en España pero llama cada semana.', context: 'Familia a distancia' },
        { id: 'pm2-6', dutch: 'Wij zijn een grote, hechte familie.', spanish: 'Somos una familia grande y unida.', context: 'Familia' },
        { id: 'pm2-7', dutch: 'Mijn beste vriend ken ik al tien jaar.', spanish: 'Llevo diez años conociendo a mi mejor amigo.', context: 'Amistad' },
        { id: 'pm2-8', dutch: 'Zij is mijn vriendin, we zijn al twee jaar samen.', spanish: 'Ella es mi novia, llevamos dos años juntos.', context: 'Pareja' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        { id: 'em2-1', type: 'multiple_choice', prompt: '¿Cómo se dice "la abuela" en neerlandés?', options: ['opa', 'oma', 'tante', 'moeder'], correctAnswer: 'oma' },
        { id: 'em2-2', type: 'fill_blank', prompt: 'Ik heb één ___ en twee zussen. (hermano)', correctAnswer: 'broer' },
        { id: 'em2-3', type: 'multiple_choice', prompt: '"De dochter" significa:', options: ['el hijo', 'la madre', 'la hija', 'la hermana'], correctAnswer: 'la hija' },
        { id: 'em2-4', type: 'fill_blank', prompt: 'Mijn ___ studeert medicijnen. (hijo)', correctAnswer: 'zoon', hint: '"Kind" es neutro; "zoon" es hijo varón' },
        { id: 'em2-5', type: 'order_sentence', prompt: 'Ordena: "Mi madre trabaja como enfermera."', options: ['Mijn', 'moeder', 'werkt', 'als', 'verpleegkundige'], correctAnswer: 'Mijn moeder werkt als verpleegkundige' },
        { id: 'em2-6', type: 'multiple_choice', prompt: '"Neef" puede significar:', options: ['sobrino solamente', 'primo solamente', 'primo o sobrino', 'tío'], correctAnswer: 'primo o sobrino', explanation: '"Neef" cubre tanto primo como sobrino en neerlandés.' },
        { id: 'em2-7', type: 'fill_blank', prompt: 'Mijn beste ___ heet Daan. (amigo)', correctAnswer: 'vriend' },
        { id: 'em2-8', type: 'order_sentence', prompt: 'Ordena: "Tenemos dos hijos."', options: ['Wij', 'hebben', 'twee', 'kinderen'], correctAnswer: 'Wij hebben twee kinderen' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'dm2-1',
        title: 'Over de familie',
        context: 'Emma en Lars praten over hun families tijdens de koffiepauze.',
        lines: [
          { id: 'dm2-1-1', speaker: 'Emma', dutch: 'Lars, heb jij broers of zussen?', spanish: 'Lars, ¿tienes hermanos o hermanas?' },
          { id: 'dm2-1-2', speaker: 'Lars', dutch: 'Ja, ik heb één broer en één zus. Jij?', spanish: 'Sí, tengo un hermano y una hermana. ¿Y tú?' },
          { id: 'dm2-1-3', speaker: 'Emma', dutch: 'Ik ben enig kind. Maar ik heb veel neeven en nichten.', spanish: 'Soy hija única. Pero tengo muchos primos y primas.' },
          { id: 'dm2-1-4', speaker: 'Lars', dutch: 'Leuk! Wonen je ouders hier in Amsterdam?', spanish: '¡Qué bien! ¿Viven tus padres aquí en Ámsterdam?' },
          { id: 'dm2-1-5', speaker: 'Emma', dutch: 'Nee, mijn vader woont in Rotterdam en mijn moeder in Den Haag. Ze zijn gescheiden.', spanish: 'No, mi padre vive en Róterdam y mi madre en La Haya. Están divorciados.' },
          { id: 'dm2-1-6', speaker: 'Lars', dutch: 'Ah, oké. Mijn ouders wonen nog samen in Groningen.', spanish: 'Ah, vale. Mis padres todavía viven juntos en Groninga.' },
          { id: 'dm2-1-7', speaker: 'Emma', dutch: 'En heb jij een vriendin?', spanish: '¿Y tienes novia?' },
          { id: 'dm2-1-8', speaker: 'Lars', dutch: 'Ja! Ze heet Sara en ze komt uit Portugal. Jij?', spanish: 'Sí. Se llama Sara y es de Portugal. ¿Y tú?' },
          { id: 'dm2-1-9', speaker: 'Emma', dutch: 'Ik ben nog single, maar dat is prima zo!', spanish: 'Todavía estoy soltera, ¡pero así está bien!' },
          { id: 'dm2-1-10', speaker: 'Lars', dutch: 'Haha, dat begrijp ik. Vrijheid is ook fijn!', spanish: '¡Jaja, lo entiendo. La libertad también está bien!' },
        ],
      },
    },
    { type: 'review' },
  ],
};

const m2_les2: Lesson = {
  id: 'm2-les-2-zinsstructuur',
  moduleId: 'familie-vrienden',
  title: 'Les 2 — Grammatica | Zinsstructuur',
  subtitle: 'Estructura de la oración',
  order: 2,
  learningObjective: 'Construir frases correctas con la regla V2 del neerlandés',
  estimatedMinutes: 20,
  blocks: [
    {
      type: 'vocabulary',
      items: [
        { id: 'ook', dutch: 'ook', spanish: 'también', article: null, emoji: '➕', color: '#1D0084', exampleNl: 'Ik leer ook Duits.', exampleEs: 'También aprendo alemán.', category: 'zinsstructuur', difficulty: 'A0' },
        { id: 'niet', dutch: 'niet', spanish: 'no (negación)', article: null, emoji: '❌', color: '#025dc7', exampleNl: 'Ik werk vandaag niet.', exampleEs: 'Hoy no trabajo.', category: 'zinsstructuur', difficulty: 'A0' },
        { id: 'wel', dutch: 'wel', spanish: 'sí (énfasis afirmativo)', article: null, emoji: '✅', color: '#0b4db5', exampleNl: 'Ik ga wel naar de les.', exampleEs: 'Sí voy a clase.', category: 'zinsstructuur', difficulty: 'A1' },
        { id: 'maar', dutch: 'maar', spanish: 'pero', article: null, emoji: '↔️', color: '#0a3d9e', exampleNl: 'Hij werkt hard maar is altijd moe.', exampleEs: 'Trabaja duro pero siempre está cansado.', category: 'zinsstructuur', difficulty: 'A0' },
        { id: 'en', dutch: 'en', spanish: 'y', article: null, emoji: '🔗', color: '#1440a0', exampleNl: 'Ik woon en werk in Amsterdam.', exampleEs: 'Vivo y trabajo en Ámsterdam.', category: 'zinsstructuur', difficulty: 'A0' },
        { id: 'of', dutch: 'of', spanish: 'o', article: null, emoji: '⚖️', color: '#0d5bbf', exampleNl: 'Wil je koffie of thee?', exampleEs: '¿Quieres café o té?', category: 'zinsstructuur', difficulty: 'A0' },
        { id: 'want', dutch: 'want', spanish: 'porque (coordinante)', article: null, emoji: '💬', color: '#1D0084', exampleNl: 'Ik leer Nederlands, want ik woon hier.', exampleEs: 'Aprendo neerlandés porque vivo aquí.', category: 'zinsstructuur', difficulty: 'A1' },
        { id: 'dus', dutch: 'dus', spanish: 'entonces / por eso', article: null, emoji: '➡️', color: '#025dc7', exampleNl: 'Het regent, dus ik neem de bus.', exampleEs: 'Llueve, así que cojo el autobús.', category: 'zinsstructuur', difficulty: 'A1' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'pzin-1', dutch: 'Ik woon in Amsterdam en ik werk in Utrecht.', spanish: 'Vivo en Ámsterdam y trabajo en Utrecht.', context: 'Coordinación con "en"' },
        { id: 'pzin-2', dutch: 'Vandaag werk ik niet, maar morgen wel.', spanish: 'Hoy no trabajo, pero mañana sí.', context: 'Negación y afirmación' },
        { id: 'pzin-3', dutch: 'Ik leer Nederlands, want ik wil hier blijven.', spanish: 'Aprendo neerlandés porque quiero quedarme aquí.', context: 'Causa con "want"' },
        { id: 'pzin-4', dutch: 'Het is laat, dus ik ga naar huis.', spanish: 'Es tarde, así que me voy a casa.', context: 'Consecuencia con "dus"' },
        { id: 'pzin-5', dutch: 'Morgen ga ik naar de markt.', spanish: 'Mañana voy al mercado.', context: 'V2: adverbio al inicio' },
        { id: 'pzin-6', dutch: 'In Amsterdam wonen veel mensen.', spanish: 'En Ámsterdam viven mucha gente.', context: 'V2: lugar al inicio' },
        { id: 'pzin-7', dutch: 'Spreek jij ook Frans of alleen Nederlands?', spanish: '¿Hablas también francés o solo neerlandés?', context: 'Pregunta con "of"' },
        { id: 'pzin-8', dutch: 'Hij werkt hard, maar hij heeft wel plezier.', spanish: 'Trabaja duro, pero sí se divierte.', context: '"maar" + "wel"' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        { id: 'ezin-1', type: 'order_sentence', prompt: 'Ordena (regla V2): "Mañana voy a la clase."', options: ['Morgen', 'ga', 'ik', 'naar', 'de', 'les'], correctAnswer: 'Morgen ga ik naar de les' },
        { id: 'ezin-2', type: 'fill_blank', prompt: 'Ik leer Nederlands, ___ ik woon hier. (porque)', correctAnswer: 'want', hint: '"Want" no mueve el verbo; "omdat" sí lo mueve al final.' },
        { id: 'ezin-3', type: 'multiple_choice', prompt: '"Dus" en una frase indica:', options: ['causa', 'consecuencia', 'contraste', 'tiempo'], correctAnswer: 'consecuencia' },
        { id: 'ezin-4', type: 'order_sentence', prompt: 'Ordena: "En Bruselas también hablan neerlandés."', options: ['In', 'Brussel', 'spreken', 'ze', 'ook', 'Nederlands'], correctAnswer: 'In Brussel spreken ze ook Nederlands' },
        { id: 'ezin-5', type: 'fill_blank', prompt: 'Het regent, ___ ik neem de bus. (por eso)', correctAnswer: 'dus' },
        { id: 'ezin-6', type: 'multiple_choice', prompt: 'En la frase "Morgen ga ik werken", el verbo "ga" está en posición:', options: ['1', '2', '3', 'final'], correctAnswer: '2', explanation: 'Regla V2: el verbo conjugado siempre ocupa la segunda posición.' },
        { id: 'ezin-7', type: 'fill_blank', prompt: 'Vandaag werk ik ___, maar morgen wel. (no)', correctAnswer: 'niet' },
        { id: 'ezin-8', type: 'order_sentence', prompt: 'Ordena: "¿Quieres café o té?"', options: ['Wil', 'jij', 'koffie', 'of', 'thee'], correctAnswer: 'Wil jij koffie of thee' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'dm2-2',
        title: 'Plannen maken',
        context: 'Nadia en Tom bespreken hun plannen voor het weekend.',
        lines: [
          { id: 'dm2-2-1', speaker: 'Nadia', dutch: 'Tom, wat doe jij dit weekend?', spanish: 'Tom, ¿qué haces este fin de semana?' },
          { id: 'dm2-2-2', speaker: 'Tom', dutch: 'Zaterdag werk ik, maar zondag ben ik vrij.', spanish: 'El sábado trabajo, pero el domingo estoy libre.' },
          { id: 'dm2-2-3', speaker: 'Nadia', dutch: 'Wil jij zondag mee naar de markt?', spanish: '¿Quieres venir el domingo al mercado?' },
          { id: 'dm2-2-4', speaker: 'Tom', dutch: 'Ja, leuk! Hoe laat gaan jullie?', spanish: 'Sí, ¡qué bien! ¿A qué hora vais?' },
          { id: 'dm2-2-5', speaker: 'Nadia', dutch: "Om tien uur, want de markt sluit om twee uur.", spanish: 'A las diez, porque el mercado cierra a las dos.' },
          { id: 'dm2-2-6', speaker: 'Tom', dutch: 'Oké. Ga jij ook mee naar het café daarna?', spanish: 'Vale. ¿Vienes también al café después?' },
          { id: 'dm2-2-7', speaker: 'Nadia', dutch: 'Ja, maar ik moet om vier uur thuis zijn.', spanish: 'Sí, pero tengo que estar en casa a las cuatro.' },
          { id: 'dm2-2-8', speaker: 'Tom', dutch: 'Geen probleem. Tot zondag dan!', spanish: 'Sin problema. ¡Hasta el domingo entonces!' },
        ],
      },
    },
    { type: 'review' },
  ],
};

const m2_les3: Lesson = {
  id: 'm2-les-3-kalender',
  moduleId: 'familie-vrienden',
  title: 'Les 3 — Woordenschat | Kalender & tijd',
  subtitle: 'Calendario y tiempo',
  order: 3,
  learningObjective: 'Hablar de fechas, días, horas y momentos del día',
  estimatedMinutes: 20,
  blocks: [
    {
      type: 'vocabulary',
      items: [
        { id: 'ochtend', dutch: 'de ochtend', spanish: 'la mañana (hasta mediodía)', article: 'de', emoji: '🌅', color: '#1D0084', exampleNl: 'Ik drink koffie in de ochtend.', exampleEs: 'Bebo café por la mañana.', category: 'tijd', difficulty: 'A0' },
        { id: 'middag', dutch: 'de middag', spanish: 'el mediodía / la tarde', article: 'de', emoji: '☀️', color: '#025dc7', exampleNl: 'We eten samen in de middag.', exampleEs: 'Comemos juntos al mediodía.', category: 'tijd', difficulty: 'A0' },
        { id: 'avond', dutch: 'de avond', spanish: 'la tarde-noche', article: 'de', emoji: '🌆', color: '#0b4db5', exampleNl: 'In de avond kijk ik tv.', exampleEs: 'Por la tarde-noche veo la tele.', category: 'tijd', difficulty: 'A0' },
        { id: 'nacht', dutch: 'de nacht', spanish: 'la noche', article: 'de', emoji: '🌙', color: '#0a3d9e', exampleNl: 'Ik slaap goed s nachts.', exampleEs: 'Duermo bien por la noche.', category: 'tijd', difficulty: 'A0' },
        { id: 'vandaag', dutch: 'vandaag', spanish: 'hoy', article: null, emoji: '📅', color: '#1440a0', exampleNl: 'Vandaag heb ik les.', exampleEs: 'Hoy tengo clase.', category: 'tijd', difficulty: 'A0' },
        { id: 'morgen', dutch: 'morgen', spanish: 'mañana (día siguiente)', article: null, emoji: '⏭️', color: '#0d5bbf', exampleNl: 'Morgen ga ik naar de tandarts.', exampleEs: 'Mañana voy al dentista.', category: 'tijd', difficulty: 'A0' },
        { id: 'gisteren', dutch: 'gisteren', spanish: 'ayer', article: null, emoji: '⏮️', color: '#1D0084', exampleNl: 'Gisteren was het koud.', exampleEs: 'Ayer hacía frío.', category: 'tijd', difficulty: 'A0' },
        { id: 'week', dutch: 'de week', spanish: 'la semana', article: 'de', emoji: '📆', color: '#025dc7', exampleNl: 'Deze week heb ik drie lessen.', exampleEs: 'Esta semana tengo tres clases.', category: 'tijd', difficulty: 'A0' },
        { id: 'maand', dutch: 'de maand', spanish: 'el mes', article: 'de', emoji: '🗓️', color: '#0b4db5', exampleNl: 'Deze maand ga ik op vakantie.', exampleEs: 'Este mes me voy de vacaciones.', category: 'tijd', difficulty: 'A0' },
        { id: 'jaar', dutch: 'het jaar', spanish: 'el año', article: 'het', emoji: '🎆', color: '#0a3d9e', exampleNl: 'Volgend jaar wil ik naar Nederland.', exampleEs: 'El año que viene quiero ir a los Países Bajos.', category: 'tijd', difficulty: 'A0' },
        { id: 'uur', dutch: 'het uur', spanish: 'la hora', article: 'het', emoji: '🕐', color: '#1440a0', exampleNl: 'De les duurt een uur.', exampleEs: 'La clase dura una hora.', category: 'tijd', difficulty: 'A0' },
        { id: 'minuut', dutch: 'de minuut', spanish: 'el minuto', article: 'de', emoji: '⏱️', color: '#0d5bbf', exampleNl: 'Wacht even, vijf minuten.', exampleEs: 'Espera un momento, cinco minutos.', category: 'tijd', difficulty: 'A0' },
        { id: 'vroeg', dutch: 'vroeg', spanish: 'temprano', article: null, emoji: '🐓', color: '#1D0084', exampleNl: 'Ik sta vroeg op.', exampleEs: 'Me levanto temprano.', category: 'tijd', difficulty: 'A0' },
        { id: 'laat', dutch: 'laat', spanish: 'tarde (adv.)', article: null, emoji: '🦉', color: '#025dc7', exampleNl: 'Ik ga laat naar bed.', exampleEs: 'Me acuesto tarde.', category: 'tijd', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'pkal-1', dutch: 'Hoe laat is het?', spanish: '¿Qué hora es?', context: 'Preguntar la hora' },
        { id: 'pkal-2', dutch: 'Het is half drie.', spanish: 'Son las dos y media.', context: 'Decir la hora' },
        { id: 'pkal-3', dutch: 'De vergadering begint om kwart over negen.', spanish: 'La reunión empieza a las nueve y cuarto.', context: 'Hora exacta' },
        { id: 'pkal-4', dutch: 'Gisteren was ik ziek, maar vandaag gaat het beter.', spanish: 'Ayer estaba enfermo/a, pero hoy estoy mejor.', context: 'Tiempo relativo' },
        { id: 'pkal-5', dutch: "Ik werk van maandag tot en met vrijdag.", spanish: 'Trabajo de lunes a viernes.', context: 'Horario laboral' },
        { id: 'pkal-6', dutch: 'In de ochtend lees ik de krant.', spanish: 'Por la mañana leo el periódico.', context: 'Rutina' },
        { id: 'pkal-7', dutch: 'Volgende week hebben we een toets.', spanish: 'La semana que viene tenemos un examen.', context: 'Futuro próximo' },
        { id: 'pkal-8', dutch: 'Ik sta altijd vroeg op, om zes uur.', spanish: 'Siempre me levanto temprano, a las seis.', context: 'Rutina' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        { id: 'ekal-1', type: 'multiple_choice', prompt: '¿Cómo se dice "ayer" en neerlandés?', options: ['morgen', 'gisteren', 'vandaag', 'vroeg'], correctAnswer: 'gisteren' },
        { id: 'ekal-2', type: 'fill_blank', prompt: 'Hoe laat is het? Het is ___ drie. (y media → 2:30)', correctAnswer: 'half', hint: 'En neerlandés, "half drie" = las dos y media (mitad antes de las tres)' },
        { id: 'ekal-3', type: 'multiple_choice', prompt: '"Avond" significa:', options: ['mañana', 'mediodía', 'tarde-noche', 'noche de madrugada'], correctAnswer: 'tarde-noche' },
        { id: 'ekal-4', type: 'fill_blank', prompt: 'De les duurt een ___. (hora)', correctAnswer: 'uur' },
        { id: 'ekal-5', type: 'order_sentence', prompt: 'Ordena: "La semana que viene tenemos un examen."', options: ['Volgende', 'week', 'hebben', 'we', 'een', 'toets'], correctAnswer: 'Volgende week hebben we een toets' },
        { id: 'ekal-6', type: 'multiple_choice', prompt: '"Half vier" en neerlandés son:', options: ['las cuatro en punto', 'las cuatro y media', 'las tres y media', 'las cuatro menos cuarto'], correctAnswer: 'las tres y media', explanation: '"Half vier" = mitad antes de las cuatro = 3:30.' },
        { id: 'ekal-7', type: 'fill_blank', prompt: '___ ga ik naar de markt. (mañana)', correctAnswer: 'Morgen' },
        { id: 'ekal-8', type: 'multiple_choice', prompt: '¿Qué significa "Ik sta vroeg op"?', options: ['Me acuesto tarde', 'Me levanto temprano', 'Llego tarde', 'Salgo pronto'], correctAnswer: 'Me levanto temprano' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'dm2-3',
        title: 'Een afspraak maken',
        context: 'Julia en Bas proberen een afspraak te maken voor de week.',
        lines: [
          { id: 'dm2-3-1', speaker: 'Julia', dutch: 'Hoi Bas! Wanneer kunnen we afspreken?', spanish: 'Hola Bas, ¿cuándo podemos quedar?' },
          { id: 'dm2-3-2', speaker: 'Bas', dutch: 'Deze week is druk. Maandag en dinsdag werk ik.', spanish: 'Esta semana tengo mucho. El lunes y el martes trabajo.' },
          { id: 'dm2-3-3', speaker: 'Julia', dutch: 'Woensdag dan? In de ochtend ben ik vrij.', spanish: '¿El miércoles entonces? Por la mañana estoy libre.' },
          { id: 'dm2-3-4', speaker: 'Bas', dutch: "Woensdag ochtend lukt! Hoe laat?", spanish: '¡El miércoles por la mañana puede! ¿A qué hora?' },
          { id: 'dm2-3-5', speaker: 'Julia', dutch: 'Om half elf? Dan kunnen we koffie drinken.', spanish: '¿A las diez y media? Así podemos tomar café.' },
          { id: 'dm2-3-6', speaker: 'Bas', dutch: 'Super. En waar spreken we af?', spanish: 'Genial. ¿Y dónde quedamos?' },
          { id: 'dm2-3-7', speaker: 'Julia', dutch: 'Bij het café op het Leidseplein. Ken jij dat?', spanish: 'En el café del Leidseplein. ¿Lo conoces?' },
          { id: 'dm2-3-8', speaker: 'Bas', dutch: 'Ja! Tot woensdag dan. Niet te laat, hoor!', spanish: '¡Sí! Hasta el miércoles entonces. ¡Sin llegar tarde, eh!' },
        ],
      },
    },
    { type: 'review' },
  ],
};

const m2_les4: Lesson = {
  id: 'm2-les-4-lidwoorden',
  moduleId: 'familie-vrienden',
  title: 'Les 4 — Grammatica | Lidwoorden',
  subtitle: 'Los artículos: de y het',
  order: 4,
  learningObjective: 'Usar correctamente de y het con sustantivos',
  estimatedMinutes: 20,
  blocks: [
    {
      type: 'vocabulary',
      items: [
        { id: 'lid-huis', dutch: 'het huis', spanish: 'la casa', article: 'het', emoji: '🏠', color: '#1D0084', exampleNl: 'Het huis is groot.', exampleEs: 'La casa es grande.', category: 'lidwoorden', difficulty: 'A0' },
        { id: 'lid-boek', dutch: 'het boek', spanish: 'el libro', article: 'het', emoji: '📕', color: '#025dc7', exampleNl: 'Het boek is interessant.', exampleEs: 'El libro es interesante.', category: 'lidwoorden', difficulty: 'A0' },
        { id: 'lid-kind2', dutch: 'het kind', spanish: 'el/la niño/niña', article: 'het', emoji: '🧒', color: '#0b4db5', exampleNl: 'Het kind speelt buiten.', exampleEs: 'El niño juega fuera.', category: 'lidwoorden', difficulty: 'A0' },
        { id: 'lid-water', dutch: 'het water', spanish: 'el agua', article: 'het', emoji: '💧', color: '#0a3d9e', exampleNl: 'Het water is koud.', exampleEs: 'El agua está fría.', category: 'lidwoorden', difficulty: 'A0' },
        { id: 'lid-leven', dutch: 'het leven', spanish: 'la vida', article: 'het', emoji: '✨', color: '#1440a0', exampleNl: 'Het leven is mooi.', exampleEs: 'La vida es bonita.', category: 'lidwoorden', difficulty: 'A0' },
        { id: 'lid-auto', dutch: 'de auto', spanish: 'el coche', article: 'de', emoji: '🚗', color: '#0d5bbf', exampleNl: 'De auto is rood.', exampleEs: 'El coche es rojo.', category: 'lidwoorden', difficulty: 'A0' },
        { id: 'lid-fiets', dutch: 'de fiets', spanish: 'la bicicleta', article: 'de', emoji: '🚲', color: '#1D0084', exampleNl: 'De fiets staat voor de deur.', exampleEs: 'La bici está en la puerta.', category: 'lidwoorden', difficulty: 'A0' },
        { id: 'lid-stad', dutch: 'de stad', spanish: 'la ciudad', article: 'de', emoji: '🏙️', color: '#025dc7', exampleNl: 'Amsterdam is een mooie stad.', exampleEs: 'Ámsterdam es una ciudad bonita.', category: 'lidwoorden', difficulty: 'A0' },
        { id: 'lid-school', dutch: 'de school', spanish: 'la escuela', article: 'de', emoji: '🏫', color: '#0b4db5', exampleNl: 'De school begint om acht uur.', exampleEs: 'La escuela empieza a las ocho.', category: 'lidwoorden', difficulty: 'A0' },
        { id: 'lid-taal2', dutch: 'de taal', spanish: 'el idioma', article: 'de', emoji: '💬', color: '#0a3d9e', exampleNl: 'De taal is moeilijk maar leuk.', exampleEs: 'El idioma es difícil pero interesante.', category: 'lidwoorden', difficulty: 'A0' },
        { id: 'lid-dag', dutch: 'de dag', spanish: 'el día', article: 'de', emoji: '🌤️', color: '#1440a0', exampleNl: 'De dag begint vroeg.', exampleEs: 'El día empieza temprano.', category: 'lidwoorden', difficulty: 'A0' },
        { id: 'lid-werk', dutch: 'het werk', spanish: 'el trabajo', article: 'het', emoji: '🏢', color: '#0d5bbf', exampleNl: 'Het werk is vandaag klaar.', exampleEs: 'El trabajo está hecho hoy.', category: 'lidwoorden', difficulty: 'A0' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'plid-1', dutch: 'De fiets is een typisch Nederlands vervoermiddel.', spanish: 'La bicicleta es un medio de transporte típicamente neerlandés.', context: 'Cultura' },
        { id: 'plid-2', dutch: 'Het boek ligt op de tafel.', spanish: 'El libro está encima de la mesa.', context: 'Ubicación' },
        { id: 'plid-3', dutch: 'De stad Amsterdam is beroemd om zijn grachten.', spanish: 'La ciudad de Ámsterdam es famosa por sus canales.', context: 'Descripción' },
        { id: 'plid-4', dutch: 'Ik wil een huis kopen in Nederland.', spanish: 'Quiero comprar una casa en los Países Bajos.', context: 'Artículo indefinido' },
        { id: 'plid-5', dutch: 'Het water in de gracht is niet schoon.', spanish: 'El agua en el canal no está limpia.', context: 'het + de combinados' },
        { id: 'plid-6', dutch: 'Een kind heeft een school nodig.', spanish: 'Un niño necesita una escuela.', context: 'Artículo indefinido' },
        { id: 'plid-7', dutch: 'De dag gaat snel voorbij als je hard werkt.', spanish: 'El día pasa rápido cuando trabajas duro.', context: 'Expresión' },
        { id: 'plid-8', dutch: 'Het leven in Amsterdam is duur maar leuk.', spanish: 'La vida en Ámsterdam es cara pero agradable.', context: 'Opinión' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        { id: 'elid-1', type: 'multiple_choice', prompt: '¿Qué artículo lleva "boek" (libro)?', options: ['de', 'het', 'een', 'geen'], correctAnswer: 'het', explanation: '"Het boek" — los diminutivos y los neutros suelen llevar "het".' },
        { id: 'elid-2', type: 'fill_blank', prompt: '___ fiets staat voor de deur. (la bici)', correctAnswer: 'De', hint: '"Fiets" es un sustantivo "de".' },
        { id: 'elid-3', type: 'multiple_choice', prompt: '"De stad" significa:', options: ['el estado', 'la ciudad', 'la tienda', 'la calle'], correctAnswer: 'la ciudad' },
        { id: 'elid-4', type: 'fill_blank', prompt: '___ kind speelt buiten. (el niño)', correctAnswer: 'Het', hint: '"Kind" lleva siempre "het".' },
        { id: 'elid-5', type: 'multiple_choice', prompt: '¿Qué artículo lleva "water" (agua)?', options: ['de', 'het', 'los dos'], correctAnswer: 'het' },
        { id: 'elid-6', type: 'fill_blank', prompt: 'Amsterdam is een mooie ___. (ciudad)', correctAnswer: 'stad' },
        { id: 'elid-7', type: 'multiple_choice', prompt: '¿Cuándo se usa "een" en neerlandés?', options: ['Con sustantivos conocidos', 'Con sustantivos no específicos / primera mención', 'Solo con "het"', 'Nunca'], correctAnswer: 'Con sustantivos no específicos / primera mención' },
        { id: 'elid-8', type: 'order_sentence', prompt: 'Ordena: "El libro está sobre la mesa."', options: ['Het', 'boek', 'ligt', 'op', 'de', 'tafel'], correctAnswer: 'Het boek ligt op de tafel' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'dm2-4',
        title: 'Een nieuwe woning',
        context: 'Sara zoekt een appartement in Amsterdam en spreekt met een makelaar.',
        lines: [
          { id: 'dm2-4-1', speaker: 'Makelaar', dutch: 'Goedemiddag! Welk type woning zoekt u?', spanish: '¡Buenas tardes! ¿Qué tipo de vivienda busca?' },
          { id: 'dm2-4-2', speaker: 'Sara', dutch: 'Ik zoek een appartement met twee kamers.', spanish: 'Busco un apartamento con dos habitaciones.' },
          { id: 'dm2-4-3', speaker: 'Makelaar', dutch: 'Heeft u een budget in gedachten?', spanish: '¿Tiene un presupuesto en mente?' },
          { id: 'dm2-4-4', speaker: 'Sara', dutch: 'Ja, maximaal duizend euro per maand.', spanish: 'Sí, máximo mil euros al mes.' },
          { id: 'dm2-4-5', speaker: 'Makelaar', dutch: 'Ik heb een mooie woning in het centrum. Het huis heeft een grote keuken.', spanish: 'Tengo una bonita vivienda en el centro. La casa tiene una cocina grande.' },
          { id: 'dm2-4-6', speaker: 'Sara', dutch: 'Is het huis dicht bij de school of het station?', spanish: '¿La casa está cerca de la escuela o de la estación?' },
          { id: 'dm2-4-7', speaker: 'Makelaar', dutch: 'Het station is op vijf minuten lopen. De school is iets verder.', spanish: 'La estación está a cinco minutos andando. La escuela está un poco más lejos.' },
          { id: 'dm2-4-8', speaker: 'Sara', dutch: 'Kan ik het appartement deze week bekijken?', spanish: '¿Puedo ver el apartamento esta semana?' },
        ],
      },
    },
    { type: 'review' },
  ],
};

const m2_les5: Lesson = {
  id: 'm2-les-5-voorzetsels',
  moduleId: 'familie-vrienden',
  title: 'Les 5 — Grammatica | Voorzetsels van tijd',
  subtitle: 'Preposiciones de tiempo',
  order: 5,
  learningObjective: 'Usar correctamente las preposiciones de tiempo: op, in, om, van...tot',
  estimatedMinutes: 15,
  blocks: [
    {
      type: 'vocabulary',
      items: [
        { id: 'prep-op', dutch: 'op', spanish: 'en (día de la semana / fecha)', article: null, emoji: '📅', color: '#1D0084', exampleNl: 'Op maandag heb ik les.', exampleEs: 'El lunes tengo clase.', category: 'voorzetsels', difficulty: 'A0' },
        { id: 'prep-in', dutch: 'in', spanish: 'en (mes, año, estación)', article: null, emoji: '🗓️', color: '#025dc7', exampleNl: 'In januari is het koud.', exampleEs: 'En enero hace frío.', category: 'voorzetsels', difficulty: 'A0' },
        { id: 'prep-om', dutch: 'om', spanish: 'a las (hora exacta)', article: null, emoji: '🕐', color: '#0b4db5', exampleNl: 'De les begint om negen uur.', exampleEs: 'La clase empieza a las nueve.', category: 'voorzetsels', difficulty: 'A0' },
        { id: 'prep-vanaf', dutch: 'vanaf', spanish: 'desde (punto de inicio)', article: null, emoji: '▶️', color: '#0a3d9e', exampleNl: 'Vanaf maandag werk ik thuis.', exampleEs: 'Desde el lunes trabajo en casa.', category: 'voorzetsels', difficulty: 'A1' },
        { id: 'prep-tot', dutch: 'tot', spanish: 'hasta', article: null, emoji: '⏹️', color: '#1440a0', exampleNl: 'Ik werk tot vijf uur.', exampleEs: 'Trabajo hasta las cinco.', category: 'voorzetsels', difficulty: 'A0' },
        { id: 'prep-van-tot', dutch: 'van ... tot', spanish: 'de ... a (rango de tiempo)', article: null, emoji: '↔️', color: '#0d5bbf', exampleNl: 'Ik werk van negen tot vijf.', exampleEs: 'Trabajo de nueve a cinco.', category: 'voorzetsels', difficulty: 'A0' },
        { id: 'prep-voor', dutch: 'voor', spanish: 'antes de', article: null, emoji: '⏪', color: '#1D0084', exampleNl: 'Voor de les drink ik koffie.', exampleEs: 'Antes de la clase bebo café.', category: 'voorzetsels', difficulty: 'A0' },
        { id: 'prep-na', dutch: 'na', spanish: 'después de', article: null, emoji: '⏩', color: '#025dc7', exampleNl: 'Na het eten ga ik wandelen.', exampleEs: 'Después de comer voy a pasear.', category: 'voorzetsels', difficulty: 'A0' },
        { id: 'prep-tijdens', dutch: 'tijdens', spanish: 'durante', article: null, emoji: '⏸️', color: '#0b4db5', exampleNl: 'Tijdens de les luister ik goed.', exampleEs: 'Durante la clase escucho bien.', category: 'voorzetsels', difficulty: 'A1' },
        { id: 'prep-al', dutch: 'al', spanish: 'ya / desde hace', article: null, emoji: '✅', color: '#0a3d9e', exampleNl: 'Ik woon hier al twee jaar.', exampleEs: 'Llevo dos años viviendo aquí.', category: 'voorzetsels', difficulty: 'A1' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'pprep-1', dutch: 'Op zondag rust ik altijd uit.', spanish: 'Los domingos siempre descanso.', context: '"op" con día' },
        { id: 'pprep-2', dutch: 'In de zomer ga ik naar Spanje.', spanish: 'En verano voy a España.', context: '"in" con estación' },
        { id: 'pprep-3', dutch: 'Om zeven uur sta ik op.', spanish: 'A las siete me levanto.', context: '"om" con hora' },
        { id: 'pprep-4', dutch: 'Ik werk van negen uur tot vijf uur.', spanish: 'Trabajo de nueve a cinco.', context: '"van...tot"' },
        { id: 'pprep-5', dutch: 'Voor het slapen gaan poets ik mijn tanden.', spanish: 'Antes de acostarme me lavo los dientes.', context: '"voor"' },
        { id: 'pprep-6', dutch: 'Na het werk ga ik naar de sportschool.', spanish: 'Después del trabajo voy al gimnasio.', context: '"na"' },
        { id: 'pprep-7', dutch: 'Tijdens het eten praten we over de dag.', spanish: 'Durante la comida hablamos del día.', context: '"tijdens"' },
        { id: 'pprep-8', dutch: 'Ik woon hier al drie jaar.', spanish: 'Llevo tres años viviendo aquí.', context: '"al" + tiempo' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        { id: 'eprep-1', type: 'multiple_choice', prompt: '¿Qué preposición usas para decir "el lunes tengo clase"?', options: ['in', 'om', 'op', 'voor'], correctAnswer: 'op', explanation: '"Op" se usa con días de la semana.' },
        { id: 'eprep-2', type: 'fill_blank', prompt: 'De les begint ___ negen uur. (a las)', correctAnswer: 'om', hint: '"Om" se usa para horas exactas.' },
        { id: 'eprep-3', type: 'multiple_choice', prompt: '"In januari" significa:', options: ['el enero', 'en enero', 'hasta enero', 'desde enero'], correctAnswer: 'en enero' },
        { id: 'eprep-4', type: 'fill_blank', prompt: 'Ik werk ___ negen ___ vijf. (de...a)', correctAnswer: 'van / tot', hint: '"Van ... tot" = de ... a' },
        { id: 'eprep-5', type: 'order_sentence', prompt: 'Ordena: "Después del trabajo voy al gimnasio."', options: ['Na', 'het', 'werk', 'ga', 'ik', 'naar', 'de', 'sportschool'], correctAnswer: 'Na het werk ga ik naar de sportschool' },
        { id: 'eprep-6', type: 'multiple_choice', prompt: '"Tijdens de les" significa:', options: ['antes de la clase', 'después de la clase', 'durante la clase', 'sin clase'], correctAnswer: 'durante la clase' },
        { id: 'eprep-7', type: 'fill_blank', prompt: 'Ik woon hier ___ twee jaar. (desde hace)', correctAnswer: 'al' },
        { id: 'eprep-8', type: 'multiple_choice', prompt: '¿Qué preposición usas con meses y años?', options: ['op', 'om', 'in', 'tot'], correctAnswer: 'in' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'dm2-5',
        title: 'De dagelijkse routine',
        context: 'Rosa vertelt haar vriendin over haar dagindeling.',
        lines: [
          { id: 'dm2-5-1', speaker: 'Vriendin', dutch: 'Hoi Rosa! Hoe ziet jouw dag eruit?', spanish: '¡Hola Rosa! ¿Cómo es tu día?' },
          { id: 'dm2-5-2', speaker: 'Rosa', dutch: "Om zes uur sta ik op. Daarna doucheer ik en eet ik ontbijt.", spanish: 'Me levanto a las seis. Luego me ducho y desayuno.' },
          { id: 'dm2-5-3', speaker: 'Vriendin', dutch: 'En hoe laat begin je met werken?', spanish: '¿Y a qué hora empiezas a trabajar?' },
          { id: 'dm2-5-4', speaker: 'Rosa', dutch: 'Van negen tot vijf. Maar op maandag heb ik een vroege vergadering om acht uur.', spanish: 'De nueve a cinco. Pero los lunes tengo una reunión temprana a las ocho.' },
          { id: 'dm2-5-5', speaker: 'Vriendin', dutch: 'Dat is vroeg! En na het werk?', spanish: '¡Eso es temprano! ¿Y después del trabajo?' },
          { id: 'dm2-5-6', speaker: 'Rosa', dutch: "Op dinsdag en donderdag ga ik naar de sportschool. De andere dagen rust ik uit.", spanish: 'Los martes y jueves voy al gimnasio. Los otros días descanso.' },
          { id: 'dm2-5-7', speaker: 'Vriendin', dutch: 'En in het weekend?', spanish: '¿Y el fin de semana?' },
          { id: 'dm2-5-8', speaker: 'Rosa', dutch: 'Op zaterdag slaap ik lekker uit en op zondag bezoek ik mijn familie.', spanish: 'El sábado duermo bien entrada la mañana y el domingo visito a mi familia.' },
        ],
      },
    },
    { type: 'review' },
  ],
};

const m2_les6: Lesson = {
  id: 'm2-les-6-uitspraak-tweeklanken',
  moduleId: 'familie-vrienden',
  title: 'Les 6 — Uitspraak | ei – ij & ui',
  subtitle: 'Pronunciación: los diptongos',
  order: 6,
  learningObjective: 'Pronunciar correctamente los diptongos ei/ij y ui en neerlandés',
  estimatedMinutes: 15,
  blocks: [
    {
      type: 'vocabulary',
      items: [
        { id: 'tijd', dutch: 'tijd', spanish: 'tiempo (ij)', article: 'de', emoji: '⏰', color: '#1D0084', exampleNl: 'Ik heb geen tijd.', exampleEs: 'No tengo tiempo.', category: 'uitspraak', difficulty: 'A0' },
        { id: 'wijn', dutch: 'wijn', spanish: 'vino (ij)', article: 'de', emoji: '🍷', color: '#025dc7', exampleNl: 'Een glas wijn, alsjeblieft.', exampleEs: 'Una copa de vino, por favor.', category: 'uitspraak', difficulty: 'A0' },
        { id: 'fijn', dutch: 'fijn', spanish: 'agradable / fino (ij)', article: null, emoji: '😊', color: '#0b4db5', exampleNl: 'Wat fijn dat je er bent!', exampleEs: '¡Qué bien que estés aquí!', category: 'uitspraak', difficulty: 'A0' },
        { id: 'prijs', dutch: 'prijs', spanish: 'precio / premio (ij)', article: 'de', emoji: '🏷️', color: '#0a3d9e', exampleNl: 'Wat is de prijs?', exampleEs: '¿Cuál es el precio?', category: 'uitspraak', difficulty: 'A0' },
        { id: 'mijn', dutch: 'mijn', spanish: 'mi / mío (ij)', article: null, emoji: '👤', color: '#1440a0', exampleNl: 'Dit is mijn boek.', exampleEs: 'Este es mi libro.', category: 'uitspraak', difficulty: 'A0' },
        { id: 'klein', dutch: 'klein', spanish: 'pequeño (ei)', article: null, emoji: '🐭', color: '#0d5bbf', exampleNl: 'Het kind is klein.', exampleEs: 'El niño es pequeño.', category: 'uitspraak', difficulty: 'A0' },
        { id: 'trein', dutch: 'trein', spanish: 'tren (ei)', article: 'de', emoji: '🚂', color: '#1D0084', exampleNl: 'Ik neem de trein naar Utrecht.', exampleEs: 'Cojo el tren a Utrecht.', category: 'uitspraak', difficulty: 'A0' },
        { id: 'huis', dutch: 'huis', spanish: 'casa (ui)', article: 'het', emoji: '🏠', color: '#025dc7', exampleNl: 'Het huis is groot.', exampleEs: 'La casa es grande.', category: 'uitspraak', difficulty: 'A0' },
        { id: 'buiten', dutch: 'buiten', spanish: 'fuera / exterior (ui)', article: null, emoji: '🌳', color: '#0b4db5', exampleNl: 'De kinderen spelen buiten.', exampleEs: 'Los niños juegan fuera.', category: 'uitspraak', difficulty: 'A0' },
        { id: 'fruit', dutch: 'fruit', spanish: 'fruta (ui)', article: 'het', emoji: '🍎', color: '#0a3d9e', exampleNl: 'Ik eet elke dag fruit.', exampleEs: 'Como fruta cada día.', category: 'uitspraak', difficulty: 'A0' },
        { id: 'uit', dutch: 'uit', spanish: 'de / fuera (ui)', article: null, emoji: '🚪', color: '#1440a0', exampleNl: 'Ik kom uit Spanje.', exampleEs: 'Soy de España.', category: 'uitspraak', difficulty: 'A0' },
        { id: 'kruis', dutch: 'kruis', spanish: 'cruz (ui)', article: 'het', emoji: '✝️', color: '#0d5bbf', exampleNl: 'Zet een kruis bij het juiste antwoord.', exampleEs: 'Marca con una cruz la respuesta correcta.', category: 'uitspraak', difficulty: 'A1' },
      ],
    },
    {
      type: 'phrases',
      items: [
        { id: 'ptw-1', dutch: 'De trein vertrekt op tijd.', spanish: 'El tren sale a tiempo.', context: 'ij en "tijd" y "trein"' },
        { id: 'ptw-2', dutch: 'Mijn huis is klein maar fijn.', spanish: 'Mi casa es pequeña pero agradable.', context: 'ij/ei + ui combinados' },
        { id: 'ptw-3', dutch: 'Ik drink graag een glas wijn.', spanish: 'Me gusta beber una copa de vino.', context: 'ij en "wijn"' },
        { id: 'ptw-4', dutch: 'De kinderen spelen buiten in de tuin.', spanish: 'Los niños juegan fuera en el jardín.', context: 'ui en "buiten/tuin"' },
        { id: 'ptw-5', dutch: 'Wat is de prijs van dit fruit?', spanish: '¿Cuál es el precio de esta fruta?', context: 'ij + ui en frase' },
        { id: 'ptw-6', dutch: 'Ik kom uit een klein dorpje in Spanje.', spanish: 'Soy de un pequeño pueblo de España.', context: 'ui + ei/ij combinados' },
      ],
    },
    {
      type: 'practice',
      exercises: [
        { id: 'etw-1', type: 'multiple_choice', prompt: '"Tijd" (tiempo) contiene el diptongo:', options: ['ei', 'ij', 'ui', 'ou'], correctAnswer: 'ij', explanation: '"Tijd" → t-ij-d. El diptongo ij suena igual que ei.' },
        { id: 'etw-2', type: 'multiple_choice', prompt: '¿Cuál de estas palabras tiene el diptongo "ui"?', options: ['trein', 'wijn', 'huis', 'klein'], correctAnswer: 'huis' },
        { id: 'etw-3', type: 'fill_blank', prompt: 'Ik neem de ___ naar Amsterdam. (tren)', correctAnswer: 'trein' },
        { id: 'etw-4', type: 'multiple_choice', prompt: '"Ei" y "ij" en neerlandés:', options: ['suenan diferente', 'suenan igual', '"ei" es más cerrado', '"ij" es más abierto'], correctAnswer: 'suenan igual', explanation: 'En el neerlandés moderno, ei e ij tienen exactamente la misma pronunciación.' },
        { id: 'etw-5', type: 'fill_blank', prompt: 'Het ___ is groot. (casa)', correctAnswer: 'huis' },
        { id: 'etw-6', type: 'multiple_choice', prompt: '"Fijn" en neerlandés significa:', options: ['fino', 'agradable / bien', 'pequeño', 'mío'], correctAnswer: 'agradable / bien' },
      ],
    },
    {
      type: 'dialogue',
      dialogue: {
        id: 'dm2-6',
        title: 'Op het station',
        context: 'Lisa vraagt informatie op het treinstation.',
        lines: [
          { id: 'dm2-6-1', speaker: 'Lisa', dutch: 'Pardon, vertrekt de trein naar Utrecht op tijd?', spanish: 'Perdone, ¿el tren a Utrecht sale a tiempo?' },
          { id: 'dm2-6-2', speaker: 'Medewerker', dutch: 'Ja, de trein vertrekt over vijf minuten van spoor vijf.', spanish: 'Sí, el tren sale en cinco minutos desde el andén cinco.' },
          { id: 'dm2-6-3', speaker: 'Lisa', dutch: 'En hoe laat komt hij aan in Utrecht?', spanish: '¿Y a qué hora llega a Utrecht?' },
          { id: 'dm2-6-4', speaker: 'Medewerker', dutch: 'Om half twee. Het is een kleine veertig minuten.', spanish: 'A la una y media. Son unos cuarenta minutos.' },
          { id: 'dm2-6-5', speaker: 'Lisa', dutch: 'Fijn! En wat is de prijs van een kaartje?', spanish: '¡Perfecto! ¿Y cuál es el precio de un billete?' },
          { id: 'dm2-6-6', speaker: 'Medewerker', dutch: 'Een enkeltje kost negen euro vijftig.', spanish: 'Un billete sencillo cuesta nueve euros cincuenta.' },
          { id: 'dm2-6-7', speaker: 'Lisa', dutch: 'Kan ik buiten bij de automaat betalen?', spanish: '¿Puedo pagar fuera en la máquina?' },
          { id: 'dm2-6-8', speaker: 'Medewerker', dutch: 'Ja, of u kunt ook online betalen. Fijne reis!', spanish: 'Sí, o también puede pagar online. ¡Buen viaje!' },
        ],
      },
    },
    { type: 'review' },
  ],
};

/* ── MODULE 2 EXTRAS ─────────────────────────────────────────────────────── */

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
        { id: 'm3lz-9', type: 'fill_blank', prompt: 'Het is goed om elke dag genoeg ___ te drinken. (agua)', correctAnswer: 'water', hint: 'agua = water', explanation: 'Conviene beber suficiente water (agua) cada día.' },
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
        { id: 'm3l2lz-5', type: 'fill_blank', prompt: 'Mag ik de ___, alstublieft? (la cuenta)', correctAnswer: 'rekening', hint: 'la cuenta = de rekening', explanation: '"Mag ik de rekening, alstublieft?"' },
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
        { id: 'm3l2e-1',  type: 'fill_blank',      prompt: 'Ik ___ graag een koffie. (willen — ik)',                correctAnswer: 'wil',      hint: '"Willen" → ik wil' },
        { id: 'm3l2e-2',  type: 'fill_blank',      prompt: 'Hij ___ een broodje kaas. (nemen — hij)',               correctAnswer: 'neemt',    hint: '"Nemen" → hij neemt' },
        { id: 'm3l2e-3',  type: 'fill_blank',      prompt: '___ ik de rekening, alstublieft? (mogen — ik)',         correctAnswer: 'Mag',      hint: '"Mogen" → ik mag' },
        { id: 'm3l2e-4',  type: 'multiple_choice', prompt: '¿Qué frase suena más educada y natural?', options: ['Ik wil koffie.', 'Ik wil graag koffie.', 'Koffie!', 'Geef koffie.'], correctAnswer: 'Ik wil graag koffie.', explanation: '"Graag" suaviza la frase y la hace más natural.' },
        { id: 'm3l2e-5',  type: 'multiple_choice', prompt: '¿Cuál es la forma correcta en una pregunta?', options: ['Jij wil koffie?', 'Wil jij koffie?', 'Wil jij koffiet?', 'Wilt jij koffie?'], correctAnswer: 'Wil jij koffie?', explanation: 'En preguntas, el verbo va primero: Wil jij…?' },
        { id: 'm3l2e-6',  type: 'order_sentence',  prompt: 'Ordena: "Quiero un café, por favor."', options: ['Ik', 'wil', 'graag', 'een', 'koffie,', 'alstublieft.'], correctAnswer: 'Ik wil graag een koffie, alstublieft.' },
        { id: 'm3l2e-7',  type: 'order_sentence',  prompt: 'Ordena: "¿Puedo pagar con tarjeta?"', options: ['Mag', 'ik', 'pinnen?'], correctAnswer: 'Mag ik pinnen?' },
        { id: 'm3l2e-8',  type: 'fill_blank',      prompt: 'Neem ___ soep? → pregunta con jij (nemen)',             correctAnswer: 'jij',      hint: 'La -t desaparece en preguntas con jij' },
        { id: 'm3l2e-9',  type: 'multiple_choice', prompt: '¿Qué significa "Nog iets?"?', options: ['¿Algo más?', '¿Quiere pagar?', '¿Está aquí?', 'Aquí tiene.'], correctAnswer: '¿Algo más?', explanation: '"Nog iets?" = ¿Algo más? Se usa para preguntar si el cliente quiere otra cosa.' },
        { id: 'm3l2e-10', type: 'fill_blank',      prompt: 'Wij ___ graag soep en salade. (willen — wij)',          correctAnswer: 'willen',   hint: '"Willen" → wij willen' },
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
        { id: 'm3l2e-17', type: 'fill_blank', prompt: 'Wij ___ soep. (nemen — wij)', correctAnswer: 'nemen', hint: 'nemen → wij nemen' },
        { id: 'm3l2e-18', type: 'fill_blank', prompt: '___ ik hier zitten? (mogen — ik)', correctAnswer: 'Mag', hint: 'mogen → ik mag' },
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
        { id: 'm3l4lz-5', type: 'fill_blank', prompt: 'Eten in Nederland is simpel, ___ gezellig. (contraste: pero)', correctAnswer: 'maar', hint: 'pero = maar', explanation: '"maar" marca un contraste.' },
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
        { id: 'm3l5lz-4', type: 'fill_blank', prompt: 'Ik wil graag een ___ appels. (kilo)', correctAnswer: 'kilo', hint: 'kilo', explanation: '"Ik wil graag een kilo appels".' },
        { id: 'm3l5lz-5', type: 'fill_blank', prompt: 'Met agua (no contable): «___ water». (mucho)', correctAnswer: 'veel', hint: 'mucho = veel', explanation: 'Con lo no contable: "veel water", no "twee water".' },
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
        { id: 'm3l5e-7',  type: 'fill_blank', prompt: 'Ik ___ van pizza. (gustar: houden van — ik)', correctAnswer: 'hou', hint: '"houden van" → ik hou van' },
        { id: 'm3l5e-8',  type: 'multiple_choice', prompt: '¿Cómo se dice "No me gusta el pescado"?', options: ['Ik hou geen van vis.', 'Ik hou niet van vis.', 'Ik niet hou van vis.'], correctAnswer: 'Ik hou niet van vis.', explanation: '"niet" va entre houden y van.' },
        { id: 'm3l5e-9',  type: 'order_sentence', prompt: 'Ordena la pregunta: "¿Cuánto café quieres?"', options: ['Hoeveel', 'koffie', 'wil', 'je?'], correctAnswer: 'Hoeveel koffie wil je?' },
        { id: 'm3l5e-10', type: 'odd_one_out', prompt: '¿Cuál NO es una palabra de cantidad?', options: ['veel', 'weinig', 'een beetje', 'lekker'], correctAnswer: 'lekker', explanation: '"lekker" significa rico; las demás son cantidades.' },
        { id: 'm3l5e-11', type: 'letter_dash', prompt: 'Completa: "la patata"', correctAnswer: 'aardappel', hint: 'de ___' },
        { id: 'm3l5e-12', type: 'word_scramble', prompt: '¿Cómo se dice "poco"?', correctAnswer: 'weinig', hint: 'poco' },
        { id: 'm3l5e-13', type: 'fill_blank', prompt: '___ een koffie, alstublieft. (otro / uno más)', correctAnswer: 'Nog', hint: '"nog een" va junto' },
        { id: 'm3l5e-14', type: 'emoji_choice', prompt: '¿Cuál es "de appel"?', options: ['🍏', '🍇', '🥔', '🍗'], correctAnswer: '🍏', explanation: '"de appel" = la manzana 🍏.' },
        { id: 'm3l5e-15', type: 'emoji_choice', prompt: '¿Cuál es "de kip"?', options: ['🥔', '🍗', '🍇', '🧈'], correctAnswer: '🍗', explanation: '"de kip" = el pollo 🍗.' },
        { id: 'm3l5e-16', type: 'fill_blank', prompt: 'Ik ___ niet van vis. (gustar: houden van — ik, negación)', correctAnswer: 'hou', hint: 'Ik hou niet van…' },
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
        { id: 'm3l6lz-5', type: 'fill_blank', prompt: 'Eerst maak je een ___ : brood, boter, melk… (lista)', correctAnswer: 'lijstje', hint: 'lista = lijstje', explanation: '"Ze maken eerst een lijstje".' },
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
        { id: 'm3l6e-5',  type: 'fill_blank', prompt: 'Repaso: Ik ___ graag koffie. (willen — ik)', correctAnswer: 'wil', hint: 'willen → ik wil' },
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
        { id: 'm3l6e-18', type: 'fill_blank', prompt: 'Repaso: Hoeveel koffie ___ je? (querer — jij)', correctAnswer: 'wil', hint: 'willen → jij wil' },
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
  m4_les1,
];
