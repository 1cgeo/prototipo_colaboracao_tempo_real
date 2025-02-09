// Arrays of adjectives and animals for generating random names
const adjectives = [
  'Happy',
  'Cheerful',
  'Bright',
  'Clever',
  'Gentle',
  'Kind',
  'Quick',
  'Calm',
  'Wise',
  'Brave',
  'Dancing',
  'Dashing',
  'Elegant',
  'Fancy',
  'Graceful',
  'Lively',
  'Merry',
  'Peaceful',
  'Proud',
  'Silly',
  'Smart',
  'Sweet',
  'Thoughtful',
  'Wandering',
  'Witty',
  'Zealous',
  'Charming',
  'Creative',
  'Friendly',
  'Jolly',
];

const animals = [
  'Penguin',
  'Elephant',
  'Giraffe',
  'Dolphin',
  'Kangaroo',
  'Koala',
  'Lion',
  'Tiger',
  'Panda',
  'Rabbit',
  'Raccoon',
  'Fox',
  'Wolf',
  'Bear',
  'Deer',
  'Duck',
  'Eagle',
  'Falcon',
  'Hawk',
  'Owl',
  'Peacock',
  'Swan',
  'Zebra',
  'Cheetah',
  'Leopard',
  'Lynx',
  'Squirrel',
  'Hedgehog',
  'Otter',
  'Seal',
];

/**
 * Generates a random name by combining an adjective and an animal
 * @returns {string} A random name like "Happy Penguin"
 */
export const generateRandomName = (): string => {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adjective} ${animal}`;
};

/**
 * Checks if a name is in the valid format (Adjective Animal)
 * @param name Name to validate
 * @returns {boolean} True if name is valid
 */
export const isValidGeneratedName = (name: string): boolean => {
  const [adjective, animal] = name.split(' ');
  return (
    adjectives.includes(adjective) &&
    animals.includes(animal) &&
    name.split(' ').length === 2
  );
};
