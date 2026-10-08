import { downloadAndShare, filenameFrom } from '@/lib/download';
import { setActiveOrg } from '@/lib/organization';

const mockShare = jest.fn(() => Promise.resolve());
jest.mock('expo-sharing', () => ({ shareAsync: (...args: unknown[]) => mockShare(...(args as [])) }));

const mockFiles: { name: string; text?: string; deleted: boolean }[] = [];
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache' },
  File: class {
    record: { name: string; text?: string; deleted: boolean };
    constructor(_dir: string, name: string) {
      this.record = { name, deleted: false };
      mockFiles.push(this.record);
    }
    get uri() {
      return `file:///cache/${this.record.name}`;
    }
    get exists() {
      return !this.record.deleted;
    }
    create() {}
    write(text: string) {
      this.record.text = text;
    }
    delete() {
      this.record.deleted = true;
    }
  },
}));
jest.mock('@/lib/server', () => ({
  serverOrigin: () => 'http://localhost:8787',
  androidFallbackOrigin: () => null,
  devUser: () => 'alex.chen.math@gmail.com',
}));

const mockFetch = jest.fn();
beforeEach(async () => {
  mockFiles.length = 0;
  jest.clearAllMocks();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  await setActiveOrg('chmi');
});

describe('downloads', () => {
  it('names the file from Content-Disposition, never a path', () => {
    expect(filenameFrom('attachment; filename="sessions-2026.csv"', 'x.csv')).toBe('sessions-2026.csv');
    expect(filenameFrom(null, 'x.csv')).toBe('x.csv');
    expect(filenameFrom('attachment; filename="../evil.csv"', 'x.csv')).toBe('.._evil.csv');
  });

  it('sends the organization and identity, shares the file, then deletes it', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('date,student\n'),
      headers: { get: () => 'attachment; filename="sessions.csv"' },
    });
    await downloadAndShare('/sessions/export.csv?from=2026-09-01', 'fallback.csv');

    const [url, init] = mockFetch.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe('http://localhost:8787/api/sessions/export.csv?from=2026-09-01&org=chmi');
    expect(init.headers['X-Organization']).toBe('chmi');
    expect(init.headers['X-Dev-User']).toBe('alex.chen.math@gmail.com');
    expect(mockShare).toHaveBeenCalledWith(
      'file:///cache/sessions.csv',
      expect.objectContaining({ mimeType: 'text/csv' }),
    );
    expect(mockFiles[0]).toMatchObject({ name: 'sessions.csv', text: 'date,student\n', deleted: true });
  });

  it('deletes the file even when sharing fails', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('x'),
      headers: { get: () => null },
    });
    mockShare.mockRejectedValueOnce(new Error('dismissed'));
    await expect(downloadAndShare('/sessions/export.csv', 'sessions.csv')).rejects.toThrow('dismissed');
    expect(mockFiles[0]?.deleted).toBe(true);
  });

  it("throws the server's own words on a refusal, and writes nothing", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: { code: 'forbidden', message: 'Not yours.' } }),
      headers: { get: () => null },
    });
    await expect(downloadAndShare('/sessions/export.csv', 'sessions.csv')).rejects.toThrow('Not yours.');
    expect(mockFiles).toHaveLength(0);
  });
});
