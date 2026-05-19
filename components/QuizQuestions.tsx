'use client'

import {
	completeAttempt,
	createAnswersBatch,
	updateSession
} from '@/lib/actions/session.actions'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

export default function QuizQuestions({
	session,
	sessionId,
	activeAttemptId
}: QuizQuestionsProps) {
	const router = useRouter()

	const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
	const [currentIndexInBatch, setCurrentIndexInBatch] = useState(0)
	const [currentBatch, setCurrentBatch] = useState<Question[]>([])
	const [batchNumber, setBatchNumber] = useState(1)
	const [questionNumber, setQuestionNumber] = useState(1)
	const [answers, setAnswers] = useState<AnswerRecord[]>([])
	const [loading, setLoading] = useState(false)
	const [feedback, setFeedback] = useState('')
	const [error, setError] = useState('')
	const [showFeedback, setShowFeedback] = useState(false)
	const [isWaitingForNext, setIsWaitingForNext] = useState(false)

	const timeoutRef = useRef<NodeJS.Timeout | null>(null)

	const saveAnswersToDB = useCallback(
		async (attemptId: string, allAnswers: AnswerRecord[]) => {
			const answersData = allAnswers.map(a => ({
				attemptId,
				questionNumber: a.questionNumber,
				questionText: a.questionText,
				userAnswer: a.userAnswer,
				correctAnswer: a.correctAnswer,
				isCorrect: a.isCorrect,
				subtopic: a.subtopic
			}))
			await createAnswersBatch(answersData)
		},
		[]
	)

	const finishTest = useCallback(
		async (allAnswers: AnswerRecord[]) => {
			console.log('activeAttemptId:', activeAttemptId)

			await saveAnswersToDB(activeAttemptId, allAnswers)
			await completeAttempt(activeAttemptId)
			await updateSession(sessionId, { completed: true })
			router.push(`/quiz/${sessionId}`)
		},
		[sessionId, activeAttemptId, router, saveAnswersToDB]
	)

	const loadBatch = useCallback(
		async (
			batchNum: number,
			currentAnswers: AnswerRecord[],
			topicParam: string
		) => {
			setLoading(true)
			setError('')

			try {
				const askedTexts = currentAnswers.map(a => a.questionText)

				const previousAttemptsAnswers =
					session?.attempts
						?.filter(
							a =>
								a.completedAt !== null &&
								a.attemptNumber !== session.current_attempt
						)
						?.flatMap(a => a.answers) || []

				const allAnswers = [...previousAttemptsAnswers, ...currentAnswers]

				const allPreviousQuestions =
					session?.attempts
						?.filter(a => a.attemptNumber !== session.current_attempt)
						?.flatMap(a => a.answers.map(ans => ans.questionText)) || []
				const allAskedQuestions = [...allPreviousQuestions, ...askedTexts]

				const res = await fetch('/api/generate-batch', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						topic: topicParam,
						batchNumber: batchNum,
						totalBatches: 2,
						askedQuestions: allAskedQuestions,
						answers: allAnswers
					})
				})

				if (!res.ok) {
					throw new Error(`HTTP error! status: ${res.status}`)
				}

				const data = await res.json()

				if (!data.questions || data.questions.length === 0) {
					throw new Error('Нет вопросов в ответе')
				}

				setCurrentBatch(data.questions)
				setCurrentIndexInBatch(0)
				setCurrentQuestion(data.questions[0])
			} catch (err) {
				console.error('Ошибка загрузки пачки:', err)
				setError('Не удалось загрузить вопросы. Попробуйте ещё раз.')
				setCurrentBatch([])
				setCurrentQuestion(null)
			} finally {
				setLoading(false)
			}
		},
		[session?.attempts, session?.current_attempt]
	)

	const handleAnswerAndContinue = useCallback(
		async (newAnswers: AnswerRecord[]) => {
			const nextIndex = currentIndexInBatch + 1
			const totalAnswered = newAnswers.length

			if (totalAnswered >= 10) {
				await finishTest(newAnswers)
				return
			}

			if (nextIndex < currentBatch.length) {
				setQuestionNumber(prev => prev + 1)
				setCurrentIndexInBatch(nextIndex)
				setCurrentQuestion(currentBatch[nextIndex])
				setShowFeedback(false)
				setFeedback('')
				setIsWaitingForNext(false)
				return
			}

			const nextBatch = batchNumber + 1
			if (nextBatch <= 2) {
				setBatchNumber(nextBatch)
				setCurrentIndexInBatch(0)
				setCurrentBatch([])
				setShowFeedback(false)
				setFeedback('')
				setIsWaitingForNext(false)
				await loadBatch(nextBatch, newAnswers, session?.topic || '')
				setQuestionNumber(prev => prev + 1)
			}
		},
		[
			currentIndexInBatch,
			currentBatch,
			batchNumber,
			session?.topic,
			loadBatch,
			finishTest
		]
	)

	const handleAnswer = (selectedAnswer: string) => {
		if (!currentQuestion || isWaitingForNext) return

		const userAnswerLetter = selectedAnswer.trim().charAt(0).toUpperCase()
		const correctAnswerLetter = currentQuestion.correctAnswer
			.trim()
			.charAt(0)
			.toUpperCase()
		const isCorrect = userAnswerLetter === correctAnswerLetter

		const newAnswer: AnswerRecord = {
			questionNumber,
			questionText: currentQuestion.text,
			userAnswer: userAnswerLetter,
			correctAnswer: correctAnswerLetter,
			isCorrect,
			subtopic: currentQuestion.subtopic
		}

		const newAnswers = [...answers, newAnswer]
		setAnswers(newAnswers)

		const feedbackMessage = isCorrect
			? 'Верно!'
			: `Неправильно. Правильный ответ: ${correctAnswerLetter}`
		setFeedback(feedbackMessage)
		setShowFeedback(true)
		setIsWaitingForNext(true)

		if (timeoutRef.current) clearTimeout(timeoutRef.current)
		timeoutRef.current = setTimeout(() => {
			handleAnswerAndContinue(newAnswers)
		}, 1500)
	}

	useEffect(() => {
		if (currentQuestion === null && answers.length === 0 && !loading) {
			loadBatch(1, [], session.topic)
		}
	}, [currentQuestion, answers.length, loading, loadBatch, session.topic])

	useEffect(() => {
		return () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current)
		}
	}, [])

	const progressPercent = (answers.length / 10) * 100

	return (
		<div className="min-h-[calc(100vh-56px)] px-4 py-8">
			<div className="max-w-3xl mx-auto">
				<div className="mb-6">
					<div className="flex justify-between text-sm text-gray-600 mb-2">
						<span>
							Попытка {session.current_attempt} • Вопрос {questionNumber} из 10
						</span>
					</div>
					<div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
						<div
							className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>
				</div>

				{error && (
					<div className="mb-4 p-3 bg-red-100 text-red-700 rounded-xl">
						{error}
						<button
							onClick={() =>
								loadBatch(batchNumber, answers, session?.topic || '')
							}
							className="ml-4 underline font-medium"
						>
							Повторить
						</button>
					</div>
				)}

				{currentQuestion ? (
					<div className="bg-white rounded-2xl shadow p-6">
						<div className="flex items-center gap-2 mb-4">
							<span className="text-sm px-3 py-1 bg-blue-50 text-blue-800 rounded-full">
								{currentQuestion.subtopic}
							</span>
						</div>

						<h2 className="text-xl font-semibold mb-6 leading-relaxed">
							{currentQuestion.text}
						</h2>

						<div className="space-y-3">
							{currentQuestion.options.map((opt, idx) => (
								<button
									key={idx}
									onClick={() => handleAnswer(opt)}
									disabled={loading || isWaitingForNext}
									className="w-full text-left p-4 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{opt}
								</button>
							))}
						</div>

						{loading && (
							<div className="mt-4 text-center text-gray-400">
								<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-800 inline-block mr-2"></div>
								Загрузка...
							</div>
						)}
					</div>
				) : (
					<div className="bg-white rounded-lg shadow p-12 text-center">
						<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-800 mx-auto"></div>
						<p className="mt-4 text-gray-600">Загрузка первого вопроса...</p>
					</div>
				)}

				{showFeedback && feedback && (
					<div
						className={`mt-4 p-4 rounded-lg text-center text-lg font-medium ${
							feedback.includes('Верно')
								? 'bg-green-100 text-green-800'
								: 'bg-red-100 text-red-800'
						}`}
					>
						{feedback}
					</div>
				)}
			</div>
		</div>
	)
}
