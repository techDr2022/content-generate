-- Split legacy combined specialty into two catalog entries (see lib/types/client.ts).
UPDATE "Client" c
SET specialty = ARRAY(
  SELECT DISTINCT u
  FROM unnest(
    array_cat(
      array_remove(c.specialty, 'Dermatology & Cosmetology'),
      ARRAY['Dermatology'::text, 'Cosmetology'::text]
    )
  ) AS u
)
WHERE 'Dermatology & Cosmetology' = ANY (c.specialty);

-- Align renamed cosmetology catalog lines with the new labels.
UPDATE "Client"
SET services = array_replace(
  array_replace(
    services,
    'Laser & light therapies'::text,
    'Laser & light therapies (IPL, resurfacing)'::text
  ),
  'Injectable aesthetics'::text,
  'Injectable aesthetics (toxins & fillers)'::text
)
WHERE services @> ARRAY['Laser & light therapies'::text]
   OR services @> ARRAY['Injectable aesthetics'::text];
