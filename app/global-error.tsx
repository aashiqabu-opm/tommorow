'use client'

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html>
      <body style={{ background: '#000000', color: '#e8e8f0', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem' }}>
          <p style={{ fontSize: '0.875rem' }}>Something went wrong.</p>
          <button onClick={reset} style={{ fontSize: '0.875rem', color: '#D6B16F', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
