import { describe, it, expect } from 'vitest';
import { shuffle, performDraw } from '../../utils/drawUtils';

describe('Draw Algorithm (drawUtils.js)', () => {

  describe('shuffle', () => {
    it('produces a permutation of the same elements', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffle([...original]);
      expect(shuffled).toHaveLength(original.length);
      expect(shuffled.sort()).toEqual(original.sort());
    });

    it('is non-deterministic (arrays differ occasionally)', () => {
      const original = Array.from({ length: 50 }, (_, i) => i);
      const shuffled1 = shuffle([...original]);
      const shuffled2 = shuffle([...original]);
      // Small chance they are identical, but with 50 elements practically impossible
      expect(shuffled1).not.toEqual(shuffled2);
    });
  });

  describe('performDraw', () => {
    it('fails when there are fewer than 3 users', () => {
      const users = [
        { id: '1', familyId: 'A' },
        { id: '2', familyId: 'B' }
      ];
      const result = performDraw(users);
      expect(result.success).toBe(false);
      expect(result.message).toContain('at least 3 users');
    });

    it('succeeds with valid users across different families', () => {
      const users = [
        { id: '1', familyId: 'A' },
        { id: '2', familyId: 'A' },
        { id: '3', familyId: 'B' },
        { id: '4', familyId: 'B' },
        { id: '5', familyId: 'C' },
      ];
      const result = performDraw(users);
      
      expect(result.success).toBe(true);
      expect(Object.keys(result.assignments)).toHaveLength(5);
      
      // Verify rules: no self-assignment, no same-family assignment
      const usersById = users.reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
      
      for (const [buyerId, recipientId] of Object.entries(result.assignments)) {
        expect(buyerId).not.toBe(recipientId);
        
        const buyer = usersById[buyerId];
        const recipient = usersById[recipientId];
        
        expect(buyer.familyId).not.toBe(recipient.familyId);
      }
    });

    it('fails gracefully when all users share the same family (impossible valid draw)', () => {
      const users = [
        { id: '1', familyId: 'A' },
        { id: '2', familyId: 'A' },
        { id: '3', familyId: 'A' },
        { id: '4', familyId: 'A' }
      ];
      const result = performDraw(users);
      expect(result.success).toBe(false);
      expect(result.message).toContain('valid combination');
    });

    it('succeeds for many families', () => {
      const users = Array.from({ length: 20 }, (_, i) => ({
        id: `user-${i}`,
        familyId: `fam-${i % 4}`
      }));
      const result = performDraw(users);
      expect(result.success).toBe(true);
    });
  });

});
