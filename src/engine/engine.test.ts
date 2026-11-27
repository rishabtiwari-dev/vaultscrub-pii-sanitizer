import { describe, expect, it } from 'vitest';
import {
  ALL_ENTITY_TYPES,
  SAMPLE_PRESETS,
  SAMPLE_PRESET_LIST,
  decodePanHolderType,
  detectCardNetwork,
  detectEntities,
  generateValidLuhn,
  generateValidVerhoeff12,
  isValidIPv4,
  isValidIPv6,
  isValidLuhn,
  isValidPan,
  isValidVerhoeff,
  makeSpanKey,
  parseCustomTerms,
  rehydrateText,
  resolveSpans,
  sanitizeText,
  type DetectedEntity,
} from './index';

describe('validators', () => {
  describe('Luhn & card networks', () => {
    it('validates generated Luhn numbers and rejects single-digit corruptions', () => {
      const visa = generateValidLuhn('453201', 16);
      const mc = generateValidLuhn('541275', 16);
      const amex = generateValidLuhn('378282', 15);
      const rupay = generateValidLuhn('607482', 16);
      const discover = generateValidLuhn('601100', 16);
      const unknown = generateValidLuhn('912345', 16);

      expect(isValidLuhn(visa)).toBe(true);
      expect(isValidLuhn(`${visa.slice(0, 4)}-${visa.slice(4, 8)}-${visa.slice(8, 12)}-${visa.slice(12)}`)).toBe(true);
      expect(detectCardNetwork(visa)).toBe('Visa');
      expect(detectCardNetwork(mc)).toBe('Mastercard');
      expect(detectCardNetwork(amex)).toBe('Amex');
      expect(detectCardNetwork(rupay)).toBe('RuPay');
      expect(detectCardNetwork(discover)).toBe('Discover');
      expect(detectCardNetwork(unknown)).toBe('Unknown');

      const corruptedLastDigit = (Number(visa[15]) + 1) % 10;
      const badVisa = `${visa.slice(0, 15)}${corruptedLastDigit}`;
      expect(isValidLuhn(badVisa)).toBe(false);
      expect(isValidLuhn('')).toBe(false);
      expect(isValidLuhn('1')).toBe(false);
      expect(isValidLuhn('4532abcd')).toBe(false);
    });

    it('detects 2-series Mastercard and non-6011 RuPay ranges accurately', () => {
      expect(detectCardNetwork(generateValidLuhn('222100', 16))).toBe('Mastercard');
      expect(detectCardNetwork(generateValidLuhn('272099', 16))).toBe('Mastercard');
      expect(detectCardNetwork(generateValidLuhn('652100', 16))).toBe('RuPay');
      expect(detectCardNetwork(generateValidLuhn('812345', 16))).toBe('RuPay');
      expect(detectCardNetwork(generateValidLuhn('644123', 16))).toBe('Discover');
    });
  });

  describe('Verhoeff D5 checksum', () => {
    it('validates generated 12-digit Verhoeff IDs and catches single-digit & transposition errors', () => {
      const valid12 = generateValidVerhoeff12('48291038471');
      expect(valid12).toHaveLength(12);
      expect(isValidVerhoeff(valid12)).toBe(true);
      expect(
        isValidVerhoeff(`${valid12.slice(0, 4)} ${valid12.slice(4, 8)} ${valid12.slice(8)}`)
      ).toBe(true);

      // Single-digit mutation
      const mutated = `${valid12.slice(0, 5)}${(Number(valid12[5]) + 1) % 10}${valid12.slice(6)}`;
      expect(isValidVerhoeff(mutated)).toBe(false);

      // Adjacent transposition error (swap two distinct adjacent digits)
      const chars = valid12.split('');
      const idx = chars.findIndex((c, i) => i < chars.length - 1 && c !== chars[i + 1]);
      expect(idx).toBeGreaterThanOrEqual(0);
      [chars[idx], chars[idx + 1]] = [chars[idx + 1], chars[idx]];
      expect(isValidVerhoeff(chars.join(''))).toBe(false);
    });
  });

  describe('PAN validator & holder type decoder', () => {
    it('decodes all 10 valid 4th-character PAN holder types', () => {
      const expected: Array<[string, string]> = [
        ['ABCPZ1234F', 'Individual'],
        ['ABCCZ1234F', 'Company'],
        ['ABCHZ1234F', 'HUF'],
        ['ABCFZ1234F', 'Firm'],
        ['ABCAZ1234F', 'AOP'],
        ['ABCTZ1234F', 'Trust'],
        ['ABCBZ1234F', 'BOI'],
        ['ABCLZ1234F', 'Local Authority'],
        ['ABCJZ1234F', 'Artificial Juridical Person'],
        ['ABCGZ1234F', 'Government'],
      ];

      for (const [pan, label] of expected) {
        expect(isValidPan(pan)).toBe(true);
        expect(decodePanHolderType(pan)).toBe(label);
      }
    });

    it('rejects invalid 4th-character PAN codes', () => {
      expect(isValidPan('ABCXZ1234F')).toBe(false);
      expect(decodePanHolderType('ABCXZ1234F')).toBe('Unknown');
      expect(isValidPan('ABCDE12345')).toBe(false);
    });
  });

  describe('IPv4 & IPv6 validators', () => {
    it('accepts valid IPv4 and rejects out-of-range or leading-zero octets', () => {
      expect(isValidIPv4('192.168.1.1')).toBe(true);
      expect(isValidIPv4('0.0.0.0')).toBe(true);
      expect(isValidIPv4('255.255.255.255')).toBe(true);

      expect(isValidIPv4('999.1.1.1')).toBe(false);
      expect(isValidIPv4('256.0.0.1')).toBe(false);
      expect(isValidIPv4('192.168.01.1')).toBe(false);
      expect(isValidIPv4('1.2.3')).toBe(false);
      expect(isValidIPv4('1.2.3.4.5')).toBe(false);
    });

    it('accepts valid IPv6 and rejects timestamps or malformed addresses', () => {
      expect(isValidIPv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
      expect(isValidIPv6('2001:db8::1')).toBe(true);
      expect(isValidIPv6('::1')).toBe(true);
      expect(isValidIPv6('::ffff:192.0.2.128')).toBe(true);

      expect(isValidIPv6('12:34:56')).toBe(false);
      expect(isValidIPv6('2001::db8::1')).toBe(false);
      expect(isValidIPv6('2001:::1')).toBe(false);
      expect(isValidIPv6('gggg::1')).toBe(false);
    });
  });
});

describe('detectors & overlap resolution', () => {
  it('logs failed 16-digit Luhn candidates as rejected without splitting into phone/Aadhaar', () => {
    const valid = generateValidLuhn('453201', 16);
    const badOrder = `${valid.slice(0, 15)}${(Number(valid[15]) + 2) % 10}`;
    const text = `Order Ref: ${badOrder}`;

    const result = sanitizeText(text, { mode: 'FULL' });
    expect(result.entities).toHaveLength(0);
    expect(result.rejectedCandidates).toHaveLength(1);
    expect(result.rejectedCandidates[0]).toMatchObject({
      value: badOrder,
      suspectedType: 'CREDIT_CARD',
      reason: 'Failed Luhn check (likely Order/Transaction ID)',
    });
  });

  it('validates Aadhaar via Verhoeff when strictVerhoeff is true and logs failures', () => {
    const validAadhaar = generateValidVerhoeff12('48291038471');
    const badAadhaar = `${validAadhaar.slice(0, 11)}${(Number(validAadhaar[11]) + 3) % 10}`;
    const formattedBad = `${badAadhaar.slice(0, 4)}-${badAadhaar.slice(4, 8)}-${badAadhaar.slice(8)}`;

    const strictRes = sanitizeText(
      `KYC: ${validAadhaar} | Track: ${formattedBad}`,
      { mode: 'FULL', strictVerhoeff: true }
    );
    expect(strictRes.entities).toHaveLength(1);
    expect(strictRes.entities[0].type).toBe('AADHAAR');
    expect(strictRes.entities[0].validationBadge).toBe('Verhoeff Valid');
    expect(strictRes.rejectedCandidates).toHaveLength(1);
    expect(strictRes.rejectedCandidates[0]).toMatchObject({
      value: formattedBad,
      suspectedType: 'AADHAAR',
      reason: 'Failed Verhoeff checksum (likely Tracking/Reference ID)',
    });

    const relaxedRes = sanitizeText(`Track: ${formattedBad}`, {
      mode: 'FULL',
      strictVerhoeff: false,
    });
    expect(relaxedRes.entities).toHaveLength(1);
    expect(relaxedRes.entities[0].type).toBe('AADHAAR');
    expect(relaxedRes.entities[0].metadata.verhoeffValid).toBe(false);
    expect(relaxedRes.rejectedCandidates).toHaveLength(0);
  });

  it('rejects out-of-range IPv4, timestamps, and dates from false-positive detection', () => {
    const text =
      'Bad IP 999.1.1.1, version 1.2.3.4.5, date 2026-11-27, time 12:34:56, good IP 10.0.42.7';
    const result = sanitizeText(text, { mode: 'FULL' });
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].type).toBe('IP_ADDRESS');
    expect(result.entities[0].value).toBe('10.0.42.7');
  });

  it('does not split a valid credit card with a phone match and enforces priority order', () => {
    const card = generateValidLuhn('498765', 16);
    const formattedCard = `${card.slice(0, 4)}-${card.slice(4, 8)}-${card.slice(8, 12)}-${card.slice(12)}`;
    const text = `Card ${formattedCard} on file`;

    const result = sanitizeText(text, { mode: 'FULL' });
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].type).toBe('CREDIT_CARD');
    expect(result.entities[0].value).toBe(formattedCard);
  });

  it('resolves overlapping spans by priority > length > earliest start', () => {
    const makeEntity = (
      start: number,
      end: number,
      type: DetectedEntity['type']
    ): DetectedEntity => ({
      start,
      end,
      value: 'x'.repeat(end - start),
      normalizedValue: 'x'.repeat(end - start),
      type,
      metadata: {},
      validationBadge: 'test',
    });

    // EMAIL beats PHONE even if PHONE starts earlier and is longer
    const emailVsPhone = resolveSpans([
      makeEntity(0, 15, 'PHONE'),
      makeEntity(2, 14, 'EMAIL'),
    ]);
    expect(emailVsPhone).toHaveLength(1);
    expect(emailVsPhone[0].type).toBe('EMAIL');

    // Same priority ties break by longest match, then earliest start
    const samePriority = resolveSpans([
      makeEntity(2, 10, 'PHONE'),
      makeEntity(0, 12, 'PHONE'),
      makeEntity(20, 30, 'PHONE'),
      makeEntity(22, 32, 'PHONE'),
    ]);
    expect(samePriority.map((e) => [e.start, e.end])).toEqual([
      [0, 12],
      [20, 30],
    ]);
  });

  it('detects standard PAN format by default and enforces 4th-character codes in strictPan mode', () => {
    const sample = 'Dummy ABCDE1234F, Individual AAAPC1234F, Company AAACP1234F, Other ABCXZ1234F';

    const relaxed = detectEntities(sample).candidates.filter((c) => c.type === 'PAN');
    expect(relaxed).toHaveLength(4);
    expect(relaxed.map((c) => c.value)).toEqual([
      'ABCDE1234F',
      'AAAPC1234F',
      'AAACP1234F',
      'ABCXZ1234F',
    ]);
    expect(relaxed[0].metadata.panHolderType).toBe('Standard Format');
    expect(relaxed[0].validationBadge).toBe('PAN • Standard Format');
    expect(relaxed[1].metadata.panHolderType).toBe('Individual');
    expect(relaxed[1].validationBadge).toBe('PAN • Individual (P)');
    expect(relaxed[2].metadata.panHolderType).toBe('Company');
    expect(relaxed[2].validationBadge).toBe('PAN • Company (C)');

    const strict = detectEntities(sample, { strictPan: true }).candidates.filter(
      (c) => c.type === 'PAN'
    );
    expect(strict).toHaveLength(2);
    expect(strict.map((c) => c.value)).toEqual(['AAAPC1234F', 'AAACP1234F']);
    expect(strict[0].validationBadge).toBe('PAN • Individual (P)');
    expect(strict[1].validationBadge).toBe('PAN • Company (C)');
  });

  it('detects IPv4 with ports, CIDR masks, and brackets in server logs while preserving suffixes', () => {
    const log =
      'upstream 192.168.1.10:8080 cidr=10.0.0.5/24 host=[192.168.1.10] bad=999.1.1.1:8080 ver=1.2.3.4.5';
    const result = sanitizeText(log, { mode: 'FULL', fullMaskStyle: 'TYPED' });

    expect(result.entities.map((e) => e.value)).toEqual([
      '192.168.1.10',
      '10.0.0.5',
      '192.168.1.10',
    ]);
    expect(result.sanitizedText).toBe(
      'upstream [IP_ADDRESS_REDACTED]:8080 cidr=[IP_ADDRESS_REDACTED]/24 host=[[IP_ADDRESS_REDACTED]] bad=999.1.1.1:8080 ver=1.2.3.4.5'
    );
  });

  it('detects 15-digit Amex 4-6-5 variants, Mastercard 2-series, compact 16-digit cards, and rejects invalid 16-digit decoys', () => {
    const amex = generateValidLuhn('378282', 15);
    const amexSpaced = `${amex.slice(0, 4)} ${amex.slice(4, 10)} ${amex.slice(10)}`;
    const amexDashed = `${amex.slice(0, 4)}-${amex.slice(4, 10)}-${amex.slice(10)}`;
    const mc2 = generateValidLuhn('222500', 16);
    const visaCompact = generateValidLuhn('453201', 16);
    const bad16 = `${visaCompact.slice(0, 15)}${(Number(visaCompact[15]) + 1) % 10}`;

    const text = `Amex1: ${amexSpaced} | Amex2: ${amexDashed} | Amex3: ${amex} | MC2: ${mc2} | Visa: ${visaCompact} | Decoy: ${bad16}`;
    const result = sanitizeText(text, { mode: 'PSEUDONYM' });

    expect(result.countsByType.CREDIT_CARD).toBe(5);
    expect(result.entities.slice(0, 3).every((e) => e.metadata.cardNetwork === 'Amex')).toBe(true);
    expect(result.entities[3].metadata.cardNetwork).toBe('Mastercard');
    expect(result.entities[4].metadata.cardNetwork).toBe('Visa');
    expect(result.rejectedCandidates).toHaveLength(1);
    expect(result.rejectedCandidates[0]).toMatchObject({
      value: bad16,
      suspectedType: 'CREDIT_CARD',
    });
  });

  it('detects plus-addressed emails and international phones in full without date collisions', () => {
    const text =
      'Alert: ops+alerts@sub.example.co.in | Call: +1 (415) 555-0199 | Date: 2026-11-27';
    const result = sanitizeText(text, { mode: 'FULL', fullMaskStyle: 'TYPED' });

    expect(result.entities.map((e) => [e.type, e.value])).toEqual([
      ['EMAIL', 'ops+alerts@sub.example.co.in'],
      ['PHONE', '+1 (415) 555-0199'],
    ]);
    expect(result.sanitizedText).toBe(
      'Alert: [EMAIL_REDACTED] | Call: [PHONE_REDACTED] | Date: 2026-11-27'
    );
  });
});

