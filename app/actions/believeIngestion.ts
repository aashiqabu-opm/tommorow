'use server'

import { createClient } from '@/lib/supabase/server'
import { getSessionProfile } from '@/lib/auth'

export async function processBelieveBulkManifest(manifestData: any[]) {
  const profile = await getSessionProfile()
  if (!profile || !['founder', 'general_manager', 'executive_producer'].includes(profile.role)) {
    throw new Error('Unauthorized access to Believe Ingestion Controller.')
  }

  const supabase = await createClient()
  const results = []

  // Iterate over batch-submitted metadata exports
  for (const item of manifestData) {
    // Ensure every uploaded high-fidelity audio link matches its declared ISRC code
    let isVerified = false
    
    if (item.tracks && Array.isArray(item.tracks)) {
      // Loop to ensure all tracks match integrity check
      isVerified = item.tracks.every((track: any) => {
        const hasAudio = !!track.audioWavUrl
        const hasIsrc = !!track.isrcCode
        // Automated integrity checkpoint: check if WAV URL somehow contains the ISRC code, verifying they belong together
        return hasAudio && hasIsrc && track.audioWavUrl.includes(track.isrcCode)
      })
    }

    // Update database status flag to "Asset_Verified" (which represents Transfer Ready) if matched
    const status = isVerified ? 'Asset_Verified' : 'Metadata_Extracted'

    const { data: takeoverData, error: takeoverError } = await supabase.from('BelieveCatalogTakeover').insert({
      upcCode: item.upcCode || null,
      releaseTitle: item.releaseTitle,
      artistName: item.artistName,
      genre: item.genre || null,
      originalReleaseDate: item.originalReleaseDate ? new Date(item.originalReleaseDate) : null,
      migrationStatus: status,
    }).select().single()

    if (takeoverError || !takeoverData) {
      results.push({ success: false, title: item.releaseTitle, error: takeoverError?.message })
      continue
    }

    if (item.tracks && Array.isArray(item.tracks)) {
      const tracksToInsert = item.tracks.map((t: any) => ({
        takeoverId: takeoverData.id,
        isrcCode: t.isrcCode,
        trackTitle: t.trackTitle,
        duration: t.duration || 0,
        audioWavUrl: t.audioWavUrl,
        artworkUrl: t.artworkUrl,
        explicitContent: t.explicitContent || false
      }))

      const { error: tracksError } = await supabase.from('TrackMetadata').insert(tracksToInsert)
      if (tracksError) {
         results.push({ success: false, title: item.releaseTitle, error: tracksError.message })
         continue
      }
    }

    results.push({ success: true, title: item.releaseTitle, takeoverId: takeoverData.id, verified: isVerified })
  }

  return results
}
