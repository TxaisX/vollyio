# Payment account settings that are still wrong

Four fields on the merchant account still describe a previous business. None can
be changed from code: the connector this repo uses exposes no account-write
operation, so every one of these is a dashboard edit. Values below are ready to
paste.

Checked live on 2026-07-28 against account `acct_1NMwN5JOFP4i3BqJ`.

## 1. The statement descriptor. Do this one first.

**Currently: `CHAMP IMMORTALITY`**

That is the text printed on the card statement of every person who pays for
Vollyio. They will not recognise it, and an unrecognised line item is the single
most common trigger for a chargeback. A chargeback costs the disputed amount, a
fee on top, and a dispute ratio that Stripe watches. This is the one item here
that costs real money if it is left alone.

Dashboard: Settings, Payments, Statement descriptor.

    Statement descriptor:        VOLLYIO
    Short descriptor (prefix):   VOLLYIO

Constraints worth knowing: 5 to 22 characters, must contain letters, and cannot
contain `< > \ " '` or `*`. `VOLLYIO` satisfies all of it.

Check it afterwards with:

```sh
curl -s https://api.stripe.com/v1/accounts/acct_1NMwN5JOFP4i3BqJ \
  -u "$STRIPE_SECRET_KEY:" | grep -i statement_descriptor
```

## 2. Business profile

Dashboard: Settings, Business, Public details.

| Field | Currently | Set to |
|---|---|---|
| Business name | not set | `Vollyio` |
| Website | `https://www.instagram.com/champimmortality/` | `https://vollyio.com` |
| Support email | not set | the address `lib/site.ts` resolves `SUPPORT_EMAIL` to, so the receipt and the privacy page agree |
| Support URL | not set | `https://vollyio.com/settings` |

Product description, currently *"My business will consist of mentoring clients to
gain a better understanding of how Instagram works."* Replace with:

> Vollyio scores a volleyball player's technique from a short clip filmed on
> their phone, against a per-skill coaching checklist, and returns the single
> highest-leverage correction. Subscription: $14.99 per month for 18 analyses.
> Free tier: 3 analyses per month.

The website field is not cosmetic. The provider compares the registered site
against the site actually taking payments, and a mismatch is a normal reason for
a review or a payout hold.

## 3. Branding

Dashboard: Settings, Branding. Icon, logo and colours are all unset, so the
hosted checkout page a player lands on looks like a generic form at the exact
moment they are deciding whether to trust it with a card.

    Icon:            public/icon-mark.png
    Brand colour:    #E8B93B   (gold, --color-gold)
    Accent colour:   #0F212C   (navy, --color-navy)

## 4. Receipts

Dashboard: Settings, Emails. Turn on successful payment receipts if they are off.
A receipt naming Vollyio, sent at the moment of charge, is the cheapest
chargeback defence there is, and a subscription acknowledgement is expected of an
auto-renewing consumer plan.

## What is already correct, for the record

Verified live, nothing to do:

- `charges_enabled` and `payouts_enabled` both true, `details_submitted` true.
- Identity verified: document and SSN last four on file.
- Bank account attached and verified, daily payouts on a two day delay.
- `requirements.currently_due`, `past_due` and `eventually_due` all empty.
- Active payment methods: card, Link, Cash App Pay, ACH bank debit, Klarna,
  Affirm, Afterpay, Amazon Pay, and several European methods. Apple Pay and
  Google Pay ride on card and need no separate enabling.

## Not a settings question

`business_type` is `individual`. The business is a sole proprietorship, not an
LLC or a corporation, which means personal liability and personal tax treatment
for revenue from a product used by minors. That is a question for an accountant
or an attorney, and it is recorded here only so it is not mistaken for an
oversight.
