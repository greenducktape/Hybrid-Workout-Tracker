'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useAIStream } from '@/hooks/useAIStream'
import { Send, Loader2, Brain, Zap, RefreshCw, Dumbbell, Timer, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Recommendation {
  mainLift?: {
    exercise: string
    warmup?: string
    workSets: { sets: number; reps: number | string; intensity: string; rest: string }[]
    notes?: string
  }
  accessory?: {
    exercise: string
    sets: number
    reps: number | string
    rest: string
    notes?: string
  }[]
  metcon?: {
    name?: string
    type: string
    duration: number
    movements: string[]
    targetScore?: string
    scaling?: string
  }
  rationale?: string
}

export function CoachClient() {
  const { messages, isStreaming, error, sendMessage, clearMessages } = useAIStream()
  const [input, setInput] = useState('')
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [isLoadingRec, startRecTransition] = useTransition()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend() {
    if (!input.trim() || isStreaming) return
    sendMessage(input.trim())
    setInput('')
  }

  function loadRecommendation() {
    startRecTransition(async () => {
      try {
        const res = await fetch('/api/ai/recommend', { method: 'POST' })
        const data = await res.json()
        if (data.recommendation) {
          setRecommendation(data.recommendation)
        } else if (data.rawText) {
          // Show as chat message if can't parse JSON
          setRecommendation(null)
          sendMessage('Generate my workout recommendation')
        }
      } catch {
        console.error('Failed to load recommendation')
      }
    })
  }

  const quickPrompts = [
    "What should I train today?",
    "How's my recovery looking?",
    "What's my weakest CrossFit area?",
    "Help me peak for a competition",
    "Suggest a deload week",
  ]

  return (
    <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
      {/* Recommendation panel */}
      <div className="lg:w-80 shrink-0">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" fill="currentColor" />
              <h2 className="font-semibold text-sm">Today's Recommendation</h2>
            </div>
            <button
              onClick={loadRecommendation}
              disabled={isLoadingRec}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              {isLoadingRec ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Generate
            </button>
          </div>

          {!recommendation && !isLoadingRec && (
            <div className="text-center py-6">
              <Brain className="w-8 h-8 text-[var(--muted-foreground)] mx-auto mb-2 opacity-50" />
              <p className="text-xs text-[var(--muted-foreground)]">
                Click Generate to get a personalized workout based on your training data
              </p>
            </div>
          )}

          {isLoadingRec && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            </div>
          )}

          {recommendation && !isLoadingRec && (
            <div className="space-y-3">
              {recommendation.mainLift && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 mb-1.5">
                    <Dumbbell className="w-3.5 h-3.5" />
                    Main Lift
                  </div>
                  <p className="text-sm font-medium">{recommendation.mainLift.exercise}</p>
                  <div className="space-y-1 mt-1">
                    {recommendation.mainLift.workSets.map((s, i) => (
                      <div key={i} className="text-xs bg-[var(--muted)] rounded px-2 py-1">
                        {s.sets}×{s.reps} @ {s.intensity}
                        <span className="text-[var(--muted-foreground)] ml-2">Rest: {s.rest}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recommendation.accessory && recommendation.accessory.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-green-400 mb-1.5">
                    <Target className="w-3.5 h-3.5" />
                    Accessory
                  </div>
                  <div className="space-y-1">
                    {recommendation.accessory.map((a, i) => (
                      <div key={i} className="text-xs bg-[var(--muted)] rounded px-2 py-1.5">
                        <p className="font-medium">{a.exercise}</p>
                        <p className="text-[var(--muted-foreground)]">{a.sets}×{a.reps} · {a.rest} rest</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recommendation.metcon && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-400 mb-1.5">
                    <Timer className="w-3.5 h-3.5" />
                    MetCon
                  </div>
                  <div className="bg-[var(--muted)] rounded p-2">
                    <p className="text-xs font-medium">
                      {recommendation.metcon.name ?? recommendation.metcon.type} · {recommendation.metcon.duration}min
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {recommendation.metcon.movements.map((m, i) => (
                        <li key={i} className="text-xs text-[var(--muted-foreground)]">• {m}</li>
                      ))}
                    </ul>
                    {recommendation.metcon.targetScore && (
                      <p className="text-xs text-orange-400 mt-1">Target: {recommendation.metcon.targetScore}</p>
                    )}
                  </div>
                </div>
              )}

              {recommendation.rationale && (
                <p className="text-xs text-[var(--muted-foreground)] italic border-t border-[var(--border)] pt-2">
                  {recommendation.rationale}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden min-h-[400px]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Brain className="w-10 h-10 text-blue-400 mx-auto mb-3 opacity-70" />
              <p className="text-sm font-medium mb-1">Ask your AI Coach</p>
              <p className="text-xs text-[var(--muted-foreground)] mb-4">
                I know your training history, PRs, fatigue, and competition goals
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="text-xs bg-[var(--muted)] hover:bg-blue-500/15 hover:text-blue-400 px-3 py-1.5 rounded-full transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'flex',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white rounded-br-sm'
                    : 'bg-[var(--muted)] text-[var(--foreground)] rounded-bl-sm'
                )}
              >
                {msg.content || (isStreaming && i === messages.length - 1 ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Thinking...
                  </span>
                ) : '')}
              </div>
            </div>
          ))}

          {error && (
            <div className="text-center">
              <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg inline-block">{error}</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask your coach..."
              disabled={isStreaming}
              className="flex-1 bg-[var(--muted)] rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-[var(--muted-foreground)] disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isStreaming || !input.trim()}
              className="w-9 h-9 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 rounded-xl flex items-center justify-center transition-colors shrink-0"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
