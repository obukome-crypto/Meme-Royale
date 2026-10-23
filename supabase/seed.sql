-- Example data for Meme Royale. Run AFTER schema.sql.
-- Replace the image_url values with your own meme image links (any public https image works).
-- Captions here need real users, so this file adds templates only, plus an optional caption
-- block you can run once you have signed up at least one account.

insert into daily_templates (day, title, image_url, status) values
  (current_date,     'Distracted Boyfriend', 'https://i.imgflip.com/1bij.jpg', 'live'),
  (current_date + 1, 'Two Buttons',          'https://i.imgflip.com/1g8my.jpg', 'scheduled'),
  (current_date + 2, 'This Is Fine',         'https://i.imgflip.com/wxica.jpg', 'scheduled')
on conflict (day) do nothing;

-- Example captions: they belong to the first profile in your database.
-- Run only after you have logged in once. Each insert becomes an eligible caption for today.
insert into captions (template_id, user_id, slot, text, eligible)
select t.id, p.id, s.slot, s.text, true
from (select id from daily_templates where status = 'live' limit 1) t
cross join (select id from profiles order by created_at limit 1) p
cross join (values
  (1, 'me explaining my five year plan to my mom'),
  (2, 'my cart when the free shipping threshold is $0.50 away')
) as s(slot, text)
on conflict do nothing;
