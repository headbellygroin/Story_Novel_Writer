# StoryForge SaaS Roadmap

## Business Model

### Revenue Model
- Monthly subscription fee for access to the StoryForge workflow platform
- Users pay for the orchestration/creative system, NOT for AI compute
- AI generation costs are borne by the user through their own accounts/free tiers
- Hosting cost per user is minimal (serving a web app, not proxying AI)
- Pricing: subscription must cover per-user hosting cost + profit margin

### Content-to-Product Pipeline
1. Stream the creation process live (proof-of-concept in real-time)
2. System of a Down project serves as the public stress test/demo
3. Finished LitRPG chapters posted to YouTube as proof of output quality
4. Audience sees value firsthand, then wants access for their own projects
5. Audience participation (voting on story decisions, suggesting characters) drives engagement
6. Revenue layers: subscriptions, live stream access, collaborative events

---

## Two-System Architecture

### System A: Creator System (Current Build)
- Full local ComfyUI integration
- Direct hardware access for generation
- All current features as-is
- Used by the creator (you) for streaming and production

### System B: Public SaaS System
- Hosted web app (same workflow UI, different generation backend)
- Users connect their own AI service accounts for generation
- No local compute required on server side for generation
- Users store their project data in the cloud (Supabase)
- Users save generated images locally AND to their StoryForge cloud storage
- Provider-agnostic generation layer

---

## User Experience Flow

### Access
1. User pays monthly subscription via Stripe
2. User gets login credentials
3. User accesses StoryForge web app

### Generation Flow
1. User works in StoryForge workflow (writing, outlining, worldbuilding, etc.)
2. When generation is needed (images, TTS, video), the system routes to external services
3. Free tier: system tries free endpoints (Grok free, ChatGPT free image gen, etc.)
4. When free tier hits cooldown/rate limit, user is notified:
   - "Service X has rate-limited you. Log into your [Grok/ChatGPT/etc.] account in another tab, then return here to continue generating."
   - OR wait for cooldown to expire
   - OR switch to a different provider that still has free quota
5. Paid provider: user has entered their own API key or logged into their account, generation continues without limits

### Data Storage
- Project data (text, outlines, characters, worldbuilding) stored in Supabase
- Generated images: saved to user's StoryForge cloud storage (Supabase Storage)
- Users can also download/keep images locally
- Import/export functionality for portability
- Users who leave keep their exported data

---

## Provider Integration Architecture

