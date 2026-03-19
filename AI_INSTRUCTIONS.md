# VoiceConnect Campaign - AI & Development Rules

This file documents critical architectural rules and database constraints for the VoiceConnect Campaign project. All AI assistants and developers should follow these rules to prevent regressions.

## 🔐 Database & Security (Supabase)

### Row Level Security (RLS) - Users Table
The `public.users` table MUST ALWAYS have the following policies to support the authentication flow and ID migration:

1. **Self-Registration (INSERT)**:
   - **Policy**: `Users can insert their own profile`
   - **Rule**: `FOR INSERT TO authenticated WITH CHECK (email = auth.jwt() ->> 'email')`
   - **Reason**: Allows new Google-authenticated users to create their initial profile automatically.

2. **ID Migration (UPDATE)**:
   - **Policy**: `Users can update their own profile`
   - **Rule**: `FOR UPDATE TO authenticated USING (email = auth.jwt() ->> 'email') WITH CHECK (email = auth.jwt() ->> 'email')`
   - **Reason**: Allows users to link their pre-registered profile (often with a `pending:` ID) to their new official Supabase Auth ID.

3. **Admin Override (UPDATE)**:
   - **Policy**: `Admins can update all profiles`
   - **Rule**: `FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE email = auth.jwt() ->> 'email' AND role IN ('ADMIN', 'DEVELOPER')))`

### Row Level Security (RLS) - Contacts Table
- **Admin/Dev**: Full access to all contacts.
- **Volunteers**: Can ONLY see and edit contacts where `assigned_to` matches their `auth.uid()` OR their recorded ID in the `users` table.

## 🚀 Authentication Flow

- The project uses **Supabase OAuth (Google)**.
- Authentication logic is centralized in `src/context/AuthContext.jsx`.
- **Migration Logic**: When a user logs in, the app checks if `users` table already has their email. If it does but the ID doesn't match the new Supabase Auth ID, it **must** update the `users.id` and any corresponding `contacts.assigned_to` fields. **DO NOT remove this logic.**
- **Call Logging**: All call-related updates (`recordCall`, `updateContact` for call status) **must** also be recorded in the `call_logs` table for audit trail.

## 📝 Documentation Rules
- **CURRENT_STATUS.md**: This file must be updated after every significant change or at the end of a task.
- **Format**: Each entry must follow the structure: **[Date] Title**, **Problem**, **Solution (수정방법)**, and **Future Plan (향후 계획)**.
- Maintain the most recent logs at the top.
