import { createClient } from '@supabase/supabase-js'

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await supabase.from('pipelines').select('*').order('createdAt', { ascending: false }).limit(1)
  console.log("createdAt error:", error)
}
main()
