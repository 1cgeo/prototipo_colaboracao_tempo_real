-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for activity types
CREATE TYPE activity_type AS ENUM (
    'COMMENT_CREATED',
    'COMMENT_UPDATED',
    'COMMENT_DELETED',
    'REPLY_CREATED',
    'REPLY_UPDATED',
    'REPLY_DELETED',
    'USER_JOINED',
    'USER_LEFT'
);

-- Map Rooms table
CREATE TABLE map_rooms (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    active_users_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Anonymous Users table (for tracking current sessions)
CREATE TABLE anonymous_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    display_name VARCHAR(255) NOT NULL,
    map_room_uuid UUID REFERENCES map_rooms(uuid) ON DELETE SET NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Spatial Comments table with PostGIS
CREATE TABLE spatial_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    map_room_uuid UUID REFERENCES map_rooms(uuid) ON DELETE CASCADE,
    location GEOMETRY(POINT, 4326) NOT NULL,
    content TEXT NOT NULL,
    author_id UUID REFERENCES anonymous_users(id) ON DELETE SET NULL,
    author_name VARCHAR(255) NOT NULL,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Comment Replies table
CREATE TABLE comment_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID REFERENCES spatial_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_id UUID REFERENCES anonymous_users(id) ON DELETE SET NULL,
    author_name VARCHAR(255) NOT NULL,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Activity Log table
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    map_room_uuid UUID REFERENCES map_rooms(uuid) ON DELETE CASCADE,
    activity_type activity_type NOT NULL,
    user_id UUID REFERENCES anonymous_users(id) ON DELETE SET NULL,
    user_name VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optimized Indexes

-- Map rooms indexes
CREATE INDEX idx_map_rooms_updated_at ON map_rooms(updated_at);

-- Anonymous users indexes
CREATE INDEX idx_anonymous_users_map_room ON anonymous_users(map_room_uuid);
CREATE INDEX idx_anonymous_users_last_seen ON anonymous_users(last_seen_at);
CREATE INDEX idx_anonymous_users_id_room ON anonymous_users(id, map_room_uuid) WHERE map_room_uuid IS NOT NULL;

-- Spatial comments indexes
CREATE INDEX idx_spatial_comments_location ON spatial_comments USING GIST(location);
CREATE INDEX idx_spatial_comments_map_room ON spatial_comments(map_room_uuid);
CREATE INDEX idx_spatial_comments_version ON spatial_comments(id, version);

-- Comment replies indexes
CREATE INDEX idx_comment_replies_comment ON comment_replies(comment_id);
CREATE INDEX idx_comment_replies_version ON comment_replies(id, version);

-- Activity logs indexes
CREATE INDEX idx_activity_logs_map_room ON activity_logs(map_room_uuid, created_at);

-- Helpful function for nearby comments
CREATE OR REPLACE FUNCTION get_nearby_comments(
    room_uuid UUID,
    search_lat FLOAT,
    search_lng FLOAT,
    distance_meters FLOAT DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    author_name VARCHAR(255),
    distance FLOAT,
    latitude FLOAT,
    longitude FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.content,
        c.author_name,
        ST_Distance(
            c.location::geography, 
            ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography
        ) as distance,
        ST_Y(c.location::geometry) as latitude,
        ST_X(c.location::geometry) as longitude
    FROM spatial_comments c
    WHERE c.map_room_uuid = room_uuid
        AND ST_DWithin(
            c.location::geography, 
            ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography, 
            distance_meters
        )
    ORDER BY c.location <-> ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326);
END;
$$ LANGUAGE plpgsql;

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updating updated_at
CREATE TRIGGER update_map_rooms_updated_at
    BEFORE UPDATE ON map_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_spatial_comments_updated_at
    BEFORE UPDATE ON spatial_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_comment_replies_updated_at
    BEFORE UPDATE ON comment_replies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Function to update active users count
CREATE OR REPLACE FUNCTION update_active_users_count()
RETURNS TRIGGER AS $$
BEGIN
    -- On insert, only update count if map_room_uuid is not null
    IF TG_OP = 'INSERT' AND NEW.map_room_uuid IS NOT NULL THEN
        UPDATE map_rooms 
        SET active_users_count = active_users_count + 1
        WHERE uuid = NEW.map_room_uuid;
    -- On delete, only update count if map_room_uuid was not null
    ELSIF TG_OP = 'DELETE' AND OLD.map_room_uuid IS NOT NULL THEN
        UPDATE map_rooms 
        SET active_users_count = GREATEST(0, active_users_count - 1)
        WHERE uuid = OLD.map_room_uuid;
    -- On update, handle room changes
    ELSIF TG_OP = 'UPDATE' AND 
          (OLD.map_room_uuid IS DISTINCT FROM NEW.map_room_uuid) THEN
        -- Decrement old room if exists
        IF OLD.map_room_uuid IS NOT NULL THEN
            UPDATE map_rooms 
            SET active_users_count = GREATEST(0, active_users_count - 1)
            WHERE uuid = OLD.map_room_uuid;
        END IF;
        -- Increment new room if exists
        IF NEW.map_room_uuid IS NOT NULL THEN
            UPDATE map_rooms 
            SET active_users_count = active_users_count + 1
            WHERE uuid = NEW.map_room_uuid;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for maintaining active users count
CREATE TRIGGER maintain_active_users_count
    AFTER INSERT OR UPDATE OR DELETE ON anonymous_users
    FOR EACH ROW
    EXECUTE FUNCTION update_active_users_count();