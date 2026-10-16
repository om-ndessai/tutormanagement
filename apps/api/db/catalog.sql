-- ===========================================================================
--  The curriculum catalog  --  GENERATED FILE, DO NOT EDIT BY HAND
-- ===========================================================================
--  From db/catalog/*.json by:  node db/generate-catalog.mjs
--  (npm run typecheck fails while this file is stale.)
--
--  The platform's curricula, as upserts: run after db/schema.sql on every new
--  database, and on its own against a live one (docs/database.md). It never
--  deletes, and never writes an organization's own curriculum.
--
--  Levels/topics: ba 8/116, nc-2017 2/4, nc-2026 2/4
-- ===========================================================================

-- Beast Academy (ba): 8 levels, 116 topics

INSERT INTO curricula (id, name, source, edition, description, source_url, sort) VALUES
  ('ba', 'Beast Academy', 'Beast Academy and Art of Problem Solving', NULL, NULL, NULL, 1)
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name, source = excluded.source, edition = excluded.edition,
  description = excluded.description, source_url = excluded.source_url, sort = excluded.sort
  WHERE curricula.organization_id IS NULL;

INSERT INTO curriculum_levels (id, curriculum_id, code, name, stage, grade_band, description) VALUES
  ('BA1', 'ba', NULL, 'Beast Academy Level 1', 1, 'Ages 6-8 (about grade 1)', 'Guide books 1A-1D.'),
  ('BA2', 'ba', NULL, 'Beast Academy Level 2', 2, 'Ages 7-9 (about grade 2)', 'Guide books 2A-2D.'),
  ('BA3', 'ba', NULL, 'Beast Academy Level 3', 3, 'Ages 8-10 (about grade 3)', 'Guide books 3A-3D.'),
  ('BA4', 'ba', NULL, 'Beast Academy Level 4', 4, 'Ages 9-12 (about grade 4)', 'Guide books 4A-4D.'),
  ('BA5', 'ba', NULL, 'Beast Academy Level 5', 5, 'Ages 10-13 (about grade 5)', 'Guide books 5A-5D.'),
  ('PRE', 'ba', NULL, 'AoPS Prealgebra', 6, 'About grades 5-7', 'After Beast Academy 5. The bridge from arithmetic to algebra.'),
  ('ALG', 'ba', NULL, 'AoPS Introduction to Algebra', 7, 'Grades 6-9', 'Follows Prealgebra.'),
  ('GEO', 'ba', NULL, 'AoPS Introduction to Geometry', 8, 'Grades 7-10', 'Usually after Introduction to Algebra; the two are sometimes taken in either order.')
ON CONFLICT (id) DO UPDATE SET
  curriculum_id = excluded.curriculum_id, code = excluded.code, name = excluded.name,
  stage = excluded.stage, grade_band = excluded.grade_band, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('BA1.01', 'BA1', 1, NULL, '1A', 'Counting', NULL),
  ('BA1.02', 'BA1', 2, NULL, '1A', 'Shapes', NULL),
  ('BA1.03', 'BA1', 3, NULL, '1A', 'Comparing', NULL),
  ('BA1.04', 'BA1', 4, NULL, '1B', 'Addition', NULL),
  ('BA1.05', 'BA1', 5, NULL, '1B', 'Subtraction', NULL),
  ('BA1.06', 'BA1', 6, NULL, '1B', 'Categories', NULL),
  ('BA1.07', 'BA1', 7, NULL, '1C', 'Addition & Subtraction', NULL),
  ('BA1.08', 'BA1', 8, NULL, '1C', 'Comparing', NULL),
  ('BA1.09', 'BA1', 9, NULL, '1C', 'Patterns', NULL),
  ('BA1.10', 'BA1', 10, NULL, '1D', 'Big Numbers', NULL),
  ('BA1.11', 'BA1', 11, NULL, '1D', 'Measurement', NULL),
  ('BA1.12', 'BA1', 12, NULL, '1D', 'Problem Solving', NULL)
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('BA2.01', 'BA2', 1, NULL, '2A', 'Place Value', NULL),
  ('BA2.02', 'BA2', 2, NULL, '2A', 'Comparing', NULL),
  ('BA2.03', 'BA2', 3, NULL, '2A', 'Addition', NULL),
  ('BA2.04', 'BA2', 4, NULL, '2B', 'Subtraction', NULL),
  ('BA2.05', 'BA2', 5, NULL, '2B', 'Expressions', NULL),
  ('BA2.06', 'BA2', 6, NULL, '2B', 'Problem Solving', NULL),
  ('BA2.07', 'BA2', 7, NULL, '2C', 'Measurement', NULL),
  ('BA2.08', 'BA2', 8, NULL, '2C', 'Strategies', NULL),
  ('BA2.09', 'BA2', 9, NULL, '2C', 'Odds & Evens', NULL),
  ('BA2.10', 'BA2', 10, NULL, '2D', 'Big Numbers', NULL),
  ('BA2.11', 'BA2', 11, NULL, '2D', 'Algorithms', NULL),
  ('BA2.12', 'BA2', 12, NULL, '2D', 'Problem Solving', NULL)
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('BA3.01', 'BA3', 1, NULL, '3A', 'Shapes', NULL),
  ('BA3.02', 'BA3', 2, NULL, '3A', 'Skip-Counting', NULL),
  ('BA3.03', 'BA3', 3, NULL, '3A', 'Perimeter & Area', NULL),
  ('BA3.04', 'BA3', 4, NULL, '3B', 'Multiplication', NULL),
  ('BA3.05', 'BA3', 5, NULL, '3B', 'Perfect Squares', NULL),
  ('BA3.06', 'BA3', 6, NULL, '3B', 'The Distributive Property', NULL),
  ('BA3.07', 'BA3', 7, NULL, '3C', 'Variables', NULL),
  ('BA3.08', 'BA3', 8, NULL, '3C', 'Division', NULL),
  ('BA3.09', 'BA3', 9, NULL, '3C', 'Measurement', NULL),
  ('BA3.10', 'BA3', 10, NULL, '3D', 'Fractions', NULL),
  ('BA3.11', 'BA3', 11, NULL, '3D', 'Estimation', NULL),
  ('BA3.12', 'BA3', 12, NULL, '3D', 'Area', NULL)
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('BA4.01', 'BA4', 1, NULL, '4A', 'Shapes', NULL),
  ('BA4.02', 'BA4', 2, NULL, '4A', 'Multiplication', NULL),
  ('BA4.03', 'BA4', 3, NULL, '4A', 'Exponents', NULL),
  ('BA4.04', 'BA4', 4, NULL, '4B', 'Counting', NULL),
  ('BA4.05', 'BA4', 5, NULL, '4B', 'Division', NULL),
  ('BA4.06', 'BA4', 6, NULL, '4B', 'Logic', NULL),
  ('BA4.07', 'BA4', 7, NULL, '4C', 'Factors', NULL),
  ('BA4.08', 'BA4', 8, NULL, '4C', 'Fractions', NULL),
  ('BA4.09', 'BA4', 9, NULL, '4C', 'Integers', NULL),
  ('BA4.10', 'BA4', 10, NULL, '4D', 'Fractions', NULL),
  ('BA4.11', 'BA4', 11, NULL, '4D', 'Decimals', NULL),
  ('BA4.12', 'BA4', 12, NULL, '4D', 'Probability', NULL)
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('BA5.01', 'BA5', 1, NULL, '5A', '3D Solids', NULL),
  ('BA5.02', 'BA5', 2, NULL, '5A', 'Integers', NULL),
  ('BA5.03', 'BA5', 3, NULL, '5A', 'Expressions & Equations', NULL),
  ('BA5.04', 'BA5', 4, NULL, '5B', 'Statistics', NULL),
  ('BA5.05', 'BA5', 5, NULL, '5B', 'Factors & Multiples', NULL),
  ('BA5.06', 'BA5', 6, NULL, '5B', 'Fractions', NULL),
  ('BA5.07', 'BA5', 7, NULL, '5C', 'Sequences', NULL),
  ('BA5.08', 'BA5', 8, NULL, '5C', 'Ratios & Rates', NULL),
  ('BA5.09', 'BA5', 9, NULL, '5C', 'Decimals', NULL),
  ('BA5.10', 'BA5', 10, NULL, '5D', 'Percents', NULL),
  ('BA5.11', 'BA5', 11, NULL, '5D', 'Square Roots', NULL),
  ('BA5.12', 'BA5', 12, NULL, '5D', 'Exponents', NULL)
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('PRE.01', 'PRE', 1, NULL, NULL, 'Properties of Arithmetic', NULL),
  ('PRE.02', 'PRE', 2, NULL, NULL, 'Exponents', NULL),
  ('PRE.03', 'PRE', 3, NULL, NULL, 'Number Theory', NULL),
  ('PRE.04', 'PRE', 4, NULL, NULL, 'Fractions', NULL),
  ('PRE.05', 'PRE', 5, NULL, NULL, 'Equations and Inequalities', NULL),
  ('PRE.06', 'PRE', 6, NULL, NULL, 'Decimals', NULL),
  ('PRE.07', 'PRE', 7, NULL, NULL, 'Ratios, Conversions, and Rates', NULL),
  ('PRE.08', 'PRE', 8, NULL, NULL, 'Percents', NULL),
  ('PRE.09', 'PRE', 9, NULL, NULL, 'Square Roots', NULL),
  ('PRE.10', 'PRE', 10, NULL, NULL, 'Angles', NULL),
  ('PRE.11', 'PRE', 11, NULL, NULL, 'Perimeter and Area', NULL),
  ('PRE.12', 'PRE', 12, NULL, NULL, 'Right Triangles and Quadrilaterals', NULL),
  ('PRE.13', 'PRE', 13, NULL, NULL, 'Data and Statistics', NULL),
  ('PRE.14', 'PRE', 14, NULL, NULL, 'Counting', NULL),
  ('PRE.15', 'PRE', 15, NULL, NULL, 'Problem-Solving Strategies', NULL)
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('ALG.01', 'ALG', 1, NULL, NULL, 'Follow the Rules', NULL),
  ('ALG.02', 'ALG', 2, NULL, NULL, 'x Marks the Spot', NULL),
  ('ALG.03', 'ALG', 3, NULL, NULL, 'One-Variable Linear Equations', NULL),
  ('ALG.04', 'ALG', 4, NULL, NULL, 'More Variables', NULL),
  ('ALG.05', 'ALG', 5, NULL, NULL, 'Multi-Variable Linear Equations', NULL),
  ('ALG.06', 'ALG', 6, NULL, NULL, 'Ratios and Percents', NULL),
  ('ALG.07', 'ALG', 7, NULL, NULL, 'Proportion', NULL),
  ('ALG.08', 'ALG', 8, NULL, NULL, 'Graphing Lines', NULL),
  ('ALG.09', 'ALG', 9, NULL, NULL, 'Introduction to Inequalities', NULL),
  ('ALG.10', 'ALG', 10, NULL, NULL, 'Quadratic Equations – Part 1', NULL),
  ('ALG.11', 'ALG', 11, NULL, NULL, 'Special Factorizations', NULL),
  ('ALG.12', 'ALG', 12, NULL, NULL, 'Complex Numbers', NULL),
  ('ALG.13', 'ALG', 13, NULL, NULL, 'Quadratic Equations – Part 2', NULL),
  ('ALG.14', 'ALG', 14, NULL, NULL, 'Graphing Quadratics', NULL),
  ('ALG.15', 'ALG', 15, NULL, NULL, 'More Inequalities', NULL),
  ('ALG.16', 'ALG', 16, NULL, NULL, 'Functions', NULL),
  ('ALG.17', 'ALG', 17, NULL, NULL, 'Graphing Functions', NULL),
  ('ALG.18', 'ALG', 18, NULL, NULL, 'Polynomials', NULL),
  ('ALG.19', 'ALG', 19, NULL, NULL, 'Exponents and Logarithms', NULL),
  ('ALG.20', 'ALG', 20, NULL, NULL, 'Special Functions', NULL),
  ('ALG.21', 'ALG', 21, NULL, NULL, 'Sequences & Series', NULL),
  ('ALG.22', 'ALG', 22, NULL, NULL, 'Special Manipulations', NULL)
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('GEO.01', 'GEO', 1, NULL, NULL, 'What''s in a Name?', NULL),
  ('GEO.02', 'GEO', 2, NULL, NULL, 'Angles', NULL),
  ('GEO.03', 'GEO', 3, NULL, NULL, 'Congruent Triangles', NULL),
  ('GEO.04', 'GEO', 4, NULL, NULL, 'Perimeter and Area', NULL),
  ('GEO.05', 'GEO', 5, NULL, NULL, 'Similar Triangles', NULL),
  ('GEO.06', 'GEO', 6, NULL, NULL, 'Right Triangles', NULL),
  ('GEO.07', 'GEO', 7, NULL, NULL, 'Special Parts of a Triangle', NULL),
  ('GEO.08', 'GEO', 8, NULL, NULL, 'Quadrilaterals', NULL),
  ('GEO.09', 'GEO', 9, NULL, NULL, 'Polygons', NULL),
  ('GEO.10', 'GEO', 10, NULL, NULL, 'Geometric Inequalities', NULL),
  ('GEO.11', 'GEO', 11, NULL, NULL, 'Circles', NULL),
  ('GEO.12', 'GEO', 12, NULL, NULL, 'Circles and Angles', NULL),
  ('GEO.13', 'GEO', 13, NULL, NULL, 'Power of a Point', NULL),
  ('GEO.14', 'GEO', 14, NULL, NULL, 'Three-Dimensional Geometry', NULL),
  ('GEO.15', 'GEO', 15, NULL, NULL, 'Curved Surfaces', NULL),
  ('GEO.16', 'GEO', 16, NULL, NULL, 'The More Things Change...', NULL),
  ('GEO.17', 'GEO', 17, NULL, NULL, 'Analytic Geometry', NULL),
  ('GEO.18', 'GEO', 18, NULL, NULL, 'Introduction to Trigonometry', NULL),
  ('GEO.19', 'GEO', 19, NULL, NULL, 'Problem Solving Strategies in Geometry', NULL)
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

-- PLACEHOLDER NC Math (2017) (nc-2017): 2 levels, 4 topics

INSERT INTO curricula (id, name, source, edition, description, source_url, sort) VALUES
  ('nc-2017', 'PLACEHOLDER NC Math (2017)', 'North Carolina Department of Public Instruction', '2017', 'PLACEHOLDER: replaced by the reviewed catalog before release.', 'https://www.dpi.nc.gov/districts-schools/classroom-resources/office-teaching-and-learning', 2)
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name, source = excluded.source, edition = excluded.edition,
  description = excluded.description, source_url = excluded.source_url, sort = excluded.sort
  WHERE curricula.organization_id IS NULL;

INSERT INTO curriculum_levels (id, curriculum_id, code, name, stage, grade_band, description) VALUES
  ('NC17.K', 'nc-2017', 'K', 'PLACEHOLDER NC Kindergarten (2017)', 1001, 'Kindergarten', NULL),
  ('NC17.1', 'nc-2017', '1', 'PLACEHOLDER NC Grade 1 (2017)', 1002, 'Grade 1', NULL)
ON CONFLICT (id) DO UPDATE SET
  curriculum_id = excluded.curriculum_id, code = excluded.code, name = excluded.name,
  stage = excluded.stage, grade_band = excluded.grade_band, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC17.K.CC.1', 'NC17.K', 1, 'NC.K.CC.1', 'Counting and Cardinality', 'PLACEHOLDER Count to 100', 'PLACEHOLDER description of NC.K.CC.1.'),
  ('NC17.K.OA.1', 'NC17.K', 2, 'NC.K.OA.1', 'Operations and Algebraic Thinking', 'PLACEHOLDER Add and subtract with objects', 'PLACEHOLDER description of NC.K.OA.1.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC17.1.OA.1', 'NC17.1', 1, 'NC.1.OA.1', 'Operations and Algebraic Thinking', 'PLACEHOLDER Word problems within 20', 'PLACEHOLDER description of NC.1.OA.1.'),
  ('NC17.1.NBT.1', 'NC17.1', 2, 'NC.1.NBT.1', 'Number and Operations in Base Ten', 'PLACEHOLDER Count to 150', 'PLACEHOLDER description of NC.1.NBT.1.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

-- PLACEHOLDER NC Math (2026) (nc-2026): 2 levels, 4 topics

INSERT INTO curricula (id, name, source, edition, description, source_url, sort) VALUES
  ('nc-2026', 'PLACEHOLDER NC Math (2026)', 'North Carolina Department of Public Instruction', '2026', 'PLACEHOLDER: replaced by the reviewed catalog before release.', 'https://docs.google.com/document/d/1LxwEUZkpFTH77pZ0GQgazvAZQNllNx-YJcsp-K3siKw/', 3)
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name, source = excluded.source, edition = excluded.edition,
  description = excluded.description, source_url = excluded.source_url, sort = excluded.sort
  WHERE curricula.organization_id IS NULL;

INSERT INTO curriculum_levels (id, curriculum_id, code, name, stage, grade_band, description) VALUES
  ('NC26.K', 'nc-2026', 'K', 'PLACEHOLDER NC Kindergarten (2026)', 2001, 'Kindergarten', NULL),
  ('NC26.1', 'nc-2026', '1', 'PLACEHOLDER NC Grade 1 (2026)', 2002, 'Grade 1', NULL)
ON CONFLICT (id) DO UPDATE SET
  curriculum_id = excluded.curriculum_id, code = excluded.code, name = excluded.name,
  stage = excluded.stage, grade_band = excluded.grade_band, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC26.K.ANR.1', 'NC26.K', 1, 'K.ANR.1', 'Algebraic and Numerical Reasoning', 'PLACEHOLDER Count and compare', 'PLACEHOLDER description of K.ANR.1.'),
  ('NC26.K.SGMR.1', 'NC26.K', 2, 'K.SGMR.1', 'Spatial, Geometric and Measurement Reasoning', 'PLACEHOLDER Name shapes', 'PLACEHOLDER description of K.SGMR.1.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC26.1.ANR.1', 'NC26.1', 1, '1.ANR.1', 'Algebraic and Numerical Reasoning', 'PLACEHOLDER Add and subtract within 20', 'PLACEHOLDER description of 1.ANR.1.'),
  ('NC26.1.RD.1', 'NC26.1', 2, '1.RD.1', 'Reasoning with Data', 'PLACEHOLDER Sort and count data', 'PLACEHOLDER description of 1.RD.1.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;
