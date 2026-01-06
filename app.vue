<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
const { initTheme } = useTheme()
const { initAuth, isAuthenticated, hasSeenWelcome } = useAuth()
const router = useRouter()
const route = useRoute()

onMounted(() => {
  initTheme()
  initAuth()

  // Handle authentication routing
  nextTick(() => {
    const publicRoutes = ['/auth', '/welcome']
    const isPublicRoute = publicRoutes.includes(route.path)

    if (!isAuthenticated.value && !isPublicRoute) {
      router.push('/auth')
    } else if (isAuthenticated.value && !hasSeenWelcome.value && route.path !== '/welcome') {
      router.push('/welcome')
    } else if (isAuthenticated.value && route.path === '/auth') {
      router.push('/')
    }
  })
})

// Watch for auth changes
watch(isAuthenticated, (newVal) => {
  if (!newVal && route.path !== '/auth') {
    router.push('/auth')
  }
})
</script>
