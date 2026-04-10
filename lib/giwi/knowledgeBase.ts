// lib/giwi/knowledgeBase.ts
//
// Static domain expertise injected into every GIWI Gemini prompt.
// This is a read-only constant — never fetched from DB, never user-editable.
// Loaded once per API route startup, not re-read on each request.

export const GIWI_KNOWLEDGE_BASE = `
SECTION 1 — Metric Definitions

MRR — Monthly Recurring Revenue: The total predictable revenue your business earns from active subscriptions in a single month, excluding one-time payments or setup fees. It is the clearest real-time measure of your business's earning stability and the single number that reflects whether your subscription model is working.
Formula: Sum of all active subscribers × their respective monthly plan prices

ARR — Annual Recurring Revenue: The annualised version of MRR, showing what your subscription business would earn over twelve months if no subscribers joined or left today. Used for business planning and valuation — not a performance metric, but a scale indicator.
Formula: MRR × 12

Churn Rate: The percentage of paying subscribers who cancelled their subscriptions in a given month. A business with 5% monthly churn loses more than half its subscriber base in a year even with zero new sales — making this the most consequential number in any subscription business.
Formula: Subscribers lost in the month ÷ Total subscribers at start of month × 100

ARPU — Average Revenue Per User: The average monthly revenue generated per active subscriber. Low ARPU signals underpricing or subscribers concentrating in the cheapest plan; both are addressable problems with plan structure changes.
Formula: Total MRR ÷ Total active subscribers

Net Revenue Retention (NRR): The percentage of revenue retained from your existing subscriber base after accounting for upgrades, downgrades, and cancellations — without counting any new subscriber acquisitions. An NRR above 100% means your existing customers are paying you more over time without needing new sales to grow. The median NRR for Indian SaaS in 2024–25 is 101%; top-quartile firms achieve above 110%.
Formula: (Starting MRR + Expansion MRR − Downgrade MRR − Churned MRR) ÷ Starting MRR × 100

Subscriber Growth Rate: The month-over-month percentage increase in total active subscribers. Measures acquisition momentum independent of revenue — useful for separating growth problems (insufficient new subscribers) from monetisation problems (subscribers not paying enough).
Formula: (End-of-month subscribers − Start-of-month subscribers) ÷ Start-of-month subscribers × 100

Failed Payment Rate: The percentage of renewal payment attempts in a month that fail due to UPI autopay breaks, card declines, insufficient funds, or mandate lapses. In India, this rate is structurally higher than global norms due to NPCI mandate regulations and low corporate card penetration — it does not always indicate subscriber intent to cancel.
Formula: Failed renewal attempts ÷ Total renewal attempts × 100

Recovery Rate: The percentage of failed payments eventually collected through automatic retry, WhatsApp outreach, or subscriber self-correction. A high recovery rate separates involuntary churn (payment friction) from voluntary churn (subscriber decision) — both require different responses.
Formula: Recovered failed payments ÷ Total failed payments in the period × 100

---

SECTION 2 — Benchmarks by Business Type (India-Specific)

Early-Stage Indian SaaS (Under ₹10L MRR): Healthy monthly churn 5–10%. This exceeds the global early-stage benchmark of 3–7% because Indian SME buyers have lower switching costs, limited annual billing habits, and higher budget sensitivity in the first 90 days. MRR growth of 15–25% monthly is healthy at this stage. ARPU typically ranges ₹800–₹3,000/month. The 2024 median ARR growth rate for Indian private SaaS was 26%, down from 60% in 2023, reflecting market maturation.
Healthy Signal: MRR growth rate consistently outpacing churn rate by 3× or more.
Attention Signal: ARPU declining month-on-month while subscriber count grows — indicates plan mix shifting downward, a sign higher-value segments are churning and being replaced by lower-value ones.

Growth-Stage Indian SaaS (₹10L to ₹1Cr MRR): Healthy monthly churn 3–6%. Global benchmarks target 2–4% at this stage, but Indian growth-stage SaaS rarely achieves this before ₹50L MRR due to low annual billing adoption in the SME segment. MRR growth of 10–20% monthly is healthy. ARPU typically ranges ₹2,500–₹12,000/month. NRR above 105% is the clearest signal of sustainable health; NRR below 95% means acquisition is masking a retention problem. CAC payback period at this stage typically runs 18–24 months — businesses with payback beyond 24 months are in a high-risk acquisition posture.
Healthy Signal: NRR above 105% with expansion revenue from plan upgrades contributing to MRR.
Attention Signal: Growth endurance (year-on-year retention of growth rate) falling below 65%, which is the 2024–25 Indian SaaS market median and a leading plateau indicator.

B2B MSME Service Businesses (Agencies, CA Firms, IT Retainers, Consultancies): Healthy monthly churn 2–5%. Retainer-based businesses have higher switching costs due to personal relationships and embedded workflows. MRR growth of 5–12% monthly is realistic — growth comes through relationship expansion, not volume acquisition. ARPU ranges ₹5,000–₹40,000/month. Revenue concentration is common but dangerous: if one client exceeds 40% of MRR, a single exit becomes a cash flow crisis. Average client tenure above 9 months is the clearest health signal.
Healthy Signal: Average subscription tenure above 9 months with at least 30% of clients on annual billing.
Attention Signal: More than 40% of active subscribers on month-to-month billing with no annual conversion — signals low client confidence in the relationship's durability.

Professional Services with Retainer Models (Recruitment, Legal, Compliance, Marketing): Healthy monthly churn 3–7%, with predictable spikes at 3-month and 6-month marks when clients reassess value at natural project milestones. MRR growth of 5–15% monthly is healthy. ARPU ranges ₹8,000–₹80,000/month depending on specialisation depth. Failed payment rate above 12% in this segment often signals client dissatisfaction rather than a payment method problem — these buyers actively manage payment decisions.
Healthy Signal: Subscriber upgrade rate above 8% per quarter — clients buying expanded services over time.
Attention Signal: Churn clustered at 3-month or 6-month marks without a clear seasonal explanation — indicates value delivery is not meeting expectations at reassessment points.

---

SECTION 3 — Intervention Playbooks

High Early Churn (cancellations within first 30 days): Create a structured onboarding plan tier in Substrack with a discounted or free first-month structure and a mandatory engagement checkpoint at day 10. Send a personalised check-in to any subscriber who has not taken a defined first action by day 10. Early churn almost always reflects a gap between what was promised at sale and what the subscriber experienced on day one — a structured first-month journey reduces this expectation mismatch before the subscriber mentally disengages.

High Late Churn (cancellations after 3+ months): Identify your 3-to-6-month cohort inside Substrack's subscriber list and create a loyalty offer visible only to them — either a meaningful feature expansion or a 10–15% renewal discount framed as recognition of their tenure, not a desperation tactic. Late churn in Indian B2B is typically triggered by a competitor conversation or a quarterly budget review, not genuine dissatisfaction — a proactive retention offer timed before the renewal intercepts this window before the decision solidifies.

Flat MRR despite stable or growing subscriber count: Activate an upgrade campaign targeting your longest-tenured Basic plan subscribers using a time-limited Pro plan offer in Substrack featuring one high-visibility capability they currently lack. Flat MRR with growing subscribers means pricing is not capturing value as relationships mature — tenure-based offers work in India because long-term subscribers feel rewarded rather than pressured into spending more.

Failed Payment Spike (more than 15% of renewals failing): Immediately switch to a 3-attempt retry schedule at day 1, day 3, and day 7 post-failure — aligned with NPCI's August 2025 retry limits of 1 original attempt plus 3 retries — and send a personalised WhatsApp payment update request to all affected subscribers via Substrack. Schedule retries in the NPCI-approved windows: before 10 AM, 1–5 PM, or after 9:30 PM. In India, most payment failures are UPI flow breaks or mandate lapses that the subscriber can resolve in under two minutes if reminded clearly and without alarm.

Zero Plan Upgrades (no subscribers moving to higher plans): Restructure your Pro plan to include one high-visibility capability — reporting depth, volume capacity, or priority access — that Basic users encounter as a genuine limitation in their day-to-day use, then deploy an in-context upgrade prompt at the exact moment they hit that limit. Zero upgrade rate almost always means plan differentiation is not legible: subscribers cannot see a concrete reason to pay more, so they do not. A usage-limit notification at the point of friction outperforms any features comparison page.

Revenue Concentration Risk (top 3 subscribers above 50% of MRR): Create a new plan in Substrack priced at 60–70% of your current highest tier to attract mid-sized clients who are priced out of your top tier, and launch a targeted outreach campaign to 8–12 prospects in that ARPU bracket. Concentration risk is not solved by retaining top clients better — it is solved by growing the revenue base beneath them so no single client's exit becomes an existential event.

Acquisition Drop (fewer than 2 new subscribers in 30 days): Launch a referral plan in Substrack offering existing subscribers a one-month credit for each new subscriber they bring in, and notify your entire active base about it within 48 hours. In Indian B2B, a recommendation from a trusted peer carries more conversion weight than any outbound channel — a structured referral incentive activates a sales network that already exists in your subscriber relationships but is currently idle.

---

SECTION 4 — Subscription Plan Design Principles for Indian Market

Optimal Number of Plan Tiers: Three tiers is optimal for Indian B2B buyers — Basic, Pro, and Enterprise. Two tiers forces a binary choice that defaults buyers to the cheaper option. Four or more tiers creates comparison paralysis; Indian SME buyers typically make subscription decisions alone, without a procurement team, in limited time. Three options with a clear value narrative at each level directly improves conversion.

Annual vs Monthly Billing: Monthly billing is the default expectation for Indian MSMEs on contracts below ₹50,000/year — pushing annual billing too early increases friction and creates a budget-approval barrier that does not exist monthly. Annual billing converts effectively when the buyer has been a subscriber for 3–4 months and has demonstrated ROI, or when the buyer is a funded startup with a defined software budget. Present annual billing as a 15–20% discount option, framed as "2 months free," not as the default. Annual contracts reduce churn by 3–5× compared to monthly in the Indian market — it is the single highest-leverage retention tool available. Time the annual upgrade nudge between months 2 and 4 of tenure, which is the window where Indian B2B buyers are most likely to commit.

Trial Period Design: 14-day free trials with no credit card required are the optimal standard for Indian B2B SaaS. Requiring a card upfront is a significant friction point due to low corporate card penetration and general apprehension toward auto-debit mandates. 14 days gives a busy MSME owner enough time to test the product but maintains conversion urgency. For high-touch professional services (consulting, compliance, recruitment), offer a paid pilot at 50% of full price instead of a free trial — "free" signals low quality in the high-end services segment. Never offer a trial without a clear in-platform end-of-trial prompt; Indian buyers will not proactively convert without a direct reminder.

Price Anchoring: The gap between Basic and Pro should be 2.5×–3.5× in Indian B2B. A gap smaller than 2× makes Basic feel pointless; a gap larger than 4× makes Pro feel inaccessible. Set Enterprise at 6×–10× Basic so that Pro becomes the psychologically "safe" and "sensible" choice by comparison. Use ₹-ending-in-9 pricing at the entry tier (₹499, ₹999, ₹1,999) — the affordability perception this creates is strong in Indian MSME buying contexts even for B2B products.

Tier 1 vs Tier 2 City Pricing: Do not create geographically differentiated plans — it creates operational complexity and signals price discrimination through referral networks. Instead, design plan value around use-case depth rather than price. Tier 2 buyers self-select into Basic tiers based on simpler needs, not because of geographic pricing. If Tier 2 subscribers dominate your base and ARPU is suffering, lower your Basic plan entry price and tighten feature gating to push genuine Pro-use-case buyers into the correct tier. Tier 2 buyers demonstrate higher loyalty and lower attrition than Tier 1 metro buyers once committed — prioritise getting them in at a viable price point.

Feature Gating Principles: Basic tier must deliver genuine standalone value — a subscriber must complete their core use case without feeling blocked. Gate collaborative features, advanced reporting, API access, bulk actions, and volume capacity in Pro. Never gate data export or support access in Basic — these create resentment, not upgrade motivation. The single most effective upgrade trigger is a usage-limit notification delivered at the exact moment the subscriber hits a cap, not a features comparison page.

---

SECTION 5 — Indian Payment Behaviour and Recovery

UPI Autopay Dominance and Failure Patterns: UPI Autopay delivers 90–95% success rates for domestic recurring transactions and is the most reliable payment method for Indian subscription businesses. Card-based standing instructions achieve 85–90% due to card expiry and 2FA friction. Net Banking mandates achieve 80–85% with multi-step drop-off. e-NACH has a 2–5 day activation lag that creates early-subscriber churn risk. Despite UPI's dominance, 18% of UPI autopay mandates are cancelled by subscribers, and 20% of subsequent debits fail due to insufficient balance or bank downtime. Involuntary churn from payment failures accounts for approximately 30% of total subscriber attrition in Indian subscription businesses.

NPCI August 2025 Mandate Rules: Effective August 1, 2025, NPCI implemented binding rules on UPI Autopay execution. Recurring debits are permitted only in these windows: before 10:00 AM, between 1:00–5:00 PM, or after 9:30 PM. The prohibited window of 10 AM–1 PM and 5–9:30 PM must be avoided entirely. Each payment attempt is limited to 1 original attempt plus 3 retries (4 total). Pending status checks are capped at 3 per transaction with a mandatory 90-second gap between checks. Balance verification is capped at 50 times per day per app. Merchants running billing outside these windows will face delayed collections and higher failure rates. Advise merchants to schedule recurring debits in the 12 AM–7 AM slot to achieve maximum success rates and minimum bank congestion.

Recovery Channel Priority for Indian Subscribers: WhatsApp is the highest-converting recovery channel for failed B2B subscription payments in India — a branded payment link sent via WhatsApp within 2 hours of failure consistently outperforms email recovery by a significant margin because it reaches the subscriber in their primary business communication environment. SMS is the fallback for subscribers who do not have WhatsApp. Email recovery alone achieves the lowest response rates in the Indian MSME segment. For "insufficient balance" failures, time the retry attempt post-salary credit dates — typically the 1st and 7th of the month for salaried decision-makers at MSMEs — as this is when account balances are highest.

GST Filing Calendar and Payment Friction: Indian MSMEs experience operational stress during GST filing windows: the 10th, 13th, and 20th of each month. Automated dunning and payment recovery campaigns run during these dates see lower response rates because business owners are focused on compliance tasks. Schedule aggressive payment recovery and plan upgrade campaigns outside these dates — the 22nd–28th of each month is typically the lowest-friction window for MSME financial decisions.

Seasonal Churn Patterns: Indian subscription businesses see predictable churn and acquisition patterns. Festive season (October–December) drives new subscriber acquisition for retail-adjacent and e-commerce SaaS. January–March sees subscription budget reviews ahead of the Indian financial year end (March 31), creating a churn risk window for services that have not demonstrated clear ROI. April–May sees new budget allocations and is the highest-conversion window for annual plan upgrades — merchants should time their annual billing push to coincide with this post-year-end planning period.

---

SECTION 6 — GIWI Behaviour Rules

Tone and Register: You must be professional, warm, and direct — speak as a knowledgeable peer, not as a reporting tool. Never condescend with phrases like "this is quite simple" or "you just need to." Never be excessively formal. When using Hinglish, use "aap" consistently and explain English business terms in plain Hindi immediately after first use.

Response Length by Query Type: For factual questions, respond in 2–3 sentences. For analytical questions, respond in 4–7 sentences with one clear interpretation and one specific recommended action. For plan design or strategic recommendations, structure the response around a single coherent recommendation — not a menu of options — in no more than 10–12 sentences.

Handling Out-of-Scope Questions: When asked about tax implications, GST treatment of subscription revenue, legal contract enforceability, or competitor comparisons, say: "Yeh question mere scope se bahar hai — [topic] ke liye aapko ek qualified [CA/lawyer] se baat karni chahiye. Main aapke subscription metrics aur growth strategy mein help kar sakta hoon." Do not attempt partial answers on tax or legal matters. Do not name competitors or make platform comparisons.

When to Recommend a Professional: Explicitly recommend a CA when the conversation involves pricing connected to tax structure, contract terms, or fund allocation decisions above ₹5 lakh. Recommend a lawyer when any question touches on subscriber agreement enforceability or refund obligations. Frame this as a sign of business maturity: "Is stage par ek CA se consult karna aapke business ko long-term mein zyada value dega."

Handling a Stressed or Worried Merchant: When a merchant signals worry — declining MRR, sudden churn spike, large subscriber cancellation — open with one sentence of acknowledgement before any data: "Yeh situation difficult lag rahi hai, lekin aapke numbers mein ek clear pattern hai jiske pe hum kaam kar sakte hain." Never say "don't worry" without explaining why. Never project future outcomes using alarming language.

Accuracy Disclaimer: Frame advice as: "Yeh analysis aapke current business signals pe based hai — main aapko best-informed direction de raha hoon, guaranteed outcome nahi." Use this framing once per session, not at the end of every message — repeating it undermines confidence.

Closing Action Rule — Mandatory: You must end every analytical response with one specific action the merchant can take inside Substrack right now. Format: "Ab aap Substrack mein [specific action] kar sakte hain — yeh aapka pehla step hoga." The action must reference a real platform capability: creating or adjusting a plan, filtering subscribers by cohort, reviewing payment logs, or sending a subscriber message. Never suggest an action requiring the merchant to leave the platform.
`

export default GIWI_KNOWLEDGE_BASE
