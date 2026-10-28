import { Fragment, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

type Mode = 'add' | 'subtract'
type FeedbackKind = 'correct' | 'wrong'
const foods = [{ icon: '🍎', name: '蘋果' }, { icon: '🍌', name: '香蕉' }, { icon: '🍓', name: '草莓' }, { icon: '🍪', name: '餅乾' }, { icon: '🍊', name: '橙' }, { icon: '🧁', name: '蛋糕' }]
const countAudioUrl = (count: number) => `${import.meta.env.BASE_URL}audio/ying-wah/count-${count}.wav?v=20261028c`
const feedbackAudioUrl = (kind: FeedbackKind) => `${import.meta.env.BASE_URL}audio/ying-wah/feedback-${kind}.wav?v=20261028`

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
  const [feedback, setFeedback] = useState<FeedbackKind | null>(null)
  const [voiceMessage, setVoiceMessage] = useState('')
  const countAudioRef = useRef<HTMLAudioElement | null>(null)
  const countAudioCacheRef = useRef<Map<number, HTMLAudioElement>>(new Map())
  const feedbackAudioCacheRef = useRef<Partial<Record<FeedbackKind, HTMLAudioElement>>>({})
  const activeFeedbackAudioRef = useRef<HTMLAudioElement | null>(null)
  const [selected, setSelected] = useState(0)
  const [drag, setDrag] = useState<{ food: number; x: number; y: number; startX: number; startY: number; moved: boolean; overBasket: number | null } | null>(null)
  const dragRef = useRef<typeof drag>(null)
  const suppressClick = useRef(false)
  const [dragMessage, setDragMessage] = useState('')

  useEffect(() => {
    const clips = new Map<number, HTMLAudioElement>()
    for (let count = 1; count <= 10; count++) {
      const audio = new Audio(countAudioUrl(count))
      audio.preload = 'auto'
      audio.load()
      clips.set(count, audio)
    }
    countAudioCacheRef.current = clips
    const feedbackClips: Partial<Record<FeedbackKind, HTMLAudioElement>> = {}
    for (const kind of ['correct', 'wrong'] as const) {
      const audio = new Audio(feedbackAudioUrl(kind))
      audio.preload = 'auto'
      audio.load()
      feedbackClips[kind] = audio
    }
    feedbackAudioCacheRef.current = feedbackClips
    return () => {
      clips.forEach(audio => audio.pause())
      Object.values(feedbackClips).forEach(audio => audio?.pause())
      countAudioCacheRef.current.clear()
      feedbackAudioCacheRef.current = {}
    }
  }, [])

  const ready = mode === 'add' ? counts[0] === question.a && counts[1] === question.b : foodsChosen[0] !== null && removed.length === question.b
  const equation = mode === 'add' ? `${question.a} ＋ ${question.b}` : `${question.a} − ${question.b}`
  const resetRound = () => { activeFeedbackAudioRef.current?.pause(); setFoodsChosen([null, null]); setCounts([0, 0]); setBasketHints([false, false]); setRemoved([]); setAnswer(''); setFeedback(null); setDragMessage(''); setSelected(0) }
  const makeNew = (nextMode = mode) => { activeFeedbackAudioRef.current?.pause(); setMode(nextMode); setQuestion(makeQuestion(nextMode)); setFoodsChosen([null, null]); setCounts([0, 0]); setBasketHints([false, false]); setRemoved([]); setAnswer(''); setFeedback(null); setDragMessage(''); setSelected(0) }
  const playCount = (count: number) => {
    if (count < 1 || count > 10) return
    const audio = countAudioCacheRef.current.get(count) ?? new Audio(countAudioUrl(count))
    audio.volume = 0.85
    activeFeedbackAudioRef.current?.pause()
    countAudioRef.current?.pause()
    audio.currentTime = 0
    countAudioRef.current = audio
    setVoiceMessage('')
    void audio.play().catch(() => {
      if (countAudioRef.current === audio) setVoiceMessage('配音未能播放，請再按一次食物。')
    })
  }
  const playFeedback = (kind: FeedbackKind) => {
    const audio = feedbackAudioCacheRef.current[kind] ?? new Audio(feedbackAudioUrl(kind))
    countAudioRef.current?.pause()
    activeFeedbackAudioRef.current?.pause()
    audio.currentTime = 0
    activeFeedbackAudioRef.current = audio
    setVoiceMessage('')
    void audio.play().catch(() => {
      if (activeFeedbackAudioRef.current === audio) setVoiceMessage('老師回應錄音未能播放。')
    })
  }
  const updateFood = (basket: number, food: number) => {
    const amount = basket === 0 ? question.a : question.b
    if (!amount || (foodsChosen[0] !== null && foodsChosen[0] !== food)) { setDragMessage(!amount ? '這個碟需要 0 件食物。' : '兩個碟要用同一款食物；想轉換，請先按「重新選擇食物」。'); return }
    if (mode === 'add') {
      if (counts[basket] >= amount) { setDragMessage('這個碟已經放滿了！'); return }
      const nextCount = counts[basket] + 1
      setCounts(items => items.map((item, i) => i === basket ? item + 1 : item))
      playCount(nextCount)
    } else {
      playCount(amount)
    }
    setFoodsChosen(mode === 'add' ? [food, food] : [food, null])
    setSelected(basket)
    setDragMessage('')
  }
  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, food: number) => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); const next = { food, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, overBasket: null }; dragRef.current = next; setDrag(next) }
  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => { const current = dragRef.current; if (!current) return; const over = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-basket]'); const next = { ...current, x: event.clientX, y: event.clientY, moved: current.moved || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 8, overBasket: over ? Number(over.dataset.basket) : null }; dragRef.current = next; setDrag(next) }
  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => { const current = dragRef.current; if (!current) return; if (current.moved) { suppressClick.current = true; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-basket]'); if (target) updateFood(Number(target.dataset.basket), current.food); else setDragMessage('請把食物放到碟上。'); window.setTimeout(() => { suppressClick.current = false }, 250) } dragRef.current = null; setDrag(null) }
  const resetFood = () => { setFoodsChosen([null, null]); setCounts([0, 0]); setBasketHints([false, false]); setRemoved([]); setAnswer(''); setSelected(0); setFeedback(null); setDragMessage('') }
  const updateAnswer = (value: string) => {
    const next = value.replace(/\D/g, '').slice(0, 2)
    if (next === '' || /^(10|[0-9])$/.test(next)) { activeFeedbackAudioRef.current?.pause(); setAnswer(next); setFeedback(null) }
  }
  const check = () => { if (!/^(10|[0-9])$/.test(answer)) return; const result = Number(answer) === question.answer ? 'correct' : 'wrong'; setFeedback(result); playFeedback(result) }
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
    <div className="tenmath-content"><aside className="tenmath-foods"><h2>🍽️ 食物選擇</h2><p>拖一件食物到碟，或者先選碟再按食物！{mode === 'add' && ' 兩個碟會用同一款食物。'}</p><div className="drag-guide" aria-hidden="true"><span>👆</span> 拖一拖 → 🍽️</div>{foods.map((food, i) => <button key={food.name} className="tenmath-food" onPointerDown={event => startDrag(event, i)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => { dragRef.current = null; setDrag(null) }} onClick={() => { if (!suppressClick.current) updateFood(selected, i) }}><span>{food.icon}</span>{food.name}<small>拖動</small></button>)}{dragMessage && <p className="drag-message" role="status">{dragMessage}</p>}</aside>
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
          {foodIndex !== null && basket === 0 && <button className="basket-reset" onClick={(event) => { event.stopPropagation(); resetFood() }}>重新選擇食物</button>}
          {basket === 0 && mode === 'subtract' && <div className="removed-label">拿走區：{Array.from({ length: removed.length }, () => countedFood.icon).join(' ') || '按物件拿走'}</div>}
        </div></Fragment>
      })}</div>
        <div className="tenmath-guide">{mode === 'add' ? <><span>⬇️</span> 先逐件放滿兩個碟，再合起來數一數！</> : <><span>👆</span> 按一按要拿走的食物，再數剩低幾多個！</>}</div><div className="tenmath-answer"><label htmlFor="tenmath-answer">我的答案</label><input id="tenmath-answer" type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={answer} onChange={e => updateAnswer(e.target.value)} placeholder="按下面數字" aria-label="輸入0至10的答案"/><button onClick={check} disabled={!ready || !/^(10|[0-9])$/.test(answer) || feedback === 'correct'}>檢查答案</button></div>
        <div className="tenmath-keypad" role="group" aria-label="數字鍵盤">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => <button key={digit} type="button" onClick={() => updateAnswer(answer + digit)}>{digit}</button>)}<button type="button" className="keypad-action" onClick={() => updateAnswer('')}>清除</button><button type="button" onClick={() => updateAnswer(answer + '0')}>0</button><button type="button" className="keypad-action" aria-label="刪除最後一個數字" onClick={() => updateAnswer(answer.slice(0, -1))}>⌫</button></div>
        {feedback && <p className={'tenmath-feedback ' + feedback} role="status">{feedback === 'correct' ? '答啱喇！做得好！ 🎉' : '再數一次，慢慢試！'}</p>}
        <div className="tenmath-actions"><button onClick={resetRound}>↻ 重做本題</button>{feedback === 'correct' && <button className="next" onClick={() => makeNew()}>下一題 →</button>}</div>{voiceMessage && <p className="tenmath-hint" role="status">{voiceMessage}</p>}
      </section></div><footer className="tenmath-footer">慢慢數，答完有陳老師回應！</footer>
  </main>
}
