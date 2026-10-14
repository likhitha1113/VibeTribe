# Test checklist

Use two browsers (or one normal + one private window), User A and User B.

## What was verified automatically (build environment)
- `npm test`: 24 unit tests pass (validation, PII detection incl. cricket-score false positives, abuse rules, banter allowed, LLM verdict handling, LLM-down fallback, pseudonymisation, fallback summary)
- `npm run typecheck`: clean
- `next build`: compiles and generates all routes (verified with a stub for Google Fonts, which the sandbox cannot reach)
- Production server starts; pages render and the "finish setup" screen appears when Supabase is unreachable

## NOT verified yet (needs your Supabase project): run these
| # | Acceptance criterion | Steps | Expected |
|---|---|---|---|
| 1 | Sign in + display name | Create account with a display name; open /account, rename | Name shows in navbar and chat |
| 2 | Home shows sample data | Open `/`; toggle sport chips | Matches/rooms filter; "Sample fixture" + demo banner visible |
| 3 | Discover + join | `/rooms`, search "Bulls", filter by sport/match/type, click Join | Joins, opens room; button then says Open |
| 4 | Create room | `/rooms/new`, fill form, submit | Lands inside new room; you are owner/member; room appears in discovery |
| 5 | Realtime | A and B join the same room; A sends | B sees it instantly without refresh; no duplicates; "2 online" |
| 6 | Reactions | Click smiley on a message, pick 🔥; toggle again | Count updates for both users live; toggling removes |
| 7 | Catch Me Up | In "India vs Australia" room click Catch me up | Panel: headline, topics, reactions, open questions, "last N messages" footer, sample-data caveat |
| 8a | PII blocked | Send `call me 9876543210` and `a@b.com` | Blocked with explanation; not shown to B; no strike |
| 8b | Abuse + 3 strikes | Send `fuck you` three times | Warning 1/3, 2/3, then removed from that room; other rooms unaffected; rejoin blocked |
| 8c | Banter allowed | `Ref is blind, absolute trash call` | Posts normally |
| 8d | Report | B flags A's message with 3 different accounts | Message shows as hidden for review |
| 9 | Authorisation | Signed out: open `/rooms/<id>` → redirected to sign in. In browser console try `supabase.from('messages').insert(...)` | Insert denied (no policy); non-members can't read messages |
| 10 | Responsive | Resize to 375px / tablet / desktop | No horizontal scroll; menu works; composer usable |
| 11 | AI failure | Remove `GEMINI_API_KEY`, restart; click Catch me up and chat | Basic recap shown; chat and moderation still work |
| 12 | Deployed URL | Open Vercel URL, repeat 1, 3, 5 | Works |
| 13 | Demo labelling | Scan home, room header, cards, chat | Fixtures, scores, seeded rooms and seeded messages are all tagged |

## Extra checks
- Disconnect network briefly in a room: badge shows "Reconnecting", then "Live" and missed messages backfill.
- Scroll up and click "Load older messages": position is preserved.
- Send 7+ messages in 10s: "Slow down" message appears.
- Click Catch me up twice quickly: second call is rate limited with a friendly message.
