// Supabase Configuration Template
// Copy this file to config.js and fill in your Supabase credentials
// DO NOT commit config.js to git (it's in .gitignore)

const SUPABASE_CONFIG = {
	url: 'https://your-project-id.supabase.co',
	anonKey: 'your-anon-key-here'
};

// How to get your Supabase credentials:
// 1. Go to https://supabase.com and create a project (or use existing)
// 2. Go to Project Settings > API
// 3. Copy the "Project URL" and paste it as the 'url' value above
// 4. Copy the "anon public" key and paste it as the 'anonKey' value above
//
// Security Note: The anon key is safe to use client-side. It's designed for public access.
// Never use the "service_role" key in client-side code - it has admin privileges.

