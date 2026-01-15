export default defineNuxtRouteMiddleware((to, from) => {
  const { isAuthenticated, isLoading } = useAuth()

  // Wait for auth to initialize
  if (isLoading.value) {
    return
  }

  // If not authenticated, redirect to landing page
  if (!isAuthenticated.value) {
    return navigateTo('/')
  }
})
