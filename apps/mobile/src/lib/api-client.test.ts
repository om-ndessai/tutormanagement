import { ApiRequestError, apiClient, requestHeaders } from './api-client';
import { on } from './events';
import { clearActiveOrg, setActiveOrg, withOrg } from './organization';
import { toQueryString } from './query-string';
import { setDevUser, setServer } from './server';

function respond(status: number, body: unknown) {
  return Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  } as Response);
}

describe('api client', () => {
  const fetchMock = jest.fn();
  beforeEach(async () => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    clearActiveOrg();
    await setDevUser(null);
    await setServer('local');
  });

  it('names the organization and the developer persona on every request', async () => {
    await setActiveOrg('chmi');
    await setDevUser('Alex.Chen.Math@gmail.com');
    fetchMock.mockReturnValue(respond(200, { data: { ok: true } }));

    await apiClient.get('/dashboard');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8787/api/dashboard');
    expect(init.credentials).toBe('omit');
    expect(init.headers['X-Organization']).toBe('chmi');
    expect(init.headers['X-Dev-User']).toBe('alex.chen.math@gmail.com');
  });

  it('sends no organization before one is chosen', () => {
    expect(requestHeaders()['X-Organization']).toBeUndefined();
  });

  it('turns the error envelope into an ApiRequestError with field errors', async () => {
    fetchMock.mockReturnValue(
      respond(400, {
        error: {
          code: 'validation_error',
          message: 'Check the form.',
          details: { email: ['Invalid email'] },
        },
      }),
    );
    const error = await apiClient.post('/users', {}).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).status).toBe(400);
    expect((error as ApiRequestError).fieldErrors).toEqual({ email: 'Invalid email' });
  });

  it('announces a lost session and a lost organization', async () => {
    const unauthenticated = jest.fn();
    const orgRequired = jest.fn();
    const offA = on('unauthenticated', unauthenticated);
    const offB = on('organization-required', orgRequired);

    fetchMock.mockReturnValueOnce(respond(401, { error: { code: 'unauthenticated', message: 'Sign in.' } }));
    await apiClient.get('/auth/session').catch(() => undefined);
    fetchMock.mockReturnValueOnce(
      respond(403, { error: { code: 'organization_required', message: 'Choose an organization.' } }),
    );
    await apiClient.get('/dashboard').catch(() => undefined);

    expect(unauthenticated).toHaveBeenCalledTimes(1);
    expect(orgRequired).toHaveBeenCalledTimes(1);
    offA();
    offB();
  });

  it('reports an unreachable server plainly', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const error = (await apiClient.get('/health').catch((caught: unknown) => caught)) as ApiRequestError;
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/Could not reach the server/);
  });

  it('returns undefined for 204', async () => {
    fetchMock.mockReturnValue(respond(204, null));
    await expect(apiClient.delete('/comments/1')).resolves.toBeUndefined();
  });
});

describe('toQueryString', () => {
  it('skips empty values and encodes the rest', () => {
    expect(toQueryString({ search: 'a b&c', role: undefined, status: '', limit: 25, deleted: false })).toBe(
      '?search=a%20b%26c&limit=25&deleted=false',
    );
    expect(toQueryString({})).toBe('');
  });
});

describe('withOrg', () => {
  it('names the active organization on a download path', async () => {
    await setActiveOrg('riverside');
    expect(withOrg('/payments/export.csv')).toBe('/payments/export.csv?org=riverside');
    expect(withOrg('/sessions/export.csv?from=2026-01-01')).toBe(
      '/sessions/export.csv?from=2026-01-01&org=riverside',
    );
  });
});