describe('redaction modes, normalization & whitelisting', () => {
  const validCard = generateValidLuhn('453201', 16);
  const validCardDashed = `${validCard.slice(0, 4)}-${validCard.slice(4, 8)}-${validCard.slice(8, 12)}-${validCard.slice(12)}`;
  const validCardSpaced = `${validCard.slice(0, 4)} ${validCard.slice(4, 8)} ${validCard.slice(8, 12)} ${validCard.slice(12)}`;
  const validAadhaar = generateValidVerhoeff12('56781234901');
  const validAadhaarSpaced = `${validAadhaar.slice(0, 4)} ${validAadhaar.slice(4, 8)} ${validAadhaar.slice(8)}`;

  it('supports FULL mode in both TYPED and GENERIC mask styles', () => {
    const text = 'Mail a.b@corp.com, PAN ABCPE1234F, IP 192.168.10.5';

    const typed = sanitizeText(text, { mode: 'FULL', fullMaskStyle: 'TYPED' });
    expect(typed.sanitizedText).toBe(
      'Mail [EMAIL_REDACTED], PAN [PAN_REDACTED], IP [IP_ADDRESS_REDACTED]'
    );

    const generic = sanitizeText(text, { mode: 'FULL', fullMaskStyle: 'GENERIC' });
    expect(generic.sanitizedText).toBe(
      'Mail [REDACTED], PAN [REDACTED], IP [REDACTED]'
    );
  });

  it('supports PARTIAL mode across all 6 entity types', () => {
    const text = [
      `Email: alice@domain.com`,
      `Phone: +91 98765 43210`,
      `Card: ${validCardDashed}`,
      `Aadhaar: ${validAadhaarSpaced}`,
      `PAN: ABCPE1234F`,
      `IP: 192.168.42.99`,
    ].join(' | ');

    const result = sanitizeText(text, { mode: 'PARTIAL' });
    expect(result.sanitizedText).toBe(
      [
        'Email: a***@domain.com',
        'Phone: +91-XXXXXX3210',
        `Card: XXXX-XXXX-XXXX-${validCard.slice(-4)}`,
        `Aadhaar: XXXX-XXXX-${validAadhaar.slice(-4)}`,
        'PAN: AB***1234F',
        'IP: 192.168.X.X',
      ].join(' | ')
    );
  });

  it('produces consistent PSEUDONYM tokens across format & case variations', () => {
    const text = [
      'Email1: Alice.Smith@Example.COM | Email2: alice.smith@example.com',
      'Phone1: +91 98765 43210 | Phone2: 98765-43210 | Phone3: 09876543210 | Phone4: 9876543210',
      `Card1: ${validCardDashed} | Card2: ${validCardSpaced}`,
      `ID1: ${validAadhaar} | ID2: ${validAadhaarSpaced}`,
      'PAN1: ABCPE1234F | PAN2: abcpe1234f',
      'IP1: 10.1.2.3 | IP2: 2001:DB8::1',
    ].join('\n');

    const result = sanitizeText(text, { mode: 'PSEUDONYM' });

    expect(result.sanitizedText).toContain('Email1: EMAIL_01 | Email2: EMAIL_01');
    expect(result.sanitizedText).toContain(
      'Phone1: PHONE_01 | Phone2: PHONE_01 | Phone3: PHONE_01 | Phone4: PHONE_01'
    );
    expect(result.sanitizedText).toContain('Card1: CARD_01 | Card2: CARD_01');
    expect(result.sanitizedText).toContain('ID1: AADHAAR_01 | ID2: AADHAAR_01');
    expect(result.sanitizedText).toContain('PAN1: PAN_01 | PAN2: PAN_01');
    expect(result.sanitizedText).toContain('IP1: IP_01 | IP2: IP_02');

    expect(result.pseudonymMap).toEqual({
      EMAIL_01: 'alice.smith@example.com',
      PHONE_01: '9876543210',
      CARD_01: validCard,
      AADHAAR_01: validAadhaar,
      PAN_01: 'abcpe1234f',
      IP_01: '10.1.2.3',
      IP_02: '2001:db8::1',
    });
  });

  it('supports click-to-whitelist via excludedSpanKeys and entity type filtering', () => {
    const text = 'Primary: alice@corp.com, Backup: bob@corp.com, IP: 192.168.1.5';
    const initial = sanitizeText(text, { mode: 'PSEUDONYM' });
    expect(initial.entities).toHaveLength(3);

    const aliceKey = makeSpanKey(initial.entities[0]);
    const whitelisted = sanitizeText(text, {
      mode: 'PSEUDONYM',
      excludedSpanKeys: new Set([aliceKey]),
    });

    expect(whitelisted.sanitizedText).toBe(
      'Primary: alice@corp.com, Backup: EMAIL_01, IP: IP_01'
    );
    expect(whitelisted.entities[0].whitelisted).toBe(true);
    expect(whitelisted.countsByType.EMAIL).toBe(1);
    expect(whitelisted.pseudonymMap).toEqual({
      EMAIL_01: 'bob@corp.com',
      IP_01: '192.168.1.5',
    });

    const onlyIp = sanitizeText(text, {
      mode: 'FULL',
      enabledTypes: ['IP_ADDRESS'],
    });
    expect(onlyIp.entities).toHaveLength(1);
    expect(onlyIp.entities[0].type).toBe('IP_ADDRESS');
    expect(onlyIp.countsByType).toEqual({
      EMAIL: 0,
      PHONE: 0,
      IP_ADDRESS: 1,
      PAN: 0,
      AADHAAR: 0,
      CREDIT_CARD: 0,
    });
  });
});

