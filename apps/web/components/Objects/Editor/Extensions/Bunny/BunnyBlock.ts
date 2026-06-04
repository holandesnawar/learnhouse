import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import dynamic from 'next/dynamic'

// Dedicated Bunny Stream video block. The generic embed block fights you with
// URL validation; this one just takes whatever Bunny gives you (the player URL
// or the full <iframe> embed code), extracts the library + video id, and renders
// a clean responsive iframe. No ads, no watermark — Bunny's own player.
const BunnyBlockComponent = dynamic(() => import('./BunnyBlockComponent'), {
  ssr: false,
})

export default Node.create({
  name: 'blockBunny',
  group: 'block',
  draggable: true,
  atom: true,

  addOptions() {
    return {
      editable: true,
      activity: null,
    }
  },

  addAttributes() {
    return {
      // Normalised embed src, e.g.
      // https://iframe.mediadelivery.net/embed/675650/170f7e3b-...
      src: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'block-bunny',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['block-bunny', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(BunnyBlockComponent as any)
  },
})
