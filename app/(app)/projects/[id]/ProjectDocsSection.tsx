'use client'

import { FileText, Printer, Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { BUILTIN_TEMPLATES } from '@/lib/templates'

const CAT_LABELS: Record<string, string> = { voucher: 'Voucher', agreement: 'Agreement', form: 'Form' }

// Per-project document formats — OPM Cinemas branded, pre-filled with the film
// name, ready to print / save as PDF. Agreements are drafts for legal review.
export function ProjectDocsSection({ projectName }: { projectName: string }) {
  const toast = useToast()

  function printDoc(html: string) {
    const w = window.open('', '_blank')
    if (!w) return toast.error('Allow pop-ups to open the document')
    w.document.write(html); w.document.close(); w.focus()
    setTimeout(() => w.print(), 350)
  }
  function downloadDoc(name: string, html: string) {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${projectName.replace(/[^a-z0-9]+/gi, '_')}_${name.replace(/[^a-z0-9]+/gi, '_')}.html`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center gap-2">
        <FileText size={16} className="text-white/70" />
        <h3 className="text-sm font-semibold text-white">Documents & Formats</h3>
        <span className="text-xs text-[#8888aa]">· OPM Cinemas branded, pre-filled for {projectName}</span>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {BUILTIN_TEMPLATES.map(t => (
          <div key={t.id} className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-white">{t.name}</span>
              <span className="text-[9px] uppercase tracking-wide text-[#8888aa] bg-[#13131a] border border-[#2a2a3a] rounded px-1 py-0.5">{CAT_LABELS[t.category] ?? t.category}</span>
            </div>
            <p className="text-[11px] text-[#8888aa] flex-1 leading-relaxed">{t.description}</p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" icon={Printer} onClick={() => printDoc(t.build({ project: projectName }))}>Print / PDF</Button>
              <Button size="sm" variant="secondary" icon={Download} onClick={() => downloadDoc(t.name, t.build({ project: projectName }))}>Save</Button>
            </div>
          </div>
        ))}
      </div>
      <p className="px-5 pb-4 text-[11px] text-[#5a5a7a]">Agreement formats are starting drafts — have them vetted by legal counsel before signing.</p>
    </div>
  )
}