describe('sample presets', () => {
  it('verifies all 4 synthetic presets have exact offsets, zero overlaps, and expected decoys', () => {
    expect(SAMPLE_PRESET_LIST).toHaveLength(4);

    for (const preset of SAMPLE_PRESET_LIST) {
      const result = sanitizeText(preset.content, { mode: 'PSEUDONYM' });

      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.rejectedCandidates.length).toBeGreaterThan(0);

      for (let i = 0; i < result.entities.length; i++) {
        const entity = result.entities[i];
        expect(preset.content.slice(entity.start, entity.end)).toBe(entity.value);
        if (i > 0) {
          expect(result.entities[i - 1].end).toBeLessThanOrEqual(entity.start);
        }
      }

      const totalCount = ALL_ENTITY_TYPES.reduce(
        (acc, t) => acc + result.countsByType[t],
        0
      );
      expect(totalCount).toBe(result.entities.length);
    }

    const supportRes = sanitizeText(SAMPLE_PRESETS.support_ticket.content, {
      mode: 'PSEUDONYM',
    });
    expect(supportRes.countsByType.EMAIL).toBe(2);
    expect(Object.keys(supportRes.pseudonymMap).filter((k) => k.startsWith('EMAIL_'))).toHaveLength(1);
    expect(supportRes.countsByType.PHONE).toBe(3);
    expect(Object.keys(supportRes.pseudonymMap).filter((k) => k.startsWith('PHONE_'))).toHaveLength(1);
    expect(supportRes.countsByType.CREDIT_CARD).toBe(2);
    expect(Object.keys(supportRes.pseudonymMap).filter((k) => k.startsWith('CARD_'))).toHaveLength(1);
    expect(supportRes.rejectedCandidates.map((r) => r.suspectedType).sort()).toEqual([
      'AADHAAR',
      'CREDIT_CARD',
    ]);

    const csvRes = sanitizeText(SAMPLE_PRESETS.noisy_csv.content, {
      mode: 'PSEUDONYM',
    });
    expect(csvRes.countsByType.EMAIL).toBe(4);
    expect(csvRes.countsByType.CREDIT_CARD).toBe(3);
    expect(csvRes.countsByType.PAN).toBe(3);
  });
});

