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

// results
interface QuizResultsProps {
	session: SessionData
	sessionId: string
}

// questions
interface Question {
	text: string
	options: string[]
	correctAnswer: string
	subtopic: string
}

interface QuizQuestionsProps {
	session: SessionData
	sessionId: string
	activeAttemptId: string
}

// tutor
interface SavedMessage {
	role: 'user' | 'system' | 'assistant'
	content: string
}

// server actions
interface UpdateSessionData {
	current_attempt?: number
	completed?: boolean
}

interface CreateAttemptData {
	sessionId: string
	attemptNumber: number
}

interface CreateAnswerData {
	attemptId: string
	questionNumber: number
	questionText: string
	userAnswer: string
	correctAnswer: string
	isCorrect: boolean
	subtopic: string
}
