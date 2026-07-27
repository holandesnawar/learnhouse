import Bold from '@tiptap/extension-bold'

/**
 * Negrita con grosor configurable. Igual que la Bold del StarterKit (misma
 * marca `bold`, mismo <strong>, el contenido antiguo sigue valiendo) pero con
 * un atributo `weight` opcional que se pinta como font-weight inline:
 *   600 seminegrita · sin atributo = 700 normal · 800 gruesa.
 * Se registra con StarterKit.configure({ bold: false }) para sustituirla.
 */
const CustomBold = Bold.extend({
  addAttributes() {
    return {
      weight: {
        default: null,
        parseHTML: (el) => {
          const w = (el as HTMLElement).style?.fontWeight
          return w && w !== '700' && w !== 'bold' ? w : null
        },
        renderHTML: (attrs) =>
          attrs.weight ? { style: `font-weight: ${attrs.weight}` } : {},
      },
    }
  },
})

export default CustomBold