function expectOffsetIntegrity(text: string, entities: DetectedEntity[]): void {
  for (let i = 0; i < entities.length; i++) {
    expect(text.slice(entities[i].start, entities[i].end)).toBe(entities[i].value);
    if (i > 0) {
      expect(entities[i - 1].end).toBeLessThanOrEqual(entities[i].start);
    }
  }
}

describe('custom sensitive terms', () => {
  it('redacts custom terms case-insensitively on word boundaries without overriding built-in PII', () => {
    expect(parseCustomTerms(' Project Helios ,, Internal-992, PROJECT   helios, x')).toEqual([
      'Project Helios',
      'Internal-992',
    ]);

    const terms = 'Project Helios, Internal-992, Helios';
    const text =
      'Project Helios kickoff. Contact ops@helios.io about Internal-992. Helios team; helioscope and Internal-9921 stay.';

    const typed = sanitizeText(text, { mode: 'FULL', fullMaskStyle: 'TYPED', customTerms: terms });
    expect(typed.sanitizedText).toBe(
      '[CUSTOM_REDACTED] kickoff. Contact [EMAIL_REDACTED] about [CUSTOM_REDACTED]. [CUSTOM_REDACTED] team; helioscope and Internal-9921 stay.'
    );
    // The "helios" inside the e-mail overlaps a higher-priority EMAIL span and is dropped.
    expect(typed.entities.map((e) => e.type)).toEqual(['CUSTOM', 'EMAIL', 'CUSTOM', 'CUSTOM']);
    expect(typed.countsByType.CUSTOM).toBe(3);
    expect(typed.countsByType.EMAIL).toBe(1);
    expectOffsetIntegrity(text, typed.entities);

    const generic = sanitizeText(text, { mode: 'FULL', fullMaskStyle: 'GENERIC', customTerms: terms });
    expect(generic.sanitizedText.match(/\[REDACTED\]/g)).toHaveLength(4);

    const partial = sanitizeText(text, { mode: 'PARTIAL', customTerms: terms });
    expect(partial.sanitizedText).toContain('about I**********2.');
    expect(partial.sanitizedText).toContain('H****s team');

    // No custom terms → no CUSTOM key, built-in shape unchanged.
    expect(sanitizeText(text, { mode: 'FULL' }).countsByType.CUSTOM).toBeUndefined();
  });

  it('maps custom-term variants to consistent CUSTOM_NN pseudonyms alongside built-in tokens', () => {
    const text =
      'Codename Project Helios (aka PROJECT  HELIOS / project helios) ships Internal-992; internal-992 owner is alice@corp.com.';
    const options = {
      mode: 'PSEUDONYM' as const,
      customTerms: ['Project Helios', 'Internal-992'],
    };

    const first = sanitizeText(text, options);
    expect(first.sanitizedText).toBe(
      'Codename CUSTOM_01 (aka CUSTOM_01 / CUSTOM_01) ships CUSTOM_02; CUSTOM_02 owner is EMAIL_01.'
    );
    expect(first.pseudonymMap).toEqual({
      CUSTOM_01: 'project helios',
      CUSTOM_02: 'internal-992',
      EMAIL_01: 'alice@corp.com',
    });
    expectOffsetIntegrity(text, first.entities);

    const second = sanitizeText(text, options);
    expect(second.sanitizedText).toBe(first.sanitizedText);
    expect(second.pseudonymMap).toEqual(first.pseudonymMap);
  });
});

