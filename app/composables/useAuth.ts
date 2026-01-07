export const useAuth = () => {
  const user = useState<{ id: string; name: string; email: string } | null>('user', () => null)
  const isAuthenticated = useState('isAuthenticated', () => false)
  const hasSeenWelcome = useState('hasSeenWelcome', () => false)
  const accessToken = useState<string | null>('accessToken', () => null)
  const refreshToken = useState<string | null>('refreshToken', () => null)

  const login = async (email: string, password: string) => {
    try {
      const response = await $fetch('/api/auth/login', {
        method: 'POST',
        body: {
          email,
          password
        }
      })

      user.value = {
        id: (response as any).user.id,
        name: (response as any).user.name,
        email: (response as any).user.email
      }
      accessToken.value = (response as any).accessToken
      refreshToken.value = (response as any).refreshToken
      isAuthenticated.value = true

      // Store in localStorage
      if (process.client) {
        localStorage.setItem('ryne_user', JSON.stringify(user.value))
        localStorage.setItem('ryne_access_token', accessToken.value!)
        localStorage.setItem('ryne_refresh_token', refreshToken.value!)
        localStorage.setItem('ryne_authenticated', 'true')
      }
    } catch (error: any) {
      console.error('Login failed:', error)
      // Enhance error with user-friendly message if not already present
      if (error?.statusCode === 401) {
        error.data = error.data || {}
        error.data.message = error.data.message || 'Invalid email or password'
      } else if (error?.statusCode === 400) {
        error.data = error.data || {}
        error.data.message = error.data.message || 'Please provide valid email and password'
      } else if (!error?.data?.message && !error?.message) {
        error.message = 'Unable to connect to server. Please check your connection.'
      }
      throw error
    }
  }

  const signup = async (name: string, email: string, password: string) => {
    try {
      const response = await $fetch('/api/auth/signup', {
        method: 'POST',
        body: {
          name,
          email,
          password
        }
      })

      user.value = {
        id: (response as any).user.id,
        name: (response as any).user.name,
        email: (response as any).user.email
      }
      accessToken.value = (response as any).accessToken
      refreshToken.value = (response as any).refreshToken
      isAuthenticated.value = true
      hasSeenWelcome.value = false

      // Store in localStorage
      if (process.client) {
        localStorage.setItem('ryne_user', JSON.stringify(user.value))
        localStorage.setItem('ryne_access_token', accessToken.value!)
        localStorage.setItem('ryne_refresh_token', refreshToken.value!)
        localStorage.setItem('ryne_authenticated', 'true')
        localStorage.removeItem('ryne_seen_welcome')
      }
    } catch (error: any) {
      console.error('Signup failed:', error)
      // Enhance error with user-friendly message if not already present
      if (error?.statusCode === 409) {
        error.data = error.data || {}
        error.data.message = error.data.message || 'An account with this email already exists'
      } else if (error?.statusCode === 400) {
        error.data = error.data || {}
        error.data.message = error.data.message || 'Please provide valid information'
      } else if (!error?.data?.message && !error?.message) {
        error.message = 'Unable to connect to server. Please check your connection.'
      }
      throw error
    }
  }

  const logout = async () => {
    try {
      if (refreshToken.value) {
        await $fetch('/api/auth/logout', {
          method: 'POST',
          body: {
            token: refreshToken.value
          }
        })
      }
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      user.value = null
      accessToken.value = null
      refreshToken.value = null
      isAuthenticated.value = false

      // Clear localStorage
      if (process.client) {
        localStorage.removeItem('ryne_user')
        localStorage.removeItem('ryne_access_token')
        localStorage.removeItem('ryne_refresh_token')
        localStorage.removeItem('ryne_authenticated')
        localStorage.removeItem('ryne_seen_welcome')
      }
    }
  }

  const markWelcomeSeen = () => {
    hasSeenWelcome.value = true
    if (process.client) {
      localStorage.setItem('ryne_seen_welcome', 'true')
    }
  }

  const getAccessToken = () => {
    return accessToken.value
  }

  const refresh = async () => {
    try {
      if (refreshToken.value) {
        const response = await $fetch('/api/auth/refresh', {
          method: 'POST',
          body: {
            token: refreshToken.value
          }
        })

        accessToken.value = (response as any).accessToken

        // Update user data if provided
        if ((response as any).user) {
          user.value = {
            id: (response as any).user.id,
            name: (response as any).user.name,
            email: (response as any).user.email
          }
        }

        if (process.client) {
          localStorage.setItem('ryne_access_token', accessToken.value!)
        }

        return true
      }
      return false
    } catch (error) {
      console.error('Refresh token failed:', error)
      // If refresh fails, log out
      logout()
      return false
    }
  }

  const initAuth = () => {
    if (process.client) {
      const storedUser = localStorage.getItem('ryne_user')
      const storedAccessToken = localStorage.getItem('ryne_access_token')
      const storedRefreshToken = localStorage.getItem('ryne_refresh_token')
      const storedAuth = localStorage.getItem('ryne_authenticated')
      const storedWelcome = localStorage.getItem('ryne_seen_welcome')

      if (storedUser && storedAuth === 'true' && storedAccessToken) {
        user.value = JSON.parse(storedUser)
        accessToken.value = storedAccessToken
        refreshToken.value = storedRefreshToken
        isAuthenticated.value = true

        // Optionally try to refresh token on init to ensure validity
        // refresh()
      }

      if (storedWelcome === 'true') {
        hasSeenWelcome.value = true
      }
    }
  }

  return {
    user,
    isAuthenticated,
    hasSeenWelcome,
    accessToken,
    login,
    signup,
    logout,
    refresh,
    markWelcomeSeen,
    getAccessToken,
    initAuth
  }
}
