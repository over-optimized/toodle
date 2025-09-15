// T027: Integration Test - Countdown List with Timers
// CRITICAL: This test MUST FAIL before implementation
// Tests complete countdown list workflow with target dates and deadline management

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key'

describe('Countdown List Management Integration', () => {
  let supabase: ReturnType<typeof createClient>
  let authToken: string
  let userId: string

  beforeEach(async () => {
    supabase = createClient(supabaseUrl, supabaseKey)

    const testEmail = `countdown-${Date.now()}@example.com`
    const { data: authData, error: authError } = await supabase.auth.signInWithOtp({
      email: testEmail,
      options: {
        shouldCreateUser: true
      }
    })

    if (authError || !authData.user) {
      throw new Error('Failed to create test user for countdown list integration test')
    }

    authToken = authData.session?.access_token || ''
    userId = authData.user.id
  })

  describe('Event Planning Workflow', () => {
    it('should handle complete event planning from creation to deadline', async () => {
      // Step 1: Create countdown list for event planning
      const eventDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now

      const createListResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'countdown',
          title: 'Wedding Planning Checklist'
        })
      })

      expect(createListResponse.status).toBe(201)
      const createdList = await createListResponse.json()
      const list = Array.isArray(createdList) ? createdList[0] : createdList
      const listId = list.id

      expect(list.type).toBe('countdown')
      expect(list.title).toBe('Wedding Planning Checklist')

      // Step 2: Add tasks with different deadlines leading up to event
      const planningTasks = [
        {
          content: 'Book venue',
          target_date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days
          sort_order: 1
        },
        {
          content: 'Send invitations',
          target_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
          sort_order: 2
        },
        {
          content: 'Order flowers',
          target_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days
          sort_order: 3
        },
        {
          content: 'Final headcount',
          target_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
          sort_order: 4
        },
        {
          content: 'Pick up dress',
          target_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days
          sort_order: 5
        },
        {
          content: 'Rehearsal dinner',
          target_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day
          sort_order: 6
        },
        {
          content: 'Wedding ceremony',
          target_date: eventDate.toISOString(), // Event day
          sort_order: 7
        }
      ]

      const createdItems = []
      for (const task of planningTasks) {
        const itemResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            list_id: listId,
            ...task
          })
        })

        expect(itemResponse.status).toBe(201)
        const createdItem = await itemResponse.json()
        const itemData = Array.isArray(createdItem) ? createdItem[0] : createdItem
        createdItems.push(itemData)

        expect(itemData.content).toBe(task.content)
        expect(itemData.target_date).toBe(task.target_date)
        expect(itemData.is_completed).toBe(false)
      }

      // Step 3: Verify countdown list structure
      const listWithItemsResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*).order(target_date)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(listWithItemsResponse.status).toBe(200)
      const listWithItems = await listWithItemsResponse.json()

      expect(listWithItems.items).toHaveLength(7)

      // Items should be ordered by target_date (closest deadline first)
      const targetDates = listWithItems.items.map((item: any) => new Date(item.target_date))
      for (let i = 1; i < targetDates.length; i++) {
        expect(targetDates[i].getTime()).toBeGreaterThanOrEqual(targetDates[i - 1].getTime())
      }

      // Step 4: Complete tasks in timeline order
      const tasksToComplete = createdItems.slice(0, 5) // Complete first 5 tasks

      for (const task of tasksToComplete) {
        const completeResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${task.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            is_completed: true
          })
        })

        expect(completeResponse.status).toBe(200)
        const completedItem = await completeResponse.json()
        const itemData = Array.isArray(completedItem) ? completedItem[0] : completedItem
        expect(itemData.is_completed).toBe(true)

        // Verify target_date preserved
        expect(itemData.target_date).toBe(task.target_date)
      }

      // Step 5: Check countdown progress
      const progressResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const progressList = await progressResponse.json()
      const completedTasks = progressList.items.filter((item: any) => item.is_completed)
      const upcomingTasks = progressList.items.filter((item: any) => !item.is_completed)

      expect(completedTasks).toHaveLength(5)
      expect(upcomingTasks).toHaveLength(2)

      // Step 6: Verify upcoming deadlines
      const upcomingDeadlines = upcomingTasks.map((item: any) => ({
        content: item.content,
        target_date: new Date(item.target_date),
        days_until: Math.ceil((new Date(item.target_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      }))

      expect(upcomingDeadlines[0].days_until).toBeLessThanOrEqual(2) // Should be soon
      expect(upcomingDeadlines[1].days_until).toBeLessThanOrEqual(7) // Within a week

      // Step 7: Update a deadline (reschedule task)
      const taskToReschedule = upcomingTasks[0]
      const newDeadline = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString() // Push out a day

      const rescheduleResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${taskToReschedule.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          target_date: newDeadline
        })
      })

      expect(rescheduleResponse.status).toBe(200)
      const rescheduledItem = await rescheduleResponse.json()
      const rescheduledData = Array.isArray(rescheduledItem) ? rescheduledItem[0] : rescheduledItem
      expect(rescheduledData.target_date).toBe(newDeadline)
    })

    it('should handle project deadline management with milestones', async () => {
      // Create project countdown list
      const projectDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'countdown',
          title: 'Software Release v2.0'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Add project milestones
      const milestones = [
        {
          content: 'Complete requirements gathering',
          target_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          sort_order: 1
        },
        {
          content: 'Finish database schema design',
          target_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          sort_order: 2
        },
        {
          content: 'Implement core features',
          target_date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
          sort_order: 3
        },
        {
          content: 'Complete testing phase',
          target_date: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
          sort_order: 4
        },
        {
          content: 'Deploy to production',
          target_date: projectDeadline.toISOString(),
          sort_order: 5
        }
      ]

      const createdMilestones = []
      for (const milestone of milestones) {
        const milestoneResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            list_id: listId,
            ...milestone
          })
        })

        const createdMilestone = await milestoneResponse.json()
        const milestoneData = Array.isArray(createdMilestone) ? createdMilestone[0] : createdMilestone
        createdMilestones.push(milestoneData)
      }

      // Simulate project progress - complete early milestones
      const milestonesToComplete = createdMilestones.slice(0, 2)

      for (const milestone of milestonesToComplete) {
        await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${milestone.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            is_completed: true
          })
        })
      }

      // Check project status
      const statusResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const projectStatus = await statusResponse.json()
      const completedMilestones = projectStatus.items.filter((item: any) => item.is_completed)
      const remainingMilestones = projectStatus.items.filter((item: any) => !item.is_completed)

      expect(completedMilestones).toHaveLength(2)
      expect(remainingMilestones).toHaveLength(3)

      // Calculate project progress
      const progressPercent = (completedMilestones.length / projectStatus.items.length) * 100
      expect(progressPercent).toBe(40) // 2/5 completed = 40%

      // Check critical path (remaining deadlines)
      const criticalTasks = remainingMilestones
        .map((item: any) => ({
          content: item.content,
          days_remaining: Math.ceil((new Date(item.target_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        }))
        .sort((a: any, b: any) => a.days_remaining - b.days_remaining)

      expect(criticalTasks[0].days_remaining).toBeLessThanOrEqual(30) // Closest deadline within 30 days
    })
  })

  describe('Deadline and Time Management', () => {
    it('should handle urgent vs non-urgent task prioritization', async () => {
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'countdown',
          title: 'Task Prioritization'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Add tasks with varying urgency
      const tasks = [
        {
          content: 'Urgent: Fix critical bug',
          target_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
          sort_order: 1
        },
        {
          content: 'Medium: Prepare presentation',
          target_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
          sort_order: 2
        },
        {
          content: 'Low: Update documentation',
          target_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week
          sort_order: 3
        },
        {
          content: 'Critical: Submit proposal',
          target_date: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours
          sort_order: 4
        }
      ]

      for (const task of tasks) {
        const taskResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            list_id: listId,
            ...task
          })
        })

        expect(taskResponse.status).toBe(201)
      }

      // Retrieve tasks ordered by urgency (target_date)
      const urgencyResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*).order(target_date)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const urgencyList = await urgencyResponse.json()
      const sortedTasks = urgencyList.items

      // Should be ordered by deadline (most urgent first)
      expect(sortedTasks[0].content).toContain('Urgent: Fix critical bug')
      expect(sortedTasks[1].content).toContain('Critical: Submit proposal')
      expect(sortedTasks[2].content).toContain('Medium: Prepare presentation')
      expect(sortedTasks[3].content).toContain('Low: Update documentation')

      // Calculate time remaining for each task
      const currentTime = Date.now()
      const taskUrgency = sortedTasks.map((task: any) => ({
        content: task.content,
        hours_remaining: Math.max(0, (new Date(task.target_date).getTime() - currentTime) / (60 * 60 * 1000)),
        is_overdue: new Date(task.target_date).getTime() < currentTime
      }))

      taskUrgency.forEach((task: any) => {
        expect(task.hours_remaining).toBeGreaterThanOrEqual(0)
        expect(typeof task.is_overdue).toBe('boolean')
      })
    })

    it('should handle deadline extensions and modifications', async () => {
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'countdown',
          title: 'Deadline Management'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Add task with initial deadline
      const originalDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()

      const taskResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          list_id: listId,
          content: 'Complete project phase 1',
          target_date: originalDeadline,
          sort_order: 1
        })
      })

      const createdTask = await taskResponse.json()
      const taskData = Array.isArray(createdTask) ? createdTask[0] : createdTask
      const taskId = taskData.id

      expect(taskData.target_date).toBe(originalDeadline)

      // Extend deadline by 3 days
      const extendedDeadline = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString()

      const extensionResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${taskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          target_date: extendedDeadline
        })
      })

      expect(extensionResponse.status).toBe(200)
      const extendedTask = await extensionResponse.json()
      const extendedData = Array.isArray(extendedTask) ? extendedTask[0] : extendedTask
      expect(extendedData.target_date).toBe(extendedDeadline)

      // Move deadline earlier (rush job)
      const rushedDeadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()

      const rushResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${taskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          target_date: rushedDeadline
        })
      })

      expect(rushResponse.status).toBe(200)
      const rushedTask = await rushResponse.json()
      const rushedData = Array.isArray(rushedTask) ? rushedTask[0] : rushedTask
      expect(rushedData.target_date).toBe(rushedDeadline)

      // Remove deadline completely (convert to open-ended task)
      const removeDeadlineResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${taskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          target_date: null
        })
      })

      expect(removeDeadlineResponse.status).toBe(200)
      const openEndedTask = await removeDeadlineResponse.json()
      const openEndedData = Array.isArray(openEndedTask) ? openEndedTask[0] : openEndedTask
      expect(openEndedData.target_date).toBeNull()
    })
  })

  describe('Error Handling and Validation', () => {
    it('should enforce countdown list business rules', async () => {
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'countdown',
          title: 'Validation Test List'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Try to create countdown item without target_date
      const missingDateResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: listId,
          content: 'Task without deadline',
          sort_order: 1
          // target_date missing
        })
      })

      expect(missingDateResponse.status).toBe(400)

      // Try to create countdown item with past target_date
      const pastDateResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: listId,
          content: 'Task with past deadline',
          target_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
          sort_order: 1
        })
      })

      expect(pastDateResponse.status).toBe(400)

      // Create valid countdown item
      const validResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: listId,
          content: 'Valid countdown task',
          target_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          sort_order: 1
        })
      })

      expect(validResponse.status).toBe(201)
    })

    it('should handle timezone considerations', async () => {
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'countdown',
          title: 'Timezone Test List'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Create task with explicit timezone
      const utcDeadline = new Date('2024-12-25T15:00:00.000Z').toISOString()

      const taskResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          list_id: listId,
          content: 'Christmas deadline task',
          target_date: utcDeadline,
          sort_order: 1
        })
      })

      expect(taskResponse.status).toBe(201)
      const createdTask = await taskResponse.json()
      const taskData = Array.isArray(createdTask) ? createdTask[0] : createdTask

      // Verify UTC timestamp preserved
      expect(taskData.target_date).toBe(utcDeadline)

      // Verify can parse back to Date object
      const parsedDate = new Date(taskData.target_date)
      expect(parsedDate.toString()).not.toBe('Invalid Date')
      expect(parsedDate.getUTCFullYear()).toBe(2024)
      expect(parsedDate.getUTCMonth()).toBe(11) // December (0-indexed)
      expect(parsedDate.getUTCDate()).toBe(25)
    })
  })

  describe('Performance and Scale', () => {
    it('should handle multiple countdown lists efficiently', async () => {
      // Create multiple countdown lists for different purposes
      const listTypes = [
        'Personal Goals 2024',
        'Work Project Deadlines',
        'Home Renovation Timeline',
        'Travel Planning Checklist'
      ]

      const createdLists = []

      for (const title of listTypes) {
        const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            type: 'countdown',
            title: title
          })
        })

        const list = await listResponse.json()
        const listData = Array.isArray(list) ? list[0] : list
        createdLists.push(listData)
      }

      // Add items to each list
      for (const list of createdLists) {
        for (let i = 0; i < 5; i++) {
          const itemResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
              'apikey': supabaseKey
            },
            body: JSON.stringify({
              list_id: list.id,
              content: `${list.title} - Task ${i + 1}`,
              target_date: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString(),
              sort_order: i + 1
            })
          })

          expect(itemResponse.status).toBe(201)
        }
      }

      // Verify all lists and items created
      const allListsResponse = await fetch(`${supabaseUrl}/rest/v1/lists?type=eq.countdown&select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const allLists = await allListsResponse.json()
      const countdownLists = allLists.filter((list: any) => list.type === 'countdown')

      expect(countdownLists.length).toBeGreaterThanOrEqual(4)

      // Check total item count across all countdown lists
      const totalItems = countdownLists.reduce((sum: number, list: any) => sum + list.items.length, 0)
      expect(totalItems).toBeGreaterThanOrEqual(20) // 4 lists × 5 items each
    })
  })
})