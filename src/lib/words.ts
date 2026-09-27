/** Short, friendly words for auto-generated remote domains (e.g. `brave-otter.localhost`). */
const ADJECTIVES = [
  "brave", "calm", "clever", "cozy", "crisp", "eager", "fuzzy", "gentle", "glad", "golden",
  "happy", "honest", "jolly", "kind", "lively", "lucky", "merry", "mighty", "misty", "neat",
  "nimble", "noble", "quiet", "quick", "rapid", "silly", "smart", "snappy", "solid", "spry",
  "steady", "sunny", "sweet", "swift", "tidy", "tiny", "vivid", "warm", "wise", "witty",
];

const NOUNS = [
  "otter", "falcon", "badger", "beetle", "bison", "cobra", "comet", "coral", "crane", "cricket",
  "dolphin", "eagle", "ember", "ferret", "finch", "fox", "gecko", "heron", "hound", "koala",
  "lemur", "lion", "lynx", "maple", "meadow", "moth", "osprey", "panda", "penguin", "puffin",
  "rabbit", "raven", "reef", "robin", "seal", "sparrow", "swan", "tiger", "walrus", "wren", "yak",
];

/** `adjective-noun`, unique vs `taken`. Falls back to appending digits if every combination is taken. */
export function randomDomain(taken: Set<string>): string {
  const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
  for (let attempt = 0; attempt < 200; attempt++) {
    const candidate = `${pick(ADJECTIVES)}-${pick(NOUNS)}`;
    if (!taken.has(candidate)) return candidate;
  }
  const base = `${pick(ADJECTIVES)}-${pick(NOUNS)}`;
  for (let n = 2; n < 10_000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("Couldn't find a free domain.");
}
