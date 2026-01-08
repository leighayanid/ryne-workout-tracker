import { getAuthUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await getAuthUser(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Not authenticated',
    })
  }

  return {
    user,
  }
})
