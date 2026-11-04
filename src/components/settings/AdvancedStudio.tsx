import { contrastRatio } from '../../lib/color'
import type { UserPreferences } from '../../lib/types'

interface Props { preferences: UserPreferences; update: (change: Partial<UserPreferences>) => void }
const colors = [
  ['accentColor', 'Accent'], ['customTextColor', 'Text'], ['customSurfaceColor', 'Surface'],
  ['gradientStart', 'Gradient start'], ['gradientEnd', 'Gradient end'],
] as const
const sliders = [['gradientAngle', 'Gradient angle', 0, 360, '°'], ['borderIntensity', 'Border intensity', 0, 100, '%'], ['shadowIntensity', 'Shadow intensity', 0, 100, '%']] as const

export function AdvancedStudio({ preferences: p, update }: Props) {
  const ratio = contrastRatio(p.customTextColor, p.customSurfaceColor)
  return <>
    <div className="content-heading"><span className="overline">PERSONALISATION STUDIO</span><h3>Make it unmistakably yours</h3><p>Every change previews on your dashboard. Custom colors apply to the Custom theme.</p></div>
    <div className="studio-preview" style={{ background: `linear-gradient(${p.gradientAngle}deg, ${p.gradientStart}, ${p.gradientEnd})`, color: p.customTextColor }} aria-label="Custom theme preview"><span>YOUR OWN LITTLE CORNER</span><strong>Space to think<span style={{ color: p.accentColor }}>.</span></strong><div style={{ background: p.customSurfaceColor, color: p.customTextColor }}>A calmer place to begin <span style={{ color: p.accentColor }}>✳</span></div></div>
    <div className="studio-color-grid">{colors.map(([key, label]) => <label key={key} className="studio-color"><span>{label}</span><input aria-label={label} type="color" value={p[key]} onChange={e => update({ [key]: e.target.value, theme: 'custom', ...(key === 'gradientStart' || key === 'gradientEnd' ? { background: 'theme' } : {}) })}/><small>{p[key].toUpperCase()}</small></label>)}</div>
    <p className={`contrast-note ${ratio < 4.5 ? 'contrast-warning' : ''}`} role="status">Text / solid surface: {ratio.toFixed(2)}:1 {ratio < 4.5 ? '— low contrast; choose colors with at least 4.5:1.' : '— meets the 4.5:1 normal-text target.'} Backgrounds and translucent surfaces may differ.</p>
    {sliders.map(([key, label, min, max, unit]) => <label className="range-row" key={key}><span><strong>{label}</strong><small>{p[key]}{unit}</small></span><input type="range" min={min} max={max} value={p[key]} onChange={e => update({ [key]: Number(e.target.value), ...(key === 'gradientAngle' ? { theme: 'custom', background: 'theme' } : {}) })}/></label>)}
    <p className="helper">For a solid background, use Backgrounds → Solid color. Your profile and export do not include notes, tasks or wallpaper image bytes.</p>
  </>
}
