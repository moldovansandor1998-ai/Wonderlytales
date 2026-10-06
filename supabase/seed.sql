-- Minimális SQL seed (a teljes demo az app indulásakor vagy `npm run seed` paranccsal jön létre mock módban)
insert into projects (name, code) values ('Wonderly Tales', 'WT') on conflict (code) do nothing;
