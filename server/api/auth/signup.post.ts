import { signupSchema } from '~~/server/utils/validation'
import { hashPassword, createSession, setSessionCookie } from '~~/server/utils/auth'
import prisma from '~~/server/utils/prisma'
import { logger } from '~~/server/utils/logger'
import { rateLimit, rateLimitPresets } from '~~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  // Rate limiting
  await rateLimit(rateLimitPresets.auth)(event)

  try {
    // Parse and validate request body
    const body = await readBody(event)
    const validatedData = signupSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: 'User with this email already exists',
      })
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password)

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    })

    // Create session and set cookie (auto-login after signup)
    const sessionToken = await createSession(user.id)
    setSessionCookie(event, sessionToken)

    logger.info({ userId: user.id, email: user.email }, 'User signed up successfully')

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    }
  } catch (error: any) {
    logger.error({ error: error.message }, 'Signup error')

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
      message: 'An error occurred during signup',
    })
  }
})
