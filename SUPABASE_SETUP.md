# Supabase Setup Instructions

This guide will walk you through setting up Supabase for the feedback form.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A Supabase project (create one if you don't have one)

## Step 1: Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** > **API**
3. Copy the following:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (the public anon key, NOT the service_role key)

4. Open `config.example.js` and copy it to `config.js`
5. Fill in your credentials in `config.js`:
   ```javascript
   const SUPABASE_CONFIG = {
     url: 'https://your-project-id.supabase.co',
     anonKey: 'your-anon-key-here'
   };
   ```

**Security Note**: The anon key is safe for client-side use. Never use the service_role key in client-side code.

## Step 2: Create the Database Table

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the following SQL:

```sql
-- Create feedback_submissions table
CREATE TABLE feedback_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  issue TEXT NOT NULL,
  image_url TEXT,
  submission_type TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_agent TEXT,
  referrer_url TEXT,
  page_url TEXT,
  language TEXT,
  screen_resolution TEXT,
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create indexes for better query performance
CREATE INDEX idx_feedback_created_at ON feedback_submissions(created_at DESC);
CREATE INDEX idx_feedback_status ON feedback_submissions(status);
CREATE INDEX idx_feedback_email ON feedback_submissions(email);
```

5. Click **Run** to execute the query
6. Verify the table was created by going to **Table Editor** and checking for `feedback_submissions`

## Step 3: Set Up Row Level Security (RLS) Policies

1. Go to **Authentication** > **Policies** (or **Table Editor** > `feedback_submissions` > **Policies**)
2. Click **Enable RLS** if not already enabled
3. Create a new policy for INSERT (allowing public submissions):

   - **Policy Name**: `Allow public insert`
   - **Allowed Operation**: `INSERT`
   - **Target Roles**: `public`
   - **Policy Definition**: 
     ```sql
     true
     ```
   - Click **Save**

4. Create a policy for SELECT (restrict to authenticated users or admins only):

   - **Policy Name**: `Restrict select to authenticated`
   - **Allowed Operation**: `SELECT`
   - **Target Roles**: `authenticated` (or create a custom role for admins)
   - **Policy Definition**:
     ```sql
     true
     ```
   - Click **Save**

**Note**: For a public feedback form, you typically want:
- **INSERT**: Allow public (anyone can submit)
- **SELECT**: Restrict to authenticated/admin users (only you can view submissions)

## Step 4: Create Storage Bucket

1. Go to **Storage** in your Supabase dashboard
2. Click **New bucket**
3. Configure the bucket:
   - **Name**: `feedback-images`
   - **Public bucket**: **Unchecked** (keep it private)
   - Click **Create bucket**

4. Configure bucket policies:
   - Click on the `feedback-images` bucket
   - Go to **Policies** tab
   - Click **New Policy**
   - Create an INSERT policy:
     - **Policy Name**: `Allow public uploads`
     - **Allowed Operation**: `INSERT`
     - **Target Roles**: `public`
     - **Policy Definition**:
       ```sql
       true
       ```
     - Click **Save**

   - Create a SELECT policy (for viewing uploaded images):
     - **Policy Name**: `Allow public read`
     - **Allowed Operation**: `SELECT`
     - **Target Roles**: `public`
     - **Policy Definition**:
       ```sql
       true
       ```
     - Click **Save**

5. Configure CORS (if needed):
   - Go to **Settings** > **API** > **CORS**
   - Add your domain to allowed origins (e.g., `https://riceywong.github.io`)
   - Or use `*` for development (not recommended for production)

## Step 5: Configure File Size Limits

1. Go to **Storage** > **Settings**
2. Set **File size limit** to 5MB (5242880 bytes)
3. Save settings

**Note**: The application also validates file size client-side, but server-side limits provide additional security.

## Step 6: Test the Setup

1. Open `feedback.html` in your browser
2. Fill out the form with test data
3. Submit the form
4. Check your Supabase dashboard:
   - **Table Editor** > `feedback_submissions` - should see your test submission
   - **Storage** > `feedback-images` - should see uploaded image (if you included one)

## Troubleshooting

### Error: "Supabase client not initialized"

**Solution**: Make sure `config.js` exists and contains valid Supabase credentials. Check the browser console for specific errors.

### Error: "new row violates row-level security policy"

**Solution**: 
1. Make sure RLS is enabled on the `feedback_submissions` table
2. Verify you have an INSERT policy that allows public access
3. Check that the policy definition is `true` (allows all inserts)

### Error: "Bucket not found" or "Storage bucket error"

**Solution**:
1. Verify the bucket name is exactly `feedback-images`
2. Check that the bucket exists in Storage
3. Verify bucket policies allow INSERT and SELECT operations
4. Check CORS settings if uploads fail

### Error: "File too large" or upload fails

**Solution**:
1. Check Storage settings for file size limits
2. Verify the file is under 5MB
3. Check browser console for specific error messages
4. Verify CORS is configured correctly

### Images not displaying

**Solution**:
1. If bucket is private, you may need to use signed URLs instead of public URLs
2. Update `feedback.js` to generate signed URLs:
   ```javascript
   // Replace getPublicUrl with getSignedUrl
   const { data: urlData, error: urlError } = await supabase.storage
     .from(STORAGE_BUCKET)
     .createSignedUrl(fileName, 3600); // 1 hour expiry
   ```

### CORS errors in browser console

**Solution**:
1. Go to **Settings** > **API** > **CORS**
2. Add your domain to allowed origins
3. For GitHub Pages, add: `https://yourusername.github.io`
4. For local development, you may need to add `http://localhost:3000` (or your dev port)

### Database connection errors

**Solution**:
1. Verify your Supabase project is active (not paused)
2. Check your internet connection
3. Verify the URL and anon key in `config.js` are correct
4. Check Supabase status page: https://status.supabase.com

## Security Best Practices

1. **Never commit `config.js` to git** - it's already in `.gitignore`
2. **Use anon key only** - Never use service_role key in client-side code
3. **Enable RLS** - Always use Row Level Security policies
4. **Validate server-side** - Client-side validation can be bypassed
5. **Monitor submissions** - Regularly check for spam or abuse
6. **Set up rate limiting** - Consider implementing server-side rate limiting via Edge Functions

## Optional: Set Up Email Notifications

To receive email notifications for new submissions, you can create a Supabase Edge Function:

1. Go to **Edge Functions** in your dashboard
2. Create a new function that triggers on database inserts
3. Use Supabase's email service or integrate with SendGrid/Mailgun
4. Set up a database trigger to call the function on new submissions

## Optional: Automatic Image Cleanup

To automatically delete old images (e.g., older than 90 days):

1. Create a Supabase Edge Function or cron job
2. Query for submissions older than 90 days
3. Delete associated images from storage
4. Optionally delete the database records

## Next Steps

- Test the form thoroughly
- Monitor submissions in the Supabase dashboard
- Set up email notifications (optional)
- Implement server-side rate limiting (recommended)
- Add analytics tracking for form usage

## Support

For Supabase-specific issues, check:
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- [Supabase GitHub](https://github.com/supabase/supabase)







