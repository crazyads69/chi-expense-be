# Apple Sign-In OAuth Setup

## Prerequisites

- Apple Developer account ($99/year)
- Access to Certificates, Identifiers & Profiles

## Steps

### 1. Create App ID

- Go to [Apple Developer Portal - Identifiers](https://developer.apple.com/account/resources/identifiers/list)
- Click "+" to add new identifier
- Select "App IDs"
- Choose type: "App"
- Description: "Chi Expense"
- Bundle ID: `com.yourcompany.chiexpense`
- Enable "Sign in with Apple" capability

### 2. Create Services ID

- Add another identifier
- Select "Services IDs"
- Description: "Chi Expense OAuth"
- Identifier: `com.yourcompany.chiexpense.oauth` (this is your `APPLE_CLIENT_ID`)
- Enable "Sign in with Apple"
- Configure: Set primary app to your App ID
- Add domain and redirect URL:
  - Domain: `your-vercel-domain.vercel.app`
  - Return URL: `https://your-vercel-domain.vercel.app/api/auth/callback/apple`

### 3. Create Private Key

- Go to [Keys section](https://developer.apple.com/account/resources/authkeys/list)
- Click "+" to add new key
- Name: "Chi Expense OAuth Key"
- Enable "Sign in with Apple"
- Configure: Select your primary App ID
- Save Key ID (this is your `APPLE_KEY_ID`)
- Download the `.p8` file (**can only download once!**)
- Copy the contents as `APPLE_CLIENT_SECRET`

### 4. Get Team ID

- Go to [Membership details](https://developer.apple.com/account#MembershipDetailsCard)
- Copy Team ID

### 5. Configure Environment Variables

```env
APPLE_CLIENT_ID="com.yourcompany.chiexpense.oauth"
APPLE_CLIENT_SECRET="-----BEGIN EC PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...\n-----END EC PRIVATE KEY-----"
APPLE_TEAM_ID="ABCDE12345"
APPLE_KEY_ID="DEF123GHIJ"
```

**Note:** The private key must include newlines. Use `\n` in `.env` or actual newlines.

## Key Rotation

Apple private keys expire every 6 months. To rotate:

1. Create new key in [Apple Developer Portal](https://developer.apple.com/account/resources/authkeys/list)
2. Update `APPLE_CLIENT_SECRET` env var
3. Update `APPLE_KEY_ID` env var
4. Redeploy application
5. Revoke old key after confirming new key works

## Testing

### Web Flow

1. Go to your app login page
2. Click "Sign in with Apple"
3. Complete Apple authentication
4. Should redirect back to app with session

### Native iOS Flow

1. Use `@better-auth/expo` in mobile app
2. Call `authClient.signIn.social({ provider: 'apple' })`
3. Apple native sheet should appear
4. After auth, session should be established

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "invalid_client" | Wrong client ID or secret | Verify APPLE_CLIENT_ID matches Services ID |
| "invalid_grant" | Expired/invalid client secret | Rotate key, update env vars |
| "redirect_uri_mismatch" | Return URL not registered | Add exact callback URL to Services ID config |

## References

- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Better Auth Apple Provider](https://www.better-auth.com/docs/authentication/apple)
