// Convert string to color
export function stringToColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
  
    // Generate HSL color with:
    // - Hue: Full range (0-360)
    // - Saturation: 60-80% (muted but visible)
    // - Lightness: 35-65% (readable on both light and dark backgrounds)
    const h = Math.abs(hash) % 360;
    const s = 60 + (Math.abs(hash) % 20); // 60-80%
    const l = 35 + (Math.abs(hash) % 30); // 35-65%
  
    return `hsl(${h}, ${s}%, ${l}%)`;
  }
  
  // Validate display name format
  export function isValidDisplayName(name: string): boolean {
    return /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(name);
  }
  
  // Get initials from display name
  export function getInitials(displayName: string): string {
    return displayName
      .split(' ')
      .map(word => word[0])
      .join('');
  }
  
  // Get abbreviated name
  export function getAbbreviatedName(displayName: string): string {
    const [first, last] = displayName.split(' ');
    return `${first} ${last[0]}.`;
  }
  
  // Export types
  export type UserBadgeSize = 'small' | 'medium' | 'large';