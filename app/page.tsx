import SessionLibrary from '@/components/SessionLibrary'
import { getAllSessions } from '@/lib/actions/session.actions'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function HomePage() {
	const { userId } = await auth()
	if (!userId) redirect('/sign-in')

	const sessions = await getAllSessions()

	return <SessionLibrary sessions={sessions} />
}
