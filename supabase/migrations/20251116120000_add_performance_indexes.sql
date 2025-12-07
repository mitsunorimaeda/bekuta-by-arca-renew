/*
  # Add Performance Optimization Indexes

  1. New Indexes
    - Add composite indexes for frequently queried combinations
    - Add indexes for training_records queries used in AthleteList
    - Add indexes for performance_records queries
    - Add indexes for coach_comments queries
    - Add indexes for users table queries

  2. Purpose
    - Speed up AthleteList ACWR calculations
    - Optimize messaging queries
    - Improve dashboard loading times
    - Reduce query execution time for staff views
*/

-- Training records: Optimize user_id + date queries (used heavily in ACWR calculations)
CREATE INDEX IF NOT EXISTS idx_training_records_user_date
  ON training_records(user_id, date DESC);

-- Training records: Optimize team-based queries
CREATE INDEX IF NOT EXISTS idx_training_records_date
  ON training_records(date DESC);

-- Performance records: Optimize user_id + test_type queries
CREATE INDEX IF NOT EXISTS idx_performance_records_user_test
  ON performance_records(user_id, test_type_id, date DESC);

-- Performance records: Optimize date range queries
CREATE INDEX IF NOT EXISTS idx_performance_records_date
  ON performance_records(date DESC);

-- Coach comments: Optimize athlete view queries
CREATE INDEX IF NOT EXISTS idx_coach_comments_athlete
  ON coach_comments(athlete_id, created_at DESC);

-- Coach comments: Optimize coach view queries
CREATE INDEX IF NOT EXISTS idx_coach_comments_coach
  ON coach_comments(coach_id, created_at DESC);

-- Coach comments: Optimize unread queries
CREATE INDEX IF NOT EXISTS idx_coach_comments_unread
  ON coach_comments(athlete_id, is_read, created_at DESC)
  WHERE is_read = false;

-- Users: Optimize team-based queries
CREATE INDEX IF NOT EXISTS idx_users_team_role
  ON users(team_id, role);

-- Users: Optimize organization lookups
CREATE INDEX IF NOT EXISTS idx_users_role
  ON users(role);

-- Staff team links: Optimize coach's team lookups
CREATE INDEX IF NOT EXISTS idx_staff_team_links_staff
  ON staff_team_links(staff_user_id);

CREATE INDEX IF NOT EXISTS idx_staff_team_links_team
  ON staff_team_links(team_id);

-- User points: Optimize leaderboard queries
CREATE INDEX IF NOT EXISTS idx_user_points_total
  ON user_points(user_id, total_points DESC);

-- User badges: Optimize badge display queries
CREATE INDEX IF NOT EXISTS idx_user_badges_user
  ON user_badges(user_id, earned_at DESC);

-- User goals: Optimize active goals queries
CREATE INDEX IF NOT EXISTS idx_user_goals_user_status
  ON user_goals(user_id, status, target_date);
