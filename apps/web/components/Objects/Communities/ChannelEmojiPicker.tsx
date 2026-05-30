'use client'
import React from 'react'
import { Hash } from 'lucide-react'
import { CHANNEL_EMOJIS } from '@/lib/communities/channelEmoji'

interface ChannelEmojiPickerProps {
  value: string | null
  onChange: (emoji: string | null) => void
}

// Small palette to pick a channel emoji (or none → default # icon).
export default function ChannelEmojiPicker({ value, onChange }: ChannelEmojiPickerProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-label="Sin emoji"
        title="Sin emoji"
        className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${
          !value
            ? 'border-[#4da3ff] bg-[#F0F5FF] text-[#025dc7]'
            : 'border-gray-200 text-gray-400 hover:bg-gray-50'
        }`}
      >
        <Hash size={16} />
      </button>
      {CHANNEL_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
          className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg border transition-colors ${
            value === emoji
              ? 'border-[#4da3ff] bg-[#F0F5FF]'
              : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span aria-hidden>{emoji}</span>
        </button>
      ))}
    </div>
  )
}
