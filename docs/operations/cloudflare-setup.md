# Cloudflare activation checklist

Use one Cloudflare account for Turnstile and R2. The website can stay on Vercel;
the database and authentication can stay on Convex. No DNS transfer, Worker or
additional hosting service is required. Use separate staging and production
widgets, buckets and credentials. Do not paste secrets into chat or commit them.

## 1. Turnstile

1. Open Cloudflare → Turnstile → Add widget. Name it `Luma.Green production`.
2. Select **Invisible**. Add `lumagreen.vercel.app`, the verified live alias on
   15 October 2026. Add `luma.green` or `www.luma.green` only after those domains
   are connected and working. Do not add the Convex API host.
3. Copy the site key into Vercel's **Production** environment as
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. A fresh frontend deployment is required.
4. In the matching **production Convex deployment**, configure:

   | Variable               | Value                                                                  |
   | ---------------------- | ---------------------------------------------------------------------- |
   | `TURNSTILE_SECRET_KEY` | Widget secret                                                          |
   | `TURNSTILE_HOSTNAMES`  | Exact comma-separated frontend hosts, currently `lumagreen.vercel.app` |
   | `TURNSTILE_ENABLED`    | `false` during setup; `true` after acceptance                          |

5. Before activation, publish a translated privacy notice that links the
   [Turnstile Privacy Addendum](https://www.cloudflare.com/turnstile-privacy-policy/).
   This remains a release gate while UI/page work is on hold. See the approved
   disclosure text in [Turnstile setup](turnstile.md).
6. Test staging with real widget keys: normal and admin OTP sends, resends,
   household login, account phone binding and required authenticator challenges.
   Confirm an OTP request without a challenge token is rejected before SMS work.
7. Enable production enforcement only after the frontend has the matching key.
   Test with one consented phone. Old open tabs need a reload. Native apps are on
   hold and are not accepted for this rollout; do not release native binaries
   until their separate device tests pass.

Rollback: set `TURNSTILE_ENABLED=false`. Existing authentication controls remain.
Never configure an automatic fail-open path.

## 2. R2 private quality attachments

1. Open Cloudflare → R2 Object Storage. Activate R2; the dashboard may request
   billing details. Review the displayed terms before accepting a paid plan.
2. Create a **Standard**, private bucket named, for example,
   `luma-green-quality-production`. Use the default global S3 endpoint; this
   implementation does not support jurisdiction-specific endpoints.
3. Keep public `r2.dev` access disabled. Do not attach a public custom domain.
   No bucket CORS rule is required because uploads and reads go through Convex.
4. Create an R2 API credential with **Object Read & Write**, scoped only to this
   bucket. Save its access key and secret securely.
5. In the matching **production Convex deployment**, configure:

   | Variable               | Value                                         |
   | ---------------------- | --------------------------------------------- |
   | `R2_ACCOUNT_ID`        | Cloudflare account ID                         |
   | `R2_BUCKET_NAME`       | Exact bucket name                             |
   | `R2_ACCESS_KEY_ID`     | Bucket-scoped access key                      |
   | `R2_SECRET_ACCESS_KEY` | Private signing secret                        |
   | `R2_ENABLED`           | `false` during setup; `true` after acceptance |

6. Repeat first in staging. Upload a synthetic quality PDF/image (maximum 2 MiB),
   download it as the authorized user, and verify unrelated users cannot read it.
   Confirm the object appears in the correct bucket and public access is denied.
   Test withdrawal and abandoned-upload cleanup. Then activate production.

Only **new quality attachments** use R2. Application/identity documents remain in
Convex. To stop new R2 writes, set `R2_ENABLED=false`, but retain the bucket and
credentials for existing reads and cleanup. Do not change bucket settings while
records still reference the old bucket. See [R2 setup](../architecture/r2-storage-plan.md).

## Cost and account reuse

Checked against official documentation on 15 October 2026:
[Turnstile is free](https://developers.cloudflare.com/turnstile/plans/) for this
setup. [R2 Standard pricing](https://developers.cloudflare.com/r2/pricing/)
includes 10 GB-month storage, 1 million Class A and 10 million Class B operations
per month. Above the allowance, storage is $0.015/GB-month; operations are
$4.50/million Class A and $0.36/million Class B. Direct egress is free. Convex
and Vercel costs are separate. Usage alerts are not a hard spending cap.

The same account can later manage DNS/CDN, firewall controls and Workers.
These products are optional and each has separate limits and billing. They are
not prerequisites for this implementation. No Cloudflare service was purchased
or activated by the code changes.
