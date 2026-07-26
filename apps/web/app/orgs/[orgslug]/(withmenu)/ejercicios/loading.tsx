import { Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <div className="flex justify-center items-center py-24">
      <Loader2 className="animate-spin text-[#4da3ff]" size={30} />
    </div>
  )
}
