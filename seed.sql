-- Seed verified test residents
INSERT OR IGNORE INTO users (
    id, auth_provider_id, ward_or_zone, is_verified_resident, voice_credits_remaining, created_at
) VALUES 
('seed-user', 'auth0|seed-user', 'WARD_64_CBE', 1, 5, strftime('%s', 'now')),
('seed-user-a1', 'auth0|seed-user-a1', 'WARD_64_CBE', 1, 5, strftime('%s', 'now')),
('seed-user-a2', 'auth0|seed-user-a2', 'WARD_64_CBE', 1, 5, strftime('%s', 'now')),
('seed-user-b1', 'auth0|seed-user-b1', 'WARD_64_CBE', 1, 5, strftime('%s', 'now')),
('seed-user-b2', 'auth0|seed-user-b2', 'WARD_64_CBE', 1, 5, strftime('%s', 'now'));

-- 1. Solid Waste & Ward Accountability
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
) VALUES 
(
    'stmt-001',
    'issue-cbe-001',
    'seed-user',
    'Sanitation collection vehicles must adhere to a predictable 7:00 AM – 8:30 AM arrival window with audible alert bells.',
    12, 1, 2, 0.65,
    strftime('%s', 'now')
),
(
    'stmt-002',
    'issue-cbe-001',
    'seed-user-a1',
    'Deploy community wet-waste micro-composting pits in ward parks to eliminate roadside secondary dumping.',
    8, 1, 1, 0.58,
    strftime('%s', 'now')
);

-- 2. Budget Literacy & Ward Funds
INSERT OR IGNORE INTO issues (
    id, slug, title, jurisdiction_level, jurisdiction_code, brief_markdown, quiz_questions, status, created_at
) VALUES (
    'issue-cbe-002',
    'budget-literacy-and-ward-funds',
    'Demystifying Municipal Corporation Budgets & Ward Funds',
    'ward',
    'WARD_64_CBE',
    '# Ward 64 Action Brief: Municipal Corporation Budgets & Ward Funds\n\nLocal property taxes, state finance commission devolutions, and infrastructure grants are assigned to ward development projects. This room demystifies budget allocations for roads, storm drains, and green spaces, empowering citizens to audit expenditures through statutory Area Sabhas.',
    '[{"question":"What percentage of local ward funds can be audited during Gram/Area Sabhas?","options":["100% via statutory public audit","25% with special permission","0% (confidential records)"],"answer":0}]',
    'deliberating',
    strftime('%s', 'now')
);

INSERT OR IGNORE INTO statements (
    id, issue_id, author_id, content_text, agree_count, disagree_count, pass_count, bridging_score, created_at
) VALUES 
(
    'stmt-003',
    'issue-cbe-002',
    'seed-user',
    'Publish a quarterly ward line-item budget ledger on public notice boards and digital portals prior to each Area Sabha.',
    15, 0, 1, 0.78,
    strftime('%s', 'now')
),
(
    'stmt-004',
    'issue-cbe-002',
    'seed-user-b1',
    'Earmark a minimum of 25% of annual ward untied funds for resident-voted local micro-infrastructure priorities.',
    9, 1, 2, 0.62,
    strftime('%s', 'now')
);

-- 3. Pedestrian Mobility & Crosswalks
INSERT OR IGNORE INTO issues (
    id, slug, title, jurisdiction_level, jurisdiction_code, brief_markdown, quiz_questions, status, created_at
) VALUES (
    'issue-cbe-003',
    'pedestrian-mobility-and-crosswalks',
    'Safe Crosswalks, Pavements & Street Lighting',
    'ward',
    'WARD_64_CBE',
    '# Ward 64 Action Brief: Safe Pedestrian Corridors & Street Lighting\n\nPedestrians, senior citizens, and schoolchildren require unhindered, walkable pavements and illuminated transit corridors. This room prioritizes barrier-free sidewalk restoration, high-visibility zebra crossings, and rapid 48-hour streetlight defect repairs.',
    '[{"question":"Which department manages municipal streetlight maintenance?","options":["Municipal Engineering & Electrical Wing","Postal Services","Traffic Police HQ"],"answer":0}]',
    'deliberating',
    strftime('%s', 'now')
);

INSERT OR IGNORE INTO statements (
    id, issue_id, author_id, content_text, agree_count, disagree_count, pass_count, bridging_score, created_at
) VALUES 
(
    'stmt-005',
    'issue-cbe-003',
    'seed-user',
    'Construct continuous, level pedestrian sidewalks with bollards to prevent two-wheeler parking near transit junctions.',
    16, 1, 0, 0.81,
    strftime('%s', 'now')
),
(
    'stmt-006',
    'issue-cbe-003',
    'seed-user-a2',
    'Mandate a strict 48-hour SLA for replacing non-functioning LED streetlights with automated outage tracking.',
    11, 0, 1, 0.72,
    strftime('%s', 'now')
);

-- Cross-cluster seed votes
INSERT OR IGNORE INTO votes (statement_id, user_id, vote_value, user_cluster_id, created_at) VALUES
('stmt-001', 'seed-user-a1', 1, 0, strftime('%s', 'now')),
('stmt-001', 'seed-user-b1', 1, 1, strftime('%s', 'now')),
('stmt-003', 'seed-user-a1', 1, 0, strftime('%s', 'now')),
('stmt-003', 'seed-user-b1', 1, 1, strftime('%s', 'now')),
('stmt-005', 'seed-user-a1', 1, 0, strftime('%s', 'now')),
('stmt-005', 'seed-user-b1', 1, 1, strftime('%s', 'now'));
