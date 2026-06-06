# Reset admin password

Your account `robert.stutzman.01@outlook.com` already exists and already has the `admin` role — only the password needs resetting.

## What I'll do

Run one migration that updates the password hash for your account directly in the auth system:

```sql
UPDATE auth.users
SET encrypted_password = crypt('Bigben0919!', gen_salt('bf')),
    updated_at = now()
WHERE email = 'robert.stutzman.01@outlook.com';
```

That's it — no app code changes, no schema changes.

## After approval

1. Go to `/login`
2. Email: `robert.stutzman.01@outlook.com`
3. Password: `Bigben0919!`
4. You'll land on `/admin` (role already granted), then click **Sounds**.

## Heads-up

Putting a real password in chat means it lives in the project history. After you sign in, consider changing it to something only you know (we can add a "Change password" UI later, or you can just tell me a new one to rotate to).
