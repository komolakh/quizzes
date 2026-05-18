'use client'

import { createAttempt, deleteSession } from '@/lib/actions/session.actions'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function QuizResults({ session, sessionId }: QuizResultsProps) {
	const router = useRouter()

	const [selectedAttempt, setSelectedAttempt] = useState<number | null>(
		session.current_attempt || session.attempts[0].attemptNumber || null
	)
	const [showConfirmDialog, setShowConfirmDialog] = useState(false)

	const handleDeleteSession = async () => {
		try {
			await deleteSession(sessionId)
			router.push('/')
		} catch (error) {
			console.error('Ошибка удаления:', error)
		}
	}

	const handleDeleteClick = () => {
		setShowConfirmDialog(true)
	}

	const handleConfirmDelete = () => {
		setShowConfirmDialog(false)
		handleDeleteSession()
	}

	const handleCancelDelete = () => {
		setShowConfirmDialog(false)
	}

	const handleNewAttempt = async () => {
		try {
			const newAttemptNumber = session.current_attempt + 1
			await createAttempt({
				sessionId: session.id,
				attemptNumber: newAttemptNumber
			})
			router.push(`/quiz/${sessionId}/questions`)
		} catch (error) {
			console.error('Ошибка создания попытки:', error)
		}
	}

	const getWeakTopics = (answers: AnswerRecord[]) => {
		const subtopicErrors: Record<string, number> = {}
		answers.forEach(a => {
			if (!a.isCorrect) {
				subtopicErrors[a.subtopic] = (subtopicErrors[a.subtopic] || 0) + 1
			}
		})
		return Object.keys(subtopicErrors)
	}

	const hasAttempts = session.attempts && session.attempts.length > 0
	const currentAttemptData =
		selectedAttempt !== null
			? session.attempts.find(a => a.attemptNumber === selectedAttempt)
			: null

	return (
		<main>
			<div className="rounded-lg bg-white px-14 py-7 items-center shadow flex justify-between mb-8 max-w-3xl mx-auto">
				<div className="text-start">
					<h1 className="text-3xl font-semibold mb-2">{session.topic}</h1>
					<p className="text-gray-500">
						Попыток: {session.attempts?.length || 0}
					</p>
				</div>

				<button
					className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
					onClick={() => router.push(`/quiz/${sessionId}/tutor`)}
				>
					Работа над ошибками
				</button>
			</div>

			<div className="max-w-3xl mx-auto">
				<div className="bg-white rounded-lg shadow p-4 mb-6">
					<div className="flex items-center gap-2 flex-wrap">
						{hasAttempts &&
							session.attempts.map(attempt => (
								<button
									key={attempt.attemptNumber}
									onClick={() => setSelectedAttempt(attempt.attemptNumber)}
									className={`px-4 py-2 rounded-lg transition ${
										selectedAttempt === attempt.attemptNumber
											? 'bg-blue-900 text-white'
											: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
									}`}
								>
									Попытка {attempt.attemptNumber}
								</button>
							))}
						<button
							className="primary-btn"
							onClick={handleNewAttempt}
						>
							+ Новая попытка
						</button>
					</div>
				</div>

				{currentAttemptData && currentAttemptData.answers.length > 0 && (
					<div className="bg-white rounded-lg shadow p-6">
						{getWeakTopics(currentAttemptData.answers).length > 0 && (
							<div className="bg-red-50 p-5 rounded-lg mb-6">
								<h3 className="font-semibold mb-2">Темы для повторения</h3>
								<ul className="list-disc list-inside">
									{getWeakTopics(currentAttemptData.answers).map((topic, i) => (
										<li key={i}>{topic}</li>
									))}
								</ul>
							</div>
						)}

						<details className="mt-4">
							<summary className="cursor-pointer text-blue-900 hover:text-blue-800 font-medium">
								Подробные ответы ({currentAttemptData.answers.length})
							</summary>
							<div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
								{currentAttemptData.answers.map(
									(a: AnswerRecord, i: number) => (
										<div
											key={i}
											className={`p-3 rounded-lg ${
												a.isCorrect
													? 'bg-green-50 border border-green-200'
													: 'bg-red-50 border border-red-200'
											}`}
										>
											<div className="font-medium text-sm">
												Вопрос {a.questionNumber}: {a.questionText}
											</div>
											<div className="text-sm mt-1">
												<span className="text-gray-500">Ваш ответ: </span>
												<span
													className={
														a.isCorrect ? 'text-green-700' : 'text-red-700'
													}
												>
													{a.userAnswer}
												</span>
												{!a.isCorrect && (
													<span className="text-gray-500 ml-2">
														/ Правильный: {a.correctAnswer}
													</span>
												)}
											</div>
											<div className="text-xs text-gray-400 mt-1">
												Тема: {a.subtopic}
											</div>
										</div>
									)
								)}
							</div>
						</details>
					</div>
				)}

				<div className="mt-8 flex justify-center">
					<button
						onClick={handleDeleteClick}
						className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition"
					>
						Удалить сессию
					</button>
				</div>
			</div>

			{showConfirmDialog && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
						<h3 className="text-xl font-semibold mb-4">
							Подтверждение удаления
						</h3>
						<p className="text-gray-600 mb-6">
							Вы уверены, что хотите удалить сессию {session?.topic}?
							<br />
							Все попытки и ответы будут потеряны безвозвратно.
						</p>
						<div className="flex justify-end gap-3">
							<button
								onClick={handleCancelDelete}
								className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
							>
								Отмена
							</button>
							<button
								onClick={handleConfirmDelete}
								className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
							>
								Удалить
							</button>
						</div>
					</div>
				</div>
			)}
		</main>
	)
}
