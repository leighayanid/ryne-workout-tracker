import { localDB } from '~/utils/db'
import type { LocalWorkout } from '~/types'

export interface WeeklyVolumeData {
  week: string
  volume: number
  change: number
  workoutCount: number
  totalReps: number
  weightedVolume: number
}

export const useVolumeStats = () => {
  /**
   * Calculate total volume for a workout (sets × reps × weight)
   * Returns both weighted volume and total reps
   */
  const calculateWorkoutVolume = async (workoutLocalId: string): Promise<{ weightedVolume: number; totalReps: number }> => {
    try {
      const exercises = await localDB.getExercisesByWorkout(workoutLocalId)
      let weightedVolume = 0
      let totalReps = 0

      for (const exercise of exercises) {
        const weight = exercise.weight ?? 0
        const reps = exercise.sets * exercise.reps

        weightedVolume += reps * weight
        totalReps += reps
      }

      return { weightedVolume, totalReps }
    } catch (error) {
      console.error('Error calculating workout volume:', error)
      return { weightedVolume: 0, totalReps: 0 }
    }
  }

  /**
   * Get weekly volume data for the last N weeks
   */
  const getWeeklyVolumeData = async (weeksCount: number = 4): Promise<WeeklyVolumeData[]> => {
    try {
      const workouts = await localDB.getWorkouts()

      // Sort workouts by date
      workouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      // Group workouts by week
      const weeklyData = new Map<string, { weightedVolume: number; totalReps: number; workoutCount: number }>()

      for (const workout of workouts) {
        const workoutDate = new Date(workout.date)

        // Get the start of the week (Sunday)
        const startOfWeek = new Date(workoutDate)
        startOfWeek.setDate(workoutDate.getDate() - workoutDate.getDay())
        startOfWeek.setHours(0, 0, 0, 0)

        const weekKey = startOfWeek.toISOString().split('T')[0]

        // Calculate volume for this workout
        const { weightedVolume, totalReps } = await calculateWorkoutVolume(workout.localId)

        if (!weeklyData.has(weekKey)) {
          weeklyData.set(weekKey, { weightedVolume: 0, totalReps: 0, workoutCount: 0 })
        }

        const weekData = weeklyData.get(weekKey)!
        weekData.weightedVolume += weightedVolume
        weekData.totalReps += totalReps
        weekData.workoutCount += 1
      }

      // Convert to array and sort by date
      const sortedWeeks = Array.from(weeklyData.entries())
        .map(([week, data]) => ({
          week,
          ...data
        }))
        .sort((a, b) => a.week.localeCompare(b.week))

      // Get last N weeks
      const recentWeeks = sortedWeeks.slice(-weeksCount)

      // Calculate percentage change
      const result: WeeklyVolumeData[] = recentWeeks.map((weekData, index) => {
        // Use totalReps as the primary metric (always > 0 if workouts exist)
        // Add weighted volume if it exists
        const combinedVolume = weekData.totalReps + weekData.weightedVolume

        let change = 0

        if (index > 0) {
          const previousCombined = recentWeeks[index - 1].totalReps + recentWeeks[index - 1].weightedVolume
          if (previousCombined > 0) {
            change = ((combinedVolume - previousCombined) / previousCombined) * 100
          }
        }

        return {
          week: formatWeekLabel(weekData.week),
          volume: Math.round(combinedVolume),
          change: Math.round(change),
          workoutCount: weekData.workoutCount,
          totalReps: Math.round(weekData.totalReps),
          weightedVolume: Math.round(weekData.weightedVolume)
        }
      })

      return result
    } catch (error) {
      console.error('Error getting weekly volume data:', error)
      return []
    }
  }

  /**
   * Format week key to readable label
   */
  const formatWeekLabel = (weekKey: string): string => {
    const date = new Date(weekKey)
    const now = new Date()

    // Check if it's this week
    const startOfThisWeek = new Date(now)
    startOfThisWeek.setDate(now.getDate() - now.getDay())
    startOfThisWeek.setHours(0, 0, 0, 0)

    if (date.getTime() === startOfThisWeek.getTime()) {
      return 'This Week'
    }

    // Check if it's last week
    const startOfLastWeek = new Date(startOfThisWeek)
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)

    if (date.getTime() === startOfLastWeek.getTime()) {
      return 'Last Week'
    }

    // Format as "Week of MMM DD"
    return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }

  /**
   * Get current week stats
   */
  const getCurrentWeekStats = async () => {
    try {
      const workouts = await localDB.getWorkouts()

      // Get start of this week (Sunday)
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)

      // Filter workouts from this week
      const thisWeekWorkouts = workouts.filter(workout => {
        const workoutDate = new Date(workout.date)
        return workoutDate >= startOfWeek
      })

      // Calculate total volume
      let weightedVolume = 0
      let totalReps = 0
      let totalExercises = 0

      for (const workout of thisWeekWorkouts) {
        const volume = await calculateWorkoutVolume(workout.localId)
        weightedVolume += volume.weightedVolume
        totalReps += volume.totalReps
        const exercises = await localDB.getExercisesByWorkout(workout.localId)
        totalExercises += exercises.length
      }

      return {
        workoutCount: thisWeekWorkouts.length,
        totalVolume: Math.round(totalReps + weightedVolume),
        totalExercises
      }
    } catch (error) {
      console.error('Error getting current week stats:', error)
      return {
        workoutCount: 0,
        totalVolume: 0,
        totalExercises: 0
      }
    }
  }

  return {
    calculateWorkoutVolume,
    getWeeklyVolumeData,
    getCurrentWeekStats,
    formatWeekLabel
  }
}
