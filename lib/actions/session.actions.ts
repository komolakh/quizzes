'use server'

import { createSupabaseClient } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

export const createSession = async (formData: CreateSession) => {
	const { userId } = await auth()
	if (!userId) throw new Error('Unauthorized')

	const supabase = createSupabaseClient()

	const { data, error } = await supabase
		.from('sessions')
		.insert({
			user_id: userId,
			topic: formData.topic,
			current_attempt: 0,
			completed: false
		})
		.select()

	if (error || !data)
		throw new Error(error?.message || 'Failed to create session')

	return data[0]
}

export const getFullSessionData = async (sessionId: string) => {
	const { userId } = await auth()
	if (!userId) throw new Error('Unauthorized')

	const supabase = createSupabaseClient()

	const { data: session, error: sessionError } = await supabase
		.from('sessions')
		.select('*')
		.eq('id', sessionId)
		.eq('user_id', userId)
		.single()

	if (sessionError) throw new Error(sessionError.message)

	const { data: attempts, error: attemptsError } = await supabase
		.from('attempts')
		.select('id, attempt_number, completed_at')
		.eq('session_id', sessionId)
		.order('attempt_number', { ascending: true })

	if (attemptsError) throw new Error(attemptsError.message)

	const attemptsWithAnswers = await Promise.all(
		attempts.map(async attempt => {
			const { data: answers, error: answersError } = await supabase
				.from('answers')
				.select('*')
				.eq('attempt_id', attempt.id)
				.order('question_number', { ascending: true })

			if (answersError) throw new Error(answersError.message)

			const formattedAnswers = answers.map(a => ({
				questionNumber: a.question_number,
				questionText: a.question_text,
				userAnswer: a.user_answer,
				correctAnswer: a.correct_answer,
				isCorrect: a.is_correct,
				subtopic: a.subtopic
			}))

			return {
				id: attempt.id,
				attemptNumber: attempt.attempt_number,
				answers: formattedAnswers,
				completedAt: attempt.completed_at
			}
		})
	)

	return {
		...session,
		attempts: attemptsWithAnswers
	}
}

export const getAllSessions = async () => {
	const { userId } = await auth()
	if (!userId) throw new Error('Unauthorized')

	const supabase = createSupabaseClient()

	const { data, error } = await supabase
		.from('sessions')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: false })

	if (error) throw new Error(error.message)

	return data
}

export const updateSession = async (
	sessionId: string,
	updates: UpdateSessionData,
	path?: string
) => {
	const { userId } = await auth()
	if (!userId) throw new Error('Unauthorized')

	const supabase = createSupabaseClient()

	const { data, error } = await supabase
		.from('sessions')
		.update(updates)
		.eq('id', sessionId)
		.eq('user_id', userId)
		.select()
		.single()

	if (error) throw new Error(error.message)

	if (path) revalidatePath(path)

	return data
}

export const deleteSession = async (sessionId: string, path: string = '/') => {
	const { userId } = await auth()
	if (!userId) throw new Error('Unauthorized')

	const supabase = createSupabaseClient()

	const { error } = await supabase
		.from('sessions')
		.delete()
		.eq('id', sessionId)
		.eq('user_id', userId)

	if (error) throw new Error(error.message)

	revalidatePath(path)
}

export const createAttempt = async (formData: CreateAttemptData) => {
	const { userId } = await auth()
	if (!userId) throw new Error('Unauthorized')

	const supabase = createSupabaseClient()

	const { data: session, error: sessionError } = await supabase
		.from('sessions')
		.select('id')
		.eq('id', formData.sessionId)
		.eq('user_id', userId)
		.single()

	if (sessionError || !session) throw new Error('Session not found')

	const { data, error } = await supabase
		.from('attempts')
		.insert({
			session_id: formData.sessionId,
			attempt_number: formData.attemptNumber
		})
		.select()
		.single()

	if (error) throw new Error(error.message)

	const { error: updateError } = await supabase
		.from('sessions')
		.update({ current_attempt: formData.attemptNumber })
		.eq('id', formData.sessionId)

	if (updateError) {
		console.error(updateError)
	}

	return data
}

