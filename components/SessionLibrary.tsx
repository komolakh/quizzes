'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function SessionLibrary({
	sessions: initialSessions
}: SessionLibraryProps) {
	const [sessions] = useState<SessionData[]>(initialSessions)

	const getAttemptsCount = (session: SessionData) => {
		return session.current_attempt
	}

	const allSessions = sessions

	return (
		<main>
			<div className="rounded-lg bg-white px-14 py-7 items-center shadow flex justify-between mb-8 max-w-3xl mx-auto">
				<h1 className="text-3xl font-semibold">Тесты</h1>
				<button className="primary-btn">
					<Link href="/quiz/new">Новый тест</Link>
				</button>
			</div>

			<div className="max-w-3xl mx-auto">
				<div className="space-y-4">
					{allSessions.map(session => {
						return (
							<div
								key={session.id}
								className="rounded-lg bg-white p-6 shadow hover:shadow-md transition"
							>
								<div className="flex justify-between items-start">
									<div className="flex-1">
										<h3 className="text-xl font-semibold mb-2">
											{session.topic}
										</h3>
										<div className="flex gap-4 text-sm text-gray-500 mb-2">
											<span>Попыток: {getAttemptsCount(session)}</span>
										</div>

										<p className="text-xs text-gray-400 mt-1">
											Создан:{' '}
											{new Date(session.created_at).toLocaleDateString('ru-RU')}
										</p>
									</div>
									<button className="primary-btn">
										<Link href={`/quiz/${session.id}`}>К тесту</Link>
									</button>
								</div>
							</div>
						)
					})}
				</div>
			</div>
		</main>
	)
}
