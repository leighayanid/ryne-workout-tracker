import { clearSessionCookie, deleteSession } from '~~/server/utils/auth'
import { logger } from '~~/server/utils/logger'

export default defineEventHandler(async (event) => {
  try {
    const token = getCookie(event, 'ryne_session')

    if (token) {
      await deleteSession(token)
      logger.info('User logged out successfully')
    }

    clearSessionCookie(event)

    return {
      success: true,
      message: 'Logged out successfully',
    }
  } catch (error: any) {
    logger.error({ error: error.message }, 'Logout error')

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'An error occurred during logout',
    })
  }
})
