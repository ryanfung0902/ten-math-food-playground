import { Fragment, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

type Mode = 'add' | 'subtract'
const foods = [{ icon: '🍎', name: '蘋果' }, { icon: '🍌', name: '香蕉' }, { icon: '🍓', name: '草莓' }, { icon: '🍪', name: '餅乾' }, { icon: '🍊', name: '橙' }, { icon: '🧁', name: '蛋糕' }]

function makeQuestion(mode: Mode) {
  if (mode === 'add') { const a = Math.floor(Math.random() * 10) + 1; const b = Math.floor(Math.random() * (11 - a)); return { a, b, answer: a + b } }
  const a = Math.floor(Math.random() * 10) + 1; const b = Math.floor(Math.random() * (a + 1)); return { a, b, answer: a - b }
}

export default function TenMath({ onBack, backLabel = '返回數學小助手', initialMode = 'add' }: { onBack: () => void; backLabel?: string; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [question, setQuestion] = useState(() => makeQuestion(initialMode))
  const [foodsChosen, setFoodsChosen] = useState<(number | null)[]>([null, null])
  const [removed, setRemoved] = useState<number[]>([])
  const [counts, setCounts] = useState([0, 0])
  const [basketHints, setBasketHints] = useState([false, false])
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [hint, setHint] = useState(0)
  const [sound, setSound] = useState(true)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [voiceMessage, setVoiceMessage] = useState('')
  const countAudioRef = useRef<HTMLAudioElement | null>(null)
  const [selected, setSelected] = useState(0)
  const [drag, setDrag] = useState<{ food: number; x: number; y: number; startX: number; startY: number; moved: boolean; overBasket: number | null } | null>(null)
  const dragRef = useRef<typeof drag>(null)
  const suppressClick = useRef(false)
  const [dragMessage, setDragMessage] = useState('')

  const ready = mode === 'add' ? counts[0] === question.a && counts[1] === question.b : foodsChosen[0] !== null && removed.length === question.b
  const equation = mode === 'add' ? `${question.a} ＋ ${question.b}` : `${question.a} − ${question.b}`
  const resetRound = () => { setFoodsChosen([null, null]); setCounts([0, 0]); setBasketHints([false, false]); setRemoved([]); setAnswer(''); setFeedback(null); setHint(0); setDragMessage(''); setSelected(0) }
  const makeNew = (nextMode = mode) => { setMode(nextMode); setQuestion(makeQuestion(nextMode)); setFoodsChosen([null, null]); setCounts([0, 0]); setBasketHints([false, false]); setRemoved([]); setAnswer(''); setFeedback(null); setHint(0); setDragMessage(''); setSelected(0) }
  const playCount = (count: number) => {
    if (!voiceEnabled || count < 1 || count > 10) return
    const audio = new Audio(`${import.meta.env.BASE_URL}audio/ying-wah/count-${count}.wav?v=20261028b`)
    audio.volume = 0.85
    countAudioRef.current?.pause()
    countAudioRef.current = audio
    setVoiceMessage('')
    void audio.play().catch(() => {
      if (countAudioRef.current === audio) setVoiceMessage('配音未能播放，請再按一次食物。')
    })
  }
  const celebrate = () => {
    if (!sound) return
    try {
      const context = new AudioContext()
      for (let clap = 0; clap < 18; clap++) {
        const duration = .075
        const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate)
        const samples = buffer.getChannelData(0)
        for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length)
        const source = context.createBufferSource()
        const filter = context.createBiquadFilter()
        const gain = context.createGain()
        const start = context.currentTime + clap * (.075 + Math.random() * .035)
        source.buffer = buffer
        filter.type = 'highpass'
        filter.frequency.value = 850
        gain.gain.setValueAtTime(.0001, start)
        gain.gain.exponentialRampToValueAtTime(.14, start + .006)
        gain.gain.exponentialRampToValueAtTime(.0001, start + duration)
        source.connect(filter).connect(gain).connect(context.destination)
        source.start(start)
      }
      window.setTimeout(() => void context.close(), 2200)
    } catch { /* audio may be unavailable */ }
  }
  const updateFood = (basket: number, food: number) => {
    const amount = basket === 0 ? question.a : question.b
    if (!amount || (foodsChosen[basket] !== null && foodsChosen[basket] !== food)) { setDragMessage(!amount ? '這個碟需要 0 件食物。' : '這個碟已選了另一款食物，請先重新選擇。'); return }
    if (mode === 'add') {
      if (counts[basket] >= amount) { setDragMessage('這個碟已經放滿了！'); return }
      const nextCount = counts[basket] + 1
      setCounts(items => items.map((item, i) => i === basket ? item + 1 : item))
      playCount(nextCount)
    } else {
      playCount(amount)
    }
    setFoodsChosen(items => items.map((item, i) => i === basket ? food : item))
    setSelected(basket)
    setDragMessage('')
  }
  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, food: number) => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); const next = { food, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, overBasket: null }; dragRef.current = next; setDrag(next) }
  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => { const current = dragRef.current; if (!current) return; const over = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-basket]'); const next = { ...current, x: event.clientX, y: event.clientY, moved: current.moved || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 8, overBasket: over ? Number(over.dataset.basket) : null }; dragRef.current = next; setDrag(next) }
  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => { const current = dragRef.current; if (!current) return; if (current.moved) { suppressClick.current = true; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-basket]'); if (target) updateFood(Number(target.dataset.basket), current.food); else setDragMessage('請把食物放到碟上。'); window.setTimeout(() => { suppressClick.current = false }, 250) } dragRef.current = null; setDrag(null) }
  const resetFood = (basket: number) => { setFoodsChosen(items => items.map((item, i) => i === basket ? null : item)); setCounts(items => items.map((item, i) => i === basket ? 0 : item)); setBasketHints(items => items.map((item, i) => i === basket ? false : item)); if (mode === 'subtract') setRemoved([]); setSelected(basket); setFeedback(null) }
  const check = () => { if (!/^(10|[0-9])$/.test(answer)) return; if (Number(answer) === question.answer) { setFeedback('correct'); celebrate() } else setFeedback('wrong') }
  const removeItem = (index: number) => {
    if (removed.length < question.b && !removed.includes(index)) {
      const nextRemoved = removed.length + 1
      setRemoved(value => [...value, index])
      playCount(question.a - nextRemoved)
    }
  }
  const countedFood = foodsChosen[0] === null ? foods[0] : foods[foodsChosen[0]]
  return <main className="tenmath-shell">
    <header className="tenmath-header"><button className="tenmath-back" onClick={onBack}>← {backLabel}</button><div className="tenmath-switch"><button className={mode === 'add' ? 'active' : ''} onClick={() => makeNew('add')}>10以內加法</button><button className={mode === 'subtract' ? 'active' : ''} onClick={() => makeNew('subtract')}>10以內減法</button></div><h1>{mode === 'add' ? '加法' : '減法'}學校樂園</h1><p>揀喜歡的食物，一齊數一數！</p></header>
    <section className="tenmath-equation" aria-label={`題目：${equation}等於多少`}>{equation} ＝ <span>{feedback === 'correct' ? question.answer : '？'}</span></section>
    <div className="tenmath-content"><aside className="tenmath-foods"><h2>🍽️ 食物選擇</h2><p>拖一件食物到碟，或者先選碟再按食物！</p><div className="drag-guide" aria-hidden="true"><span>👆</span> 拖一拖 → 🍽️</div>{foods.map((food, i) => <button key={food.name} className="tenmath-food" onPointerDown={event => startDrag(event, i)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => { dragRef.current = null; setDrag(null) }} onClick={() => { if (!suppressClick.current) updateFood(selected, i) }}><span>{food.icon}</span>{food.name}<small>拖動</small></button>)}{dragMessage && <p className="drag-message" role="status">{dragMessage}</p>}</aside>
      {drag?.moved && <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true"><span>{foods[drag.food].icon}</span><i>👆</i></div>}
      <section className="tenmath-work"><div className={'tenmath-baskets ' + (mode === 'add' ? 'addition' : '')}>{[0, 1].slice(0, mode === 'add' ? 2 : 1).map((basket) => {
        const amount = basket === 0 ? question.a : question.b
        const foodIndex = foodsChosen[basket]
        const count = mode === 'add' ? counts[basket] : foodIndex === null ? 0 : amount
        return <Fragment key={basket}>{basket === 1 && <div className="basket-plus" aria-label="加">＋</div>}<div className={'tenmath-basket ' + (selected === basket ? 'selected ' : '') + (drag?.overBasket === basket && drag.moved ? 'drag-over' : '')} onClick={() => setSelected(basket)} data-basket={basket} role="group" aria-label={`${basket === 0 ? '第一個' : '第二個'}數字 ${amount} 的碟`}>
          <div className="basket-title"><button className="basket-select" onClick={() => setSelected(basket)}>{mode === 'subtract' ? '原有' : basket === 0 ? '第一個數' : '第二個數'}</button><strong>{amount}</strong></div>
          <div className="basket-plate"><div className="basket-items">{Array.from({ length: count }, (_, i) => mode === 'subtract' ? <button key={i} aria-label={removed.includes(i) ? '已拿走' : '拿走這件食物'} className={removed.includes(i) ? 'taken' : ''} onClick={(event) => { event.stopPropagation(); removeItem(i) }} disabled={removed.includes(i) || removed.length >= question.b}>{foods[foodIndex!].icon}</button> : <span key={i} className="basket-fruit">{foods[foodIndex!].icon}</span>)}{basketHints[basket] && foodIndex !== null && mode === 'add' && Array.from({ length: Math.max(0, amount - count) }, (_, i) => <span key={`hint-${i}`} className="basket-fruit basket-fruit-ghost" aria-hidden="true">{foods[foodIndex].icon}</span>)}{count === 0 && <span className="basket-empty">{amount === 0 ? '空碟，0 件' : '食物放喺呢度'}</span>}</div></div>
          <div className="basket-caption">{mode === 'add' ? `已放 ${count} / ${amount} 件${count === amount ? ' ✓' : ''}` : foodIndex === null ? '請先揀食物' : foods[foodIndex].name}</div>
          {mode === 'add' && <button className="basket-hint" aria-pressed={basketHints[basket]} onClick={(event) => { event.stopPropagation(); setBasketHints(items => items.map((item, i) => i === basket ? !item : item)) }}>{basketHints[basket] ? '🙈 隱藏水果影子' : '💡 顯示水果影子'}</button>}
          {basketHints[basket] && foodIndex === null && <div className="basket-hint-help" role="status">先選一款水果，就會出現影子。</div>}
          {foodIndex !== null && <button className="basket-reset" onClick={(event) => { event.stopPropagation(); resetFood(basket) }}>重新選擇食物</button>}
          {basket === 0 && mode === 'subtract' && <div className="removed-label">拿走區：{Array.from({ length: removed.length }, () => countedFood.icon).join(' ') || '按物件拿走'}</div>}
        </div></Fragment>
      })}</div>
        <div className="tenmath-guide">{mode === 'add' ? <><span>⬇️</span> 先逐件放滿兩個碟，再合起來數一數！</> : <><span>👆</span> 按一按要拿走的食物，再數剩低幾多個！</>}</div><div className="tenmath-answer"><label htmlFor="tenmath-answer">我的答案</label><input id="tenmath-answer" inputMode="numeric" maxLength={2} value={answer} onChange={e => { setAnswer(e.target.value.replace(/\D/g, '').slice(0, 2)); setFeedback(null) }} placeholder="輸入答案" aria-label="輸入0至10的答案"/><button onClick={check} disabled={!ready || !/^(10|[0-9])$/.test(answer) || feedback === 'correct'}>檢查答案</button></div>
        {feedback && <p className={'tenmath-feedback ' + feedback} role="status">{feedback === 'correct' ? '答啱喇！做得好！ 🎉' : '再數一次，慢慢試！'}</p>}
        <div className="tenmath-actions"><button onClick={() => setHint(n => Math.min(n + 1, 2))}>💡 提示</button><button onClick={() => setSound(!sound)} aria-pressed={sound}>{sound ? '🔊 掌聲開' : '🔇 掌聲關'}</button><button onClick={() => setVoiceEnabled(value => !value)} aria-pressed={voiceEnabled}>{voiceEnabled ? '🗣️ 數數聲開' : '🔇 數數聲關'}</button><button onClick={resetRound}>↻ 重做本題</button>{feedback === 'correct' && <button className="next" onClick={() => makeNew()}>下一題 →</button>}</div>{voiceMessage && <p className="tenmath-hint" role="status">{voiceMessage}</p>}{hint > 0 && <p className="tenmath-hint" role="status">{mode === 'add' ? hint === 1 ? '由第一個碟開始，逐個數到第二個碟。' : `可以由 ${question.a} 開始，再向前數 ${question.b} 個。` : hint === 1 ? `原有 ${question.a} 個，拿走 ${question.b} 個。` : `原有 ${question.a} 個，已拿走 ${removed.length} 個；數一數碟上還有幾多個。`}</p>}
      </section></div><footer className="tenmath-footer">慢慢數，答啱就有掌聲！</footer>
  </main>
}
