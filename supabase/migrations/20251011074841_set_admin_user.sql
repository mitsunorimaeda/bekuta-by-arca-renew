/*
  # Set Admin User
  
  ## Purpose
  Set info@arca.fit as admin user to allow access to organization management
  
  ## Changes
  - Update the role of info@arca.fit to 'admin'
*/

UPDATE users 
SET role = 'admin' 
WHERE email = 'info@arca.fit';

-- Verify the update
SELECT id, email, role, name 
FROM users 
WHERE email = 'info@arca.fit';
