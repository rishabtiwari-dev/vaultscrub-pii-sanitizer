import {
  generateValidLuhn,
  generateValidVerhoeff12,
  isValidLuhn,
  isValidVerhoeff,
} from './validators';

export type SamplePresetId =
  | 'support_ticket'
  | 'hr_resume'
  | 'clinical_note'
  | 'noisy_csv';

export interface SamplePreset {
  id: SamplePresetId;
  label: string;
  description: string;
  content: string;
}

function formatGrouped(digits: string, groupSizes: number[], sep = '-'): string {
  const groups: string[] = [];
  let offset = 0;
  for (const size of groupSizes) {
    groups.push(digits.slice(offset, offset + size));
    offset += size;
  }
  return groups.join(sep);
}

function makeInvalidLuhn16(prefix: string): string {
  const valid = generateValidLuhn(prefix, 16);
  const lastDigit = (Number(valid[15]) + 3) % 10;
  const invalid = `${valid.slice(0, 15)}${lastDigit}`;
  if (isValidLuhn(invalid)) {
    throw new Error('Failed to generate invalid Luhn decoy.');
  }
  return invalid;
}

function makeInvalidVerhoeff12(first11: string): string {
  const valid = generateValidVerhoeff12(first11);
  const lastDigit = (Number(valid[11]) + 4) % 10;
  const invalid = `${valid.slice(0, 11)}${lastDigit}`;
  if (isValidVerhoeff(invalid)) {
    throw new Error('Failed to generate invalid Verhoeff decoy.');
  }
  return invalid;
}

// Programmatically generated synthetic credentials (zero real PII)
const visaCard1 = formatGrouped(generateValidLuhn('453201', 16), [4, 4, 4, 4], '-');
const visaCard1Compact = visaCard1.replace(/-/g, ' ');
const mcCard2 = formatGrouped(generateValidLuhn('541275', 16), [4, 4, 4, 4], ' ');
const rupayCard3 = formatGrouped(generateValidLuhn('607482', 16), [4, 4, 4, 4], '-');
const amexCard4 = formatGrouped(generateValidLuhn('378282', 15), [4, 6, 5], ' ');

const orderDecoy1 = makeInvalidLuhn16('492184');
const orderDecoy2 = formatGrouped(makeInvalidLuhn16('529104'), [4, 4, 4, 4], '-');
const shippingDecoy1 = makeInvalidVerhoeff12('34829104752');
const trackingDecoy2 = formatGrouped(makeInvalidVerhoeff12('67120498123'), [4, 4, 4], '-');

const aadhaarValid1 = formatGrouped(generateValidVerhoeff12('48291038471'), [4, 4, 4], ' ');
const aadhaarValid2 = formatGrouped(generateValidVerhoeff12('73918264501'), [4, 4, 4], '-');

export const SAMPLE_PRESETS: Record<SamplePresetId, SamplePreset> = {
  support_ticket: {
    id: 'support_ticket',
    label: 'Customer Support Ticket',
    description:
      'Noisy refund escalation log with repeated contacts, valid Visa card, and decoy Order/Shipping IDs.',
    content: [
      '[TICKET #VS-2026-8841] Priority: HIGH | Timestamp: 2026-11-27 09:42:18 UTC',
      `Reporter: Priya.Sharma@ExampleCorp.in (alt reply: priya.sharma@examplecorp.in)`,
      `Callback: +91 98765 43210 | Secondary: 98765-43210 | Office: 09876543210`,
      `Client Gateway IP: 192.168.14.22 (Edge Proxy: 2001:0db8:85a3::8a2e:0370:7334)`,
      `Order Reference ID: ${orderDecoy1} | Courier Tracking: ${shippingDecoy1}`,
      `Payment Method Charged: ${visaCard1} (also logged as ${visaCard1Compact})`,
      `Notes: Customer reported duplicate debit on 2026-11-25; invalid node 999.12.34.56 ignored by firewall.`,
    ].join('\n'),
  },

  hr_resume: {
    id: 'hr_resume',
    label: 'Indian Candidate KYC & Resume',
    description:
      'Candidate onboarding profile containing PAN, Verhoeff-valid 12-digit ID, phone, email, and workstation IP.',
    content: [
      'CANDIDATE PROFILE — ONBOARDING KYC PACKET',
      'Full Name: Arjun Nair',
      'Email: arjun.nair.dev@protonmail.com',
      'Mobile: +91-98201-45678 (Emergency: +1 (415) 555-0192)',
      'Tax Identifier (PAN): ABCPE1234F (Entity PAN on prior form: AABCA9876C)',
      `National ID (12-digit): ${aadhaarValid1}`,
      'Submitted From IP: 10.24.188.91 | Portal Build: 2.14.999.1',
      `Background Verification Ref: ${trackingDecoy2}`,
    ].join('\n'),
  },

  clinical_note: {
    id: 'clinical_note',
    label: 'Hospital Discharge Note',
    description:
      'Clinical discharge summary with patient contact, emergency contact, billing card, IP, and decoy MRN.',
    content: [
      'DISCHARGE SUMMARY — WARD 4B',
      'Admission Date: 2026-11-20 | Discharge Date: 2026-11-27',
      'Patient Email: meera.kulkarni@healthmail.org | Patient Phone: +91 99102 33445',
      'Emergency Contact: +91 98111 22334 (Spouse)',
      `Insured ID: ${aadhaarValid2} | Billing Card: ${rupayCard3}`,
      `Hospital EMR Ref (non-PII): ${orderDecoy2} | Lab Batch: ${shippingDecoy1}`,
      'EHR Terminal IP: 172.16.40.12 | Vitals Sync Time: 14:25:09',
    ].join('\n'),
  },

  noisy_csv: {
    id: 'noisy_csv',
    label: 'Noisy Multi-Row Export CSV',
    description:
      'RFC-4180 CSV with quoted comma descriptions, repeated users across formats, valid cards, and decoy IDs.',
    content: [
      'row_id,customer_email,phone,tax_id,payment_instrument,order_ref,client_ip,notes',
      `1,"ananya.rao@finops.io","+91 97401 11223","AFZPK7190K","${mcCard2}","${orderDecoy1}","198.51.100.42","Charged for plan, invoice sent to ananya.rao@finops.io"`,
      `2,"ANANYA.RAO@FINOPS.IO","09740111223","afzpk7190k","${mcCard2.replace(/ /g, '-')}","${shippingDecoy1}","198.51.100.42","Follow-up call on 97401-11223, no refund needed"`,
      `3,"vikram.menon@cloud.dev","+1-212-555-0148","AAACT2727Q","${amexCard4}","${orderDecoy2}","2001:db8::1","Corporate card settlement, shipment ref ${trackingDecoy2}"`,
    ].join('\n'),
  },
};

export const SAMPLE_PRESET_LIST: readonly SamplePreset[] = [
  SAMPLE_PRESETS.support_ticket,
  SAMPLE_PRESETS.hr_resume,
  SAMPLE_PRESETS.clinical_note,
  SAMPLE_PRESETS.noisy_csv,
];
