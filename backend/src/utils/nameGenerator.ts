// src/utils/nameGenerator.ts
const adjectives = [
  'Amazing',
  'Brave',
  'Calm',
  'Daring',
  'Eager',
  'Fancy',
  'Gentle',
  'Happy',
  'Intrepid',
  'Jolly',
  'Kind',
  'Lively',
  'Mighty',
  'Noble',
  'Polite',
  'Quick',
  'Radiant',
  'Smart',
  'Talented',
  'Upbeat',
  'Vibrant',
  'Witty',
  'Zealous',
];

const nouns = [
  'Alligator',
  'Badger',
  'Cheetah',
  'Dolphin',
  'Elephant',
  'Falcon',
  'Giraffe',
  'Hedgehog',
  'Iguana',
  'Jaguar',
  'Koala',
  'Lion',
  'Monkey',
  'Narwhal',
  'Octopus',
  'Penguin',
  'Quokka',
  'Raccoon',
  'Squirrel',
  'Tiger',
  'Unicorn',
  'Viper',
  'Wolf',
];

export function generateRandomName(): string {
  const randomAdjective =
    adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${randomAdjective}${randomNoun}`;
}
