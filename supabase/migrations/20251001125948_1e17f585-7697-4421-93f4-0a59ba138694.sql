-- Delete old incorrect rules
DELETE FROM public.work_hour_rules;

-- Add column for days of week (0 = Sunday, 1 = Monday, etc.)
ALTER TABLE public.work_hour_rules 
ADD COLUMN applies_to_days INTEGER[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6];

-- Insert correct rules based on confirmed structure

-- Normal hours: Monday-Friday 06:00-22:00 (0% bonus)
INSERT INTO public.work_hour_rules (rule_type, start_time, end_time, applies_to_days, description) VALUES
('normal', '06:00:00', '22:00:00', ARRAY[1,2,3,4,5], 'Ore normale de lucru Luni-Vineri (0% spor)');

-- Night hours: Monday-Friday 22:00-06:00 (25% bonus)
INSERT INTO public.work_hour_rules (rule_type, start_time, end_time, applies_to_days, description) VALUES
('night', '22:00:00', '23:59:59', ARRAY[1,2,3,4,5], 'Ore de noapte Luni-Vineri 22:00-00:00 (25% spor)'),
('night', '00:00:00', '05:59:59', ARRAY[1,2,3,4,5], 'Ore de noapte Luni-Vineri 00:00-06:00 (25% spor)');

-- Saturday night: 00:00-06:00 (25% bonus - priority over weekend)
INSERT INTO public.work_hour_rules (rule_type, start_time, end_time, applies_to_days, description) VALUES
('night', '00:00:00', '05:59:59', ARRAY[6], 'Ore de noapte Sâmbătă 00:00-06:00 (25% spor)');

-- Saturday weekend: 06:00-22:00 (50% bonus)
INSERT INTO public.work_hour_rules (rule_type, start_time, end_time, applies_to_days, description) VALUES
('saturday', '06:00:00', '21:59:59', ARRAY[6], 'Ore weekend Sâmbătă 06:00-22:00 (50% spor)');

-- Saturday night: 22:00-23:59 (25% bonus - priority over weekend)
INSERT INTO public.work_hour_rules (rule_type, start_time, end_time, applies_to_days, description) VALUES
('night', '22:00:00', '23:59:59', ARRAY[6], 'Ore de noapte Sâmbătă 22:00-00:00 (25% spor)');

-- Sunday night: 00:00-06:00 (25% bonus - priority over holiday)
INSERT INTO public.work_hour_rules (rule_type, start_time, end_time, applies_to_days, description) VALUES
('night', '00:00:00', '05:59:59', ARRAY[0], 'Ore de noapte Duminică 00:00-06:00 (25% spor)');

-- Sunday holiday: 06:00-22:00 (100% bonus)
INSERT INTO public.work_hour_rules (rule_type, start_time, end_time, applies_to_days, description) VALUES
('sunday_holiday', '06:00:00', '21:59:59', ARRAY[0], 'Ore sărbătoare legală Duminică 06:00-22:00 (100% spor)');

-- Sunday night: 22:00-23:59 (25% bonus - priority over holiday)
INSERT INTO public.work_hour_rules (rule_type, start_time, end_time, applies_to_days, description) VALUES
('night', '22:00:00', '23:59:59', ARRAY[0], 'Ore de noapte Duminică 22:00-00:00 (25% spor)');