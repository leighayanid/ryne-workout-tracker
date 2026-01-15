<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <Toaster position="top-right" :theme="colorMode" richColors />
  </div>
</template>

<script setup lang="ts">
import { Toaster } from 'vue-sonner'

const { initTheme, colorMode } = useTheme()
const { isAuthenticated, hasSeenWelcome } = useAuth()
const router = useRouter()
const route = useRoute()

onMounted(() => {
  initTheme()
})
</script>
