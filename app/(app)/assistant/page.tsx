import { requireProfile } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { AskOpm } from './AskOpm'

export default async function AssistantPage() {
  // Any active role may use it; the API gives finance roles the full toolset and
  // everyone else the all-role subset, all RLS-scoped to what they can see.
  const profile = await requireProfile()
  const isFinance = ['founder', 'accountant'].includes(profile.role)

  return (
    <div>
      <PageHeader
        title="Ask OPM"
        subtitle={isFinance
          ? 'Your AI analyst — ask about cash, projects, budgets, contracts and more.'
          : 'Ask about projects and production. Answers are scoped to what your role can access.'}
      />
      <AskOpm />
    </div>
  )
}
