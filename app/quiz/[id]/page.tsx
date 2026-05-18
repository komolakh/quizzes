import QuizResults from '@/components/QuizResults'
import { getFullSessionData } from '@/lib/actions/session.actions'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function QuizResultsPage({
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

	return (
		<QuizResults
			session={sessionData}
			sessionId={id}
		/>
	)
}