### Supported Providers (Generation)
Each provider adapter must handle:
- Free tier detection and usage
- Rate limit / cooldown detection and user notification
- Authenticated (user's own paid account) mode
- Graceful fallback messaging

#### Image Generation
- Grok (free tier + paid)
- ChatGPT/DALL-E (free tier + paid)
- Stability AI (API key)
- Midjourney (future, if API available)
- Any new services as they emerge

#### Text Generation (Writing/Editing)
- Grok (free tier + paid)
- ChatGPT (free tier + paid)
- Claude API (if user has key)
- Ollama (if user runs locally)

#### TTS / Audio
- ElevenLabs (free tier + paid)
- Browser-native TTS (always free, lower quality)
- Kokoro/other open models (future)

#### Video / Animation
- Grok video (when available)
- Stability Video (API)
- Others as they emerge

### Provider Adapter Interface
```typescript
interface ProviderAdapter {
  id: string;
  name: string;
  capabilities: ('text' | 'image' | 'tts' | 'video')[];
  
  // Check if user has configured this provider
  isConfigured(): boolean;
  
  // Check if free tier is available (not rate-limited)
  checkFreeTierAvailable(): Promise<{ available: boolean; cooldownMinutes?: number }>;
  
  // Check if user has authenticated/paid access
  hasAuthenticatedAccess(): boolean;
  
  // Execute generation
  generate(request: GenerationRequest): Promise<GenerationResult>;
  
  // Get instructions for user to authenticate
  getAuthInstructions(): string;
}
```

### Provider Priority System
Users can configure their preferred provider order:
1. Try Provider A (free tier)
2. If rate-limited, try Provider B (free tier)
3. If all free tiers exhausted, prompt user to authenticate their preferred paid provider
4. User authenticates in another tab, comes back, retries

---

## Technical Implementation Plan

### Phase 1: Auth + Payments (Pre-launch)
- [ ] Supabase Auth (email/password)
- [ ] Stripe subscription integration (single tier initially)
- [ ] Protected routes (all workflow pages behind auth)
- [ ] User profile / settings page with subscription status

### Phase 2: Provider Abstraction Layer
- [ ] Define provider adapter interface
- [ ] Build Grok adapter (free + authenticated)
- [ ] Build ChatGPT/OpenAI adapter (free + authenticated)
- [ ] Build ElevenLabs adapter
- [ ] Provider selection UI (user picks preferred providers)
- [ ] API key storage (encrypted, per-user, in Supabase)
- [ ] Rate limit detection and user notification system

### Phase 3: Cloud Storage for Users
- [ ] Per-user project storage in Supabase
- [ ] Image upload/save to Supabase Storage
- [ ] Project import/export (JSON + assets)
- [ ] Local save option (download to machine)

### Phase 4: Multi-tenant Data Isolation
- [ ] RLS policies scoped to user_id on all tables
- [ ] User can only see/edit their own projects
- [ ] Shared/collaborative projects (future consideration)

### Phase 5: Deployment
- [ ] Deploy web app (Vercel/Netlify/similar)
- [ ] Custom domain
- [ ] SSL, CDN, basic monitoring
- [ ] Stripe webhook handling for subscription lifecycle

---

## Key Design Decisions

### Why Users Provide Their Own AI Compute
- Zero AI hosting costs for us
- Unlimited scalability (each user brings their own capacity)
- No GPU infrastructure to manage
- Subscription price stays low and predictable
- Users already have/will get these accounts anyway

### Why Local Save Is Important
- Users own their creative work
- Reduces our storage costs
- Portability builds trust
- Users can work offline on text (generation needs connection)

### Rate Limit UX Philosophy
- Never block the user silently
- Always explain what happened and what to do
- Offer alternatives (try another provider, wait, authenticate)
- Make it feel like a feature ("you've used your free generations, upgrade your Grok account for unlimited")

### Separation from Creator System
- The SaaS version is a fork/build-target of the same codebase
- ComfyUI integration exists only in creator build
- SaaS build uses provider adapters instead
- Shared: all workflow logic, UI, writing tools, consistency engine, worldbuilding
- Different: generation backend, storage layer, auth layer

---

## Cost Structure Estimate

### Fixed Costs (Monthly)
- Supabase Pro: ~$25/mo (covers auth, database, storage for many users)
- Hosting (Vercel/similar): ~$20/mo
- Domain + misc: ~$15/mo
- Total baseline: ~$60/mo

### Per-User Costs
- Supabase storage: minimal (text is tiny, images add up)
- Bandwidth: minimal (generation happens client-side to external services)
- Estimated per-user cost: < $1/mo

### Break-even
- At $10/mo subscription with 10 users = $100 revenue - $60 fixed = $40 profit
- At $10/mo subscription with 50 users = $500 revenue - $60 fixed - $50 variable = $390 profit
- Scales extremely well because compute is externalized

---

## Future Expansion Options

### Tier 2: Premium (Your Hosted Compute)
- When affordable, offer a premium tier where generation runs on your hardware/cloud
- Users don't need their own accounts anywhere
- Higher subscription price covers AI compute costs

### Tier 3: Enterprise/License
- White-label the platform for studios/publishers
- Site license for teams
- Custom provider integrations

### Collaborative Features
- Shared worlds between subscribers
- Live co-creation during streams
- Community asset libraries
- Voting/participation tools for live events

### Character Portrait Lipsync for Dialogue
- When a character speaks in a chapter, their portrait image flashes up and lip-syncs the dialogue audio
- Pipeline would need a dialogue attribution step: parse prose to identify who is speaking, map to character portrait + voice profile
- Route dialogue TTS chunks through LTX lipsync workflow using the character's portrait as source frame
- Narration segments use standard scene images/animations; dialogue segments use portrait lipsync video
- Requires: clean front-facing character portraits (already have these), per-character voice assignments in TTS, a new pipeline stage between TTS and assembly that splits narration vs. dialogue
- End result: visual novel / animated audiobook hybrid -- scene imagery for action, talking portraits for dialogue

---

## When to Pull the Trigger

Prerequisites before launching SaaS:
1. System of a Down project demonstrates the workflow publicly (stress test complete)
2. At least 1 finished YouTube LitRPG chapter proves output quality
3. Stream audience shows interest (people asking "how do I use this?")
4. Stripe account ready
5. ~1-2 weeks of development to add auth, payments, and provider adapters

This document serves as the blueprint. When the time comes, reference this and begin with Phase 1.
