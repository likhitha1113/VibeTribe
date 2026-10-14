-- =====================================================================
-- VibeTribe DEMO seed data. Safe to re-run.
-- All fixtures, scores and chat lines below are SAMPLE content.
-- =====================================================================
insert into public.sports (slug, name, emoji, sort_order) values
  ('cricket',  'Cricket',  '🏏', 1),
  ('football', 'Football', '⚽', 2),
  ('kabaddi',  'Kabaddi',  '🤼', 3)
on conflict (slug) do nothing;
-- Adding a sport later:  insert into public.sports (slug,name,emoji) values ('basketball','Basketball','🏀');

insert into public.matches (id, sport, team_a, team_b, competition, status, score_a, score_b, status_note, venue, starts_at) values
  ('a1000000-0000-0000-0000-000000000001','cricket','India','Australia','Sample T20I series','live','168/4 (17.2 ov)','Yet to bat','India batting, 2nd innings of a sample match','Sample Stadium, Mumbai', now() - interval '90 minutes'),
  ('a1000000-0000-0000-0000-000000000002','cricket','Mumbai Indians','Chennai Super Kings','Sample league','upcoming',null,null,'Toss at 7:00 PM (sample)','Sample Ground, Chennai', now() + interval '1 day'),
  ('a1000000-0000-0000-0000-000000000003','football','Mumbai City FC','Bengaluru FC','Sample league','live','2','1','72'' - second half (sample)','Sample Arena, Mumbai', now() - interval '75 minutes'),
  ('a1000000-0000-0000-0000-000000000004','football','Arsenal','Manchester City','Sample cup tie','finished','1','1','Full time (sample)','Sample Park, London', now() - interval '1 day'),
  ('a1000000-0000-0000-0000-000000000005','kabaddi','Bengaluru Bulls','Patna Pirates','Sample kabaddi league','live','31','28','Second half, 12 min left (sample)','Sample Dome, Bengaluru', now() - interval '40 minutes'),
  ('a1000000-0000-0000-0000-000000000006','kabaddi','Jaipur Pink Panthers','Dabang Delhi','Sample kabaddi league','upcoming',null,null,'Starts tomorrow (sample)','Sample Dome, Jaipur', now() + interval '1 day 3 hours')
on conflict (id) do nothing;

insert into public.rooms (id, name, description, sport, match_id, created_by) values
  ('b1000000-0000-0000-0000-000000000001','India vs Australia: match thread','Overs, wickets, DRS drama. Join the live chat for this sample T20I.','cricket','a1000000-0000-0000-0000-000000000001',null),
  ('b1000000-0000-0000-0000-000000000002','Captaincy calls: right or wrong?','Bowling changes, field settings and declarations. Debate the decisions.','cricket',null,null),
  ('b1000000-0000-0000-0000-000000000003','MI vs CSK pre-match room','Predict the XI and swap lineup hot takes before the toss.','cricket','a1000000-0000-0000-0000-000000000002',null),
  ('b1000000-0000-0000-0000-000000000004','Mumbai City vs Bengaluru: matchday','Live reactions for the derby. Goals, VAR and refereeing welcome.','football','a1000000-0000-0000-0000-000000000003',null),
  ('b1000000-0000-0000-0000-000000000005','Arsenal v City: full-time debrief','Was the draw fair? Break down the tactics.','football','a1000000-0000-0000-0000-000000000004',null),
  ('b1000000-0000-0000-0000-000000000006','Football tactics nerds','Pressing, build-up and set pieces. Any league, any match.','football',null,null),
  ('b1000000-0000-0000-0000-000000000007','Bulls vs Pirates: raid by raid','Super raids, tackles and the all-out moment. Follow along together.','kabaddi','a1000000-0000-0000-0000-000000000005',null),
  ('b1000000-0000-0000-0000-000000000008','Kabaddi newcomers welcome','New to kabaddi? Ask rules questions and learn with the community.','kabaddi',null,null)
on conflict (id) do nothing;

-- Demonstration chat (clearly flagged is_demo; shown with a DEMO tag in the UI)
delete from public.messages where is_demo;
insert into public.messages (room_id, body, created_at, is_demo, demo_author) values
 ('b1000000-0000-0000-0000-000000000001','Ok that last over changed everything 😮', now() - interval '38 minutes', true, 'Aarav'),
 ('b1000000-0000-0000-0000-000000000001','Anyone else think the spinner should have bowled the 16th?', now() - interval '36 minutes', true, 'Meera'),
 ('b1000000-0000-0000-0000-000000000001','Captain trusted the pacer, fair call on that pitch.', now() - interval '35 minutes', true, 'Rohan'),
 ('b1000000-0000-0000-0000-000000000001','That cover drive though 🔥🔥', now() - interval '31 minutes', true, 'Sana'),
 ('b1000000-0000-0000-0000-000000000001','Is the DRS review still available for them?', now() - interval '27 minutes', true, 'Dev'),
 ('b1000000-0000-0000-0000-000000000001','I think they burned it earlier, not sure.', now() - interval '26 minutes', true, 'Meera'),
 ('b1000000-0000-0000-0000-000000000001','Need 30 off 16, this is gettable 👏', now() - interval '20 minutes', true, 'Aarav'),
 ('b1000000-0000-0000-0000-000000000001','Dew is making the ball skid, bowlers will struggle.', now() - interval '14 minutes', true, 'Rohan'),
 ('b1000000-0000-0000-0000-000000000001','Who is bowling the 19th, any guesses?', now() - interval '6 minutes', true, 'Sana'),
 ('b1000000-0000-0000-0000-000000000004','GOAL! Did not see that header coming 🔥', now() - interval '22 minutes', true, 'Kabir'),
 ('b1000000-0000-0000-0000-000000000004','Defence was asleep on that corner.', now() - interval '21 minutes', true, 'Ishita'),
 ('b1000000-0000-0000-0000-000000000004','Offside? Looked tight, VAR will take ages.', now() - interval '15 minutes', true, 'Neel'),
 ('b1000000-0000-0000-0000-000000000004','Ref has been inconsistent with fouls all half.', now() - interval '9 minutes', true, 'Kabir'),
 ('b1000000-0000-0000-0000-000000000004','Should they bring on the extra striker now?', now() - interval '4 minutes', true, 'Ishita'),
 ('b1000000-0000-0000-0000-000000000007','Super raid!! 3 points in one go 🤯', now() - interval '12 minutes', true, 'Vikram'),
 ('b1000000-0000-0000-0000-000000000007','Wait, what is a do-or-die raid again?', now() - interval '10 minutes', true, 'Tara'),
 ('b1000000-0000-0000-0000-000000000007','Third empty raid in a row means the raider must score, or he is out.', now() - interval '9 minutes', true, 'Vikram'),
 ('b1000000-0000-0000-0000-000000000007','Ahh that makes the tension make sense 😂', now() - interval '8 minutes', true, 'Tara'),
 ('b1000000-0000-0000-0000-000000000007','Defenders are cornering well but the all-out looks close.', now() - interval '3 minutes', true, 'Vikram');
