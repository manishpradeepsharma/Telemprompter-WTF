import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODES } from './productFacts';

const root = resolve(__dirname, '../..');

const read = (relPath: string): string => readFileSync(resolve(root, relPath), 'utf8');

describe('Public Content Consistency against Product Facts', () => {
  const llms = read('public/llms.txt');
  const indexAstro = read('src/pages/index.astro');
  const featuresAstro = read('src/pages/features.astro');
  const privacyAstro = read('src/pages/privacy.astro');
  const privateVoiceAstro = read('src/pages/private-voice-tracking.astro');
  const compatibilityAstro = read('src/pages/compatibility.astro');
  const readme = read('README.md');

  it('verifies no page claims Smart Pace avoids transcription or the network', () => {
    // Smart Pace uses the browser's own speech recognition, which some browsers run on their
    // servers. Any page still promising zero transcription or zero network is now false.
    const documents = [
      { name: 'llms.txt', content: llms },
      { name: 'index.astro', content: indexAstro },
      { name: 'features.astro', content: featuresAstro },
      { name: 'privacy.astro', content: privacyAstro },
      { name: 'private-voice-tracking.astro', content: privateVoiceAstro },
      { name: 'compatibility.astro', content: compatibilityAstro },
      { name: 'README.md', content: readme },
    ];

    for (const doc of documents) {
      expect(doc.content, doc.name).not.toMatch(/zero transcription/i);
      expect(doc.content, doc.name).not.toMatch(/without transcribing speech/i);
      expect(doc.content, doc.name).not.toMatch(/Smart Pace[^.]{0,80}without transcription/i);
    }
  });

  it('verifies the pages say where Smart Pace recognition runs', () => {
    // The privacy-facing pages have to name the exposure, not just omit the old claim.
    for (const doc of [
      { name: 'privacy.astro', content: privacyAstro },
      { name: 'private-voice-tracking.astro', content: privateVoiceAstro },
    ]) {
      expect(doc.content, doc.name).toMatch(/own servers/i);
    }
    expect(llms).toMatch(/browser vendor's servers/i);
  });

  it('verifies Private Precision is still described as staying on the device', () => {
    expect(MODES.precision.transcribesSpeech).toBe(true);
    expect(MODES.precision.networkRequirement).toMatch(/same-origin/i);
    expect(privateVoiceAstro).toMatch(/on-device/i);
    expect(privacyAstro).toMatch(/never leave the device/i);
  });

  it('verifies Private Precision model size is accurately cited as ~67 MB or 66,874,154 bytes', () => {
    expect(llms).toContain('67 MB');
    expect(featuresAstro).toContain('67 MB');
    expect(privacyAstro).toContain('67 MB');
    expect(privateVoiceAstro).toContain('67 MB');
  });

  it('verifies all 3 modes (Manual, Smart Pace, Private Precision) are named in core pages', () => {
    for (const mode of [MODES.manual.name, MODES.smart.name, MODES.precision.name]) {
      expect(indexAstro).toContain(mode);
      expect(featuresAstro).toContain(mode);
      expect(privacyAstro).toContain(mode);
      expect(privateVoiceAstro).toContain(mode);
      expect(compatibilityAstro).toContain(mode);
    }
  });
});
