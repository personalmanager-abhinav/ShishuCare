export const MAX_BARGAIN_ATTEMPTS = 3;
export const MAX_BARGAIN_MESSAGES = 10;
export const BARGAIN_SESSION_MINUTES = 30;
export const BARGAIN_LANGUAGES = ['hi', 'hinglish', 'en'] as const;
export type BargainLanguage = (typeof BARGAIN_LANGUAGES)[number];

export type BargainDecision = 'clarify' | 'counter' | 'accepted_demo' | 'declined';

export interface BargainReply {
  decision: BargainDecision;
  message: string;
  sellerOfferMinor: number | null;
}

export function isBargainLanguage(value: unknown): value is BargainLanguage {
  return typeof value === 'string' && BARGAIN_LANGUAGES.includes(value as BargainLanguage);
}

export function bargainWelcome(language: BargainLanguage): string {
  if (language === 'en')
    return 'Hello! Like this product? Enter your price in numbers—you have three offers.';
  if (language === 'hinglish')
    return 'Namaste! Product pasand aaya? Apni price numbers mein batayein—aapke paas three offers hain.';
  return 'नमस्ते! यह पसंद आया? अपनी कीमत अंकों में बताइए—आपके पास तीन मौके हैं।';
}

export function bargainAcceptance(language: BargainLanguage, amountMinor: number): string {
  const amount = amountMinor / 100;
  if (language === 'en')
    return `Your demo offer of ₹${amount} was accepted. No real coupon will be issued.`;
  if (language === 'hinglish')
    return `Demo mein ₹${amount} ka offer accept ho gaya. Koi real coupon issue nahi hoga.`;
  return `डेमो में ₹${amount} का ऑफ़र स्वीकार हुआ। कोई असली कूपन जारी नहीं होगा।`;
}

const DEVANAGARI_DIGITS: Record<string, string> = {
  '०': '0',
  '१': '1',
  '२': '2',
  '३': '3',
  '४': '4',
  '५': '5',
  '६': '6',
  '७': '7',
  '८': '8',
  '९': '9',
};

export function normalizeBargainMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const message = value.trim().replace(/\s+/g, ' ');
  return message.length > 0 && message.length <= 120 ? message : null;
}

export function parseRupeeOffer(message: string): number | null {
  const normalized = [...message]
    .map((character) => DEVANAGARI_DIGITS[character] ?? character)
    .join('')
    .replace(/,/g, '');
  const values = [...normalized.matchAll(/(?:₹|rs\.?|inr)?\s*(\d{1,6})(?:\.00)?/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isSafeInteger(value) && value > 0 && value <= 100000);
  if (values.length !== 1) return null;
  return values[0] * 100;
}

export function chooseDemoReply(input: {
  buyerOfferMinor: number | null;
  listPriceMinor: number;
  floorMinor: number;
  attemptsUsed: number;
  previousSellerOfferMinor: number | null;
  language: BargainLanguage;
}): BargainReply {
  const {
    buyerOfferMinor,
    listPriceMinor,
    floorMinor,
    attemptsUsed,
    previousSellerOfferMinor,
    language,
  } = input;
  const localized = (hi: string, hinglish: string, en: string) =>
    language === 'hi' ? hi : language === 'hinglish' ? hinglish : en;
  if (buyerOfferMinor === null)
    return {
      decision: 'clarify',
      message: localized(
        'कृपया अपनी कीमत अंकों में बताइए—जैसे ₹150। इससे आपका मौका खर्च नहीं होगा।',
        'Apni price numbers mein batayein—jaise ₹150. Isse aapka offer chance use nahi hoga.',
        'Please enter your price in numbers—for example ₹150. This will not use an offer.',
      ),
      sellerOfferMinor: previousSellerOfferMinor,
    };

  if (buyerOfferMinor >= listPriceMinor)
    return {
      decision: 'accepted_demo',
      message: localized(
        `सूची कीमत ₹${listPriceMinor / 100} है। डेमो में यही कीमत स्वीकार मानी गई है—कोई असली कूपन जारी नहीं होगा।`,
        `List price ₹${listPriceMinor / 100} hai. Demo mein yeh price accept hai—koi real coupon issue nahi hoga.`,
        `The list price is ₹${listPriceMinor / 100}. It is accepted in this demo—no real coupon will be issued.`,
      ),
      sellerOfferMinor: listPriceMinor,
    };

  if (buyerOfferMinor >= floorMinor)
    return {
      decision: 'accepted_demo',
      message: localized(
        `चलिए, डेमो में ₹${buyerOfferMinor / 100} पर बात पक्की। यह असली या रिडीम करने योग्य ऑफ़र नहीं है।`,
        `Chaliye, demo mein ₹${buyerOfferMinor / 100} par deal pakki. Yeh real ya redeemable offer nahi hai.`,
        `Deal agreed at ₹${buyerOfferMinor / 100} in this demo. This is not a real or redeemable offer.`,
      ),
      sellerOfferMinor: buyerOfferMinor,
    };

  if (attemptsUsed >= MAX_BARGAIN_ATTEMPTS)
    return {
      decision: 'declined',
      message: localized(
        `आपके तीन मौके पूरे हुए। डेमो में सबसे कम संभव कीमत ₹${floorMinor / 100} थी। सामान्य marketplace विकल्प नीचे उपलब्ध हैं।`,
        `Aapke three offers complete ho gaye. Demo ki lowest price ₹${floorMinor / 100} thi. Regular marketplace options neeche hain.`,
        `You have used all three offers. The lowest demo price was ₹${floorMinor / 100}. Regular marketplace options remain below.`,
      ),
      sellerOfferMinor: floorMinor,
    };

  const span = listPriceMinor - floorMinor;
  const progress = Math.min(attemptsUsed, MAX_BARGAIN_ATTEMPTS) / MAX_BARGAIN_ATTEMPTS;
  const target = Math.max(
    floorMinor,
    Math.round((listPriceMinor - span * progress * 0.8) / 100) * 100,
  );
  const sellerOfferMinor = previousSellerOfferMinor
    ? Math.max(floorMinor, Math.min(previousSellerOfferMinor - 100, target))
    : target;
  return {
    decision: 'counter',
    message: localized(
      `इतने में देना थोड़ा मुश्किल होगा। डेमो में ₹${sellerOfferMinor / 100} तक कर सकते हैं।`,
      `Itne mein dena mushkil hoga. Demo mein ₹${sellerOfferMinor / 100} tak kar sakte hain.`,
      `That price is a little too low. In this demo, we can offer ₹${sellerOfferMinor / 100}.`,
    ),
    sellerOfferMinor,
  };
}

export function safeAttemptsRemaining(attemptsUsed: number) {
  return Math.max(0, MAX_BARGAIN_ATTEMPTS - attemptsUsed);
}
