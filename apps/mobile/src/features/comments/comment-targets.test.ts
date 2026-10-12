import { commentTargetHref } from './comment-targets';

describe('commentTargetHref', () => {
  it('opens a person and a lesson on their own screens', () => {
    expect(commentTargetHref({ target_type: 'user', target_id: 'u1' })).toEqual({
      pathname: '/people/[id]',
      params: { id: 'u1' },
    });
    expect(commentTargetHref({ target_type: 'session', target_id: 's1' })).toEqual({
      pathname: '/sessions/[id]',
      params: { id: 's1' },
    });
  });

  it('narrows the pairings and the schedule to the one row', () => {
    expect(commentTargetHref({ target_type: 'assignment', target_id: 'a1' })).toEqual({
      pathname: '/pairings',
      params: { focus: 'a1' },
    });
    expect(commentTargetHref({ target_type: 'scheduled_session', target_id: 'r1' })).toEqual({
      pathname: '/schedule',
      params: { focus: 'r1' },
    });
  });
});
