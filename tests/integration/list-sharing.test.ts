// T028: Integration Test - List Sharing Workflow
// CRITICAL: This test MUST FAIL before implementation
// Tests complete list sharing workflow with permissions and expiration

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key'

describe('List Sharing Workflow Integration', () => {
  let ownerSupabase: ReturnType<typeof createClient>
  let recipientSupabase: ReturnType<typeof createClient>
  let ownerAuthToken: string
  let recipientAuthToken: string
  let ownerId: string
  let recipientId: string
  let ownerEmail: string
  let recipientEmail: string

  beforeEach(async () => {
    // Create owner user
    ownerSupabase = createClient(supabaseUrl, supabaseKey)
    ownerEmail = `owner-${Date.now()}@example.com`

    const { data: ownerAuthData, error: ownerAuthError } = await ownerSupabase.auth.signInWithOtp({
      email: ownerEmail,
      options: {
        shouldCreateUser: true
      }
    })

    if (ownerAuthError || !ownerAuthData.user) {
      throw new Error('Failed to create owner user for sharing integration test')
    }

    ownerAuthToken = ownerAuthData.session?.access_token || ''
    ownerId = ownerAuthData.user.id

    // Create recipient user
    recipientSupabase = createClient(supabaseUrl, supabaseKey)
    recipientEmail = `recipient-${Date.now()}@example.com`

    const { data: recipientAuthData, error: recipientAuthError } = await recipientSupabase.auth.signInWithOtp({
      email: recipientEmail,
      options: {
        shouldCreateUser: true
      }
    })

    if (recipientAuthError || !recipientAuthData.user) {
      throw new Error('Failed to create recipient user for sharing integration test')
    }

    recipientAuthToken = recipientAuthData.session?.access_token || ''
    recipientId = recipientAuthData.user.id
  })

  describe('Complete Sharing Workflow', () => {
    it('should handle full sharing lifecycle from creation to expiration', async () => {
      // Step 1: Owner creates a list
      const createListResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'simple',
          title: 'Shared Shopping List'
        })
      })

      expect(createListResponse.status).toBe(201)
      const createdList = await createListResponse.json()
      const list = Array.isArray(createdList) ? createdList[0] : createdList
      const listId = list.id

      expect(list.user_id).toBe(ownerId)
      expect(list.is_private).toBe(true) // Default private

      // Step 2: Owner adds items to the list
      const initialItems = [
        { content: 'Milk', sort_order: 1 },
        { content: 'Bread', sort_order: 2 },
        { content: 'Eggs', sort_order: 3 }
      ]

      for (const item of initialItems) {
        const itemResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ownerAuthToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            list_id: listId,
            ...item
          })
        })

        expect(itemResponse.status).toBe(201)
      }

      // Step 3: Verify recipient cannot see list initially
      const initialAccessResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}`, {
        headers: {
          'Authorization': `Bearer ${recipientAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect([403, 404]).toContain(initialAccessResponse.status)

      // Step 4: Owner creates read-only share
      const createShareResponse = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          list_id: listId,
          shared_with_email: recipientEmail,
          role: 'read',
          created_by: ownerId
        })
      })

      expect(createShareResponse.status).toBe(201)
      const createdShare = await createShareResponse.json()
      const share = Array.isArray(createdShare) ? createdShare[0] : createdShare

      expect(share.list_id).toBe(listId)
      expect(share.shared_with_email).toBe(recipientEmail)
      expect(share.role).toBe('read')
      expect(share.created_by).toBe(ownerId)

      // Verify expiration is set (within 24 hours)
      const expiresAt = new Date(share.expires_at)
      const createdAt = new Date(share.created_at)
      const hoursUntilExpiry = (expiresAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
      expect(hoursUntilExpiry).toBeLessThanOrEqual(24)
      expect(hoursUntilExpiry).toBeGreaterThan(0)

      // Step 5: Recipient can now view the list
      const sharedAccessResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${recipientAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(sharedAccessResponse.status).toBe(200)
      const sharedList = await sharedAccessResponse.json()

      expect(sharedList.id).toBe(listId)
      expect(sharedList.title).toBe('Shared Shopping List')
      expect(sharedList.items).toHaveLength(3)
      expect(sharedList.items[0].content).toBe('Milk')

      // Step 6: Verify recipient cannot edit with read-only access
      const attemptEditResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${recipientAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: listId,
          content: 'Unauthorized item',
          sort_order: 4
        })
      })

      expect([403, 404]).toContain(attemptEditResponse.status)

      // Step 7: Owner upgrades share to edit permissions
      const upgradeShareResponse = await fetch(`${supabaseUrl}/rest/v1/shares?id=eq.${share.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          role: 'edit'
        })
      })

      expect(upgradeShareResponse.status).toBe(200)
      const upgradedShare = await upgradeShareResponse.json()
      const upgradeData = Array.isArray(upgradedShare) ? upgradedShare[0] : upgradedShare
      expect(upgradeData.role).toBe('edit')

      // Step 8: Recipient can now edit the list
      const editItemResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${recipientAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          list_id: listId,
          content: 'Butter (added by recipient)',
          sort_order: 4
        })
      })

      expect(editItemResponse.status).toBe(201)
      const addedItem = await editItemResponse.json()
      const itemData = Array.isArray(addedItem) ? addedItem[0] : addedItem
      expect(itemData.content).toBe('Butter (added by recipient)')

      // Step 9: Both users can see the updated list
      const ownerUpdatedListResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const recipientUpdatedListResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${recipientAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(ownerUpdatedListResponse.status).toBe(200)
      expect(recipientUpdatedListResponse.status).toBe(200)

      const ownerUpdatedList = await ownerUpdatedListResponse.json()
      const recipientUpdatedList = await recipientUpdatedListResponse.json()

      expect(ownerUpdatedList.items).toHaveLength(4)
      expect(recipientUpdatedList.items).toHaveLength(4)
      expect(ownerUpdatedList.items[3].content).toBe('Butter (added by recipient)')
      expect(recipientUpdatedList.items[3].content).toBe('Butter (added by recipient)')

      // Step 10: Owner revokes share
      const revokeShareResponse = await fetch(`${supabaseUrl}/rest/v1/shares?id=eq.${share.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(revokeShareResponse.status).toBe(204)

      // Step 11: Recipient loses access
      const revokedAccessResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}`, {
        headers: {
          'Authorization': `Bearer ${recipientAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect([403, 404]).toContain(revokedAccessResponse.status)

      // Step 12: Owner still has access
      const ownerStillAccessResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}`, {
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(ownerStillAccessResponse.status).toBe(200)
    })

    it('should handle collaborative editing scenario', async () => {
      // Create list
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'grocery',
          title: 'Collaborative Grocery List'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Share with edit permissions
      const shareResponse = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: listId,
          shared_with_email: recipientEmail,
          role: 'edit',
          created_by: ownerId
        })
      })

      expect(shareResponse.status).toBe(201)

      // Both users add items simultaneously
      const ownerItemPromise = fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: listId,
          content: 'Apples (added by owner)',
          sort_order: 1
        })
      })

      const recipientItemPromise = fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${recipientAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: listId,
          content: 'Bananas (added by recipient)',
          sort_order: 2
        })
      })

      const [ownerResult, recipientResult] = await Promise.all([ownerItemPromise, recipientItemPromise])

      expect(ownerResult.status).toBe(201)
      expect(recipientResult.status).toBe(201)

      // Both users can see all items
      const finalListResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const finalList = await finalListResponse.json()
      expect(finalList.items).toHaveLength(2)

      const itemContents = finalList.items.map((item: any) => item.content)
      expect(itemContents).toContain('Apples (added by owner)')
      expect(itemContents).toContain('Bananas (added by recipient)')

      // Both users can complete items
      const firstItem = finalList.items[0]
      const completeByRecipientResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${firstItem.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${recipientAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          is_completed: true
        })
      })

      expect(completeByRecipientResponse.status).toBe(200)

      // Owner sees the completion
      const ownerSeesCompletionResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const ownerSeesCompletion = await ownerSeesCompletionResponse.json()
      const completedItem = ownerSeesCompletion.items.find((item: any) => item.id === firstItem.id)
      expect(completedItem.is_completed).toBe(true)
    })
  })

  describe('Share Management and Permissions', () => {
    it('should handle multiple shares for the same list', async () => {
      // Create a third user
      const thirdUserEmail = `third-${Date.now()}@example.com`
      const thirdUserSupabase = createClient(supabaseUrl, supabaseKey)

      const { data: thirdUserAuthData } = await thirdUserSupabase.auth.signInWithOtp({
        email: thirdUserEmail,
        options: {
          shouldCreateUser: true
        }
      })

      const thirdUserAuthToken = thirdUserAuthData.session?.access_token || ''

      // Create list
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'simple',
          title: 'Multi-User Shared List'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Share with first recipient (read-only)
      const share1Response = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: listId,
          shared_with_email: recipientEmail,
          role: 'read',
          created_by: ownerId
        })
      })

      // Share with second recipient (edit)
      const share2Response = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: listId,
          shared_with_email: thirdUserEmail,
          role: 'edit',
          created_by: ownerId
        })
      })

      expect(share1Response.status).toBe(201)
      expect(share2Response.status).toBe(201)

      // All three users can view the list
      const ownerViewResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}`, {
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const recipient1ViewResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}`, {
        headers: {
          'Authorization': `Bearer ${recipientAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const recipient2ViewResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}`, {
        headers: {
          'Authorization': `Bearer ${thirdUserAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(ownerViewResponse.status).toBe(200)
      expect(recipient1ViewResponse.status).toBe(200)
      expect(recipient2ViewResponse.status).toBe(200)

      // Only owner and edit-role recipient can add items
      const recipient1EditResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${recipientAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: listId,
          content: 'Read-only user item',
          sort_order: 1
        })
      })

      const recipient2EditResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${thirdUserAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: listId,
          content: 'Edit user item',
          sort_order: 1
        })
      })

      expect([403, 404]).toContain(recipient1EditResponse.status) // Read-only denied
      expect(recipient2EditResponse.status).toBe(201) // Edit allowed

      // Owner can see all shares
      const ownerSharesResponse = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${listId}`, {
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(ownerSharesResponse.status).toBe(200)
      const ownerShares = await ownerSharesResponse.json()
      expect(ownerShares).toHaveLength(2)

      const shareEmails = ownerShares.map((share: any) => share.shared_with_email)
      expect(shareEmails).toContain(recipientEmail)
      expect(shareEmails).toContain(thirdUserEmail)
    })

    it('should prevent unauthorized sharing operations', async () => {
      // Create list as owner
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'simple',
          title: 'Security Test List'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Recipient tries to share list they don't own
      const unauthorizedShareResponse = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${recipientAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: listId,
          shared_with_email: 'someone@example.com',
          role: 'edit',
          created_by: recipientId
        })
      })

      expect([403, 404]).toContain(unauthorizedShareResponse.status)

      // Recipient tries to view shares for list they don't own
      const unauthorizedViewSharesResponse = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${listId}`, {
        headers: {
          'Authorization': `Bearer ${recipientAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect([403, 404]).toContain(unauthorizedViewSharesResponse.status)

      // Unauthenticated user tries to access list
      const unauthenticatedResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}`, {
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(unauthenticatedResponse.status).toBe(401)
    })
  })

  describe('Share Expiration and Cleanup', () => {
    it('should handle share expiration correctly', async () => {
      // Create list
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'simple',
          title: 'Expiration Test List'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Create share with custom expiration (very short for testing)
      const shortExpiration = new Date(Date.now() + 1000).toISOString() // 1 second

      const shareResponse = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          list_id: listId,
          shared_with_email: recipientEmail,
          role: 'read',
          created_by: ownerId,
          expires_at: shortExpiration
        })
      })

      // Note: The API might auto-correct this to be within 24 hours
      // This test verifies the expiration mechanism exists
      expect([201, 400]).toContain(shareResponse.status)

      if (shareResponse.status === 201) {
        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Access should be denied after expiration
        const expiredAccessResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}`, {
          headers: {
            'Authorization': `Bearer ${recipientAuthToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          }
        })

        expect([403, 404]).toContain(expiredAccessResponse.status)
      }
    })

    it('should handle share cleanup operations', async () => {
      // Create list with multiple shares
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'simple',
          title: 'Cleanup Test List'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Create multiple shares
      const shareEmails = [
        'user1@example.com',
        'user2@example.com',
        'user3@example.com'
      ]

      for (const email of shareEmails) {
        const shareResponse = await fetch(`${supabaseUrl}/rest/v1/shares`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ownerAuthToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            list_id: listId,
            shared_with_email: email,
            role: 'read',
            created_by: ownerId
          })
        })

        expect(shareResponse.status).toBe(201)
      }

      // Verify shares created
      const sharesResponse = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${listId}`, {
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const shares = await sharesResponse.json()
      expect(shares).toHaveLength(3)

      // Revoke all shares at once
      const revokeAllResponse = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${listId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(revokeAllResponse.status).toBe(204)

      // Verify all shares removed
      const verifyRemovedResponse = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${listId}`, {
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const remainingShares = await verifyRemovedResponse.json()
      expect(remainingShares).toHaveLength(0)

      // Test cleanup on list deletion
      const deleteListResponse = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${listId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(deleteListResponse.status).toBe(204)

      // Shares should be automatically cleaned up (CASCADE DELETE)
      const orphanSharesResponse = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${listId}`, {
        headers: {
          'Authorization': `Bearer ${ownerAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const orphanShares = await orphanSharesResponse.json()
      expect(orphanShares).toHaveLength(0)
    })
  })

  describe('Performance and Reliability', () => {
    it('should handle sharing operations efficiently', async () => {
      // Create multiple lists for sharing performance test
      const numLists = 5
      const createdLists = []

      for (let i = 0; i < numLists; i++) {
        const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ownerAuthToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            type: 'simple',
            title: `Performance Test List ${i + 1}`
          })
        })

        const list = await listResponse.json()
        const listData = Array.isArray(list) ? list[0] : list
        createdLists.push(listData)
      }

      // Share all lists with recipient
      const startTime = Date.now()

      const sharePromises = createdLists.map(list =>
        fetch(`${supabaseUrl}/rest/v1/shares`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ownerAuthToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            list_id: list.id,
            shared_with_email: recipientEmail,
            role: 'edit',
            created_by: ownerId
          })
        })
      )

      const shareResults = await Promise.all(sharePromises)
      const endTime = Date.now()

      // Verify all shares succeeded
      shareResults.forEach(result => {
        expect(result.status).toBe(201)
      })

      // Check performance
      const totalTime = endTime - startTime
      const avgTimePerShare = totalTime / numLists
      expect(avgTimePerShare).toBeLessThan(500) // 500ms per share max

      // Verify recipient can access all shared lists
      const recipientListsResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        headers: {
          'Authorization': `Bearer ${recipientAuthToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const recipientLists = await recipientListsResponse.json()
      const sharedListCount = recipientLists.filter((list: any) => list.user_id === ownerId).length
      expect(sharedListCount).toBe(numLists)
    })
  })
})