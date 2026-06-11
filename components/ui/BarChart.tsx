interface BarChartData {
  label: string
  value: number
  value2?: number
}

interface BarChartProps {
  data: BarChartData[]
  label1?: string
  label2?: string
  formatValue?: (v: number) => string
  height?: number
}

export function BarChart({ data, label1, label2, formatValue, height = 120 }: BarChartProps) {
  const allValues = data.flatMap(d => label2 !== undefined ? [d.value, d.value2 ?? 0] : [d.value])
  const maxValue = Math.max(...allValues, 1)
  const fmt = formatValue ?? ((v: number) => v.toLocaleString('en-IN'))
  const isDual = label2 !== undefined

  return (
    <div className="space-y-3">
      {/* Legend */}
      {isDual && (
        <div className="flex items-center gap-4">
          {label1 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-indigo-500" />
              <span className="text-[11px] text-[#8888aa]">{label1}</span>
            </div>
          )}
          {label2 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span className="text-[11px] text-[#8888aa]">{label2}</span>
            </div>
          )}
        </div>
      )}

      {/* Chart area */}
      <div className="flex items-end gap-2" style={{ height: `${height}px` }}>
        {data.map((d, i) => {
          const h1 = maxValue > 0 ? Math.round((d.value / maxValue) * height) : 0
          const h2 = maxValue > 0 ? Math.round(((d.value2 ?? 0) / maxValue) * height) : 0
          return (
            <div key={i} className="flex-1 flex items-end gap-0.5">
              <div
                className="flex-1 bg-indigo-500 rounded-t-sm min-h-[2px] transition-all duration-500"
                style={{ height: `${h1}px` }}
                title={`${d.label}: ${fmt(d.value)}`}
              />
              {isDual && (
                <div
                  className="flex-1 bg-emerald-500 rounded-t-sm min-h-[2px] transition-all duration-500"
                  style={{ height: `${h2}px` }}
                  title={`${d.label}: ${fmt(d.value2 ?? 0)}`}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-[#5a5a7a] truncate">{d.label}</div>
        ))}
      </div>
    </div>
  )
}
