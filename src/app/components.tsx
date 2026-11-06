import type { ReactNode } from 'react'
import type { DisplaySnapshot, StageId } from '../sim/model'
import { STAGES } from '../sim/model'

export function formatReading(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value)
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="section-title">
    <p className="eyebrow">{eyebrow}</p>
    <div className="section-title-row"><h1>{title}</h1>{children}</div>
  </div>
}

export function SignalBadge({ signal }: { signal: DisplaySnapshot['signal'] }) {
  const symbol = signal.kind === 'alarm' ? '⬣' : signal.kind === 'warning' ? '▲' : '●'
  return <div className={`signal-badge signal-${signal.kind}`} role="status" aria-live="polite">
    <span className="signal-symbol" aria-hidden="true">{symbol}</span>
    <span><strong>{signal.label}</strong><small>{signal.cause ?? 'Учебная модель в штатном состоянии'}{signal.acknowledged ? ' · квитировано' : ''}</small></span>
  </div>
}

export function ReadingRow({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return <div className={`reading-row${emphasis ? ' reading-emphasis' : ''}`}>
    <div className="reading-line"><span>{label}</span><strong>{formatReading(value)} <small>% усл.</small></strong></div>
    <div className="reading-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
  </div>
}

export function Readings({ snapshot, compact = false }: { snapshot: DisplaySnapshot; compact?: boolean }) {
  return <div className={`readings${compact ? ' readings-compact' : ''}`}>
    <ReadingRow label="Мощность" value={snapshot.readings.power} emphasis />
    <ReadingRow label="Температура" value={snapshot.readings.temperature} />
    <ReadingRow label="Давление" value={snapshot.readings.pressure} />
    <ReadingRow label="Расход" value={snapshot.readings.flow} />
    <div className="systems-row">
      <span>Системы</span>
      <strong>{snapshot.systems.filter((item) => item.status === 'normal').length}/{snapshot.systems.length} в норме</strong>
    </div>
  </div>
}

export function StageStrip({ stage, onStage, compact = false }: { stage: StageId; onStage?: (stage: StageId) => void; compact?: boolean }) {
  return <div className={`stage-strip${compact ? ' stage-strip-compact' : ''}`} aria-label="Этапы занятия">
    {STAGES.map((label, index) => {
      const current = index === stage
      const content = <><span className="stage-index">{String(index + 1).padStart(2, '0')}</span><span className="stage-name">{label}</span></>
      return onStage
        ? <button key={index} type="button" aria-current={current ? 'step' : undefined} className={`stage-item${current ? ' is-current' : ''}`} onClick={() => onStage(index as StageId)}>{content}</button>
        : <div key={index} aria-current={current ? 'step' : undefined} className={`stage-item${current ? ' is-current' : ''}`}>{content}</div>
    })}
  </div>
}

export function Panel({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`panel ${className}`.trim()}>{children}</section>
}
