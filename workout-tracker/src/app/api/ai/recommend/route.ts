import Anthropic from '@anthropic-ai/sdk'
import { buildCoachContext, COACH_SYSTEM_PROMPT } from '@/lib/anthropic'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST() {
  try {
    const context = await buildCoachContext()

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: COACH_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Based on my current training data, recommend today's workout. Here is my context:\n\n${context}\n\nProvide a structured workout recommendation in the JSON format specified in your instructions.`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response type' }, { status: 500 })
    }

    // Try to extract JSON from the response
    const text = content.text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    let recommendation = null
    if (jsonMatch) {
      try {
        recommendation = JSON.parse(jsonMatch[0])
      } catch {
        // Return raw text if JSON parsing fails
      }
    }

    return NextResponse.json({ recommendation, rawText: text })
  } catch (error) {
    console.error('AI recommend error:', error)
    return NextResponse.json({ error: 'Failed to generate recommendation' }, { status: 500 })
  }
}
