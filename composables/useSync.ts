import { localDB } from '~/utils/db'
import type { SyncQueueItem } from '~/types'

export const useSync = () => {
  const { isOnline } = useNetwork()
  const syncing = useState('syncing', () => false)
  const lastSyncTime = useState<Date | null>('lastSyncTime', () => null)

  // Helper function that handles API calls with automatic token refresh on 401
  const authenticatedFetch = async <T>(
    url: string,
    options: { method: string; body?: any }
  ): Promise<T> => {
    const { getAccessToken, refreshAccessToken } = useAuth()
    let token = getAccessToken()

    if (!token) {
      // Try to refresh the token first
      const refreshed = await refreshAccessToken()
      if (!refreshed) {
        throw new Error('No access token available and refresh failed')
      }
      token = getAccessToken()
    }

    try {
      const response = await $fetch<T>(url, {
        method: options.method,
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: options.body
      })
      return response
    } catch (error: any) {
      // Check if it's a 401 error (token expired)
      if (error?.response?.status === 401 || error?.statusCode === 401) {
        // Try to refresh the token
        const refreshed = await refreshAccessToken()
        if (!refreshed) {
          throw new Error('Token expired and refresh failed')
        }

        // Get the new token and retry the request
        const newToken = getAccessToken()
        const response = await $fetch<T>(url, {
          method: options.method,
          headers: {
            'Authorization': `Bearer ${newToken}`
          },
          body: options.body
        })
        return response
      }
      throw error
    }
  }

  const addToSyncQueue = async (item: SyncQueueItem) => {
    await localDB.init()
    await localDB.addToSyncQueue(item)

    // Trigger sync if online
    if (isOnline.value) {
      await syncData()
    }
  }

  const syncData = async () => {
    if (syncing.value) return
    if (!isOnline.value) return

    syncing.value = true

    try {
      await localDB.init()
      const queue = await localDB.getSyncQueue()

      if (queue.length === 0) {
        syncing.value = false
        return
      }

      // Group items by workout for batch processing
      const workoutItems = queue.filter(item => item.entityType === 'workout')

      // Process each item
      for (const item of workoutItems) {
        try {
          if (item.action === 'create') {
            await syncCreateWorkout(item)
          } else if (item.action === 'update') {
            await syncUpdateWorkout(item)
          } else if (item.action === 'delete') {
            await syncDeleteWorkout(item)
          }

          // Remove from sync queue on success
          await localDB.removeSyncQueueItem(item.id)
        } catch (error) {
          console.error('Sync failed for item:', item, error)

          // Increment retry count
          item.retryCount++
          if (item.retryCount < 3) {
            await localDB.addToSyncQueue(item)
          } else {
            console.error('Max retries reached for item:', item)
            // Mark as failed but keep in queue for manual retry
          }
        }
      }

      lastSyncTime.value = new Date()
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      syncing.value = false
    }
  }

  const syncCreateWorkout = async (item: SyncQueueItem) => {
    const workout = item.data

    // Send to server with automatic token refresh
    const response = await authenticatedFetch<{ id: string; exercises?: Array<{ id: string }> }>(
      '/api/workouts',
      {
        method: 'POST',
        body: {
          date: workout.date,
          notes: workout.notes,
          exercises: workout.exercises.map((e: any) => ({
            name: e.name,
            sets: e.sets,
            reps: e.reps,
            weight: e.weight,
            notes: e.notes
          }))
        }
      }
    )

    // Update local record with serverId
    const localWorkout = await localDB.getWorkout(workout.localId)
    if (localWorkout) {
      localWorkout.serverId = response.id
      localWorkout.syncStatus = 'synced'
      await localDB.saveWorkout(localWorkout)

      // Update exercises with serverIds if provided
      if (response.exercises && response.exercises.length > 0) {
        const localExercises = await localDB.getExercisesByWorkout(workout.localId)
        for (let i = 0; i < localExercises.length && i < response.exercises.length; i++) {
          const localExercise = localExercises[i]
          if (localExercise && response.exercises[i]) {
            localExercise.serverId = response.exercises[i].id
            await localDB.saveExercise(localExercise)
          }
        }
      }
    }
  }

  const syncUpdateWorkout = async (item: SyncQueueItem) => {
    const workout = item.data

    if (!workout.serverId) {
      // If no serverId, treat as create
      return syncCreateWorkout(item)
    }

    // Send to server with automatic token refresh
    await authenticatedFetch(`/api/workouts/${workout.serverId}`, {
      method: 'PUT',
      body: {
        date: workout.date,
        notes: workout.notes,
        exercises: workout.exercises.map((e: any) => ({
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          weight: e.weight,
          notes: e.notes
        }))
      }
    })

    // Update sync status
    const localWorkout = await localDB.getWorkout(workout.localId)
    if (localWorkout) {
      localWorkout.syncStatus = 'synced'
      await localDB.saveWorkout(localWorkout)
    }
  }

  const syncDeleteWorkout = async (item: SyncQueueItem) => {
    const { serverId } = item.data

    if (serverId) {
      // Delete from server with automatic token refresh
      await authenticatedFetch(`/api/workouts/${serverId}`, {
        method: 'DELETE'
      })
    }
  }

  // Auto-sync when coming online
  const setupAutoSync = () => {
    if (import.meta.client) {
      watch(isOnline, (online) => {
        if (online) {
          syncData()
        }
      })

      // Periodic sync every 5 minutes when online
      setInterval(() => {
        if (isOnline.value) {
          syncData()
        }
      }, 5 * 60 * 1000)
    }
  }

  return {
    syncing,
    lastSyncTime,
    addToSyncQueue,
    syncData,
    setupAutoSync
  }
}
