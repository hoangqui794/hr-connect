# Production avatar storage rollout

Avatar uploads use the existing private Cloudflare R2 bucket. The database stores only an immutable object key and update timestamp. The API returns a versioned avatar route; the frontend resolves that route against its configured backend origin.

## Required production configuration

Set these secrets and variables on the backend service:

```ini
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key-id>
R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
R2_BUCKET_NAME=<private-bucket-name>
R2_ENDPOINT=https://<cloudflare-account-id>.r2.cloudflarestorage.com
PUBLIC_API_BASE_URL=https://<deployed-backend-host>
```

`PUBLIC_API_BASE_URL` must contain the backend origin without `/api/v1`. Production startup fails when a required value is absent or when either URL is not HTTPS. Never commit real credentials. `R2_PUBLIC_BASE_URL` is optional; leave it empty to keep the bucket private and let the API issue short-lived redirects.

Avatar limits have production-safe defaults and can be overridden when needed:

```ini
MAX_AVATAR_FILE_SIZE_MB=5
MAX_AVATAR_WIDTH=4096
MAX_AVATAR_HEIGHT=4096
MAX_AVATAR_PIXELS=16000000
AVATAR_OUTPUT_SIZE=1024
AVATAR_WEBP_QUALITY=85
AVATAR_PRESIGNED_URL_EXPIRY_MINUTES=10
```

The frontend must set `VITE_API_BASE_URL` to the same backend origin. Existing absolute legacy avatar URLs continue to work during this compatibility release.

## Deployment order

1. Back up the PostgreSQL database and verify R2 Put/Get/Delete permissions with a non-production object.
2. Configure the backend variables above.
3. Deploy the backend and run migration `20261019040709_ProductionAvatarStorage`.
4. Confirm `/health`, then upload, read, replace and delete an avatar using a test account.
5. Deploy the frontend and confirm the avatar remains correct after refresh and sign-in on Candidate, Affiliate, Client, HR and Admin shells.
6. Monitor failed/dead `storage_cleanup_job` rows and application logs during rollout.

## Rollback

Roll back application code before rolling back the schema. The compatibility `avatar_url` column remains available for legacy records. Do not drop `avatar_object_key`, `avatar_updated_at` or `storage_cleanup_job` while any deployed instance writes the new contract. If storage is temporarily unavailable, keep the database migration and restore R2 connectivity; queued cleanup jobs retry safely.

## Acceptance smoke test

- Upload a valid JPEG, PNG and WebP; each response must omit the storage key and the displayed image must survive refresh.
- Reject a renamed/non-image file, corrupt image, oversized upload and excessive dimensions.
- Replace an avatar; the new image must display immediately and the old key must be queued for cleanup.
- Delete twice; both requests must succeed and the default initials must display.
- Confirm a cleanup job never deletes a key still referenced by a user and never accepts a key outside `avatars/`.
