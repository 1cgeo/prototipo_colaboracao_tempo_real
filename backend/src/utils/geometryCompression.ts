// Path: utils\geometryCompression.ts

/**
 * Utility functions for compressing geospatial data to reduce bandwidth usage
 * Reduces coordinate precision to approximately 1 meter accuracy (5 decimal places)
 */

/**
 * Reduce precision of coordinates to save bandwidth
 * 5 decimal places ≈ 1.1 meter precision at the equator
 * 
 * @param coordinates Coordinates array (any nesting level)
 * @param precision Number of decimal places to keep
 * @returns Compressed coordinates with reduced precision
 */
function compressCoordinates(coordinates: any, precision: number = 5): any {
  if (!coordinates) return coordinates;
  
  // If it's a simple [lng, lat] pair
  if (Array.isArray(coordinates) && coordinates.length === 2 && 
      typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    return [
      Number(coordinates[0].toFixed(precision)),
      Number(coordinates[1].toFixed(precision))
    ];
  }
  
  // If it's a nested structure (LineString, Polygon, etc.)
  if (Array.isArray(coordinates)) {
    return coordinates.map(coord => compressCoordinates(coord, precision));
  }
  
  // Not coordinates, return as is
  return coordinates;
}

/**
 * Compress a GeoJSON geometry object by reducing coordinate precision
 * 
 * @param geometry GeoJSON geometry object
 * @param precision Number of decimal places to keep
 * @returns Compressed geometry object
 */
function compressGeometry(geometry: any, precision: number = 5): any {
  if (!geometry) return geometry;
  
  // Create a shallow clone to avoid modifying the original
  const compressedGeometry = { ...geometry };
  
  // Compress the coordinates if they exist
  if (compressedGeometry.coordinates) {
    compressedGeometry.coordinates = compressCoordinates(compressedGeometry.coordinates, precision);
  }
  
  return compressedGeometry;
}

/**
 * Compress a complete feature by reducing geometry precision
 * 
 * @param feature Feature object with geometry property
 * @param precision Number of decimal places to keep
 * @returns Compressed feature
 */
export function compressFeature(feature: any, precision: number = 5): any {
  if (!feature) return feature;
  
  // Create a shallow clone to avoid modifying the original
  const compressedFeature = { ...feature };
  
  // Compress the geometry if it exists
  if (compressedFeature.geometry) {
    compressedFeature.geometry = compressGeometry(compressedFeature.geometry, precision);
  }
  
  return compressedFeature;
}

/**
 * Compress an array of features by reducing geometry precision
 * 
 * @param features Array of feature objects
 * @param precision Number of decimal places to keep
 * @returns Array of compressed features
 */
export function compressFeatures(features: any[], precision: number = 5): any[] {
  if (!features || !Array.isArray(features)) return features;
  
  return features.map(feature => compressFeature(feature, precision));
}