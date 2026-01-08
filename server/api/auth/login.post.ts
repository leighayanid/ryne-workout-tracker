import { loginSchema } from '~~/server/utils/validation'
import { verifyPassword, createSession, setSessionCookie } from '~~/server/utils/auth'
import prisma from '~~/server/utils/prisma'
import { logger } from '~~/server/utils/logger'
import { rateLimit, rateLimitPresets } from '~~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  // Rate limiting
  await rateLimit(rateLimitPresets.auth)(event)

  try {
    // Parse and validate request body
    const body = await readBody(event)
    const validatedData = loginSchema.parse(body)

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: 'Invalid email or password',
      })
    }

    // Verify password
    const isValidPassword = await verifyPassword(validatedData.password, user.password)

    if (!isValidPassword) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: 'Invalid email or password',
      })
    }

    // Create session
    const sessionToken = await createSession(user.id)

    // Set session cookie
    setSessionCookie(event, sessionToken)

    logger.info({ userId: user.id, email: user.email }, 'User logged in successfully')

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    }
  } catch (error: any) {
    logger.error({ error: error.message }, 'Login error')

    if (error.statusCode) {
      throw error
    }

    // Zod validation errors
    if (error.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'Validation failed',
        data: error.errors,
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'An error occurred during login',
    })
  }
})
