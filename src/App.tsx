import { useState } from 'react'
import TenMath from './TenMath'

export default function App() {
  const [chosenMode, setChosenMode] = useState<'add' | 'subtract' | null>(null)
  if (chosenMode) return <TenMath initialMode={chosenMode} onBack={() => setChosenMode(null)} backLabel="返回樂園首頁" />
  return <main className="playground-home">
    <div className="playground-card">
      <div className="playground-icons" aria-hidden="true">🍎 🍌 🍓</div>
      <h1>10以內加減法<br /><span>食物樂園</span></h1>
      <div className="playground-mode-buttons">
        <button className="playground-mode addition-mode" onClick={() => setChosenMode('add')}><span aria-hidden="true">＋</span><strong>10以內加法</strong><small>合起來，數一數 →</small></button>
        <button className="playground-mode subtraction-mode" onClick={() => setChosenMode('subtract')}><span aria-hidden="true">−</span><strong>10以內減法</strong><small>拿走後，剩幾多 →</small></button>
      </div>
    </div>
  </main>
}