describe('round-trip re-hydration', () => {
  it('restores pseudonymized text back to original normalized values locally', () => {
    const original =
      'Reach ops+alerts@sub.example.co.in at +91 98765 43210 regarding PAN ABCDE1234F and IP 192.168.1.10:8080.';
    const sanitized = sanitizeText(original, { mode: 'PSEUDONYM' });
    expect(sanitized.sanitizedText).toBe(
      'Reach EMAIL_01 at PHONE_01 regarding PAN PAN_01 and IP IP_01:8080.'
    );

    const aiReply =
      'Ticket drafted for EMAIL_01 (callback PHONE_01). Tax ID PAN_01 verified from IP_01:8080; cc EMAIL_01.';
    const restored = rehydrateText(aiReply, sanitized.pseudonymMap);
    expect(restored.replacementsCount).toBe(5);
    expect(restored.restoredText).toBe(
      'Ticket drafted for ops+alerts@sub.example.co.in (callback 9876543210). Tax ID abcde1234f verified from 192.168.1.10:8080; cc ops+alerts@sub.example.co.in.'
    );
  });

  it('handles >=10 tokens cleanly with exact token-boundary & non-cascading safety', () => {
    const emails = Array.from({ length: 12 }, (_, i) => `user${i + 1}@example.com`);
    const doc = emails.map((e, i) => `Contact ${i + 1}: ${e}`).join(' | ');
    const sanitized = sanitizeText(doc, { mode: 'PSEUDONYM' });

    expect(Object.keys(sanitized.pseudonymMap)).toHaveLength(12);
    expect(sanitized.sanitizedText).toContain('EMAIL_10');
    expect(sanitized.sanitizedText).toContain('EMAIL_12');

    const roundTrip = rehydrateText(sanitized.sanitizedText, sanitized.pseudonymMap);
    expect(roundTrip.replacementsCount).toBe(12);
    expect(roundTrip.restoredText).toBe(doc);

    // Ensure short tokens like EMAIL_1 never corrupt EMAIL_10 and replacement values aren't re-scanned
    const edge = rehydrateText('Send to EMAIL_1 and EMAIL_10 (and EMAIL_2)', {
      EMAIL_1: 'EMAIL_2',
      EMAIL_2: 'two@example.com',
    });
    expect(edge.replacementsCount).toBe(2);
    expect(edge.restoredText).toBe('Send to EMAIL_2 and EMAIL_10 (and two@example.com)');
  });
});

