UPDATE users SET avatar = '' WHERE avatar IS NOT NULL AND avatar <> '';
