-- Rows written before publications, awards, certifications, and custom sections existed store
-- content JSON without those keys, and the PDF template maps over every list unguarded.
-- The right operand of `||` wins, so present keys keep their values and absent ones become [].

UPDATE resumes
SET content = (
  jsonb_build_object(
    'experience', '[]'::jsonb,
    'projects', '[]'::jsonb,
    'skills', '[]'::jsonb,
    'education', '[]'::jsonb,
    'publications', '[]'::jsonb,
    'awards', '[]'::jsonb,
    'certifications', '[]'::jsonb,
    'sections', '[]'::jsonb
  ) || content::jsonb
)::text
WHERE content IS NOT NULL
  AND jsonb_typeof(content::jsonb) = 'object'
  AND NOT jsonb_exists_all(
    content::jsonb,
    ARRAY[
      'experience',
      'projects',
      'skills',
      'education',
      'publications',
      'awards',
      'certifications',
      'sections'
    ]
  );

UPDATE resume_variants
SET content = (
  jsonb_build_object(
    'experience', '[]'::jsonb,
    'projects', '[]'::jsonb,
    'skills', '[]'::jsonb,
    'education', '[]'::jsonb,
    'publications', '[]'::jsonb,
    'awards', '[]'::jsonb,
    'certifications', '[]'::jsonb,
    'sections', '[]'::jsonb
  ) || content::jsonb
)::text
WHERE jsonb_typeof(content::jsonb) = 'object'
  AND NOT jsonb_exists_all(
    content::jsonb,
    ARRAY[
      'experience',
      'projects',
      'skills',
      'education',
      'publications',
      'awards',
      'certifications',
      'sections'
    ]
  );
