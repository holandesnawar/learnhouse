import Bold from '@tiptap/extension-bold'

/**
 * Negrita con grosor configurable. Misma marca `bold` del StarterKit (mismo
 * <strong>, el contenido antiguo sigue valiendo) más un atributo `weight`
 * opcional que se pinta como font-weight inline: 400 fina … 900 muy gruesa.
 * Sin `weight` = negrita normal (700 por CSS, ver `.ProseMirror strong`).
 *
 * Ojo con el `!important`: el navegador aplica `strong { font-weight: bolder }`,
 * que es RELATIVO al peso heredado — dentro de un título (600) un <strong>
 * acababa renderizando 900 y pisaba cualquier ajuste. Con el estilo inline
 * marcado important, el grosor elegido gana siempre.
 */
const CustomBold = Bold.extend({
  addAttributes() {
    return {
      weight: {
        default: null,
        parseHTML: (el) => {
          const w = (el as HTMLElement).style?.fontWeight
          if (!w || w === 'bold' || w === 'bolder' || w === 'normal') return null
          return w
        },
        renderHTML: (attrs) =>
          attrs.weight ? { style: `font-weight: ${attrs.weight} !important` } : {},
      },
    }
  },
})

export default CustomBold
