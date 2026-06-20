import { createClient } from '@supabase/supabase-js'

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  
  console.log("Testing pipelines...")
  const res1 = await supabase.from('pipelines').select('*').limit(1)
  console.log(res1.error)

  console.log("Testing StaffClearance...")
  const res2 = await supabase.from('StaffClearance').select('*').limit(1)
  console.log(res2.error)

  console.log("Testing BelieveCatalogTakeover...")
  const res3 = await supabase.from('BelieveCatalogTakeover').select('*, tracks:TrackMetadata(*)').limit(1)
  console.log(res3.error)
}
main()
