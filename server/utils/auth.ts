import bcrypt from 'bcrypt'
import type { H3Event } from 'h3'
import { randomBytes } from 'crypto'
import prisma from './prisma'

const SALT_ROUNDS = 12
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const COOKIE_NAME = 'ryne_session'

export interface AuthUser {
  id: string
  email: string
  name: string
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Generate a secure random session token
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Create a new session for a user
 */
export async function createSession(userId: string): Promise<string> {
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
      lastActiveAt: new Date(),
    },
  })

  return token
}

/**
 * Get session from token
 */
export async function getSession(token: string) {
  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  })

  if (!session) {
    return null
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } })
    return null
  }

  // Update last active time (every 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  if (session.lastActiveAt < fiveMinutesAgo) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    })
  }

  return session
}

/**
 * Delete a session
 */
export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { token },
  })
}

/**
 * Delete all sessions for a user
 */
export async function deleteUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  })
}

/**
 * Get authenticated user from request cookie
 */
export async function getAuthUser(event: H3Event): Promise<AuthUser | null> {
  const token = getCookie(event, COOKIE_NAME)

  if (!token) {
    return null
  }

  const session = await getSession(token)

  if (!session) {
    // Clear invalid cookie
    deleteCookie(event, COOKIE_NAME)
    return null
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  }
}

/**
 * Set session cookie
 */
export function setSessionCookie(event: H3Event, token: string): void {
  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_MS / 1000, // maxAge is in seconds
    path: '/',
  })
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, COOKIE_NAME)
}

/**
 * Require authentication middleware
 * Throws 401 if user is not authenticated
 */
export async function requireAuth(event: H3Event): Promise<AuthUser> {
  const user = await getAuthUser(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication required',
    })
  }

  return user
}
