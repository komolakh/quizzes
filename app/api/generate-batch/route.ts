import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

function analyzeWeakTopics(answers: any[]): string[] {
	if (!answers || answers.length === 0) return []

	const subtopicStats: Record<string, { correct: number; total: number }> = {}

	answers.forEach(a => {
		if (!subtopicStats[a.subtopic]) {
			subtopicStats[a.subtopic] = { correct: 0, total: 0 }
		}
		subtopicStats[a.subtopic].total++
		if (a.isCorrect) subtopicStats[a.subtopic].correct++
	})

	return Object.entries(subtopicStats)
		.filter(([_, stats]) => stats.correct / stats.total < 0.5)
		.map(([topic]) => topic)
}

function getErrorContext(answers: any[]): string {
	if (!answers || answers.length === 0) return ''

	const errors = answers
		.filter(a => !a.isCorrect)
		.slice(-5)
		.map(
			a =>
				`- Тема "${a.subtopic}": "${a.questionText.substring(
					0,
					80
				)}..." (Ответ: ${a.userAnswer}, Правильно: ${a.correctAnswer})`
		)

	if (errors.length === 0) return ''

	return `\n ОШИБКИ УЧЕНИКА:\n${errors.join('\n')}\n`
}

export async function POST(req: Request) {
	try {
		const body = await req.json()
		const topic = body.topic || 'теме'
		const batchNumber = body.batchNumber || 1
		const totalBatches = body.totalBatches || 2
		const askedQuestions = body.askedQuestions || []
		const answers = body.answers || []

		if (!topic) {
			return NextResponse.json({ error: 'Тема обязательна' }, { status: 400 })
		}

		if (!process.env.GEMINI_API_KEY) {
			console.log('Нет API ключа')
			return NextResponse.json(
				{ error: 'API ключ не настроен' },
				{ status: 500 }
			)
		}

		const weakTopics = analyzeWeakTopics(answers)
		const errorContext = getErrorContext(answers)

		let difficultyInstruction = ''
		if (answers.length > 0) {
			const correctCount = answers.filter(a => a.isCorrect).length
			const successRate = (correctCount / answers.length) * 100

			if (successRate < 40) {
				difficultyInstruction =
					'Ученик допускает много ошибок. Сделай вопросы ЗНАЧИТЕЛЬНО ЛЕГЧЕ. Вернись к самым основам.'
			} else if (successRate < 70) {
				difficultyInstruction =
					'У ученика средние результаты. Сделай вопросы немного легче.'
			} else if (successRate > 85 && answers.length >= 5) {
				difficultyInstruction =
					'Ученик отвечает хорошо. Можно немного усложнить вопросы.'
			}
		}

		const askedText = askedQuestions
			.slice(-10)
			.map((q: string, i: number) => `${i + 1}. ${q.substring(0, 100)}`)
			.join('\n')

		let weakTopicsContext = ''
		if (weakTopics.length > 0) {
			weakTopicsContext = `
ТЕМЫ, В КОТОРЫХ БЫЛИ ОШИБКИ:
${weakTopics.map(t => `- ${t}`).join('\n')}

Ученик ошибался в этих темах. Проверь эти темы снова, но используй ДРУГИЕ вопросы, не повторяй предыдущие.
`
		}

		const prompt = `Ты - адаптивный генератор тестов, который подстраивается под уровень ученика.

ТЕМА: "${topic}"
ПАЧКА: ${batchNumber} из ${totalBatches}
${difficultyInstruction}
${weakTopicsContext}
${errorContext}

${askedQuestions.length > 0 ? `НЕ ПОВТОРЯЙ эти вопросы:\n${askedText}` : ''}

Создай ПАЧКУ ИЗ 5 ВОПРОСОВ. Каждый вопрос должен иметь 4 варианта ответа (A, B, C, D) и только один правильный.

Важно: Если есть темы, в которых были ошибки — обязательно включи вопросы по этим темам, чтобы проверить понимание.

Верни ТОЛЬКО JSON:
{
  "questions": [
    {
      "text": "текст вопроса",
      "options": ["A. вариант 1", "B. вариант 2", "C. вариант 3", "D. вариант 4"],
      "correctAnswer": "A",
      "subtopic": "конкретная подтема"
    }
  ]
}`

		const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
		const result = await model.generateContent(prompt)
		const responseText = result.response.text()

		let cleanedText = responseText.replace(/```json\n?/gi, '')
		cleanedText = cleanedText.replace(/```\n?/g, '')
		cleanedText = cleanedText.trim()

		const data = JSON.parse(cleanedText)

		if (!data.questions || data.questions.length !== 5) {
			console.log('Gemini вернул не 5 вопросов')
			return NextResponse.json(
				{ error: 'Неверный формат ответа от API' },
				{ status: 500 }
			)
		}

		return NextResponse.json({ questions: data.questions })
	} catch (error: any) {
		console.error('Ошибка генерации пачки:', error)
		return NextResponse.json(
			{ error: error.message || 'Ошибка генерации вопросов' },
			{ status: 500 }
		)
	}
}
