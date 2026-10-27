# Paid services for the foundation release

Status: core recommendations checked against official pricing on 27 October 2026.
Analytics and review-plan additions checked on 28 October 2026.
No purchases, plan changes or commitments made. USD prices exclude tax and
usage charges; provider checkout controls the final charge.

| Service                                          | Recommended start                                                    | Published base price                                    | Why it helps                                                                                                            |
| ------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Vercel                                           | Pro                                                                  | USD20/month plus usage; check paid developer seats      | Commercial web hosting, team access and spending controls.                                                              |
| Convex                                           | Professional                                                         | USD25/developer/month plus usage                        | Daily backups, logging and exception reporting for production work.                                                     |
| Expo EAS                                         | Starter                                                              | USD19/month plus usage                                  | Deferred while Expo is paused. Priority builds are a future option, not a web-release need.                             |
| Trigger.dev                                      | Hobby initially; Pro if support/retention matters                    | USD10/month Hobby; USD50/month Pro                      | Long jobs and schedules; Pro adds 30 day retention and dedicated Slack support.                                         |
| Apple Developer Program                          | Organization enrolment if eligible                                   | USD99/year or local price                               | iOS signing, TestFlight and App Store distribution. Identity/entity checks take time.                                   |
| Google Play Console                              | Developer registration                                               | USD25 one time                                          | Android publication. Account verification/testing obligations still apply.                                              |
| Cloudflare R2                                    | Standard pay as you go                                               | USD0.015/GB month after free allowance, plus operations | Private uploads; no internet egress charge. 10GB month Standard free tier.                                              |
| Cloudflare Turnstile                             | Free                                                                 | USD0                                                    | Retain current bot protection; a paid Cloudflare plan is not needed merely for Turnstile.                               |
| Surepass                                         | Existing approved GST products and funded usage                      | Account quotation                                       | Confirm the actual subscribed endpoints, credit and quota. Buying another hosting plan will not activate a GST product. |
| OS Digital ENVRIN / configured MSG91 alternative | Existing OTP service and approved sender/templates                   | Provider quotation and message usage                    | Top up the current service and complete sender/template approval, rather than add another OTP provider.                 |
| Cashfree                                         | Existing selected merchant setup                                     | Merchant contract and transaction pricing               | Finish merchant and split/vendor acceptance for the implemented business payment policy.                                |
| Resend                                           | Existing configured email path; paid only if volume/support needs it | Check current account offer                             | Invitations and recovery, independent of OTP.                                                                           |
| AI model service                                 | Usage budget on current provider                                     | Model usage                                             | Optional document/photo assistance. Set server quotas; no mandatory new AI subscription to make manual flows work.      |

## Analytics and review options

| Service    | Start                                                            | Published price checked 28 October                                             | Use and limits                                                                                                                                                                                                                                                |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostHog    | Free product analytics initially                                 | First 1 million events per month free; usage beyond starts at USD0.00005/event | Public-page, consented analytics only in this release. Replay and private-form capture stay off. [Official pricing](https://posthog.com/pricing).                                                                                                             |
| Sentry     | Free Developer for one person; Team when collaboration is needed | Team from USD26/month when billed annually with default prepaid data           | Error monitoring and team access. Keep this app's error-only, scrubbed capture policy. Usage and add-ons can cost more. [Official pricing](https://sentry.io/pricing/).                                                                                       |
| GitHub     | Current plan; organization Team when its controls are needed     | Team USD4/user/month; check introductory/annual terms and checkout             | More Actions allowance and organization controls. Private security scanning has separate organization/licensing conditions; personal Pro alone does not unlock it. [Official pricing](https://github.com/pricing), [pipeline setup](ci-security-pipeline.md). |
| CodeRabbit | Optional Essentials                                              | USD30/developer/month monthly, or USD24/developer/month billed annually        | Automated pull-request review; Essentials is the current name for Pro. Required tests and human judgment remain necessary. [Official pricing](https://www.coderabbit.ai/pricing).                                                                             |

These optional plans are outside the core hosting subtotal. Do not enable extra
capture, purchase a plan or accept commercial terms automatically. Verify the
actual checkout and usage budget before activation.

Suggested current web platform base for one developer: USD55/month
(Vercel20 + Convex25 + Trigger Hobby10), before usage and taxes.
With Trigger Pro the base is USD95/month. Expo, Apple enrolment and Google
Play registration are deferred while native work is paused. R2, OTP, GST,
payment and AI usage remain variable. Scale plans from measured use.

Do not purchase AWS instances yet. Do not buy a second database, auth service,
queue, storage provider or paid IDE to solve an infrastructure problem this
stack already covers. AWS can be added for a measured specialist workload.
Paid plans reduce some capacity and queue limits; they do not bypass store
review, business verification, SMS approvals, payment onboarding or legal rules.

## Official sources

- [Vercel pricing](https://vercel.com/pricing)
- [Convex pricing](https://www.convex.dev/pricing)
- [Expo pricing](https://expo.dev/pricing)
- [Trigger pricing](https://trigger.dev/pricing)
- [Apple programme](https://developer.apple.com/programs/)
- [Google developer registration](https://support.google.com/googleplay/android-developer/answer/6112435)
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Turnstile](https://www.cloudflare.com/products/turnstile/)
