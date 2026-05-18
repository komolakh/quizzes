import QuizQuestions from '@/components/QuizQuestions'
import { getFullSessionData } from '@/lib/actions/session.actions'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function QuizQuestionsPage({
	params
}: {
	params: Promise<{ id: string }>
}) {
	const { userId } = await auth()
	if (!userId) redirect('/sign-in')

	const { id } = await params
	const sessionData = await getFullSessionData(id)

	if (!sessionData) {
		redirect('/quiz/new')
	}

	const activeAttemptId = sessionData.current_attempt

	if (!activeAttemptId) {
		redirect(`/quiz/${id}`)
	}

	return (
		<QuizQuestions
			session={sessionData}
			sessionId={id}
			activeAttemptId={activeAttemptId}
		/>
	)
}
