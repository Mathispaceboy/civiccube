INSERT OR IGNORE INTO users (
    id, auth_provider_id, ward_or_zone, is_verified_resident, voice_credits_remaining, created_at
) VALUES (
    'seed-user',
    'auth0|seed-user',
    'WARD_64_CBE',
    1,
    5,
    strftime('%s', 'now')
);

INSERT OR IGNORE INTO issues (
    id, slug, title, jurisdiction_level, jurisdiction_code, brief_markdown, quiz_questions, status, created_at
) VALUES (
    'issue-cbe-001',
    'solid-waste-and-ward-accountability',
    'Door-to-Door Waste Segregation and Street Cleansing Oversight',
    'ward',
    'WARD_64_CBE',
    '# Ward 64 Action Brief: Solid Waste Management\n\nUnder the Solid Waste Management Rules 2016, source segregation of wet and dry waste is mandatory. This room evaluates morning collection reliability, bin placement, and sanitary worker support.',
    '[{"question":"Who manages local sanitation schedules at the ward level?","options":["Ward Committee & Sanitary Inspector","Electricity Board","Post Office"],"answer":0}]',
    'deliberating',
    strftime('%s', 'now')
);

INSERT OR IGNORE INTO statements (
    id, issue_id, author_id, content_text, agree_count, disagree_count, pass_count, bridging_score, created_at
) VALUES (
    'stmt-001',
    'issue-cbe-001',
    'seed-user',
    'Sanitation collection vehicles must adhere to a predictable 7:00 AM – 8:30 AM arrival window with audible alert bells.',
    12, 1, 2, 0.65,
    strftime('%s', 'now')
);
