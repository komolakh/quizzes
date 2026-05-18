// home
interface CreateSession {
	topic: string
}

interface AnswerRecord {
	questionNumber: number
	questionText: string
	userAnswer: string
	correctAnswer: string
	isCorrect: boolean
	subtopic: string
}

interface Attempt {
	id?: string
	attemptNumber: number
	answers: AnswerRecord[]
	completedAt?: string
}

interface SessionData {
	id: string
	topic: string
	attempts: Attempt[]
	current_attempt: number
	completed: boolean
	created_at?: string
	user_id?: string
}

interface SessionLibraryProps {
	sessions: SessionData[]
}

// quiz results
interface QuizResultsProps {
	session: SessionData
	sessionId: string
}

// tutor
interface SavedMessage {
	role: 'user' | 'system' | 'assistant'
	content: string
}
