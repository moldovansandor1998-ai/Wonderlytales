import { describe, it, expect } from 'vitest';
import { assessHungarianTranscript, reviewHungarianSpeech } from '@/lib/speechReview';
import { createServer } from 'http';
describe('Hungarian recording review', () => {
  it('recognizes the actual audio without a language hint or the script in the request', async () => {
    let requestBody = '';
    const server = createServer((req, res) => {
      req.on('data', chunk => requestBody += chunk);
      req.on('end', () => { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({text:'Szia!',language_code:'hun'})); });
    });
    await new Promise<void>(resolve => server.listen(0, resolve));
    try {
      const port = (server.address() as {port:number}).port;
      const result = await reviewHungarianSpeech(Buffer.alloc(200, 1), 'Szia!', 'test-key', `http://127.0.0.1:${port}`);
      expect(result).toMatchObject({hungarian:true,textMatches:true});
      expect(requestBody).toContain('scribe_v2');
      expect(requestBody).not.toContain('language_code');
      expect(requestBody).not.toContain('Szia!');
    } finally { server.close(); }
  });
  it('accepts Hungarian punctuation differences but preserves accents', () => {
    expect(assessHungarianTranscript('Hallod? Ropogós az egész erdő.', 'Hallod, ropogós az egész erdő!', 'hun')).toMatchObject({ hungarian: true, textMatches: true });
    expect(assessHungarianTranscript('erdő', 'erdo', 'hu').textMatches).toBe(false);
  });
  it('does not approve a different language or hallucinated dialogue', () => {
    const foreign = assessHungarianTranscript('Szia!', 'Szia!', 'en');
    expect(foreign.hungarian).toBe(false);
    expect(assessHungarianTranscript('Szia!', 'Hello!', 'hu').textMatches).toBe(false);
  });
});
