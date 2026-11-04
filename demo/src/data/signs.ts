import manifest from "../../../signs-manifest.example.json" with { type: "json" };

export const SIGN_LABELS = ["অপেক্ষা করো", "আজ", "আমার", "আমি", "এখন", "কখন", "কাজ", "কে", "ক্লান্ত", "ক্ষুধার্ত", "খারাপ", "চুপ করো", "তুমি", "তোমার", "দুঃখিত", "ভালো", "মাথাব্যথা", "সাহায্য"] as const;
export type SignLabel = typeof SIGN_LABELS[number];
export interface SignSample {
  id: string;
  label: SignLabel;
  english: string;
  image: string;
  verifiedBdslGesture: boolean;
}
const featuredIds = ["good", "wait", "headache", "you", "now", "who"];
const samples: SignSample[] = manifest.map(entry => {
  const label = SIGN_LABELS.find(label => label === entry.labelBn);
  if (!label) throw new Error(`Unknown sign class: ${entry.labelBn}`);
  return { id: entry.id, label, english: entry.labelEn, image: `${(import.meta.env?.BASE_URL ?? "/")}${entry.illustration.slice(1)}`, verifiedBdslGesture: entry.verifiedBdslGesture };
});
export const SIGN_SAMPLES: readonly SignSample[] = [
  ...featuredIds.map(id => samples.find(sample => sample.id === id)!),
  ...samples.filter(sample => !featuredIds.includes(sample.id)),
];
