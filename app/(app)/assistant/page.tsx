import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { AskOpm } from './AskOpm'

export default async function AssistantPage() {
  // Founder-only — the AI assistant is a metered, costly resource.
  const profile = await requireProfile()
  if (profile.role !== 'founder') redirect('/dashboard')

  return (
    <div>
      <PageHeader
        title="Ask OPM"
        subtitle="Your AI analyst — ask about cash, projects, budgets, contracts and more."
      />
      <AskOpm />
    </div>
  )
}