describe('performance', () => {
  function buildNoisyDocument(lineCount: number): string {
    const lines: string[] = [];
    for (let i = 0; i < lineCount; i++) {
      const card = generateValidLuhn(String(453201 + (i % 50)), 16);
      const cardDashed = `${card.slice(0, 4)}-${card.slice(4, 8)}-${card.slice(8, 12)}-${card.slice(12)}`;
      const decoy = `${card.slice(0, 15)}${(Number(card[15]) + 3) % 10}`;
      const aadhaar = generateValidVerhoeff12(String(48291038471 + i));
      const phoneDigits = String(9800000000 + i);
      const phone = `+91 ${phoneDigits.slice(0, 5)} ${phoneDigits.slice(5)}`;
      const ip = `10.${i % 256}.${(i * 7) % 256}.${(i * 13) % 256}`;
      const email = `user${i}@corp${i % 9}.example.com`;
      const pan = `ABCP${String.fromCharCode(65 + (i % 26))}${String(i % 10000).padStart(4, '0')}F`;

      switch (i % 5) {
        case 0:
          lines.push(`[2026-11-27 09:42:${String(i % 60).padStart(2, '0')}] ${email} paid with ${cardDashed} from ${ip}`);
          break;
        case 1:
          lines.push(`Order ${decoy} shipped; callback ${phone}; build 2.14.9${i}.1`);
          break;
        case 2:
          lines.push(`KYC ${aadhaar.slice(0, 4)} ${aadhaar.slice(4, 8)} ${aadhaar.slice(8)} PAN ${pan}, ts 12:34:56`);
          break;
        case 3:
          lines.push(`Plain narrative line ${i} with numbers 12345 and version 1.2.3.4.5 — nothing sensitive.`);
          break;
        default:
          lines.push(`Mixed: ${email} | ${phone} | ${card.match(/.{4}/g)?.join(' ')} | 2001:db8::${i.toString(16)}`);
      }
    }
    return lines.join('\n');
  }

  it('sanitizes a 2,000-line noisy document in well under 250ms with zero overlaps', () => {
    const doc = buildNoisyDocument(2000);
    expect(doc.split('\n')).toHaveLength(2000);

    // Warm up the JIT on a small slice so we measure steady-state throughput.
    sanitizeText(doc.slice(0, 5000), { mode: 'PSEUDONYM' });

    const t0 = performance.now();
    const result = sanitizeText(doc, {
      mode: 'PSEUDONYM',
      customTerms: 'Project Helios, Internal-992',
    });
    const elapsed = performance.now() - t0;

    console.log(
      `[perf] 2,000-line doc (${(doc.length / 1024).toFixed(1)} KB): ${elapsed.toFixed(1)} ms, ` +
        `${result.entities.length} entities, ${result.rejectedCandidates.length} rejected`
    );

    expect(elapsed).toBeLessThan(250);
    expect(result.entities.length).toBeGreaterThan(2000);
    expect(result.rejectedCandidates.length).toBeGreaterThanOrEqual(400);
    expectOffsetIntegrity(doc, result.entities);
  });

  it('resolves 3,000 overlapping multi-priority spans in O(N log N) with strict non-overlap', () => {
    const candidates: DetectedEntity[] = [];
    const totalClusters = 500;

    // Build clusters in reverse order to stress worst-case sorting and interval insertion.
    for (let i = totalClusters - 1; i >= 0; i--) {
      const base = i * 30;
      const makeCandidate = (
        start: number,
        end: number,
        type: DetectedEntity['type']
      ): DetectedEntity => ({
        start,
        end,
        value: 'x'.repeat(end - start),
        normalizedValue: 'x',
        type,
        metadata: {},
        validationBadge: type,
      });

      // Lower-priority wider/nested spans plus same-priority shorter/longer ties.
      candidates.push(makeCandidate(base, base + 22, 'CUSTOM'));
      candidates.push(makeCandidate(base + 1, base + 15, 'PHONE'));
      candidates.push(makeCandidate(base + 2, base + 18, 'PAN'));
      candidates.push(makeCandidate(base + 4, base + 12, 'EMAIL'));
      candidates.push(makeCandidate(base + 4, base + 16, 'EMAIL')); // longer EMAIL wins over shorter
      candidates.push(makeCandidate(base + 17, base + 25, 'PHONE')); // non-overlapping trailing PHONE
    }

    const t0 = performance.now();
    const resolved = resolveSpans(candidates);
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(100);
    expect(resolved).toHaveLength(totalClusters * 2);

    for (let i = 0; i < totalClusters; i++) {
      const base = i * 30;
      const email = resolved[i * 2];
      const trailingPhone = resolved[i * 2 + 1];
      expect(email).toMatchObject({ start: base + 4, end: base + 16, type: 'EMAIL' });
      expect(trailingPhone).toMatchObject({ start: base + 17, end: base + 25, type: 'PHONE' });
      expect(email.end).toBeLessThanOrEqual(trailingPhone.start);
      if (i > 0) {
        expect(resolved[i * 2 - 1].end).toBeLessThanOrEqual(email.start);
      }
    }
  });

  it('blocks phone substring leaks across hundreds of interleaved reserved card and Aadhaar spans', () => {
    const card = generateValidLuhn('453201', 16);
    const decoyCard = `${card.slice(0, 15)}${(Number(card[15]) + 1) % 10}`;
    const aadhaar = generateValidVerhoeff12('98765432101');
    const decoyAadhaar = `${aadhaar.slice(0, 11)}${(Number(aadhaar[11]) + 1) % 10}`;

    const lines: string[] = [];
    for (let i = 0; i < 200; i++) {
      lines.push(
        `Card ${card} Order ${decoyCard} Aadhaar ${aadhaar} Track ${decoyAadhaar} Call +91-9876543210`
      );
    }
    const text = lines.join('\n');
    const output = detectEntities(text, { strictVerhoeff: true });
    const resolved = resolveSpans(output.candidates);

    expect(resolved.filter((e) => e.type === 'CREDIT_CARD')).toHaveLength(200);
    expect(resolved.filter((e) => e.type === 'AADHAAR')).toHaveLength(200);
    expect(resolved.filter((e) => e.type === 'PHONE')).toHaveLength(200);
    expect(output.rejectedCandidates).toHaveLength(400);
    expectOffsetIntegrity(text, resolved);
  });
});