export const getAttempt = async (attemptId: string) => {
	const { userId } = await auth()
	if (!userId) throw new Error('Unauthorized')

	const supabase = createSupabaseClient()

	const { data, error } = await supabase
		.from('attempts')
		.select('*')
		.eq('id', attemptId)
		.single()

	if (error) throw new Error(error.message)

	return data
}

export const completeAttempt = async (attemptId: string) => {
	const { userId } = await auth()
	if (!userId) throw new Error('Unauthorized')

	const supabase = createSupabaseClient()

	const { data, error } = await supabase
		.from('attempts')
		.update({ completed_at: new Date().toISOString() })
		.eq('id', attemptId)
		.select()
		.single()

	if (error) throw new Error(error.message)

	return data
}

export const deleteUnfinishedAttempts = async (sessionId: string) => {
	const { userId } = await auth()
	if (!userId) throw new Error('Unauthorized')

	const supabase = createSupabaseClient()

	const { data: session, error: sessionError } = await supabase
		.from('sessions')
		.select('user_id')
		.eq('id', sessionId)
		.single()

	if (sessionError) throw new Error('session not found')
	if (session.user_id !== userId) throw new Error('Unauthorized')

	const { error } = await supabase
		.from('attempts')
		.delete()
		.eq('session_id', sessionId)
		.is('completed_at', null)

	if (error) throw new Error(error.message)

	const { data: lastCompleted } = await supabase
		.from('attempts')
		.select('attempt_number')
		.eq('session_id', sessionId)
		.not('completed_at', 'is', null)
		.order('attempt_number', { ascending: false })
		.limit(1)
		.single()

	const newCurrentAttempt = lastCompleted?.attempt_number || 0

	await supabase
		.from('sessions')
		.update({ current_attempt: newCurrentAttempt })
		.eq('id', sessionId)

	return { success: true }
}

export const createAnswer = async (formData: CreateAnswerData) => {
	const { userId } = await auth()
	if (!userId) throw new Error('Unauthorized')

	const supabase = createSupabaseClient()

	const { data: attempt, error: attemptError } = await supabase
		.from('attempts')
		.select('session_id')
		.eq('id', formData.attemptId)
		.single()

	if (attemptError) throw new Error('attempt not found')

	const { data: session, error: sessionError } = await supabase
		.from('sessions')
		.select('id')
		.eq('id', attempt.session_id)
		.eq('user_id', userId)
		.single()

	if (sessionError || !session) throw new Error('Unauthorized')

	const { data, error } = await supabase
		.from('answers')
		.insert({
			attempt_id: formData.attemptId,
			question_number: formData.questionNumber,
			question_text: formData.questionText,
			user_answer: formData.userAnswer,
			correct_answer: formData.correctAnswer,
			is_correct: formData.isCorrect,
			subtopic: formData.subtopic
		})
		.select()
		.single()

	if (error) throw new Error(error.message)

	return data
}

export const createAnswersBatch = async (answers: CreateAnswerData[]) => {
	const { userId } = await auth()
	if (!userId) throw new Error('Unauthorized')

	if (answers.length === 0) return []

	const attemptId = answers[0].attemptId
	const supabase = createSupabaseClient()

	const { data: attempt, error: attemptError } = await supabase
		.from('attempts')
		.select('session_id')
		.eq('id', attemptId)
		.single()

	if (attemptError) throw new Error('Attempt not found')

	const { data: session, error: sessionError } = await supabase
		.from('sessions')
		.select('id')
		.eq('id', attempt.session_id)
		.eq('user_id', userId)
		.single()

	if (sessionError || !session) throw new Error('Unauthorized')

	const { data, error } = await supabase
		.from('answers')
		.insert(
			answers.map(a => ({
				attempt_id: a.attemptId,
				question_number: a.questionNumber,
				question_text: a.questionText,
				user_answer: a.userAnswer,
				correct_answer: a.correctAnswer,
				is_correct: a.isCorrect,
				subtopic: a.subtopic
			}))
		)
		.select()

	if (error) throw new Error(error.message)

	return data
}
