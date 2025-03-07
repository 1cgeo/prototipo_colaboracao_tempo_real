-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create maps table first since it's referenced by comments
CREATE TABLE IF NOT EXISTS maps (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  map_id INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create replies table
CREATE TABLE IF NOT EXISTS replies (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS comments_map_id_idx ON comments(map_id);
CREATE INDEX IF NOT EXISTS replies_comment_id_idx ON replies(comment_id);

-- Create features table (partition-ready but not partitioned)
CREATE TABLE features (
  id SERIAL PRIMARY KEY,
  map_id INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  feature_type VARCHAR(10) NOT NULL CHECK (feature_type IN ('point', 'line', 'polygon', 'text', 'image')),
  geometry GEOMETRY NOT NULL,
  properties JSONB NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  version INTEGER DEFAULT 1
);

-- Add map_id to indexes for partition-readiness
CREATE INDEX features_map_id_idx ON features(map_id);
CREATE INDEX features_feature_type_idx ON features(feature_type);
CREATE INDEX features_geom_idx ON features USING GIST (geometry);

-- Feature history table (partition-ready but not partitioned)
CREATE TABLE feature_history (
  id SERIAL PRIMARY KEY,
  feature_id INTEGER REFERENCES features(id) ON DELETE SET NULL,
  map_id INTEGER NOT NULL,
  operation VARCHAR(10) NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  previous_state JSONB NULL,
  new_state JSONB NULL,
  user_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX feature_history_map_id_idx ON feature_history(map_id);
CREATE INDEX feature_history_feature_id_idx ON feature_history(feature_id);