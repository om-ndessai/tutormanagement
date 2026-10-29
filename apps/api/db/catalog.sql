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
--  Levels/topics: ba 8/116, nc-2026 14/190, nc-2017 14/361, mk 6/48
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

-- NC Math 2026 (nc-2026): 14 levels, 190 topics

INSERT INTO curricula (id, name, source, edition, description, source_url, sort) VALUES
  ('nc-2026', 'NC Math 2026', 'North Carolina Standard Course of Study', '2026', 'North Carolina''s K-12 mathematics standards adopted by the State Board of Education in October 2026, taught from 2028-29: kindergarten to grade 8, NC Mathematics 1 and 2, and three state electives. One topic per standard, with its objectives.', 'https://docs.google.com/document/d/1LxwEUZkpFTH77pZ0GQgazvAZQNllNx-YJcsp-K3siKw/', 2)
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name, source = excluded.source, edition = excluded.edition,
  description = excluded.description, source_url = excluded.source_url, sort = excluded.sort
  WHERE curricula.organization_id IS NULL;

INSERT INTO curriculum_levels (id, curriculum_id, code, name, stage, grade_band, description) VALUES
  ('NC26.K', 'nc-2026', 'Kindergarten', 'Kindergarten', 2001, 'Kindergarten', NULL),
  ('NC26.1', 'nc-2026', 'Grade 1', 'Grade 1', 2002, 'Grade 1', NULL),
  ('NC26.2', 'nc-2026', 'Grade 2', 'Grade 2', 2003, 'Grade 2', NULL),
  ('NC26.3', 'nc-2026', 'Grade 3', 'Grade 3', 2004, 'Grade 3', NULL),
  ('NC26.4', 'nc-2026', 'Grade 4', 'Grade 4', 2005, 'Grade 4', NULL),
  ('NC26.5', 'nc-2026', 'Grade 5', 'Grade 5', 2006, 'Grade 5', NULL),
  ('NC26.6', 'nc-2026', 'Grade 6', 'Grade 6', 2007, 'Grade 6', NULL),
  ('NC26.7', 'nc-2026', 'Grade 7', 'Grade 7', 2008, 'Grade 7', NULL),
  ('NC26.8', 'nc-2026', 'Grade 8', 'Grade 8', 2009, 'Grade 8', NULL),
  ('NC26.M1', 'nc-2026', 'NC Math 1', 'NC Mathematics 1', 2010, 'High school', NULL),
  ('NC26.M2', 'nc-2026', 'NC Math 2', 'NC Mathematics 2', 2011, 'High school', NULL),
  ('NC26.ALR', 'nc-2026', 'ALR', 'Applied Logic and Reasoning', 2012, 'High school', NULL),
  ('NC26.ASDS', 'nc-2026', 'ASDS', 'Applied Statistics and Data Science', 2013, 'High school', NULL),
  ('NC26.MSM', 'nc-2026', 'MSM', 'Mathematical and Statistical Modeling', 2014, 'High school', NULL)
ON CONFLICT (id) DO UPDATE SET
  curriculum_id = excluded.curriculum_id, code = excluded.code, name = excluded.name,
  stage = excluded.stage, grade_band = excluded.grade_band, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC26.K.ANR.1', 'NC26.K', 1, 'K.ANR.1', 'Algebraic and Numerical Reasoning', 'Count objects to 20', 'Connect counting with how many objects there are, up to 20. Covers the counting sequence, one-to-one matching, cardinality, writing and showing numerals 0-20, one more, and seeing groups of up to 5 at a glance.'),
  ('NC26.K.ANR.2', 'NC26.K', 2, 'K.ANR.2', 'Algebraic and Numerical Reasoning', 'Count to 100', 'Use the pattern of the number system to count up to 100. Covers counting by ones and by tens to 100, counting on from any number, and counting back within 10.'),
  ('NC26.K.ANR.3', 'NC26.K', 3, 'K.ANR.3', 'Algebraic and Numerical Reasoning', 'Compare numbers to 20', 'Describe how two quantities up to 20 relate. Covers comparing sets and numerals as more, fewer or equal, and making sets that are more, fewer or the same.'),
  ('NC26.K.ANR.4', 'NC26.K', 4, 'K.ANR.4', 'Algebraic and Numerical Reasoning', 'Add and subtract within 10', 'Understand addition and subtraction within 10 with objects and drawings. Covers joining and separating, counting on and back, simple word problems, writing + and - expressions, part-part-whole and making 10.'),
  ('NC26.K.ANR.5', 'NC26.K', 5, 'K.ANR.5', 'Algebraic and Numerical Reasoning', 'Addition and subtraction within 5', 'Build fluency with early addition and subtraction facts. Covers adding and subtracting 0 or 1 within 10 and fluent facts within 5.'),
  ('NC26.K.ANR.6', 'NC26.K', 6, 'K.ANR.6', 'Algebraic and Numerical Reasoning', 'Teen numbers', 'Understand the numbers 11 to 19 as ten ones and some more. Covers composing and decomposing teen numbers with objects, drawings, numbers and expressions.'),
  ('NC26.K.ANR.7', 'NC26.K', 7, 'K.ANR.7', 'Algebraic and Numerical Reasoning', 'Repeating patterns', 'Recognise and build patterns that repeat with colours, shapes, sounds or objects. Covers finding the core unit, extending and creating AB, AAB, ABB and ABC patterns.'),
  ('NC26.K.SGMR.1', 'NC26.K', 8, 'K.SGMR.1', 'Spatial, Geometric, and Measurement Reasoning', 'Name and describe shapes', 'Describe flat and solid shapes by their attributes. Covers naming common 2D and 3D shapes in any orientation or size, sorting 2D from 3D, and comparing 2D shapes.'),
  ('NC26.K.SGMR.2', 'NC26.K', 9, 'K.SGMR.2', 'Spatial, Geometric, and Measurement Reasoning', 'Draw and build shapes', 'Make two-dimensional shapes. Covers drawing and building triangles, rectangles, squares and circles, and combining shapes into larger figures.'),
  ('NC26.K.SGMR.3', 'NC26.K', 10, 'K.SGMR.3', 'Spatial, Geometric, and Measurement Reasoning', 'Compare length, height and weight', 'Compare two objects by an attribute that can be measured. Covers describing length, height and weight and comparing them with words such as longer or heavier.'),
  ('NC26.K.RD.1', 'NC26.K', 11, 'K.RD.1', 'Reasoning with Data', 'Sort by one attribute', 'Sort and classify objects by a shared attribute. Covers sorting up to 20 objects by one attribute and describing the attribute used.'),
  ('NC26.K.RD.2', 'NC26.K', 12, 'K.RD.2', 'Reasoning with Data', 'Object and picture graphs', 'Use the data cycle with simple object and picture graphs. Covers deciding what data a question needs, collecting it, graphing it, counting and comparing categories, and sharing conclusions.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC26.1.ANR.1', 'NC26.1', 1, '1.ANR.1', 'Algebraic and Numerical Reasoning', 'Count to 120', 'Use the structure of the number system to count within 120. Covers counting forward and back by ones and tens, counting by fives, and describing skip-counting patterns.'),
  ('NC26.1.ANR.2', 'NC26.1', 2, '1.ANR.2', 'Algebraic and Numerical Reasoning', 'Count collections to 120', 'Count larger collections of objects by grouping them. Covers grouping strategies to find a total and writing the numeral for a set.'),
  ('NC26.1.ANR.3', 'NC26.1', 3, '1.ANR.3', 'Algebraic and Numerical Reasoning', 'Tens and ones', 'Understand two-digit numbers as tens and ones. Covers making a ten from ten ones, composing and decomposing two-digit numbers, and standard and expanded form.'),
  ('NC26.1.ANR.4', 'NC26.1', 4, '1.ANR.4', 'Algebraic and Numerical Reasoning', 'Compare numbers to 100', 'Use place value to reason about the size of numbers to 100. Covers numbers on a number line, comparing with >, < and =, and estimating positions from benchmarks.'),
  ('NC26.1.ANR.5', 'NC26.1', 5, '1.ANR.5', 'Algebraic and Numerical Reasoning', 'Add and subtract within 20', 'Understand addition and subtraction within 20. Covers strategies such as counting on, doubles and making ten, word problems with an unknown, and adding three numbers using properties.'),
  ('NC26.1.ANR.6', 'NC26.1', 6, '1.ANR.6', 'Algebraic and Numerical Reasoning', 'Addition facts within 10', 'Build fluency with the foundational addition and subtraction facts. Covers fluent facts within 10, ten-plus facts and doubles within 20.'),
  ('NC26.1.ANR.7', 'NC26.1', 7, '1.ANR.7', 'Algebraic and Numerical Reasoning', 'The equal sign', 'Use the equal sign to describe how quantities within 20 relate. Covers the meaning of =, deciding whether two expressions are equal, and finding an unknown in any position.'),
  ('NC26.1.ANR.8', 'NC26.1', 8, '1.ANR.8', 'Algebraic and Numerical Reasoning', 'Add and subtract within 100', 'Use place value to add and subtract within 100. Covers adding and subtracting one-digit numbers and multiples of 10, explaining strategies, and finding 10 more or 10 less mentally.'),
  ('NC26.1.SGMR.1', 'NC26.1', 9, '1.SGMR.1', 'Spatial, Geometric, and Measurement Reasoning', 'Attributes of shapes', 'Describe and create shapes from their defining attributes. Covers defining versus non-defining attributes, sides and vertices, drawing 2D shapes, and naming, building and comparing 3D shapes.'),
  ('NC26.1.SGMR.2', 'NC26.1', 10, '1.SGMR.2', 'Spatial, Geometric, and Measurement Reasoning', 'Halves and fourths', 'Understand equal shares of a whole as halves and fourths. Covers partitioning circles and rectangles, naming the shares, and why fourths are smaller than halves.'),
  ('NC26.1.SGMR.3', 'NC26.1', 11, '1.SGMR.3', 'Spatial, Geometric, and Measurement Reasoning', 'Compare and order lengths', 'Reason about length without standard units. Covers ordering three objects by length and comparing two lengths using a third object.'),
  ('NC26.1.SGMR.4', 'NC26.1', 12, '1.SGMR.4', 'Spatial, Geometric, and Measurement Reasoning', 'Measure with non-standard units', 'Measure lengths by repeating a smaller unit. Covers expressing length as a whole number of units laid end to end with no gaps or overlaps.'),
  ('NC26.1.SGMR.5', 'NC26.1', 13, '1.SGMR.5', 'Spatial, Geometric, and Measurement Reasoning', 'Time to the half hour', 'Tell time to the nearest hour and half hour. Covers hours and minutes on a clock and reading analog and digital clocks.'),
  ('NC26.1.SGMR.6', 'NC26.1', 14, '1.SGMR.6', 'Spatial, Geometric, and Measurement Reasoning', 'Value of coins', 'Understand what coins are worth. Covers identifying quarters, dimes, nickels and pennies, their values, and counting collections of like coins to 100 cents.'),
  ('NC26.1.RD.1', 'NC26.1', 15, '1.RD.1', 'Reasoning with Data', 'Sort by one or two attributes', 'Sort and classify objects by how they are alike and different. Covers sorting up to 20 objects by one or two attributes and describing the attributes used.'),
  ('NC26.1.RD.2', 'NC26.1', 16, '1.RD.2', 'Reasoning with Data', 'Data with picture graphs', 'Use the data cycle with object and picture graphs. Covers asking questions that need categorical data, collecting up to 20 data points, graphing them, and drawing and sharing conclusions.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC26.2.ANR.1', 'NC26.2', 1, '2.ANR.1', 'Algebraic and Numerical Reasoning', 'Skip counting, odd and even', 'Use patterns in numbers to reason about quantities. Covers counting by 1s, 2s, 5s, 10s and 100s within 1,000, odd and even numbers, and totals of small arrays.'),
  ('NC26.2.ANR.2', 'NC26.2', 2, '2.ANR.2', 'Algebraic and Numerical Reasoning', 'Hundreds, tens and ones', 'Understand three-digit numbers through place value. Covers making a hundred from ten tens, the value of each digit, equivalent forms, and standard, expanded and word form.'),
  ('NC26.2.ANR.3', 'NC26.2', 3, '2.ANR.3', 'Algebraic and Numerical Reasoning', 'Compare numbers to 1,000', 'Use place value to reason about the size of numbers within 1,000. Covers comparing and ordering with digits, number lines and symbols, and estimating positions on a number line.'),
  ('NC26.2.ANR.4', 'NC26.2', 4, '2.ANR.4', 'Algebraic and Numerical Reasoning', 'Mental addition and subtraction', 'Build fluency with mental addition and subtraction. Covers fluent facts within 20 and adding or subtracting 10 or 100 within 1,000.'),
  ('NC26.2.ANR.5', 'NC26.2', 5, '2.ANR.5', 'Algebraic and Numerical Reasoning', 'Add and subtract within 100', 'Add and subtract fluently within 100 using place value and properties. Covers strategies, one- and two-step word problems with an unknown, and choosing efficient strategies.'),
  ('NC26.2.ANR.6', 'NC26.2', 6, '2.ANR.6', 'Algebraic and Numerical Reasoning', 'Equal and not equal within 100', 'Use the equal sign to compare quantities and expressions within 100. Covers justifying whether two expressions are equal and finding an unknown in any position.'),
  ('NC26.2.ANR.7', 'NC26.2', 7, '2.ANR.7', 'Algebraic and Numerical Reasoning', 'Add and subtract within 1,000', 'Use place value and properties to add and subtract within 1,000. Covers adding three two-digit numbers, adding and subtracting three-digit numbers, and explaining why strategies work.'),
  ('NC26.2.SGMR.1', 'NC26.2', 8, '2.SGMR.1', 'Spatial, Geometric, and Measurement Reasoning', 'Two-dimensional shapes', 'Reason about flat shapes and their attributes. Covers comparing polygons and circles by sides, vertices and angles, composing and decomposing shapes, and lines of symmetry.'),
  ('NC26.2.SGMR.2', 'NC26.2', 9, '2.SGMR.2', 'Spatial, Geometric, and Measurement Reasoning', 'Halves, thirds and fourths', 'Understand equal shares of a whole as halves, thirds and fourths. Covers partitioning circles and rectangles, naming shares, equal shares that look different, and more shares meaning smaller shares.'),
  ('NC26.2.SGMR.3', 'NC26.2', 10, '2.SGMR.3', 'Spatial, Geometric, and Measurement Reasoning', 'Measure length in units', 'Measure and estimate length in customary and metric units. Covers measuring with rulers and tapes, comparing measurements in two units, choosing a unit, estimating and comparing lengths.'),
  ('NC26.2.SGMR.4', 'NC26.2', 11, '2.SGMR.4', 'Spatial, Geometric, and Measurement Reasoning', 'Time to the minute', 'Tell and write time to the nearest minute. Covers reading and writing times to 5 minutes and 1 minute on analog and digital clocks with a.m. and p.m.'),
  ('NC26.2.SGMR.5', 'NC26.2', 12, '2.SGMR.5', 'Spatial, Geometric, and Measurement Reasoning', 'Count money to $1', 'Work with the value of coins up to one dollar. Covers making a given amount with coins and finding the value of a set of mixed coins.'),
  ('NC26.2.RD.1', 'NC26.2', 13, '2.RD.1', 'Reasoning with Data', 'Sort up to 30 objects', 'Sort and classify objects by one or two attributes. Covers sorting up to 30 objects and describing the attributes used.'),
  ('NC26.2.RD.2', 'NC26.2', 14, '2.RD.2', 'Reasoning with Data', 'Picture and bar graphs', 'Use the data cycle with single-scale picture and bar graphs. Covers posing questions, collecting up to 30 data points, graphing them, and analysing and sharing conclusions.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC26.3.ANR.1', 'NC26.3', 1, '3.ANR.1', 'Algebraic and Numerical Reasoning', 'Place value to 10,000', 'Extend place value to numbers within 10,000. Covers the value of each digit, standard, expanded and word forms, equivalent forms, mentally adding multiples of 10, 100 or 1,000, and comparing and ordering.'),
  ('NC26.3.ANR.2', 'NC26.3', 2, '3.ANR.2', 'Algebraic and Numerical Reasoning', 'Add and subtract within 1,000', 'Understand whole-number addition and subtraction within 1,000. Covers one-step problems in context, strategies based on expanded form and properties, and building procedural fluency.'),
  ('NC26.3.ANR.3', 'NC26.3', 3, '3.ANR.3', 'Algebraic and Numerical Reasoning', 'Meaning of multiplication', 'Understand multiplication of whole numbers. Covers factors as equal groups, strategies such as skip-counting and decomposing, word problems with equal groups and arrays, patterns, and multiplying by multiples of 10.'),
  ('NC26.3.ANR.4', 'NC26.3', 4, '3.ANR.4', 'Algebraic and Numerical Reasoning', 'Meaning of division', 'Understand division of whole numbers. Covers divisor and quotient as groups and group size, division strategies, word problems with equal groups and arrays, and equations with an unknown.'),
  ('NC26.3.ANR.5', 'NC26.3', 5, '3.ANR.5', 'Algebraic and Numerical Reasoning', 'Multiplication and division facts', 'Connect multiplication and division. Covers explaining the operations in context, inverse relationships, equal expressions, fluency with facts to 10 x 10, and instant recall of 0s, 1s, 2s, 5s and 10s.'),
  ('NC26.3.ANR.6', 'NC26.3', 6, '3.ANR.6', 'Algebraic and Numerical Reasoning', 'Two-step word problems', 'Solve problems that use whole-number operations. Covers two-step problems with addition, subtraction and multiplication, and estimating answers.'),
  ('NC26.3.ANR.7', 'NC26.3', 7, '3.ANR.7', 'Algebraic and Numerical Reasoning', 'Understand fractions', 'Make sense of fractions with denominators 2, 3, 4, 6 and 8. Covers unit fractions, numerators on area models and number lines, equivalent fractions, wholes as fractions, and comparing fractions.'),
  ('NC26.3.SGMR.1', 'NC26.3', 8, '3.SGMR.1', 'Spatial, Geometric, and Measurement Reasoning', 'Lines, angles and quadrilaterals', 'Reason about quadrilaterals and their parts. Covers points, lines, segments, parallel and perpendicular lines, types of angles, and identifying kinds of quadrilaterals.'),
  ('NC26.3.SGMR.2', 'NC26.3', 9, '3.SGMR.2', 'Spatial, Geometric, and Measurement Reasoning', 'Time and customary measurement', 'Work with elapsed time and customary units. Covers time intervals within an hour, estimating and measuring length, capacity and weight, and one-step measurement problems.'),
  ('NC26.3.SGMR.3', 'NC26.3', 10, '3.SGMR.3', 'Spatial, Geometric, and Measurement Reasoning', 'Area and perimeter', 'Understand area and perimeter. Covers area by tiling and multiplying side lengths, splitting rectangles to find area, perimeter of polygons, and finding a missing side from the perimeter.'),
  ('NC26.3.RD.1', 'NC26.3', 11, '3.RD.1', 'Reasoning with Data', 'Scaled bar graphs', 'Use the data cycle with frequency tables, scaled bar graphs and picture graphs. Covers posing questions, planning and collecting categorical data, graphing it, and drawing conclusions and predictions.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC26.4.ANR.1', 'NC26.4', 1, '4.ANR.1', 'Algebraic and Numerical Reasoning', 'Place value to 100,000', 'Extend place value to numbers within 100,000. Covers the value of each digit, equivalent forms, each place being ten times the place to its right, and comparing and ordering.'),
  ('NC26.4.ANR.2', 'NC26.4', 2, '4.ANR.2', 'Algebraic and Numerical Reasoning', 'Add and subtract with algorithms', 'Add and subtract whole numbers within 100,000. Covers connecting earlier strategies to the standard algorithm and using it with multi-digit numbers.'),
  ('NC26.4.ANR.3', 'NC26.4', 3, '4.ANR.3', 'Algebraic and Numerical Reasoning', 'Multiply and divide whole numbers', 'Understand multiplication and division of whole numbers. Covers factor pairs, primes and composites, multiples, fact fluency to 10 x 10, multiplicative comparison, multi-digit products and quotients, and remainders.'),
  ('NC26.4.ANR.4', 'NC26.4', 4, '4.ANR.4', 'Algebraic and Numerical Reasoning', 'Two-step problems, all operations', 'Solve two-step problems with whole numbers. Covers problems with all four operations, equations with a letter for the unknown, and checking answers by estimation.'),
  ('NC26.4.ANR.5', 'NC26.4', 5, '4.ANR.5', 'Algebraic and Numerical Reasoning', 'Equivalent fractions and decimals', 'Make sense of fractions and decimals. Covers equivalent fractions, comparing and ordering fractions with benchmarks and models, tenths and hundredths as decimals, and comparing decimals.'),
  ('NC26.4.ANR.6', 'NC26.4', 6, '4.ANR.6', 'Algebraic and Numerical Reasoning', 'Add fractions, multiply by whole numbers', 'Operate with fractions. Covers adding and subtracting fractions and mixed numbers with like denominators, decomposing fractions, multiplying a fraction by a whole number, and fractions of a set.'),
  ('NC26.4.ANR.7', 'NC26.4', 7, '4.ANR.7', 'Algebraic and Numerical Reasoning', 'Shape and number patterns', 'Reason about patterns. Covers generating a pattern from a rule, finding the rule of a pattern, and telling growing patterns from repeating ones.'),
  ('NC26.4.SGMR.1', 'NC26.4', 8, '4.SGMR.1', 'Spatial, Geometric, and Measurement Reasoning', 'Measure angles', 'Reason about angles and how they are measured. Covers degrees as parts of a circle, estimating angles, using a protractor, and finding unknown angles by adding and subtracting.'),
  ('NC26.4.SGMR.2', 'NC26.4', 9, '4.SGMR.2', 'Spatial, Geometric, and Measurement Reasoning', 'Classify triangles and quadrilaterals', 'Reason about triangles and quadrilaterals by their attributes. Covers notation for points, lines and rays, classifying triangles by angles and sides, and classifying quadrilaterals.'),
  ('NC26.4.SGMR.3', 'NC26.4', 10, '4.SGMR.3', 'Spatial, Geometric, and Measurement Reasoning', 'Time and metric measurement', 'Work with elapsed time and metric units. Covers time intervals across the hour, estimating and measuring length, capacity and mass, one-step problems, and converting larger units to smaller.'),
  ('NC26.4.SGMR.4', 'NC26.4', 11, '4.SGMR.4', 'Spatial, Geometric, and Measurement Reasoning', 'Area and perimeter formulas', 'Apply area and perimeter in problems. Covers the rectangle formulas in context, area of rectilinear figures, and fixed area with changing perimeter and the reverse.'),
  ('NC26.4.RD.1', 'NC26.4', 12, '4.RD.1', 'Reasoning with Data', 'Line plots and double bar graphs', 'Use the data cycle with frequency tables, line plots and bar graphs. Covers categorical and numerical questions, collecting and graphing data, range, mode and median, and drawing conclusions.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC26.5.ANR.1', 'NC26.5', 1, '5.ANR.1', 'Algebraic and Numerical Reasoning', 'Numerical expressions', 'Make sense of numerical expressions. Covers order of operations in two-step expressions, relating expressions to properties, and connecting them to representations.'),
  ('NC26.5.ANR.2', 'NC26.5', 2, '5.ANR.2', 'Algebraic and Numerical Reasoning', 'Place value and decimals', 'Extend place value to millions and thousandths. Covers the value of each digit, forms of decimals, patterns when multiplying or dividing by powers of ten, and comparing decimals.'),
  ('NC26.5.ANR.3', 'NC26.5', 3, '5.ANR.3', 'Algebraic and Numerical Reasoning', 'Multi-digit multiplication and division', 'Operate with multi-digit whole numbers. Covers multiplying three-digit by two-digit numbers, dividing four-digit by one-digit numbers including long division, remainders, multi-step problems and estimation.'),
  ('NC26.5.ANR.4', 'NC26.5', 4, '5.ANR.4', 'Algebraic and Numerical Reasoning', 'Operations with decimals', 'Make sense of operations with decimals. Covers adding and subtracting to thousandths, multiplying and dividing by a whole number within 4, two-step problems, and estimation.'),
  ('NC26.5.ANR.5', 'NC26.5', 5, '5.ANR.5', 'Algebraic and Numerical Reasoning', 'Operations with fractions', 'Make sense of operations with fractions. Covers adding and subtracting with unlike denominators, fractions as division, multiplying fractions, scaling, and dividing with unit fractions.'),
  ('NC26.5.ANR.6', 'NC26.5', 6, '5.ANR.6', 'Algebraic and Numerical Reasoning', 'Patterns and relationships', 'Reason about patterns and how they relate. Covers generating two patterns from rules and analysing the relationship between corresponding terms.'),
  ('NC26.5.SGMR.1', 'NC26.5', 7, '5.SGMR.1', 'Spatial, Geometric, and Measurement Reasoning', 'Hierarchy of quadrilaterals', 'Reason about shapes through their properties. Covers classifying quadrilaterals in a hierarchy and how attributes carry to subcategories.'),
  ('NC26.5.SGMR.2', 'NC26.5', 8, '5.SGMR.2', 'Spatial, Geometric, and Measurement Reasoning', 'The coordinate plane', 'Reason about location in the first quadrant. Covers graphing points, solving problems on the plane, and graphing ordered pairs from patterns.'),
  ('NC26.5.SGMR.3', 'NC26.5', 9, '5.SGMR.3', 'Spatial, Geometric, and Measurement Reasoning', 'Convert measurement units', 'Convert between units within the customary or the metric system. Covers checking that conversions are reasonable and solving one- or two-step conversion problems.'),
  ('NC26.5.SGMR.4', 'NC26.5', 10, '5.SGMR.4', 'Spatial, Geometric, and Measurement Reasoning', 'Volume of rectangular prisms', 'Understand and apply volume of rectangular prisms. Covers volume in cubic units, packing with unit cubes, the volume formula, finding a missing dimension, and composite prisms.'),
  ('NC26.5.RD.1', 'NC26.5', 11, '5.RD.1', 'Reasoning with Data', 'Line graphs and line plots', 'Use the data cycle with line graphs, line plots and bar graphs. Covers questions about categorical data and data that change over time, planning and collecting, graphing, and drawing conclusions and predictions.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC26.6.RPR.1', 'NC26.6', 1, '6.RPR.1', 'Ratio and Proportional Reasoning', 'Ratios and unit ratios', 'Understand equivalent ratios. Covers ratio language for part-to-part and part-to-whole, writing ratios in several notations, and the two unit ratios that relate two quantities.'),
  ('NC26.6.RPR.2', 'NC26.6', 2, '6.RPR.2', 'Ratio and Proportional Reasoning', 'Ratio problems and percents', 'Use ratio reasoning to solve problems, including percents. Covers ratio tables, double number lines and graphs, unit conversions, independent and dependent variables, percent as a rate per 100, and finding a part, whole or percent.'),
  ('NC26.6.ANR.1', 'NC26.6', 3, '6.ANR.1', 'Algebraic and Numerical Reasoning', 'Factors and multiples', 'Relate factors and multiples. Covers least common multiples, prime factorisation in exponent form, greatest common factors, and factoring a sum with the distributive property.'),
  ('NC26.6.ANR.2', 'NC26.6', 4, '6.ANR.2', 'Algebraic and Numerical Reasoning', 'Fraction operations', 'Operate with positive fractions and mixed numbers with denominators up to 12. Covers adding, subtracting and dividing with models, multiplying with an algorithm, interpreting quotients, word problems and checking reasonableness.'),
  ('NC26.6.ANR.3', 'NC26.6', 5, '6.ANR.3', 'Algebraic and Numerical Reasoning', 'Decimal operations', 'Operate with positive decimals. Covers fluent algorithms for adding and subtracting to thousandths and multiplying and dividing to hundredths, estimation, and word problems.'),
  ('NC26.6.ANR.4', 'NC26.6', 6, '6.ANR.4', 'Algebraic and Numerical Reasoning', 'Integer operations', 'Operate with integers from -20 to 20. Covers zero pairs, subtraction as adding the opposite, models for all four operations, computing, checking reasonableness, and problems in context.'),
  ('NC26.6.ANR.5', 'NC26.6', 7, '6.ANR.5', 'Algebraic and Numerical Reasoning', 'Compare rational numbers', 'Compare and order integers, fractions, mixed numbers and decimals. Covers equivalent forms, the number line, inequality statements, opposites, the meaning of zero, and absolute value.'),
  ('NC26.6.ANR.6', 'NC26.6', 8, '6.ANR.6', 'Algebraic and Numerical Reasoning', 'Expressions and exponents', 'Write and evaluate numerical and algebraic expressions. Covers whole-number exponents, order of operations, translating words to expressions, parts of an expression, evaluating, and equivalent expressions using properties.'),
  ('NC26.6.ANR.7', 'NC26.6', 9, '6.ANR.7', 'Algebraic and Numerical Reasoning', 'One-step equations and inequalities', 'Represent and solve one-variable equations and represent inequalities. Covers checking solutions by substitution, writing and solving one-step equations, and writing and graphing simple inequalities.'),
  ('NC26.6.SGMR.1', 'NC26.6', 10, '6.SGMR.1', 'Spatial, Geometric, and Measurement Reasoning', 'Area of polygons', 'Solve problems about the area of two-dimensional figures. Covers areas of triangles, special quadrilaterals and polygons by composing and decomposing shapes, and checking answers in context.'),
  ('NC26.6.SGMR.2', 'NC26.6', 11, '6.SGMR.2', 'Spatial, Geometric, and Measurement Reasoning', 'Four-quadrant coordinate plane', 'Solve problems with the coordinate plane. Covers plotting points in all four quadrants, reflections across axes, distances between points sharing a coordinate, and polygons with perimeter and area.'),
  ('NC26.6.SGMR.3', 'NC26.6', 12, '6.SGMR.3', 'Spatial, Geometric, and Measurement Reasoning', 'Nets, surface area and volume', 'Solve problems with surface area and volume. Covers nets of prisms and pyramids, surface area of rectangular and triangular prisms, and volume of rectangular prisms with fractional edges.'),
  ('NC26.6.RD.1', 'NC26.6', 13, '6.RD.1', 'Reasoning with Data', 'Probability of simple events', 'Investigate chance and the probability of simple, equally likely events. Covers probability language and values from 0 to 1, theoretical probability, and comparing experiments with theory.'),
  ('NC26.6.RD.2', 'NC26.6', 14, '6.RD.2', 'Reasoning with Data', 'Statistical questions and samples', 'Pose and investigate statistical questions about one population. Covers telling statistical questions apart, spotting bias, collecting data from a representative sample, and organising it.'),
  ('NC26.6.RD.3', 'NC26.6', 15, '6.RD.3', 'Reasoning with Data', 'Dot plots, histograms and box plots', 'Examine numerical data displayed on a number line. Covers key features of line plots, histograms and box plots, constructing them, describing centre and spread, and reading non-standard displays.'),
  ('NC26.6.RD.4', 'NC26.6', 16, '6.RD.4', 'Reasoning with Data', 'Mean and median', 'Model and analyse a data set by its centre and spread. Covers the mean as a balance point, finding mean and median, comparing displays and variability, and choosing the best measure of centre.'),
  ('NC26.6.RD.5', 'NC26.6', 17, '6.RD.5', 'Reasoning with Data', 'Interpret a data investigation', 'Summarise and interpret a one-variable data investigation. Covers drawing inferences from centre and variability, summarising a distribution, communicating findings, and reflecting on the question and methods.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC26.7.RPR.1', 'NC26.7', 1, '7.RPR.1', 'Ratio and Proportional Reasoning', 'Unit rates and proportions', 'Use the unit rate, or constant of proportionality, in proportional relationships. Covers identifying what stays constant, unit rates with fractions, testing for proportionality, representing and comparing relationships, and reading points in context.'),
  ('NC26.7.RPR.2', 'NC26.7', 2, '7.RPR.2', 'Ratio and Proportional Reasoning', 'Scale drawings and percents', 'Use proportional reasoning for scale and percent problems. Covers unit conversions, constructing and using scale drawings, how scale affects area, and tax, markups, tips, commission and percent change.'),
  ('NC26.7.RPR.3', 'NC26.7', 3, '7.RPR.3', 'Ratio and Proportional Reasoning', 'Circle graphs and circumference', 'Use proportional reasoning with circles. Covers circle graphs in degrees, fractions and percents, the ratio of circumference to diameter as pi, and problems with radius, diameter and circumference.'),
  ('NC26.7.ANR.1', 'NC26.7', 4, '7.ANR.1', 'Algebraic and Numerical Reasoning', 'Rational number operations', 'Operate with integers, fractions and decimals. Covers rational numbers as quotients and as terminating or repeating decimals, fluent operations, checking reasonableness, and converting fractions to decimals.'),
  ('NC26.7.ANR.2', 'NC26.7', 5, '7.ANR.2', 'Algebraic and Numerical Reasoning', 'Equivalent linear expressions', 'Generate equivalent linear expressions with properties of operations. Covers factoring, combining like terms and the distributive property, and what equivalent forms reveal in context.'),
  ('NC26.7.ANR.3', 'NC26.7', 6, '7.ANR.3', 'Algebraic and Numerical Reasoning', 'Multi-step equations and inequalities', 'Solve problems with expressions, equations and inequalities using rational numbers. Covers writing and solving multi-step equations and inequalities with the variable on one side, graphing solutions, and choosing between them.'),
  ('NC26.7.SGMR.1', 'NC26.7', 7, '7.SGMR.1', 'Spatial, Geometric, and Measurement Reasoning', 'Area of circles and composite figures', 'Solve area problems with triangles, quadrilaterals, circles and polygons. Covers how circumference, pi and area relate, area of a circle, and perimeter and area of composite figures in context.'),
  ('NC26.7.SGMR.2', 'NC26.7', 8, '7.SGMR.2', 'Spatial, Geometric, and Measurement Reasoning', 'Prisms and cylinders', 'Solve problems with the surface area and volume of solids. Covers surface area as the sum of faces, volume as layers of the base, and problems with right prisms, cylinders and composite solids.'),
  ('NC26.7.SGMR.3', 'NC26.7', 9, '7.SGMR.3', 'Spatial, Geometric, and Measurement Reasoning', 'Angle relationships', 'Find unknown angles from angle relationships. Covers vertical, adjacent, supplementary and complementary angles, writing equations for unknown angles, and multi-step problems with intersecting lines.'),
  ('NC26.7.RD.1', 'NC26.7', 10, '7.RD.1', 'Reasoning with Data', 'Probability of compound events', 'Investigate chance with compound events and unequal outcomes. Covers theoretical probability, sample spaces with lists, tables and tree diagrams, simulations, and how experiments approach theory as trials grow.'),
  ('NC26.7.RD.2', 'NC26.7', 11, '7.RD.2', 'Reasoning with Data', 'Random samples and inference', 'Pose and investigate statistical questions comparing two groups. Covers writing statistical questions, bias, why random samples represent a population, simulating samples, and organising data from two groups.'),
  ('NC26.7.RD.3', 'NC26.7', 12, '7.RD.3', 'Reasoning with Data', 'Compare two data displays', 'Examine two sets of numerical data on a number line. Covers comparing shape, centre and spread informally, plotting two distributions together, and reading non-standard displays.'),
  ('NC26.7.RD.4', 'NC26.7', 13, '7.RD.4', 'Reasoning with Data', 'Range, IQR and MAD', 'Model and analyse the centre and spread of up to two data sets. Covers range, interquartile range and mean absolute deviation, choosing measures, comparing distributions, and the effect of extreme values.'),
  ('NC26.7.RD.5', 'NC26.7', 14, '7.RD.5', 'Reasoning with Data', 'Compare two groups with data', 'Summarise and interpret an investigation comparing two groups. Covers comparative inferences, summarising distributions, communicating findings, and reflecting on the question and methods.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC26.8.ANFR.1', 'NC26.8', 1, '8.ANFR.1', 'Algebraic and Numerical Reasoning', 'Equations with variables on both sides', 'Solve equations and inequalities in one variable using properties of operations. Covers writing and solving linear equations and inequalities with the variable on both sides, and one, none or infinitely many solutions.'),
  ('NC26.8.ANFR.2', 'NC26.8', 2, '8.ANFR.2', 'Algebraic and Numerical Reasoning', 'Introduction to functions', 'Analyse patterns of change in functions. Covers a function as one output for each input, increasing, decreasing, linear and non-linear behaviour, and sketching functions from real situations.'),
  ('NC26.8.ANFR.3', 'NC26.8', 3, '8.ANFR.3', 'Algebraic and Numerical Reasoning', 'Linear functions', 'Analyse linear functions and their key features. Covers identifying linear functions, slope-intercept form, graphing, interpreting slope and intercept, and comparing two functions shown different ways.'),
  ('NC26.8.ANFR.4', 'NC26.8', 4, '8.ANFR.4', 'Algebraic and Numerical Reasoning', 'Irrational numbers', 'Describe how the subsets of the real numbers relate. Covers recognising irrational numbers, placing and estimating them on a number line, and approximating expressions with pi.'),
  ('NC26.8.ANFR.5', 'NC26.8', 5, '8.ANFR.5', 'Algebraic and Numerical Reasoning', 'Exponents, roots and scientific notation', 'Develop properties of radicals and integer exponents. Covers exponent properties, square and cube roots, solving x² = p and x³ = p, and using and comparing numbers in scientific notation.'),
  ('NC26.8.SGMR.1', 'NC26.8', 6, '8.SGMR.1', 'Spatial, Geometric, and Measurement Reasoning', 'Rigid transformations', 'Describe rigid transformations of triangles and quadrilaterals on the coordinate plane. Covers describing and representing up to two translations, reflections across an axis and 90 degree rotations about the origin.'),
  ('NC26.8.SGMR.2', 'NC26.8', 7, '8.SGMR.2', 'Spatial, Geometric, and Measurement Reasoning', 'Dilations on the plane', 'Describe dilations of triangles and quadrilaterals. Covers investigating dilations from a centre, finding the scale factor, and describing and drawing dilations about the origin.'),
  ('NC26.8.SGMR.3', 'NC26.8', 8, '8.SGMR.3', 'Spatial, Geometric, and Measurement Reasoning', 'Conditions for a triangle', 'Investigate which side and angle combinations give one triangle, several or none. Covers the triangle side-length condition, the 180 degree angle sum, and arguing with models.'),
  ('NC26.8.SGMR.4', 'NC26.8', 9, '8.SGMR.4', 'Spatial, Geometric, and Measurement Reasoning', 'Triangle angles and transversals', 'Use angle relationships to solve problems. Covers interior and exterior angles of triangles, angles formed by parallel lines and a transversal, and multi-step angle problems.'),
  ('NC26.8.SGMR.5', 'NC26.8', 10, '8.SGMR.5', 'Spatial, Geometric, and Measurement Reasoning', 'The Pythagorean Theorem', 'Apply the Pythagorean Theorem and its converse. Covers verifying the theorem, solving problems with it and its converse, and finding distances on the coordinate plane.'),
  ('NC26.8.SGMR.6', 'NC26.8', 11, '8.SGMR.6', 'Spatial, Geometric, and Measurement Reasoning', 'Pyramids, cones and spheres', 'Solve problems with the surface area and volume of solids. Covers surface area of pyramids, how volumes of cones, spheres and pyramids relate to cylinders and prisms, and volume problems.'),
  ('NC26.8.RD.1', 'NC26.8', 12, '8.RD.1', 'Reasoning with Data', 'Mutually exclusive events', 'Find probabilities of mutually exclusive and inclusive events. Covers telling the two kinds apart and justifying their probabilities with models.'),
  ('NC26.8.RD.2', 'NC26.8', 13, '8.RD.2', 'Reasoning with Data', 'Sampling several populations', 'Pose and investigate statistical questions about three or four populations. Covers writing questions, bias, random sampling by simulation, the validity of samples, and collecting and organising data.'),
  ('NC26.8.RD.3', 'NC26.8', 14, '8.RD.3', 'Reasoning with Data', 'Compare several data displays', 'Examine three or four sets of numerical data on a number line. Covers comparing distributions, plotting several on one display, and reading non-standard displays.'),
  ('NC26.8.RD.4', 'NC26.8', 15, '8.RD.4', 'Reasoning with Data', 'Standard deviation', 'Analyse the centre and spread of three or four data sets. Covers standard deviation and variance, computing it with technology, comparing distributions, outliers, and choosing a measure of spread.'),
  ('NC26.8.RD.5', 'NC26.8', 16, '8.RD.5', 'Reasoning with Data', 'Compare several populations with data', 'Summarise and interpret an investigation of three or four populations. Covers comparative inferences, summarising distributions, communicating findings with a recommended plan, and reflecting on methods.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC26.M1.RMM.1', 'NC26.M1', 1, 'NCM1.RMM.1', 'Reasoning with Mathematics Modeling', 'Mathematical modeling process', 'Solve and defend real-world problems with the modeling cycle. Covers identifying a problem, naming quantities and assumptions, building and analysing a model, testing conjectures, revising, and explaining and critiquing models.'),
  ('NC26.M1.ANFR.1', 'NC26.M1', 2, 'NCM1.ANFR.1', 'Algebraic, Numerical, and Functional Reasoning', 'Polynomial and exponent expressions', 'Rewrite algebraic expressions in equivalent forms. Covers integer exponent properties, comparing polynomial and integer operations, adding, subtracting and multiplying polynomials, and area models for products.'),
  ('NC26.M1.ANFR.2', 'NC26.M1', 3, 'NCM1.ANFR.2', 'Algebraic, Numerical, and Functional Reasoning', 'Linear versus exponential patterns', 'Analyse patterns of change across function types. Covers telling linear from exponential and other relationships, arithmetic and geometric patterns, and predicting values from graphs and tables.'),
  ('NC26.M1.ANFR.3', 'NC26.M1', 4, 'NCM1.ANFR.3', 'Algebraic, Numerical, and Functional Reasoning', 'Key features of functions', 'Interpret key features of linear and exponential functions. Covers function notation, evaluating in context, domain and range, discrete or continuous, growth and decay, average rate of change, and comparing functions.'),
  ('NC26.M1.ANFR.4', 'NC26.M1', 5, 'NCM1.ANFR.4', 'Algebraic, Numerical, and Functional Reasoning', 'Writing linear and exponential functions', 'Represent linear and exponential functions in several ways. Covers recursive rules for sequences, writing functions from situations, slope-intercept form, and choosing a linear or exponential model.'),
  ('NC26.M1.ANFR.5', 'NC26.M1', 6, 'NCM1.ANFR.5', 'Algebraic, Numerical, and Functional Reasoning', 'One-variable equations in context', 'Reason with linear and exponential equations and linear inequalities in one variable. Covers justifying solution steps, solving formulas for a quantity, writing exponential equations, solving them by graph and technology, and interpreting solutions.'),
  ('NC26.M1.ANFR.6', 'NC26.M1', 7, 'NCM1.ANFR.6', 'Algebraic, Numerical, and Functional Reasoning', 'Two-variable linear inequalities', 'Model situations with linear inequalities in two variables. Covers writing the inequality from a context, graphing its solutions with technology, and interpreting them.'),
  ('NC26.M1.ANFR.7', 'NC26.M1', 8, 'NCM1.ANFR.7', 'Algebraic, Numerical, and Functional Reasoning', 'Systems of linear equations', 'Reason with systems of linear equations and inequalities in context. Covers building a system from a situation, solving by graphing and by substitution, counting solutions, and interpreting them.'),
  ('NC26.M1.SGMR.1', 'NC26.M1', 9, 'NCM1.SGMR.1', 'Spatial, Geometric, and Measurement Reasoning', 'Rigid transformations and congruence', 'Apply rigid transformations to figures on the coordinate plane. Covers properties of rotations, reflections and translations, function notation, finding images and preimages, and showing congruence by a sequence of moves.'),
  ('NC26.M1.SGMR.2', 'NC26.M1', 10, 'NCM1.SGMR.2', 'Spatial, Geometric, and Measurement Reasoning', 'Triangle congruence', 'Apply the properties of triangle congruence. Covers developing congruence criteria from rigid motions and arguing whether two triangles are congruent.'),
  ('NC26.M1.SGMR.3', 'NC26.M1', 11, 'NCM1.SGMR.3', 'Spatial, Geometric, and Measurement Reasoning', 'Coordinate geometry', 'Analyse figures on the coordinate plane. Covers parallel and perpendicular lines and their equations, classifying triangles, quadrilaterals and parallelograms, midpoints, and perimeter and area from coordinates.'),
  ('NC26.M1.SDSR.1', 'NC26.M1', 12, 'NCM1.SDSR.1', 'Statistics and Data Science Reasoning', 'Contingency tables and probability', 'Investigate probability with two-way tables and sample spaces. Covers summarising categorical data in tables, finding missing entries, unions, intersections and complements, and joint and marginal probabilities.'),
  ('NC26.M1.SDSR.2', 'NC26.M1', 13, 'NCM1.SDSR.2', 'Statistics and Data Science Reasoning', 'Statistical questions, multivariate data', 'Pose statistical questions about real-world issues with multivariate data. Covers generating questions, telling statistical from non-statistical questions, and spotting sources of bias.'),
  ('NC26.M1.SDSR.3', 'NC26.M1', 14, 'NCM1.SDSR.3', 'Statistics and Data Science Reasoning', 'Explore multivariate datasets', 'Explore and evaluate datasets to investigate a question. Covers judging a source''s credibility, choosing relevant variables, and splitting data by a third variable to improve a model.'),
  ('NC26.M1.SDSR.4', 'NC26.M1', 15, 'NCM1.SDSR.4', 'Statistics and Data Science Reasoning', 'Scatter plots and visualizations', 'Create and interpret visualizations of multivariate data. Covers scatter plots, form, direction and strength, informal lines of best fit, and reading and critiquing non-standard displays.'),
  ('NC26.M1.SDSR.5', 'NC26.M1', 16, 'NCM1.SDSR.5', 'Statistics and Data Science Reasoning', 'Linear and exponential regression', 'Analyse relationships in quantitative data with regression. Covers least-squares lines, exponential models, correlation, residual plots, outliers, correlation versus causation, and making and judging predictions.'),
  ('NC26.M1.SDSR.6', 'NC26.M1', 17, 'NCM1.SDSR.6', 'Statistics and Data Science Reasoning', 'Communicate a statistical investigation', 'Communicate the statistical modeling process and its conclusions and limits. Covers evaluating the process, presenting conclusions, and critiquing claims in the media.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC26.M2.RMM.1', 'NC26.M2', 1, 'NCM2.RMM.1', 'Reasoning with Mathematics Modeling', 'Mathematical modeling cycle', 'Solve and defend real-world problems with the modeling cycle. Covers identifying a problem, naming quantities and assumptions, building and analysing a model, testing conjectures, revising, and explaining and critiquing models.'),
  ('NC26.M2.ANFR.1', 'NC26.M2', 2, 'NCM2.ANFR.1', 'Algebraic, Numerical, and Functional Reasoning', 'Factoring and completing the square', 'Rewrite polynomial expressions in equivalent forms. Covers factoring quadratics with area models, completing the square, and how factoring relates to multiplying polynomials.'),
  ('NC26.M2.ANFR.2', 'NC26.M2', 3, 'NCM2.ANFR.2', 'Algebraic, Numerical, and Functional Reasoning', 'Quadratic and reciprocal patterns', 'Analyse patterns of change across function types. Covers telling linear, exponential, quadratic and reciprocal relationships apart from each other and from other types, and predicting from graphs and tables.'),
  ('NC26.M2.ANFR.3', 'NC26.M2', 4, 'NCM2.ANFR.3', 'Algebraic, Numerical, and Functional Reasoning', 'Key features of quadratic functions', 'Interpret key features of quadratic and reciprocal functions. Covers parameters, inputs and outputs, domain and range, discrete or continuous, extrema, symmetry, zeros, average rate of change, and comparing function types.'),
  ('NC26.M2.ANFR.4', 'NC26.M2', 5, 'NCM2.ANFR.4', 'Algebraic, Numerical, and Functional Reasoning', 'Writing quadratic and reciprocal functions', 'Represent quadratic and reciprocal functions in several ways. Covers recursive rules for quadratic sequences, writing functions from situations, factored and vertex forms, zeros, and transforming parent functions.'),
  ('NC26.M2.ANFR.5', 'NC26.M2', 6, 'NCM2.ANFR.5', 'Algebraic, Numerical, and Functional Reasoning', 'Solve quadratic equations', 'Reason with quadratic and reciprocal equations and quadratic inequalities in one variable. Covers writing them from contexts, counting real solutions, solving by square roots, factoring and completing the square, technology, and interpreting solutions.'),
  ('NC26.M2.ANFR.6', 'NC26.M2', 7, 'NCM2.ANFR.6', 'Algebraic, Numerical, and Functional Reasoning', 'Linear-quadratic systems', 'Reason with systems of a linear and a quadratic equation in context. Covers building the system, solving it with technology, counting real solutions, and interpreting them.'),
  ('NC26.M2.SGMR.1', 'NC26.M2', 8, 'NCM2.SGMR.1', 'Spatial, Geometric, and Measurement Reasoning', 'Dilations and transformations', 'Apply rigid and non-rigid transformations on the coordinate plane. Covers comparing their effects, properties of dilations, function notation, finding images, centre and scale factor, and mapping one figure onto another.'),
  ('NC26.M2.SGMR.2', 'NC26.M2', 9, 'NCM2.SGMR.2', 'Spatial, Geometric, and Measurement Reasoning', 'Similarity and congruence', 'Use congruence and similarity to solve problems. Covers developing triangle similarity criteria, arguing whether triangles are congruent, similar or neither, and solving problems with similar figures.'),
  ('NC26.M2.SGMR.3', 'NC26.M2', 10, 'NCM2.SGMR.3', 'Spatial, Geometric, and Measurement Reasoning', 'Right triangle trigonometry', 'Apply proportional relationships in right triangles. Covers special right triangles from the Pythagorean Theorem, trigonometric ratios for acute angles, how the ratios relate, and writing equations with them.'),
  ('NC26.M2.SGMR.4', 'NC26.M2', 11, 'NCM2.SGMR.4', 'Spatial, Geometric, and Measurement Reasoning', 'Solve right triangles', 'Solve problems involving right triangles. Covers missing sides and angles with trigonometric ratios, special right triangles, and real-world problems with angles of elevation and depression.'),
  ('NC26.M2.SDSR.1', 'NC26.M2', 12, 'NCM2.SDSR.1', 'Statistics and Data Science Reasoning', 'Conditional probability and independence', 'Investigate conditional probability and independence. Covers finding and interpreting conditional probabilities from tables and diagrams, and arguing whether events are independent.'),
  ('NC26.M2.SDSR.2', 'NC26.M2', 13, 'NCM2.SDSR.2', 'Statistics and Data Science Reasoning', 'Statistical questions and bias', 'Pose and investigate statistical questions about real-world issues with multivariate data. Covers generating questions, telling statistical from non-statistical questions, and spotting sources of bias.'),
  ('NC26.M2.SDSR.3', 'NC26.M2', 14, 'NCM2.SDSR.3', 'Statistics and Data Science Reasoning', 'Evaluate multivariate datasets', 'Explore and evaluate datasets to investigate a question. Covers judging a source''s credibility, choosing relevant variables, and splitting data by a third variable to improve a model.'),
  ('NC26.M2.SDSR.4', 'NC26.M2', 15, 'NCM2.SDSR.4', 'Statistics and Data Science Reasoning', 'Visualize multivariate data', 'Create and interpret visualizations of multivariate data. Covers choosing displays including scatter plots, describing linear and non-linear relationships, and reading and critiquing non-standard displays.'),
  ('NC26.M2.SDSR.5', 'NC26.M2', 16, 'NCM2.SDSR.5', 'Statistics and Data Science Reasoning', 'Quadratic regression and model fit', 'Analyse relationships in data with linear, exponential and quadratic models. Covers quadratic regression, r and r², residual plots, outliers, correlation versus causation, interpreting models and judging predictions.'),
  ('NC26.M2.SDSR.6', 'NC26.M2', 17, 'NCM2.SDSR.6', 'Statistics and Data Science Reasoning', 'Report a statistical investigation', 'Communicate the statistical modeling process and its conclusions and limits. Covers evaluating the process, presenting conclusions, and critiquing claims in the media.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC26.ALR.NQ.1', 'NC26.ALR', 1, 'ALR.NQ.1', 'Number and Quantity', 'Matrix and vector operations', 'Operate with matrices and vectors. Covers adding, subtracting and multiplying matrices, when those operations are defined, vector operations including the dot product, and matrix inverses.'),
  ('NC26.ALR.NQ.2', 'NC26.ALR', 2, 'ALR.NQ.2', 'Number and Quantity', 'Matrices in context', 'Use matrices to model and solve problems. Covers representing situations with matrices, solving systems with an inverse matrix, interpreting results, and Leslie models and Markov chains.'),
  ('NC26.ALR.NQ.3', 'NC26.ALR', 3, 'ALR.NQ.3', 'Number and Quantity', 'Set theory and Venn diagrams', 'Model and solve problems with sets. Covers sets and subsets, unions, intersections, complements and differences, and solving problems with Venn diagrams.'),
  ('NC26.ALR.NQ.4', 'NC26.ALR', 4, 'ALR.NQ.4', 'Number and Quantity', 'Number theory and sets', 'Reason about statements in number theory and set theory. Covers the Euclidean algorithm for GCF and LCM, the Fundamental Theorem of Arithmetic, set equality, and arguments about primes, factors and parity.'),
  ('NC26.ALR.GT.1', 'NC26.ALR', 5, 'ALR.GT.1', 'Graph Theory', 'Graphs and networks', 'Model relationships with graph theory. Covers vertex-edge graphs, adjacency matrices and tables, Euler and Hamiltonian paths and circuits, and ranking with a complete digraph.'),
  ('NC26.ALR.GT.2', 'NC26.ALR', 6, 'ALR.GT.2', 'Graph Theory', 'Graph algorithms', 'Solve problems with graph algorithms. Covers critical path analysis, methods for the Traveling Salesperson Problem, vertex colouring, and minimum spanning trees with Kruskal''s and Prim''s algorithms.'),
  ('NC26.ALR.L.1', 'NC26.ALR', 7, 'ALR.L.1', 'Logic', 'Logic and truth tables', 'Use mathematical logic to model and solve problems. Covers truth tables, validity of arguments, tautologies and contradictions, Boolean logic circuits, and logical equivalence.'),
  ('NC26.ALR.MDMF.1', 'NC26.ALR', 8, 'ALR.MDMF.1', 'Modeling Decision Making and Fairness', 'Voting methods', 'Apply and analyse voting methods. Covers plurality, Borda count, pairwise comparison and elimination methods, defending a method, fairness criteria, and Arrow''s Impossibility Theorem.'),
  ('NC26.ALR.MDMF.2', 'NC26.ALR', 9, 'ALR.MDMF.2', 'Modeling Decision Making and Fairness', 'Weighted voting', 'Evaluate weighted voting systems. Covers the Banzhaf and Shapley-Shubik power indices, coalitions using subsets and permutations, and the fairness of real systems.'),
  ('NC26.ALR.MDMF.3', 'NC26.ALR', 10, 'ALR.MDMF.3', 'Modeling Decision Making and Fairness', 'Fair division', 'Solve problems with fair-division methods. Covers divider-chooser, lone-divider, lone-chooser, sealed bids and markers, and weighing their strengths and fairness.'),
  ('NC26.ALR.MDMF.4', 'NC26.ALR', 11, 'ALR.MDMF.4', 'Modeling Decision Making and Fairness', 'Apportionment methods', 'Evaluate methods for apportioning seats. Covers the Hamilton, Jefferson, Adams, Webster and Huntington-Hill methods and critiquing their fairness.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC26.ASDS.FSP.1', 'NC26.ASDS', 1, 'ASDS.FSP.1', 'Framing Statistical Problems', 'Frame statistical questions', 'Formulate and refine statistical questions that data can answer. Covers telling statistical questions apart, anticipating variability, refining questions for data and audience, and how framing shapes conclusions.'),
  ('NC26.ASDS.CCD.1', 'NC26.ASDS', 2, 'ASDS.CCD.1', 'Collecting and Creating Data', 'Design studies and surveys', 'Design and carry out data collection that limits bias. Covers random sampling in surveys and observational studies, random assignment in experiments, ethics, neutral instruments, and collecting with technology.'),
  ('NC26.ASDS.CCD.2', 'NC26.ASDS', 3, 'ASDS.CCD.2', 'Collecting and Creating Data', 'Sampling methods', 'Understand how sampling affects whether a sample represents a population. Covers populations versus samples, why we sample, random sampling, choosing a method, and how bias affects validity.'),
  ('NC26.ASDS.CCD.3', 'NC26.ASDS', 4, 'ASDS.CCD.3', 'Collecting and Creating Data', 'Collect and clean data', 'Collect and prepare original and secondary data for analysis. Covers generating data, compiling and organising existing data, cleaning datasets, and noting limitations and sources of bias.'),
  ('NC26.ASDS.CCD.4', 'NC26.ASDS', 5, 'ASDS.CCD.4', 'Collecting and Creating Data', 'Data ethics', 'Apply fairness, consent and representation when collecting data. Covers informed consent and the right to withdraw, risks of misrepresentation, and justifying ethical collection choices.'),
  ('NC26.ASDS.DV.1', 'NC26.ASDS', 6, 'ASDS.DV.1', 'Data Visualizations', 'Create data visualizations', 'Visualise multivariate data to find patterns and compare distributions. Covers choosing a display for the data and audience, building it with technology, and reading its key features.'),
  ('NC26.ASDS.DV.2', 'NC26.ASDS', 7, 'ASDS.DV.2', 'Data Visualizations', 'Critique data visualizations', 'Critique and improve visualizations. Covers how scales, axes, order, colour and aggregation affect reading, what different displays highlight, revising for clarity and accessibility, and judging published graphics.'),
  ('NC26.ASDS.AMD.1', 'NC26.ASDS', 8, 'ASDS.AMD.1', 'Analyzing and Modeling Data', 'Descriptive statistics', 'Summarise and compare distributions with descriptive statistics. Covers choosing numerical summaries, interpreting them in context, comparing centre, shape and spread, and measures of relative standing.'),
  ('NC26.ASDS.AMD.2', 'NC26.ASDS', 9, 'ASDS.AMD.2', 'Analyzing and Modeling Data', 'Statistical and probability models', 'Build and interpret models that describe data. Covers linear, exponential, quadratic and logistic models, parameters, residual plots, choosing a model, binomial and normal distributions, and z-scores.'),
  ('NC26.ASDS.AMD.3', 'NC26.ASDS', 10, 'ASDS.AMD.3', 'Analyzing and Modeling Data', 'Randomness and simulation', 'Use probability and random processes to model uncertainty. Covers the role of probability, simulation to estimate a mean or proportion with a margin of error, and testing differences between groups.'),
  ('NC26.ASDS.DCC.1', 'NC26.ASDS', 11, 'ASDS.DCC.1', 'Drawing Conclusions and Communicating', 'Present data insights', 'Communicate data insights to different audiences. Covers presentations that combine visuals with narrative and probabilistic language, and adapting the message to the audience.'),
  ('NC26.ASDS.DCC.2', 'NC26.ASDS', 12, 'ASDS.DCC.2', 'Drawing Conclusions and Communicating', 'Inference from samples', 'Draw and justify inferences about a population from sample data. Covers limits on generalising, informal inference by simulation, margins of error, and judging predicted values.'),
  ('NC26.ASDS.DCC.3', 'NC26.ASDS', 13, 'ASDS.DCC.3', 'Drawing Conclusions and Communicating', 'Evaluate data-based claims', 'Critique claims based on data and the limits of inference. Covers evidence from observational studies versus experiments and critiquing claims in media, research and policy.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC26.MSM.RMM.1', 'NC26.MSM', 1, 'MSM.RMM.1', 'Reasoning with Mathematical Modeling', 'The modeling process', 'Solve and defend real-world problems with the modeling cycle. Covers identifying a problem, naming quantities and assumptions, building and analysing a model, testing conjectures, revising, and explaining and critiquing models.'),
  ('NC26.MSM.RMM.2', 'NC26.MSM', 2, 'MSM.RMM.2', 'Reasoning with Mathematical Modeling', 'Choose a function type', 'Analyse patterns of change to choose a function model. Covers picking a function type from a context, defining variables and parameters, and a reasonable domain and range.'),
  ('NC26.MSM.RMM.3', 'NC26.MSM', 3, 'MSM.RMM.3', 'Reasoning with Mathematical Modeling', 'Build function models', 'Represent situations with polynomial, exponential, reciprocal, piecewise or logarithmic functions. Covers building polynomial and piecewise models, regression with technology, useful representations, and justifying the model chosen.'),
  ('NC26.MSM.RMM.4', 'NC26.MSM', 4, 'MSM.RMM.4', 'Reasoning with Mathematical Modeling', 'Interpret function models', 'Interpret a model''s key features and solutions in context. Covers inputs and outputs, solving equations and inequalities with technology, and key features of several function families.'),
  ('NC26.MSM.RSM.1', 'NC26.MSM', 5, 'MSM.RSM.1', 'Reasoning with Statistical Modeling', 'Plan a statistical investigation', 'Pose statistical questions and plan how to collect data. Covers writing questions, designing surveys and samples, anticipating variability, collecting and curating data, and noting limits and bias.'),
  ('NC26.MSM.RSM.2', 'NC26.MSM', 6, 'MSM.RSM.2', 'Reasoning with Statistical Modeling', 'Explore and summarize data', 'Explore collected data to investigate a question. Covers visualising quantitative and categorical data, reading displays, calculating and interpreting summaries, and comparing patterns with chance.'),
  ('NC26.MSM.RSM.3', 'NC26.MSM', 7, 'MSM.RSM.3', 'Reasoning with Statistical Modeling', 'Probability distributions for decisions', 'Use probability distributions to make decisions under uncertainty. Covers discrete, binomial and normal models, finding likelihoods, and justifying decisions with probability.'),
  ('NC26.MSM.RSM.4', 'NC26.MSM', 8, 'MSM.RSM.4', 'Reasoning with Statistical Modeling', 'Nonlinear regression models', 'Analyse relationships in multivariate data. Covers polynomial, exponential and logarithmic regression, judging fit with residuals, r and r², and drawing evidence-based conclusions.'),
  ('NC26.MSM.RSM.5', 'NC26.MSM', 9, 'MSM.RSM.5', 'Reasoning with Statistical Modeling', 'Communicate statistical findings', 'Summarise and communicate a statistical modeling investigation. Covers evaluating questions, plans and probability models, presenting conclusions with limitations, and critiquing other investigations.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

-- NC Math 2017 (nc-2017): 14 levels, 361 topics

INSERT INTO curricula (id, name, source, edition, description, source_url, sort) VALUES
  ('nc-2017', 'NC Math 2017', 'North Carolina Standard Course of Study', '2017', 'North Carolina''s K-12 mathematics standards as taught through 2027-28: kindergarten to grade 8 (adopted June 2017), NC Math 1 to 4 and Precalculus. One topic per numbered standard, grouped by domain.', 'https://docs.google.com/document/d/1ZCt83aTtuev58rHlZkakK989vziGI3eLk2xNXi8u_4o/', 3)
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name, source = excluded.source, edition = excluded.edition,
  description = excluded.description, source_url = excluded.source_url, sort = excluded.sort
  WHERE curricula.organization_id IS NULL;

INSERT INTO curriculum_levels (id, curriculum_id, code, name, stage, grade_band, description) VALUES
  ('NC17.K', 'nc-2017', 'Kindergarten', 'Kindergarten', 1001, 'Kindergarten', NULL),
  ('NC17.1', 'nc-2017', 'Grade 1', 'Grade 1', 1002, 'Grade 1', NULL),
  ('NC17.2', 'nc-2017', 'Grade 2', 'Grade 2', 1003, 'Grade 2', NULL),
  ('NC17.3', 'nc-2017', 'Grade 3', 'Grade 3', 1004, 'Grade 3', NULL),
  ('NC17.4', 'nc-2017', 'Grade 4', 'Grade 4', 1005, 'Grade 4', NULL),
  ('NC17.5', 'nc-2017', 'Grade 5', 'Grade 5', 1006, 'Grade 5', NULL),
  ('NC17.6', 'nc-2017', 'Grade 6', 'Grade 6', 1007, 'Grade 6', NULL),
  ('NC17.7', 'nc-2017', 'Grade 7', 'Grade 7', 1008, 'Grade 7', NULL),
  ('NC17.8', 'nc-2017', 'Grade 8', 'Grade 8', 1009, 'Grade 8', NULL),
  ('NC17.M1', 'nc-2017', 'NC Math 1', 'NC Math 1', 1010, 'High school', NULL),
  ('NC17.M2', 'nc-2017', 'NC Math 2', 'NC Math 2', 1011, 'High school', NULL),
  ('NC17.M3', 'nc-2017', 'NC Math 3', 'NC Math 3', 1012, 'High school', NULL),
  ('NC17.M4', 'nc-2017', 'NC Math 4', 'NC Math 4', 1013, 'High school', NULL),
  ('NC17.PC', 'nc-2017', 'Precalculus', 'Precalculus', 1014, 'High school', NULL)
ON CONFLICT (id) DO UPDATE SET
  curriculum_id = excluded.curriculum_id, code = excluded.code, name = excluded.name,
  stage = excluded.stage, grade_band = excluded.grade_band, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC17.K.CC.1', 'NC17.K', 1, 'NC.K.CC.1', 'Counting and Cardinality', 'Count to 100', 'Say the counting sequence to 100 by ones and by tens, noticing its patterns.'),
  ('NC17.K.CC.2', 'NC17.K', 2, 'NC.K.CC.2', 'Counting and Cardinality', 'Count on from any number', 'Continue counting forward from a given number instead of starting again at 1.'),
  ('NC17.K.CC.3', 'NC17.K', 3, 'NC.K.CC.3', 'Counting and Cardinality', 'Write numbers 0 to 20', 'Write the numerals 0 to 20 and use them to record how many objects there are, with 0 meaning none.'),
  ('NC17.K.CC.4', 'NC17.K', 4, 'NC.K.CC.4', 'Counting and Cardinality', 'Numbers and quantities', 'Connect counting to quantity through one-to-one correspondence, cardinality and recognising up to 5 objects at a glance.'),
  ('NC17.K.CC.5', 'NC17.K', 5, 'NC.K.CC.5', 'Counting and Cardinality', 'Count to answer how many', 'Count out up to 20 objects, name the number one more, and count objects in lines, arrays, circles and scattered groups.'),
  ('NC17.K.CC.6', 'NC17.K', 6, 'NC.K.CC.6', 'Counting and Cardinality', 'Compare groups of objects', 'Tell whether one group of up to 10 objects has more, fewer or the same number as another by matching or counting.'),
  ('NC17.K.CC.7', 'NC17.K', 7, 'NC.K.CC.7', 'Counting and Cardinality', 'Compare numbers to 10', 'Compare two written numerals between 1 and 10.'),
  ('NC17.K.OA.1', 'NC17.K', 8, 'NC.K.OA.1', 'Operations and Algebraic Thinking', 'Show addition and subtraction', 'Represent addition and subtraction within 10 with objects, fingers, drawings, actions, words or expressions, and connect the representations.'),
  ('NC17.K.OA.2', 'NC17.K', 9, 'NC.K.OA.2', 'Operations and Algebraic Thinking', 'Word problems within 10', 'Solve add-to, take-from and put-together/take-apart word problems within 10 using objects or drawings.'),
  ('NC17.K.OA.3', 'NC17.K', 10, 'NC.K.OA.3', 'Operations and Algebraic Thinking', 'Break apart numbers to 10', 'Split numbers up to 10 into pairs in more than one way and record each split with a drawing or expression.'),
  ('NC17.K.OA.4', 'NC17.K', 11, 'NC.K.OA.4', 'Operations and Algebraic Thinking', 'Make ten', 'Find the number that makes 10 with any number from 0 to 10, using objects or drawings, and record it.'),
  ('NC17.K.OA.6', 'NC17.K', 12, 'NC.K.OA.6', 'Operations and Algebraic Thinking', 'See small groups combined', 'Recognise and combine small groups with totals up to 5 without counting one by one.'),
  ('NC17.K.OA.5', 'NC17.K', 13, 'NC.K.OA.5', 'Operations and Algebraic Thinking', 'Add and subtract within 5', 'Add and subtract within 5 quickly and accurately.'),
  ('NC17.K.NBT.1', 'NC17.K', 14, 'NC.K.NBT.1', 'Number and Operations in Base Ten', 'Teen numbers as ten and ones', 'Build and break apart the numbers 11 to 19 as ten ones and some more ones, and record them.'),
  ('NC17.K.MD.1', 'NC17.K', 15, 'NC.K.MD.1', 'Measurement and Data', 'Measurable attributes', 'Describe the measurable attributes of objects, including several attributes of one object.'),
  ('NC17.K.MD.2', 'NC17.K', 16, 'NC.K.MD.2', 'Measurement and Data', 'Compare two objects directly', 'Compare two objects by a shared attribute to see which has more or less of it, and describe the difference.'),
  ('NC17.K.MD.3', 'NC17.K', 17, 'NC.K.MD.3', 'Measurement and Data', 'Sort and count by category', 'Sort objects into categories, count each category and order the categories by count.'),
  ('NC17.K.G.1', 'NC17.K', 18, 'NC.K.G.1', 'Geometry', 'Shapes and positions', 'Name shapes seen in the environment and describe where objects are using position words.'),
  ('NC17.K.G.2', 'NC17.K', 19, 'NC.K.G.2', 'Geometry', 'Name shapes', 'Name common flat and solid shapes correctly whatever their size or orientation.'),
  ('NC17.K.G.3', 'NC17.K', 20, 'NC.K.G.3', 'Geometry', 'Flat and solid shapes', 'Identify common shapes as two-dimensional or three-dimensional.'),
  ('NC17.K.G.4', 'NC17.K', 21, 'NC.K.G.4', 'Geometry', 'Compare shapes', 'Compare flat and solid shapes of different sizes and orientations, describing likenesses, differences and attributes in everyday language.'),
  ('NC17.K.G.5', 'NC17.K', 22, 'NC.K.G.5', 'Geometry', 'Build and draw shapes', 'Model shapes from the world by building and drawing flat shapes and building solid ones.'),
  ('NC17.K.G.6', 'NC17.K', 23, 'NC.K.G.6', 'Geometry', 'Compose larger shapes', 'Put simple shapes together to make larger shapes.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC17.1.OA.1', 'NC17.1', 1, 'NC.1.OA.1', 'Operations and Algebraic Thinking', 'Word problems within 20', 'Represent and solve addition and subtraction word problems within 20 with unknowns in different positions, using objects, drawings and equations.'),
  ('NC17.1.OA.2', 'NC17.1', 2, 'NC.1.OA.2', 'Operations and Algebraic Thinking', 'Add three numbers in problems', 'Represent and solve word problems adding three whole numbers with a sum up to 20.'),
  ('NC17.1.OA.3', 'NC17.1', 3, 'NC.1.OA.3', 'Operations and Algebraic Thinking', 'Properties of addition', 'Use the commutative and associative properties as strategies when adding.'),
  ('NC17.1.OA.4', 'NC17.1', 4, 'NC.1.OA.4', 'Operations and Algebraic Thinking', 'Unknown addend problems', 'Solve missing-addend problems within 20 by adding on or by turning them into subtraction.'),
  ('NC17.1.OA.9', 'NC17.1', 5, 'NC.1.OA.9', 'Operations and Algebraic Thinking', 'Add and subtract within 10', 'Add and subtract within 10 fluently.'),
  ('NC17.1.OA.6', 'NC17.1', 6, 'NC.1.OA.6', 'Operations and Algebraic Thinking', 'Strategies within 20', 'Add and subtract within 20 using strategies such as counting on, making ten, number lines and related facts.'),
  ('NC17.1.OA.7', 'NC17.1', 7, 'NC.1.OA.7', 'Operations and Algebraic Thinking', 'Meaning of the equal sign', 'Use the meaning of the equal sign to decide whether addition and subtraction equations are true.'),
  ('NC17.1.OA.8', 'NC17.1', 8, 'NC.1.OA.8', 'Operations and Algebraic Thinking', 'Find the unknown number', 'Find the missing whole number in an addition or subtraction equation relating three numbers.'),
  ('NC17.1.NBT.1', 'NC17.1', 9, 'NC.1.NBT.1', 'Number and Operations in Base Ten', 'Count to 150', 'Count up to 150 starting from any number below 150.'),
  ('NC17.1.NBT.7', 'NC17.1', 10, 'NC.1.NBT.7', 'Number and Operations in Base Ten', 'Read and write numbers to 100', 'Read and write numerals to 100 and use them to record a number of objects.'),
  ('NC17.1.NBT.2', 'NC17.1', 11, 'NC.1.NBT.2', 'Number and Operations in Base Ten', 'Tens and ones', 'Understand a two-digit number as tens and ones, including making a ten from ten ones and the decade numbers.'),
  ('NC17.1.NBT.3', 'NC17.1', 12, 'NC.1.NBT.3', 'Number and Operations in Base Ten', 'Compare two-digit numbers', 'Compare two-digit numbers by their tens and ones and record the result with >, = or <.'),
  ('NC17.1.NBT.4', 'NC17.1', 13, 'NC.1.NBT.4', 'Number and Operations in Base Ten', 'Add within 100', 'Add a one-digit number or a multiple of 10 to a two-digit number using models and place-value strategies, explaining the reasoning.'),
  ('NC17.1.NBT.5', 'NC17.1', 14, 'NC.1.NBT.5', 'Number and Operations in Base Ten', 'Ten more and ten less', 'Mentally find 10 more or 10 less than a two-digit number and explain how.'),
  ('NC17.1.NBT.6', 'NC17.1', 15, 'NC.1.NBT.6', 'Number and Operations in Base Ten', 'Subtract multiples of 10', 'Subtract multiples of 10 from 10 to 90 using models, number lines and place-value strategies, explaining the reasoning.'),
  ('NC17.1.MD.1', 'NC17.1', 16, 'NC.1.MD.1', 'Measurement and Data', 'Order and compare lengths', 'Order three objects by length and compare two lengths indirectly using a third object.'),
  ('NC17.1.MD.2', 'NC17.1', 17, 'NC.1.MD.2', 'Measurement and Data', 'Measure with non-standard units', 'Measure length by laying copies of a shorter unit end to end and state it as a whole number of units.'),
  ('NC17.1.MD.3', 'NC17.1', 18, 'NC.1.MD.3', 'Measurement and Data', 'Time to the half hour', 'Tell and write time in hours and half hours on analog and digital clocks.'),
  ('NC17.1.MD.5', 'NC17.1', 19, 'NC.1.MD.5', 'Measurement and Data', 'Coins and their values', 'Identify quarters, dimes and nickels and relate their values to pennies.'),
  ('NC17.1.MD.4', 'NC17.1', 20, 'NC.1.MD.4', 'Measurement and Data', 'Data with three categories', 'Organise, show and answer questions about data in up to three categories.'),
  ('NC17.1.G.1', 'NC17.1', 21, 'NC.1.G.1', 'Geometry', 'Attributes of shapes', 'Tell defining from non-defining attributes and build and draw flat and solid shapes with given attributes.'),
  ('NC17.1.G.2', 'NC17.1', 22, 'NC.1.G.2', 'Geometry', 'Composite shapes', 'Make flat and solid composite shapes from simpler shapes and name their parts.'),
  ('NC17.1.G.3', 'NC17.1', 23, 'NC.1.G.3', 'Geometry', 'Halves and fourths', 'Split circles and rectangles into two or four equal shares, name them as halves and fourths, and see that more shares are smaller.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC17.2.OA.1', 'NC17.2', 1, 'NC.2.OA.1', 'Operations and Algebraic Thinking', 'Word problems within 100', 'Represent and solve one- and two-step addition and subtraction word problems within 100 with unknowns in all positions.'),
  ('NC17.2.OA.2', 'NC17.2', 2, 'NC.2.OA.2', 'Operations and Algebraic Thinking', 'Mental math within 20', 'Add and subtract within 20 fluently using mental strategies.'),
  ('NC17.2.OA.3', 'NC17.2', 3, 'NC.2.OA.3', 'Operations and Algebraic Thinking', 'Odd and even numbers', 'Decide whether a group of up to 20 objects is odd or even by pairing, splitting into two equal groups, or writing a doubles equation.'),
  ('NC17.2.OA.4', 'NC17.2', 4, 'NC.2.OA.4', 'Operations and Algebraic Thinking', 'Arrays and repeated addition', 'Use addition to total objects in arrays of up to 5 by 5 and write the total as a sum of equal addends.'),
  ('NC17.2.NBT.1', 'NC17.2', 5, 'NC.2.NBT.1', 'Number and Operations in Base Ten', 'Hundreds, tens and ones', 'Understand a three-digit number as hundreds, tens and ones, including making a hundred from ten tens and regrouping.'),
  ('NC17.2.NBT.2', 'NC17.2', 6, 'NC.2.NBT.2', 'Number and Operations in Base Ten', 'Count and skip-count to 1000', 'Count within 1000 and skip-count by 5s, 10s and 100s.'),
  ('NC17.2.NBT.3', 'NC17.2', 7, 'NC.2.NBT.3', 'Number and Operations in Base Ten', 'Read and write numbers to 1000', 'Read and write numbers within 1000 as numerals, in words and in expanded form.'),
  ('NC17.2.NBT.4', 'NC17.2', 8, 'NC.2.NBT.4', 'Number and Operations in Base Ten', 'Compare three-digit numbers', 'Compare three-digit numbers by their hundreds, tens and ones and record with >, = or <.'),
  ('NC17.2.NBT.5', 'NC17.2', 9, 'NC.2.NBT.5', 'Number and Operations in Base Ten', 'Add and subtract within 100', 'Add and subtract within 100 fluently, choosing and comparing place-value and property-based strategies.'),
  ('NC17.2.NBT.6', 'NC17.2', 10, 'NC.2.NBT.6', 'Number and Operations in Base Ten', 'Add up to three numbers', 'Add up to three two-digit numbers using place value and properties of operations.'),
  ('NC17.2.NBT.7', 'NC17.2', 11, 'NC.2.NBT.7', 'Number and Operations in Base Ten', 'Add and subtract within 1000', 'Add and subtract within 1000 with models and place-value strategies, linking each strategy to a written method.'),
  ('NC17.2.NBT.8', 'NC17.2', 12, 'NC.2.NBT.8', 'Number and Operations in Base Ten', 'Add or subtract 10 and 100', 'Mentally add or subtract 10 or 100 to or from numbers between 100 and 900.'),
  ('NC17.2.MD.1', 'NC17.2', 13, 'NC.2.MD.1', 'Measurement and Data', 'Measure with standard tools', 'Measure lengths in standard units choosing tools such as rulers, yardsticks, meter sticks and tape measures.'),
  ('NC17.2.MD.2', 'NC17.2', 14, 'NC.2.MD.2', 'Measurement and Data', 'Measure with two units', 'Measure one object in two different units and explain how the measurements relate to the unit size.'),
  ('NC17.2.MD.3', 'NC17.2', 15, 'NC.2.MD.3', 'Measurement and Data', 'Estimate lengths', 'Estimate lengths in inches, feet, yards, centimeters and meters.'),
  ('NC17.2.MD.4', 'NC17.2', 16, 'NC.2.MD.4', 'Measurement and Data', 'Compare lengths', 'Measure how much longer one object is than another in a standard unit.'),
  ('NC17.2.MD.5', 'NC17.2', 17, 'NC.2.MD.5', 'Measurement and Data', 'Length word problems', 'Solve addition and subtraction word problems about lengths within 100, using equations with an unknown.'),
  ('NC17.2.MD.6', 'NC17.2', 18, 'NC.2.MD.6', 'Measurement and Data', 'Number line diagrams', 'Show whole numbers as lengths from 0 on a number line and show sums and differences within 100 on it.'),
  ('NC17.2.MD.7', 'NC17.2', 19, 'NC.2.MD.7', 'Measurement and Data', 'Time to five minutes', 'Tell and write time to the nearest five minutes on analog and digital clocks, using a.m. and p.m.'),
  ('NC17.2.MD.8', 'NC17.2', 20, 'NC.2.MD.8', 'Measurement and Data', 'Money word problems', 'Solve word problems with coins up to 99 cents and with whole dollars, using the cent and dollar symbols.'),
  ('NC17.2.MD.10', 'NC17.2', 21, 'NC.2.MD.10', 'Measurement and Data', 'Picture and bar graphs', 'Organise data in up to four categories in picture and bar graphs and solve simple problems from them.'),
  ('NC17.2.G.1', 'NC17.2', 22, 'NC.2.G.1', 'Geometry', 'Polygons and solids', 'Recognise and draw triangles, quadrilaterals, pentagons and hexagons with given attributes, and describe rectangular prisms and cubes.'),
  ('NC17.2.G.3', 'NC17.2', 23, 'NC.2.G.3', 'Geometry', 'Halves, thirds and fourths', 'Split circles and rectangles into two, three or four equal shares, name them, and see that equal shares can differ in shape.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC17.3.OA.1', 'NC17.3', 1, 'NC.3.OA.1', 'Operations and Algebraic Thinking', 'Meaning of multiplication', 'Interpret products of factors up to 10 as equal groups and explain strategies such as arrays, repeated addition and the properties.'),
  ('NC17.3.OA.2', 'NC17.3', 2, 'NC.3.OA.2', 'Operations and Algebraic Thinking', 'Meaning of division', 'Interpret one-digit quotients as group counts or group sizes and explain strategies such as arrays and repeated subtraction.'),
  ('NC17.3.OA.3', 'NC17.3', 3, 'NC.3.OA.3', 'Operations and Algebraic Thinking', 'Multiplication and division problems', 'Represent and solve one-step multiplication and division word problems with factors and divisors up to 10.'),
  ('NC17.3.OA.6', 'NC17.3', 4, 'NC.3.OA.6', 'Operations and Algebraic Thinking', 'Unknown factor problems', 'Solve unknown-factor problems with division strategies or by turning them into multiplication.'),
  ('NC17.3.OA.7', 'NC17.3', 5, 'NC.3.OA.7', 'Operations and Algebraic Thinking', 'Multiply and divide within 100', 'Multiply and divide fluently with factors up to 10, knowing the products from memory and using the link between the operations.'),
  ('NC17.3.OA.8', 'NC17.3', 6, 'NC.3.OA.8', 'Operations and Algebraic Thinking', 'Two-step word problems', 'Solve two-step word problems with addition, subtraction and multiplication, writing equations with an unknown.'),
  ('NC17.3.OA.9', 'NC17.3', 7, 'NC.3.OA.9', 'Operations and Algebraic Thinking', 'Multiplication patterns', 'Find and explain patterns on a hundreds board or a multiplication table.'),
  ('NC17.3.NBT.2', 'NC17.3', 8, 'NC.3.NBT.2', 'Number and Operations in Base Ten', 'Add and subtract to 1,000', 'Add and subtract whole numbers up to 1,000, estimating to check answers and using expanded form and inverse operations.'),
  ('NC17.3.NBT.3', 'NC17.3', 9, 'NC.3.NBT.3', 'Number and Operations in Base Ten', 'Multiply by multiples of 10', 'Multiply a one-digit number by a multiple of 10 from 10 to 90 using models based on place value and properties.'),
  ('NC17.3.NF.1', 'NC17.3', 10, 'NC.3.NF.1', 'Number and Operations – Fractions', 'Unit fractions', 'Understand a unit fraction with denominator 2, 3, 4, 6 or 8 as one equal part of a whole, using area and length models.'),
  ('NC17.3.NF.2', 'NC17.3', 11, 'NC.3.NF.2', 'Number and Operations – Fractions', 'Fractions on models', 'Interpret fractions as counts of unit fractions using area models and the number line.'),
  ('NC17.3.NF.3', 'NC17.3', 12, 'NC.3.NF.3', 'Number and Operations – Fractions', 'Equivalent fractions', 'Show equivalent fractions with area and length models, including fractions equal to one and to whole numbers.'),
  ('NC17.3.NF.4', 'NC17.3', 13, 'NC.3.NF.4', 'Number and Operations – Fractions', 'Compare fractions', 'Compare fractions with the same numerator or denominator by reasoning about size, recording with >, < or =, for the same whole.'),
  ('NC17.3.MD.1', 'NC17.3', 14, 'NC.3.MD.1', 'Measurement and Data', 'Time to the minute', 'Tell and write time to the nearest minute and solve problems about elapsed time within one hour.'),
  ('NC17.3.MD.2', 'NC17.3', 15, 'NC.3.MD.2', 'Measurement and Data', 'Customary measurement', 'Estimate and measure length, capacity and weight in customary units and solve one-step problems with them.'),
  ('NC17.3.MD.3', 'NC17.3', 16, 'NC.3.MD.3', 'Measurement and Data', 'Scaled picture and bar graphs', 'Collect data, show it in frequency tables and scaled graphs, and answer how-many-more and how-many-less questions.'),
  ('NC17.3.MD.5', 'NC17.3', 17, 'NC.3.MD.5', 'Measurement and Data', 'Area by tiling', 'Find the area of a rectangle by covering it with unit squares and counting them.'),
  ('NC17.3.MD.7', 'NC17.3', 18, 'NC.3.MD.7', 'Measurement and Data', 'Area and multiplication', 'Relate area to multiplication and addition, including splitting a rectangle into two smaller ones.'),
  ('NC17.3.MD.8', 'NC17.3', 19, 'NC.3.MD.8', 'Measurement and Data', 'Perimeter of polygons', 'Find the perimeter of a polygon from its sides and find an unknown side from the perimeter.'),
  ('NC17.3.G.1', 'NC17.3', 20, 'NC.3.G.1', 'Geometry', 'Compose and classify quadrilaterals', 'Reason about composing and decomposing triangles and quadrilaterals and draw examples of each type of quadrilateral.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC17.4.OA.1', 'NC17.4', 1, 'NC.4.OA.1', 'Operations and Algebraic Thinking', 'Multiplicative comparison', 'Interpret multiplication as comparison and solve such word problems, telling them apart from additive comparisons.'),
  ('NC17.4.OA.3', 'NC17.4', 2, 'NC.4.OA.3', 'Operations and Algebraic Thinking', 'Multi-step word problems', 'Solve two-step whole-number word problems with all four operations, interpreting remainders and checking by estimation.'),
  ('NC17.4.OA.4', 'NC17.4', 3, 'NC.4.OA.4', 'Operations and Algebraic Thinking', 'Factors, multiples and primes', 'Find factor pairs up to 50 and use them to identify multiples and prime or composite numbers.'),
  ('NC17.4.OA.5', 'NC17.4', 4, 'NC.4.OA.5', 'Operations and Algebraic Thinking', 'Number and shape patterns', 'Generate and analyse a number or shape pattern that follows a rule.'),
  ('NC17.4.NBT.1', 'NC17.4', 5, 'NC.4.NBT.1', 'Number and Operations in Base Ten', 'Place value to 100,000', 'Explain that each place is worth ten times the place to its right in whole numbers up to 100,000.'),
  ('NC17.4.NBT.2', 'NC17.4', 6, 'NC.4.NBT.2', 'Number and Operations in Base Ten', 'Read and write large numbers', 'Read and write whole numbers to 100,000 in numerals, words and expanded form.'),
  ('NC17.4.NBT.7', 'NC17.4', 7, 'NC.4.NBT.7', 'Number and Operations in Base Ten', 'Compare multi-digit numbers', 'Compare whole numbers up to 100,000 by place value and record with >, = or <.'),
  ('NC17.4.NBT.4', 'NC17.4', 8, 'NC.4.NBT.4', 'Number and Operations in Base Ten', 'Standard algorithm for add and subtract', 'Add and subtract whole numbers up to 100,000 with the standard algorithm and place-value understanding.'),
  ('NC17.4.NBT.5', 'NC17.4', 9, 'NC.4.NBT.5', 'Number and Operations in Base Ten', 'Multi-digit multiplication', 'Multiply up to three digits by one digit and two digits by two digits with area models and partial products, building toward the algorithm.'),
  ('NC17.4.NBT.6', 'NC17.4', 10, 'NC.4.NBT.6', 'Number and Operations in Base Ten', 'Division with remainders', 'Divide up to three-digit numbers by one-digit numbers, finding quotients and remainders with arrays, area models and partial quotients.'),
  ('NC17.4.NF.1', 'NC17.4', 11, 'NC.4.NF.1', 'Number and Operations – Fractions', 'Why fractions are equivalent', 'Explain with area and length models why two fractions are equivalent although their parts differ.'),
  ('NC17.4.NF.2', 'NC17.4', 12, 'NC.4.NF.2', 'Number and Operations – Fractions', 'Compare unlike fractions', 'Compare fractions with different numerators and denominators using models, benchmarks or common terms, and justify the result.'),
  ('NC17.4.NF.3', 'NC17.4', 13, 'NC.4.NF.3', 'Number and Operations – Fractions', 'Add and subtract like fractions', 'Decompose fractions and add and subtract fractions and mixed numbers with like denominators, including word problems.'),
  ('NC17.4.NF.4', 'NC17.4', 14, 'NC.4.NF.4', 'Number and Operations – Fractions', 'Multiply a fraction by a whole', 'Multiply a whole number by a fraction and solve word problems involving it.'),
  ('NC17.4.NF.6', 'NC17.4', 15, 'NC.4.NF.6', 'Number and Operations – Fractions', 'Decimal notation for fractions', 'Relate tenths and hundredths as fractions and decimals, and add fractions with denominators 10 and 100.'),
  ('NC17.4.NF.7', 'NC17.4', 16, 'NC.4.NF.7', 'Number and Operations – Fractions', 'Compare decimals', 'Compare decimals to hundredths by reasoning about size with models, recording with >, = or <.'),
  ('NC17.4.MD.1', 'NC17.4', 17, 'NC.4.MD.1', 'Measurement and Data', 'Metric measurement', 'Know the relative sizes of metric units and solve one-step problems with metric length, mass and capacity.'),
  ('NC17.4.MD.2', 'NC17.4', 18, 'NC.4.MD.2', 'Measurement and Data', 'Convert metric units', 'Convert metric measurements from a larger unit to a smaller one using place value, tables and length models.'),
  ('NC17.4.MD.8', 'NC17.4', 19, 'NC.4.MD.8', 'Measurement and Data', 'Elapsed time across the hour', 'Solve word problems adding and subtracting time intervals that cross the hour.'),
  ('NC17.4.MD.3', 'NC17.4', 20, 'NC.4.MD.3', 'Measurement and Data', 'Area and perimeter problems', 'Find areas of rectilinear figures and solve area and perimeter problems, including fixed area or fixed perimeter.'),
  ('NC17.4.MD.4', 'NC17.4', 21, 'NC.4.MD.4', 'Measurement and Data', 'Line plots and data', 'Collect numerical data, show it in tables, bar graphs or line plots, and tell categorical from numerical questions.'),
  ('NC17.4.MD.6', 'NC17.4', 22, 'NC.4.MD.6', 'Measurement and Data', 'Angles and protractors', 'Understand angles as measured in degrees, measure and sketch them with a protractor, and find unknown angles.'),
  ('NC17.4.G.1', 'NC17.4', 23, 'NC.4.G.1', 'Geometry', 'Lines, rays and angles', 'Draw and identify points, lines, segments, rays, angles, and parallel and perpendicular lines.'),
  ('NC17.4.G.2', 'NC17.4', 24, 'NC.4.G.2', 'Geometry', 'Classify triangles and quadrilaterals', 'Classify triangles and quadrilaterals by angles, sides, and parallel or perpendicular lines.'),
  ('NC17.4.G.3', 'NC17.4', 25, 'NC.4.G.3', 'Geometry', 'Lines of symmetry', 'Recognise symmetry in flat figures and identify and draw lines of symmetry.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC17.5.OA.2', 'NC17.5', 1, 'NC.5.OA.2', 'Operations and Algebraic Thinking', 'Numerical expressions', 'Write, explain and evaluate expressions with parentheses and the properties to solve up to two-step problems.'),
  ('NC17.5.OA.3', 'NC17.5', 2, 'NC.5.OA.3', 'Operations and Algebraic Thinking', 'Patterns and ordered pairs', 'Generate two patterns from rules, relate their terms, and graph the resulting ordered pairs.'),
  ('NC17.5.NBT.1', 'NC17.5', 3, 'NC.5.NBT.1', 'Number and Operations in Base Ten', 'Place value patterns', 'Explain place-value patterns from millions to thousandths, including multiplying and dividing by powers of ten.'),
  ('NC17.5.NBT.3', 'NC17.5', 4, 'NC.5.NBT.3', 'Number and Operations in Base Ten', 'Decimals to thousandths', 'Read, write and compare decimals to thousandths in numerals, words and expanded form.'),
  ('NC17.5.NBT.5', 'NC17.5', 5, 'NC.5.NBT.5', 'Number and Operations in Base Ten', 'Standard algorithm for multiplication', 'Multiply up to a three-digit number by a two-digit number fluently with the standard algorithm.'),
  ('NC17.5.NBT.6', 'NC17.5', 6, 'NC.5.NBT.6', 'Number and Operations in Base Ten', 'Divide by two-digit numbers', 'Divide up to four-digit numbers by two-digit numbers, finding quotients and remainders with models and partial quotients.'),
  ('NC17.5.NBT.7', 'NC17.5', 7, 'NC.5.NBT.7', 'Number and Operations in Base Ten', 'Operations with decimals', 'Add, subtract, multiply and divide with decimals using models and place-value strategies, checking by estimation.'),
  ('NC17.5.NF.1', 'NC17.5', 8, 'NC.5.NF.1', 'Number and Operations – Fractions', 'Add and subtract unlike fractions', 'Add and subtract fractions and mixed numbers with related unlike denominators, estimating and solving word problems.'),
  ('NC17.5.NF.3', 'NC17.5', 9, 'NC.5.NF.3', 'Number and Operations – Fractions', 'Fractions as division', 'Interpret a fraction as division of the numerator by the denominator and solve sharing problems with fractional answers.'),
  ('NC17.5.NF.4', 'NC17.5', 10, 'NC.5.NF.4', 'Number and Operations – Fractions', 'Multiply fractions', 'Multiply fractions and mixed numbers using area and length models, reasoning about the size of the product.'),
  ('NC17.5.NF.7', 'NC17.5', 11, 'NC.5.NF.7', 'Number and Operations – Fractions', 'Divide with unit fractions', 'Solve problems dividing unit fractions by whole numbers and whole numbers by unit fractions with models and equations.'),
  ('NC17.5.MD.1', 'NC17.5', 12, 'NC.5.MD.1', 'Measurement and Data', 'Convert measurement units', 'Use a conversion chart and multiplication to convert units within one measurement system.'),
  ('NC17.5.MD.2', 'NC17.5', 13, 'NC.5.MD.2', 'Measurement and Data', 'Line graphs', 'Collect data that changes over time, show and read it on a line graph, and classify survey questions by the data they yield.'),
  ('NC17.5.MD.4', 'NC17.5', 14, 'NC.5.MD.4', 'Measurement and Data', 'Volume with unit cubes', 'Recognise volume and measure it by counting unit cubes in standard and improvised units.'),
  ('NC17.5.MD.5', 'NC17.5', 15, 'NC.5.MD.5', 'Measurement and Data', 'Volume of rectangular prisms', 'Relate volume to multiplication and addition, use the prism volume formula, and find volumes of two joined prisms.'),
  ('NC17.5.G.1', 'NC17.5', 16, 'NC.5.G.1', 'Geometry', 'Coordinate plane, first quadrant', 'Graph points in the first quadrant and use their coordinates to solve problems.'),
  ('NC17.5.G.3', 'NC17.5', 17, 'NC.5.G.3', 'Geometry', 'Hierarchy of quadrilaterals', 'Classify quadrilaterals in a hierarchy, knowing that a category''s attributes belong to all its subcategories.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC17.6.RP.1', 'NC17.6', 1, 'NC.6.RP.1', 'Ratio and Proportional Relationships', 'Ratios and ratio language', 'Understand a ratio as a multiplicative relationship between two quantities and model it in several ways.'),
  ('NC17.6.RP.2', 'NC17.6', 2, 'NC.6.RP.2', 'Ratio and Proportional Relationships', 'Unit ratios', 'Express ratios as equivalent unit ratios and interpret both unit ratios in context.'),
  ('NC17.6.RP.3', 'NC17.6', 3, 'NC.6.RP.3', 'Ratio and Proportional Relationships', 'Ratio tables and reasoning', 'Solve ratio problems with tables, unit ratios, measurement conversions and graphs of value pairs.'),
  ('NC17.6.RP.4', 'NC17.6', 4, 'NC.6.RP.4', 'Ratio and Proportional Relationships', 'Percent of a quantity', 'Solve percent problems as ratios per 100, using benchmark percents and finding the whole from a part.'),
  ('NC17.6.NS.1', 'NC17.6', 5, 'NC.6.NS.1', 'The Number System', 'Divide fractions', 'Interpret and compute quotients of fractions with visual models and common denominators, including word problems.'),
  ('NC17.6.NS.2', 'NC17.6', 6, 'NC.6.NS.2', 'The Number System', 'Long division', 'Divide fluently with long division using at least four-digit dividends and interpret the quotient and remainder.'),
  ('NC17.6.NS.3', 'NC17.6', 7, 'NC.6.NS.3', 'The Number System', 'Decimal algorithms', 'Use the standard algorithms fluently to add, subtract, multiply and divide decimals.'),
  ('NC17.6.NS.4', 'NC17.6', 8, 'NC.6.NS.4', 'The Number System', 'Factors, GCF and LCM', 'Use prime factorisation, greatest common factor and least common multiple, including with the distributive property and fractions.'),
  ('NC17.6.NS.5', 'NC17.6', 9, 'NC.6.NS.5', 'The Number System', 'Rational numbers and absolute value', 'Use positive and negative numbers for opposite quantities, explain zero in context, and interpret absolute value as magnitude.'),
  ('NC17.6.NS.6', 'NC17.6', 10, 'NC.6.NS.6', 'The Number System', 'Rational numbers on a plane', 'Place rational numbers on a number line and ordered pairs in the coordinate plane, relating signs to locations and reflections.'),
  ('NC17.6.NS.7', 'NC17.6', 11, 'NC.6.NS.7', 'The Number System', 'Order rational numbers', 'Interpret and write inequality statements about rational numbers in context and on the number line.'),
  ('NC17.6.NS.8', 'NC17.6', 12, 'NC.6.NS.8', 'The Number System', 'Graph in four quadrants', 'Solve problems by graphing points in all four quadrants and finding horizontal and vertical distances.'),
  ('NC17.6.NS.9', 'NC17.6', 13, 'NC.6.NS.9', 'The Number System', 'Add and subtract integers', 'Add and subtract integers from -20 to 20 with models, using zero pairs and subtraction as adding the opposite.'),
  ('NC17.6.EE.1', 'NC17.6', 14, 'NC.6.EE.1', 'Expressions and Equations', 'Expressions with exponents', 'Write and evaluate numerical expressions with whole-number exponents, with and without grouping symbols.'),
  ('NC17.6.EE.2', 'NC17.6', 15, 'NC.6.EE.2', 'Expressions and Equations', 'Algebraic expressions', 'Write, read and evaluate algebraic expressions, naming their parts and substituting values from formulas.'),
  ('NC17.6.EE.3', 'NC17.6', 16, 'NC.6.EE.3', 'Expressions and Equations', 'Generate equivalent expressions', 'Use the properties of operations to write equivalent expressions without exponents.'),
  ('NC17.6.EE.4', 'NC17.6', 17, 'NC.6.EE.4', 'Expressions and Equations', 'Identify equivalent expressions', 'Tell when two expressions are equivalent and justify it with reasoning.'),
  ('NC17.6.EE.5', 'NC17.6', 18, 'NC.6.EE.5', 'Expressions and Equations', 'Solutions by substitution', 'Substitute values from a set to decide which make an equation true.'),
  ('NC17.6.EE.6', 'NC17.6', 19, 'NC.6.EE.6', 'Expressions and Equations', 'Variables in expressions', 'Use variables to stand for numbers and write expressions when solving problems.'),
  ('NC17.6.EE.7', 'NC17.6', 20, 'NC.6.EE.7', 'Expressions and Equations', 'One-step equations', 'Write and solve equations of the form x + p = q and px = q with nonnegative rational numbers.'),
  ('NC17.6.EE.8', 'NC17.6', 21, 'NC.6.EE.8', 'Expressions and Equations', 'Write and graph inequalities', 'Test values in inequalities, write x > c or x < c for constraints, and graph their many solutions on a number line.'),
  ('NC17.6.EE.9', 'NC17.6', 22, 'NC.6.EE.9', 'Expressions and Equations', 'Dependent and independent variables', 'Use variables for two related quantities and analyse their relationship in context, equations, tables and graphs.'),
  ('NC17.6.G.1', 'NC17.6', 23, 'NC.6.G.1', 'Geometry', 'Area of triangles and polygons', 'Find areas of triangles, special quadrilaterals and polygons by composing and decomposing them into rectangles and triangles.'),
  ('NC17.6.G.2', 'NC17.6', 24, 'NC.6.G.2', 'Geometry', 'Volume with fractional edges', 'Find the volume of right rectangular prisms with fractional edge lengths and use it to solve problems.'),
  ('NC17.6.G.3', 'NC17.6', 25, 'NC.6.G.3', 'Geometry', 'Polygons on the coordinate plane', 'Draw polygons from vertex coordinates and find side lengths that share a coordinate.'),
  ('NC17.6.G.4', 'NC17.6', 26, 'NC.6.G.4', 'Geometry', 'Nets and surface area', 'Represent right prisms and pyramids with nets and use them to find surface area in problems.'),
  ('NC17.6.SP.1', 'NC17.6', 27, 'NC.6.SP.1', 'Statistics and Probability', 'Statistical questions', 'Recognise a statistical question as one that expects variability in its data.'),
  ('NC17.6.SP.2', 'NC17.6', 28, 'NC.6.SP.2', 'Statistics and Probability', 'Data distributions', 'Understand that data from a statistical question has a distribution described by its centre, spread and shape.'),
  ('NC17.6.SP.3', 'NC17.6', 29, 'NC.6.SP.3', 'Statistics and Probability', 'Centre and variability', 'Describe numerical data with a measure of centre such as mean or median together with its variability.'),
  ('NC17.6.SP.4', 'NC17.6', 30, 'NC.6.SP.4', 'Statistics and Probability', 'Dot plots, histograms, box plots', 'Display numerical data in dot plots, histograms and box plots and compare what each shows.'),
  ('NC17.6.SP.5', 'NC17.6', 31, 'NC.6.SP.5', 'Statistics and Probability', 'Summarize data sets', 'Summarise data in context by its observations and units and by centre, variability and shape.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC17.7.RP.1', 'NC17.7', 1, 'NC.7.RP.1', 'Ratio and Proportional Relationships', 'Unit rates with fractions', 'Compute unit rates from ratios of fractions to solve problems.'),
  ('NC17.7.RP.2', 'NC17.7', 2, 'NC.7.RP.2', 'Ratio and Proportional Relationships', 'Proportional relationships', 'Recognise and represent proportional relationships with tables, graphs and equations, finding and interpreting the constant of proportionality.'),
  ('NC17.7.RP.3', 'NC17.7', 3, 'NC.7.RP.3', 'Ratio and Proportional Relationships', 'Ratio and percent problems', 'Use scale factors and unit rates to solve ratio and percent problems.'),
  ('NC17.7.NS.1', 'NC17.7', 4, 'NC.7.NS.1', 'The Number System', 'Add and subtract rational numbers', 'Add and subtract rational numbers using properties of operations and describe real-world sums and differences.'),
  ('NC17.7.NS.2', 'NC17.7', 5, 'NC.7.NS.2', 'The Number System', 'Multiply and divide rational numbers', 'Multiply and divide rational numbers and convert fractions to terminating or repeating decimals by long division.'),
  ('NC17.7.NS.3', 'NC17.7', 6, 'NC.7.NS.3', 'The Number System', 'Problems with rational numbers', 'Solve problems with numerical expressions involving rational numbers and all four operations.'),
  ('NC17.7.EE.1', 'NC17.7', 7, 'NC.7.EE.1', 'Expressions and Equations', 'Linear expressions', 'Add, subtract, expand and factor linear expressions with rational coefficients using properties of operations.'),
  ('NC17.7.EE.2', 'NC17.7', 8, 'NC.7.EE.2', 'Expressions and Equations', 'Equivalent expressions in context', 'See how equivalent expressions reveal relationships and interpret the parts of each in context.'),
  ('NC17.7.EE.3', 'NC17.7', 9, 'NC.7.EE.3', 'Expressions and Equations', 'Multi-step problems', 'Solve multi-step problems with rational numbers in any form, converting between equivalent forms as needed.'),
  ('NC17.7.EE.4', 'NC17.7', 10, 'NC.7.EE.4', 'Expressions and Equations', 'Equations and inequalities', 'Write and solve multi-step equations and inequalities with the variable on one side, and interpret and graph the solutions.'),
  ('NC17.7.G.1', 'NC17.7', 11, 'NC.7.G.1', 'Geometry', 'Scale drawings', 'Solve problems with scale drawings, computing actual lengths and areas and creating drawings to scale.'),
  ('NC17.7.G.2', 'NC17.7', 12, 'NC.7.G.2', 'Geometry', 'Constructing triangles', 'Determine when given angles and sides make one, many or no triangles, and build triangles from three measures.'),
  ('NC17.7.G.4', 'NC17.7', 13, 'NC.7.G.4', 'Geometry', 'Area and circumference of circles', 'Relate radius, diameter, circumference and area, and use the circle formulas to solve problems.'),
  ('NC17.7.G.5', 'NC17.7', 14, 'NC.7.G.5', 'Geometry', 'Angle relationships', 'Use supplementary, complementary, vertical and adjacent angles to write and solve equations for unknown angles.'),
  ('NC17.7.G.6', 'NC17.7', 15, 'NC.7.G.6', 'Geometry', 'Area, volume and surface area', 'Solve problems on area and perimeter of composite figures and volume and surface area of prisms and pyramids.'),
  ('NC17.7.SP.1', 'NC17.7', 16, 'NC.7.SP.1', 'Statistics and Probability', 'Samples and populations', 'Use representative random samples to make valid generalisations about a population.'),
  ('NC17.7.SP.2', 'NC17.7', 17, 'NC.7.SP.2', 'Statistics and Probability', 'Inferences from samples', 'Draw several random samples to gauge variation in estimates and make inferences about a population.'),
  ('NC17.7.SP.3', 'NC17.7', 18, 'NC.7.SP.3', 'Statistics and Probability', 'Variability between populations', 'Use mean absolute deviation, range and interquartile range, and visual overlap, to compare two data sets.'),
  ('NC17.7.SP.4', 'NC17.7', 19, 'NC.7.SP.4', 'Statistics and Probability', 'Compare populations', 'Use measures of centre and variability from random samples to compare two populations.'),
  ('NC17.7.SP.5', 'NC17.7', 20, 'NC.7.SP.5', 'Statistics and Probability', 'Probability of events', 'Understand probability as a number from 0 to 1 expressing how likely an event is.'),
  ('NC17.7.SP.6', 'NC17.7', 21, 'NC.7.SP.6', 'Statistics and Probability', 'Experimental probability', 'Find experimental probability from collected data and use it to predict relative frequency.'),
  ('NC17.7.SP.7', 'NC17.7', 22, 'NC.7.SP.7', 'Statistics and Probability', 'Probability models', 'Build uniform and non-uniform probability models and compare their predictions with observed frequencies.'),
  ('NC17.7.SP.8', 'NC17.7', 23, 'NC.7.SP.8', 'Statistics and Probability', 'Compound events', 'Find probabilities of compound events using lists, tables, tree diagrams and simulations.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC17.8.NS.1', 'NC17.8', 1, 'NC.8.NS.1', 'The Number System', 'Irrational numbers', 'Understand that every number has a decimal expansion and that irrational numbers neither terminate nor repeat.'),
  ('NC17.8.NS.2', 'NC17.8', 2, 'NC.8.NS.2', 'The Number System', 'Approximate irrational numbers', 'Approximate irrational numbers to compare and place them on a number line and estimate roots and pi.'),
  ('NC17.8.EE.1', 'NC17.8', 3, 'NC.8.EE.1', 'Expressions and Equations', 'Integer exponents', 'Develop and apply the properties of integer exponents to write equivalent numerical expressions.'),
  ('NC17.8.EE.2', 'NC17.8', 4, 'NC.8.EE.2', 'Expressions and Equations', 'Square and cube roots', 'Use root symbols for solutions of x² = p and x³ = p and evaluate roots of perfect squares and cubes up to 400.'),
  ('NC17.8.EE.3', 'NC17.8', 5, 'NC.8.EE.3', 'Expressions and Equations', 'Scientific notation estimates', 'Use scientific notation to estimate very large or small quantities and compare them.'),
  ('NC17.8.EE.4', 'NC17.8', 6, 'NC.8.EE.4', 'Expressions and Equations', 'Operations in scientific notation', 'Multiply and divide numbers in scientific notation to solve problems, mixing decimal and scientific forms.'),
  ('NC17.8.EE.7', 'NC17.8', 7, 'NC.8.EE.7', 'Expressions and Equations', 'Multi-step linear equations', 'Solve linear equations and inequalities in one variable with variables on both sides, recognising one, none or infinitely many solutions.'),
  ('NC17.8.EE.8', 'NC17.8', 8, 'NC.8.EE.8', 'Expressions and Equations', 'Systems of linear equations', 'Solve systems of two linear equations in slope-intercept form by graphing or inspection and interpret the intersection.'),
  ('NC17.8.F.1', 'NC17.8', 9, 'NC.8.F.1', 'Functions', 'What a function is', 'Understand a function as a rule giving each input exactly one output, recognised from graphs, tables and ordered pairs.'),
  ('NC17.8.F.2', 'NC17.8', 10, 'NC.8.F.2', 'Functions', 'Compare linear functions', 'Compare properties of two linear functions shown in different representations.'),
  ('NC17.8.F.3', 'NC17.8', 11, 'NC.8.F.3', 'Functions', 'Identify linear functions', 'Identify linear functions from tables, equations and graphs.'),
  ('NC17.8.F.4', 'NC17.8', 12, 'NC.8.F.4', 'Functions', 'Model with linear functions', 'Model linear relationships with y = mx + b, graph them, and interpret slope and intercept in context.'),
  ('NC17.8.F.5', 'NC17.8', 13, 'NC.8.F.5', 'Functions', 'Describe functions qualitatively', 'Describe where a graph increases or decreases or is linear or not, and sketch graphs from verbal descriptions.'),
  ('NC17.8.G.2', 'NC17.8', 14, 'NC.8.G.2', 'Geometry', 'Congruence and transformations', 'Define congruence through rotations, reflections and translations and describe sequences that map one figure onto another.'),
  ('NC17.8.G.3', 'NC17.8', 15, 'NC.8.G.3', 'Geometry', 'Transformations with coordinates', 'Describe the effect of dilations, translations, rotations and reflections on figures using coordinates.'),
  ('NC17.8.G.4', 'NC17.8', 16, 'NC.8.G.4', 'Geometry', 'Similarity and transformations', 'Define similarity through transformations including dilations and describe sequences that show it.'),
  ('NC17.8.G.5', 'NC17.8', 17, 'NC.8.G.5', 'Geometry', 'Angles, transversals, triangles', 'Use informal arguments about triangle angles, parallel lines cut by a transversal and angle-angle similarity.'),
  ('NC17.8.G.6', 'NC17.8', 18, 'NC.8.G.6', 'Geometry', 'Explain the Pythagorean Theorem', 'Explain the Pythagorean Theorem and its converse.'),
  ('NC17.8.G.7', 'NC17.8', 19, 'NC.8.G.7', 'Geometry', 'Apply the Pythagorean Theorem', 'Use the Pythagorean Theorem and its converse to solve problems.'),
  ('NC17.8.G.8', 'NC17.8', 20, 'NC.8.G.8', 'Geometry', 'Distance on the coordinate plane', 'Use the Pythagorean Theorem to find the distance between two points on a coordinate grid.'),
  ('NC17.8.G.9', 'NC17.8', 21, 'NC.8.G.9', 'Geometry', 'Volume of cones, cylinders, spheres', 'Relate the volume formulas for cones, cylinders and spheres and use them to solve problems.'),
  ('NC17.8.SP.1', 'NC17.8', 22, 'NC.8.SP.1', 'Statistics and Probability', 'Scatter plots', 'Construct and interpret scatter plots and describe clustering, outliers and types of association.'),
  ('NC17.8.SP.2', 'NC17.8', 23, 'NC.8.SP.2', 'Statistics and Probability', 'Lines of best fit', 'Informally fit a straight line to a scatter plot and judge how well it fits.'),
  ('NC17.8.SP.3', 'NC17.8', 24, 'NC.8.SP.3', 'Statistics and Probability', 'Use linear models', 'Solve problems with the equation of a linear model, interpreting its slope and intercept.'),
  ('NC17.8.SP.4', 'NC17.8', 25, 'NC.8.SP.4', 'Statistics and Probability', 'Two-way tables', 'Construct and interpret two-way tables of categorical data and use relative frequencies to describe association.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC17.M1.N-RN.2', 'NC17.M1', 1, 'NC.M1.N-RN.2', 'Number and Quantity', 'Integer exponent properties', 'Use the properties of exponents to rewrite algebraic expressions that have integer exponents.'),
  ('NC17.M1.A-SSE.1', 'NC17.M1', 2, 'NC.M1.A-SSE.1', 'Algebra', 'Interpret parts of expressions', 'Explain what the terms, factors, coefficients and exponents of linear, exponential and quadratic expressions mean in context, and read multi-part expressions as combinations of simpler pieces.'),
  ('NC17.M1.A-SSE.3', 'NC17.M1', 3, 'NC.M1.A-SSE.3', 'Algebra', 'Factor quadratics to find zeros', 'Factor a quadratic expression ax² + bx + c (a an integer) to reveal the solutions of the related equation or the zeros of the function.'),
  ('NC17.M1.A-APR.1', 'NC17.M1', 4, 'NC.M1.A-APR.1', 'Algebra', 'Add, subtract and multiply polynomials', 'See polynomial arithmetic as like integer arithmetic by adding and subtracting quadratic expressions and adding, subtracting and multiplying linear ones.'),
  ('NC17.M1.A-APR.3', 'NC17.M1', 5, 'NC.M1.A-APR.3', 'Algebra', 'Factors, solutions and zeros', 'Connect the factors of a quadratic expression with the solutions of the quadratic equation and the zeros of the quadratic function.'),
  ('NC17.M1.A-CED.1', 'NC17.M1', 6, 'NC.M1.A-CED.1', 'Algebra', 'Write one-variable equations', 'Write equations and inequalities in one variable for linear, exponential and quadratic situations and use them to solve problems.'),
  ('NC17.M1.A-CED.2', 'NC17.M1', 7, 'NC.M1.A-CED.2', 'Algebra', 'Write and graph two-variable equations', 'Write and graph equations in two variables that model linear, exponential and quadratic relationships between quantities.'),
  ('NC17.M1.A-CED.3', 'NC17.M1', 8, 'NC.M1.A-CED.3', 'Algebra', 'Model with linear systems', 'Write systems of linear equations and inequalities that model a situation in context.'),
  ('NC17.M1.A-CED.4', 'NC17.M1', 9, 'NC.M1.A-CED.4', 'Algebra', 'Rearrange formulas', 'Solve a science or mathematics formula for a chosen quantity using the same steps as solving an equation.'),
  ('NC17.M1.A-REI.1', 'NC17.M1', 10, 'NC.M1.A-REI.1', 'Algebra', 'Justify solution steps', 'Explain why a solution method works and justify each step when solving linear and quadratic equations.'),
  ('NC17.M1.A-REI.3', 'NC17.M1', 11, 'NC.M1.A-REI.3', 'Algebra', 'Solve linear equations and inequalities', 'Solve linear equations and inequalities in one variable.'),
  ('NC17.M1.A-REI.4', 'NC17.M1', 12, 'NC.M1.A-REI.4', 'Algebra', 'Solve quadratics by roots and factoring', 'Find the real solutions of one-variable quadratic equations by taking square roots and by factoring.'),
  ('NC17.M1.A-REI.5', 'NC17.M1', 13, 'NC.M1.A-REI.5', 'Algebra', 'Why elimination works', 'Explain why replacing an equation in a linear system with its sum with a multiple of the other equation keeps the same solutions.'),
  ('NC17.M1.A-REI.6', 'NC17.M1', 14, 'NC.M1.A-REI.6', 'Algebra', 'Solve systems of linear equations', 'Solve linear systems exactly or approximately with tables, graphs, substitution or elimination, and interpret the solutions in context.'),
  ('NC17.M1.A-REI.10', 'NC17.M1', 15, 'NC.M1.A-REI.10', 'Algebra', 'Graphs as solution sets', 'Recognise that the graph of an equation in two variables is the set of all its solutions.'),
  ('NC17.M1.A-REI.11', 'NC17.M1', 16, 'NC.M1.A-REI.11', 'Algebra', 'Solve equations by intersecting graphs', 'Explain why the x-coordinates where y = f(x) and y = g(x) meet solve f(x) = g(x) for linear, exponential and quadratic functions, and approximate them with technology or tables.'),
  ('NC17.M1.A-REI.12', 'NC17.M1', 17, 'NC.M1.A-REI.12', 'Algebra', 'Graph linear inequalities', 'Show the solutions of a linear inequality or a system of linear inequalities as a region of the coordinate plane.'),
  ('NC17.M1.F-IF.1', 'NC17.M1', 18, 'NC.M1.F-IF.1', 'Functions', 'What a function is', 'Understand a function as assigning each input in the domain exactly one output in the range, with f(x) as the output for x and the graph of f as the graph of y = f(x).'),
  ('NC17.M1.F-IF.2', 'NC17.M1', 19, 'NC.M1.F-IF.2', 'Functions', 'Use function notation', 'Evaluate linear, quadratic and exponential functions written in function notation and interpret statements in that notation in context.'),
  ('NC17.M1.F-IF.3', 'NC17.M1', 20, 'NC.M1.F-IF.3', 'Functions', 'Sequences as functions', 'See arithmetic and geometric sequences, defined recursively or explicitly, as functions on the integers related to linear and exponential functions.'),
  ('NC17.M1.F-IF.4', 'NC17.M1', 21, 'NC.M1.F-IF.4', 'Functions', 'Key features in context', 'Interpret intercepts, increasing or decreasing and positive or negative intervals, and maximums and minimums of functions given by graphs, tables or descriptions in context.'),
  ('NC17.M1.F-IF.5', 'NC17.M1', 22, 'NC.M1.F-IF.5', 'Functions', 'Domain and range in context', 'Relate a function''s domain and range to its graph and to the real situation it describes.'),
  ('NC17.M1.F-IF.6', 'NC17.M1', 23, 'NC.M1.F-IF.6', 'Functions', 'Average rate of change', 'Calculate and interpret a function''s average rate of change over an interval from a table, graph or formula.'),
  ('NC17.M1.F-IF.7', 'NC17.M1', 24, 'NC.M1.F-IF.7', 'Functions', 'Graph functions to show features', 'Represent linear, exponential and quadratic functions in different ways, by hand or with technology, to show domain, range, rate of change, intercepts, intervals, extremes and end behavior.'),
  ('NC17.M1.F-IF.8', 'NC17.M1', 25, 'NC.M1.F-IF.8', 'Functions', 'Equivalent forms reveal properties', 'Rewrite quadratic functions to reveal key features, and interpret growth and decay rates of exponential functions.'),
  ('NC17.M1.F-IF.9', 'NC17.M1', 26, 'NC.M1.F-IF.9', 'Functions', 'Compare functions across representations', 'Compare key features of two linear, quadratic or exponential functions given in different representations.'),
  ('NC17.M1.F-BF.1', 'NC17.M1', 27, 'NC.M1.F-BF.1', 'Functions', 'Build functions from relationships', 'Write linear and exponential functions, including sequences, from graphs, descriptions or two points, and combine functions by adding, subtracting or multiplying two linear ones.'),
  ('NC17.M1.F-BF.2', 'NC17.M1', 28, 'NC.M1.F-BF.2', 'Functions', 'Explicit and recursive sequences', 'Move between explicit and recursive forms of arithmetic and geometric sequences and use both to model situations.'),
  ('NC17.M1.F-LE.1', 'NC17.M1', 29, 'NC.M1.F-LE.1', 'Functions', 'Linear or exponential model', 'Decide whether a situation is linear or exponential by looking at change over equal intervals, and justify the choice of model.'),
  ('NC17.M1.F-LE.3', 'NC17.M1', 30, 'NC.M1.F-LE.3', 'Functions', 'Exponential growth overtakes', 'Use graphs and tables to show that exponential growth eventually exceeds linear or quadratic growth.'),
  ('NC17.M1.F-LE.5', 'NC17.M1', 31, 'NC.M1.F-LE.5', 'Functions', 'Interpret function parameters', 'Explain in context what the parameters mean in a linear function ax + b or an exponential function a times b to the x.'),
  ('NC17.M1.G-GPE.4', 'NC17.M1', 32, 'NC.M1.G-GPE.4', 'Geometry', 'Coordinate geometry of polygons', 'Use coordinates to find perimeters of polygons and areas of triangles and rectangles, and to classify triangles and quadrilaterals algebraically.'),
  ('NC17.M1.G-GPE.5', 'NC17.M1', 33, 'NC.M1.G-GPE.5', 'Geometry', 'Slopes of parallel and perpendicular lines', 'Use coordinates to justify the slope rules for parallel and perpendicular lines, classify pairs of lines, and write equations of such lines through a point.'),
  ('NC17.M1.G-GPE.6', 'NC17.M1', 34, 'NC.M1.G-GPE.6', 'Geometry', 'Midpoints and endpoints', 'Use coordinates to find the midpoint or a missing endpoint of a line segment.'),
  ('NC17.M1.S-ID.1', 'NC17.M1', 35, 'NC.M1.S-ID.1', 'Statistics and Probability', 'Histograms and box plots', 'Use technology to display data on a number line with histograms and box plots.'),
  ('NC17.M1.S-ID.2', 'NC17.M1', 36, 'NC.M1.S-ID.2', 'Statistics and Probability', 'Compare center and spread', 'Choose suitable statistics to compare the center and spread of two or more data sets, and interpret differences in shape, center and spread in context.'),
  ('NC17.M1.S-ID.3', 'NC17.M1', 37, 'NC.M1.S-ID.3', 'Statistics and Probability', 'Effect of outliers', 'Examine how outliers change the shape, center and spread of a data set.'),
  ('NC17.M1.S-ID.6', 'NC17.M1', 38, 'NC.M1.S-ID.6', 'Statistics and Probability', 'Scatter plots and fitted lines', 'Plot two quantitative variables, fit least squares lines and exponential models with technology, use them to solve problems, and judge linear fit with residuals.'),
  ('NC17.M1.S-ID.7', 'NC17.M1', 39, 'NC.M1.S-ID.7', 'Statistics and Probability', 'Interpret linear models', 'Interpret the slope and intercept of a linear model in context, use it to interpolate and extrapolate, and judge whether a prediction is valid.'),
  ('NC17.M1.S-ID.8', 'NC17.M1', 40, 'NC.M1.S-ID.8', 'Statistics and Probability', 'Correlation and residual plots', 'Describe relationships between two variables, compute and interpret the correlation coefficient, and use scatter plots, correlation and residuals to judge whether a linear model fits.'),
  ('NC17.M1.S-ID.9', 'NC17.M1', 41, 'NC.M1.S-ID.9', 'Statistics and Probability', 'Association versus causation', 'Tell the difference between two variables being associated and one causing the other.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC17.M2.N-RN.1', 'NC17.M2', 1, 'NC.M2.N-RN.1', 'Number and Quantity', 'Rational exponents as radicals', 'Explain how an expression with a rational exponent can be written as a radical expression.'),
  ('NC17.M2.N-RN.2', 'NC17.M2', 2, 'NC.M2.N-RN.2', 'Number and Quantity', 'Rewrite radicals and rational exponents', 'Use exponent properties to rewrite expressions with radicals and rational exponents into equivalent forms.'),
  ('NC17.M2.N-RN.3', 'NC17.M2', 3, 'NC.M2.N-RN.3', 'Number and Quantity', 'Rational and irrational sums, products', 'Explain why sums and products of rationals are rational, while a rational plus an irrational, or a nonzero rational times an irrational, is irrational.'),
  ('NC17.M2.N-CN.1', 'NC17.M2', 4, 'NC.M2.N-CN.1', 'Number and Quantity', 'Complex numbers', 'Know that i squared is -1 and that every complex number can be written as a + bi with a and b real.'),
  ('NC17.M2.A-SSE.1', 'NC17.M2', 5, 'NC.M2.A-SSE.1', 'Algebra', 'Interpret quadratic and radical expressions', 'Interpret the parts of quadratic, square root, inverse variation and right-triangle trigonometric expressions, and read multi-part expressions as single entities in context.'),
  ('NC17.M2.A-SSE.3', 'NC17.M2', 6, 'NC.M2.A-SSE.3', 'Algebra', 'Complete the square', 'Complete the square on a quadratic expression ax² + bx + c to reveal the maximum or minimum value of the function.'),
  ('NC17.M2.A-APR.1', 'NC17.M2', 7, 'NC.M2.A-APR.1', 'Algebra', 'Polynomial arithmetic', 'Add, subtract and multiply polynomials, seeing the parallel with integer arithmetic.'),
  ('NC17.M2.A-CED.1', 'NC17.M2', 8, 'NC.M2.A-CED.1', 'Algebra', 'Write one-variable equations', 'Write equations and inequalities in one variable for quadratic, square root, inverse variation and right-triangle trigonometric situations and solve problems with them.'),
  ('NC17.M2.A-CED.2', 'NC17.M2', 9, 'NC.M2.A-CED.2', 'Algebra', 'Write and graph two-variable equations', 'Write and graph two-variable equations for quadratic, square root and inverse variation relationships.'),
  ('NC17.M2.A-CED.3', 'NC17.M2', 10, 'NC.M2.A-CED.3', 'Algebra', 'Model with systems of equations', 'Write systems of linear, quadratic, square root and inverse variation equations that model a situation.'),
  ('NC17.M2.A-REI.1', 'NC17.M2', 11, 'NC.M2.A-REI.1', 'Algebra', 'Justify solution steps', 'Justify a solution method and each step when solving quadratic, square root and inverse variation equations.'),
  ('NC17.M2.A-REI.2', 'NC17.M2', 12, 'NC.M2.A-REI.2', 'Algebra', 'Radical and inverse variation equations', 'Solve square root and inverse variation equations in context, interpret the results, and explain how extraneous solutions arise.'),
  ('NC17.M2.A-REI.4', 'NC17.M2', 13, 'NC.M2.A-REI.4', 'Algebra', 'Quadratic formula and complex solutions', 'Solve any quadratic equation, seeing the quadratic formula as completing the square in general, and express non-real solutions as a ± bi.'),
  ('NC17.M2.A-REI.7', 'NC17.M2', 14, 'NC.M2.A-REI.7', 'Algebra', 'Linear-quadratic systems', 'Solve systems of a linear and a quadratic equation with tables, graphs or algebra, and interpret the solutions in context.'),
  ('NC17.M2.A-REI.11', 'NC17.M2', 15, 'NC.M2.A-REI.11', 'Algebra', 'Solve equations by intersecting graphs', 'Explain why intersections of y = f(x) and y = g(x) solve f(x) = g(x) for square root and inverse variation equations, and approximate them with technology or tables.'),
  ('NC17.M2.F-IF.1', 'NC17.M2', 16, 'NC.M2.F-IF.1', 'Functions', 'Transformations as functions', 'Treat a geometric transformation as a function whose domain and range are sets of points and whose image depends on the pre-image.'),
  ('NC17.M2.F-IF.2', 'NC17.M2', 17, 'NC.M2.F-IF.2', 'Functions', 'Function notation for transformations', 'Use function notation to describe the image of a figure under a translation, a rotation by multiples of 90 degrees, a reflection over an axis, or a dilation.'),
  ('NC17.M2.F-IF.4', 'NC17.M2', 18, 'NC.M2.F-IF.4', 'Functions', 'Key features in context', 'Interpret domain, range, rate of change, symmetry and end behavior of functions given by graphs, tables or descriptions in context.'),
  ('NC17.M2.F-IF.7', 'NC17.M2', 19, 'NC.M2.F-IF.7', 'Functions', 'Graph functions to show features', 'Represent quadratic, square root and inverse variation functions in different ways to show domain, range, intercepts, intervals, rate of change, extremes, symmetry and end behavior.'),
  ('NC17.M2.F-IF.8', 'NC17.M2', 20, 'NC.M2.F-IF.8', 'Functions', 'Completing the square for features', 'Complete the square on a quadratic function to find its zeros, extreme value and symmetry, and interpret them in context.'),
  ('NC17.M2.F-IF.9', 'NC17.M2', 21, 'NC.M2.F-IF.9', 'Functions', 'Compare functions across representations', 'Compare key features of two linear, quadratic, square root or inverse variation functions given in different representations.'),
  ('NC17.M2.F-BF.1', 'NC17.M2', 22, 'NC.M2.F-BF.1', 'Functions', 'Build quadratic and inverse variation functions', 'Write quadratic functions with real solutions and inverse variation functions from a graph, a description or ordered pairs.'),
  ('NC17.M2.F-BF.3', 'NC17.M2', 23, 'NC.M2.F-BF.3', 'Functions', 'Transformations of function graphs', 'Describe how k times f(x), f(x) + k and f(x + k) change the graph and table of linear, quadratic, square root and inverse variation functions.'),
  ('NC17.M2.G-CO.2', 'NC17.M2', 24, 'NC.M2.G-CO.2', 'Geometry', 'Rigid motions and dilations', 'Represent transformations in the plane, compare rigid motions with transformations that change size, and connect rigid motions with congruence and dilations with similarity.'),
  ('NC17.M2.G-CO.3', 'NC17.M2', 25, 'NC.M2.G-CO.3', 'Geometry', 'Symmetry of polygons', 'Describe the reflection and rotation symmetries of triangles, quadrilaterals and regular polygons, naming centers, angles and lines of symmetry.'),
  ('NC17.M2.G-CO.4', 'NC17.M2', 26, 'NC.M2.G-CO.4', 'Geometry', 'Properties of rigid motions', 'Verify by experiment how rotations, reflections and translations act on angles, circles, perpendicular and parallel lines and segments.'),
  ('NC17.M2.G-CO.5', 'NC17.M2', 27, 'NC.M2.G-CO.5', 'Geometry', 'Perform and describe rigid motions', 'Find the image of a figure under a rigid motion, and name a rigid motion or sequence that maps a figure onto a given image.'),
  ('NC17.M2.G-CO.6', 'NC17.M2', 28, 'NC.M2.G-CO.6', 'Geometry', 'Congruence by rigid motions', 'Decide whether two figures are congruent by finding rigid motions that map one onto the other.'),
  ('NC17.M2.G-CO.7', 'NC17.M2', 29, 'NC.M2.G-CO.7', 'Geometry', 'Congruent triangles and rigid motions', 'Use rigid motions to show that triangles are congruent exactly when all corresponding sides and angles are congruent.'),
  ('NC17.M2.G-CO.8', 'NC17.M2', 30, 'NC.M2.G-CO.8', 'Geometry', 'Triangle congruence criteria', 'Justify ASA, SAS and SSS with rigid motions, and use ASA, SAS, SSS and HL to decide whether triangles are congruent.'),
  ('NC17.M2.G-CO.9', 'NC17.M2', 31, 'NC.M2.G-CO.9', 'Geometry', 'Theorems about lines and angles', 'Prove and use theorems on vertical angles, angles formed by parallel lines and a transversal, perpendicular bisectors and angle bisectors.'),
  ('NC17.M2.G-CO.10', 'NC17.M2', 32, 'NC.M2.G-CO.10', 'Geometry', 'Theorems about triangles', 'Prove and use triangle theorems: the angle sum, exterior angles, isosceles base angles and the midsegment.'),
  ('NC17.M2.G-SRT.1', 'NC17.M2', 33, 'NC.M2.G-SRT.1', 'Geometry', 'Properties of dilations', 'Verify by experiment that dilations keep lines parallel or on the same line, scale lengths and distances from the center by the scale factor, and preserve angles.'),
  ('NC17.M2.G-SRT.2', 'NC17.M2', 34, 'NC.M2.G-SRT.2', 'Geometry', 'Similarity through transformations', 'Decide whether figures are similar by finding a sequence of transformations, and use dilations to show triangles with proportional sides and congruent angles are similar.'),
  ('NC17.M2.G-SRT.3', 'NC17.M2', 35, 'NC.M2.G-SRT.3', 'Geometry', 'AA similarity', 'Use rigid motions and dilations to justify the angle-angle criterion for similar triangles.'),
  ('NC17.M2.G-SRT.4', 'NC17.M2', 36, 'NC.M2.G-SRT.4', 'Geometry', 'Similarity theorems for triangles', 'Use similarity to prove triangle theorems, including the side-splitter theorem and its converse and the Pythagorean Theorem, and solve problems with them.'),
  ('NC17.M2.G-SRT.6', 'NC17.M2', 37, 'NC.M2.G-SRT.6', 'Geometry', 'Defining trigonometric ratios', 'Discover that side ratios in similar right triangles depend only on the angles, and use this to define the trigonometric ratios for acute angles.'),
  ('NC17.M2.G-SRT.8', 'NC17.M2', 38, 'NC.M2.G-SRT.8', 'Geometry', 'Solve right triangles', 'Use trigonometric ratios and the Pythagorean Theorem to solve right-triangle problems in context.'),
  ('NC17.M2.G-SRT.12', 'NC17.M2', 39, 'NC.M2.G-SRT.12', 'Geometry', 'Special right triangles', 'Develop the properties of 45-45-90 and 30-60-90 triangles and use them to solve problems.'),
  ('NC17.M2.S-IC.2', 'NC17.M2', 40, 'NC.M2.S-IC.2', 'Statistics and Probability', 'Simulation and theoretical probability', 'Use simulation to judge whether an experimental probability from sample data is consistent with the theoretical probability.'),
  ('NC17.M2.S-CP.1', 'NC17.M2', 41, 'NC.M2.S-CP.1', 'Statistics and Probability', 'Events and sample spaces', 'Describe events as subsets of a sample space, or as unions, intersections and complements of other events.'),
  ('NC17.M2.S-CP.3', 'NC17.M2', 42, 'NC.M2.S-CP.3', 'Statistics and Probability', 'Independence and conditional probability', 'Use two-way tables to understand P(A|B) as the share of B''s outcomes also in A, and understand A as independent of B when P(A|B) equals P(A).'),
  ('NC17.M2.S-CP.4', 'NC17.M2', 43, 'NC.M2.S-CP.4', 'Statistics and Probability', 'Two-way frequency tables', 'Build two-way tables for two categorical variables, use them to find conditional, joint and marginal probabilities, and test events for independence.'),
  ('NC17.M2.S-CP.5', 'NC17.M2', 44, 'NC.M2.S-CP.5', 'Statistics and Probability', 'Conditional probability in everyday language', 'Recognise and explain conditional probability and independence in everyday situations and language.'),
  ('NC17.M2.S-CP.6', 'NC17.M2', 45, 'NC.M2.S-CP.6', 'Statistics and Probability', 'Find conditional probabilities', 'Find the probability of A given B as the fraction of B''s outcomes that are also in A, and interpret it in context.'),
  ('NC17.M2.S-CP.7', 'NC17.M2', 46, 'NC.M2.S-CP.7', 'Statistics and Probability', 'The Addition Rule', 'Use the Addition Rule for P(A or B) and interpret the result in context.'),
  ('NC17.M2.S-CP.8', 'NC17.M2', 47, 'NC.M2.S-CP.8', 'Statistics and Probability', 'The Multiplication Rule', 'Use the general Multiplication Rule for P(A and B), including the independent case, and interpret the result in context.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC17.M3.N-CN.9', 'NC17.M3', 1, 'NC.M3.N-CN.9', 'Number and Quantity', 'Fundamental Theorem of Algebra', 'Use the Fundamental Theorem of Algebra to find how many solutions a polynomial has and what kinds they might be.'),
  ('NC17.M3.A-SSE.1', 'NC17.M3', 2, 'NC.M3.A-SSE.1', 'Algebra', 'Interpret advanced expressions', 'Interpret the parts of piecewise, absolute value, polynomial, exponential and rational expressions, and read multi-part expressions as single entities in context.'),
  ('NC17.M3.A-SSE.2', 'NC17.M3', 3, 'NC.M3.A-SSE.2', 'Algebra', 'Use structure to rewrite expressions', 'Use the structure of an expression to find ways to write it in equivalent forms.'),
  ('NC17.M3.A-SSE.3', 'NC17.M3', 4, 'NC.M3.A-SSE.3', 'Algebra', 'Rewrite exponential expressions', 'Use exponent properties to rewrite exponential expressions so they show rates over different time intervals.'),
  ('NC17.M3.A-APR.2', 'NC17.M3', 5, 'NC.M3.A-APR.2', 'Algebra', 'The Remainder Theorem', 'Understand the Remainder Theorem and use it.'),
  ('NC17.M3.A-APR.3', 'NC17.M3', 6, 'NC.M3.A-APR.3', 'Algebra', 'Polynomial factors and zeros', 'Connect the factors of a polynomial with the solutions of the polynomial equation and the zeros of the function.'),
  ('NC17.M3.A-APR.6', 'NC17.M3', 7, 'NC.M3.A-APR.6', 'Algebra', 'Rewrite rational expressions', 'Rewrite a simple rational expression a(x)/b(x) as a quotient plus a remainder over b(x), with the remainder of lower degree than b(x).'),
  ('NC17.M3.A-APR.7', 'NC17.M3', 8, 'NC.M3.A-APR.7', 'Algebra', 'Rational expression arithmetic', 'Treat rational expressions like rational numbers: add and subtract ones with linear denominators, and multiply and divide them.'),
  ('NC17.M3.A-CED.1', 'NC17.M3', 9, 'NC.M3.A-CED.1', 'Algebra', 'Write one-variable equations', 'Write equations and inequalities in one variable for absolute value, polynomial, exponential and rational situations and solve them algebraically and graphically.'),
  ('NC17.M3.A-CED.2', 'NC17.M3', 10, 'NC.M3.A-CED.2', 'Algebra', 'Write and graph two-variable equations', 'Write and graph two-variable equations for absolute value, polynomial, exponential and rational relationships.'),
  ('NC17.M3.A-CED.3', 'NC17.M3', 11, 'NC.M3.A-CED.3', 'Algebra', 'Model with systems', 'Write systems of equations or inequalities that model a situation in context.'),
  ('NC17.M3.A-REI.1', 'NC17.M3', 12, 'NC.M3.A-REI.1', 'Algebra', 'Justify solution steps', 'Justify a solution method and explain each step of solving an equation.'),
  ('NC17.M3.A-REI.2', 'NC17.M3', 13, 'NC.M3.A-REI.2', 'Algebra', 'Solve rational equations', 'Solve one-variable rational equations in context, interpret the solutions, and explain how extraneous solutions arise.'),
  ('NC17.M3.A-REI.11', 'NC17.M3', 14, 'NC.M3.A-REI.11', 'Algebra', 'Solve equations by intersecting graphs', 'Explain why intersections of y = f(x) and y = g(x) solve f(x) = g(x), and approximate those solutions with technology or tables.'),
  ('NC17.M3.F-IF.1', 'NC17.M3', 15, 'NC.M3.F-IF.1', 'Functions', 'Trigonometric ratios as functions', 'Recognise trigonometric ratios as functions of angle measure.'),
  ('NC17.M3.F-IF.2', 'NC17.M3', 16, 'NC.M3.F-IF.2', 'Functions', 'Piecewise function notation', 'Evaluate piecewise functions written in function notation and interpret such statements in context.'),
  ('NC17.M3.F-IF.4', 'NC17.M3', 17, 'NC.M3.F-IF.4', 'Functions', 'Periodicity and discontinuities', 'Interpret key features of functions in context from graphs, tables and descriptions, including periodicity and discontinuities.'),
  ('NC17.M3.F-IF.7', 'NC17.M3', 18, 'NC.M3.F-IF.7', 'Functions', 'Graph advanced functions', 'Represent piecewise, absolute value, polynomial, exponential, rational, sine and cosine functions to show key features such as intercepts, extremes, symmetry, end behavior, period and discontinuities.'),
  ('NC17.M3.F-IF.9', 'NC17.M3', 19, 'NC.M3.F-IF.9', 'Functions', 'Compare functions across representations', 'Compare key features of two different functions, each given in a different representation.'),
  ('NC17.M3.F-BF.1', 'NC17.M3', 20, 'NC.M3.F-BF.1', 'Functions', 'Build polynomial and exponential functions', 'Write polynomial and exponential functions from graphs, descriptions or points, and combine standard function types with arithmetic operations in context.'),
  ('NC17.M3.F-BF.3', 'NC17.M3', 21, 'NC.M3.F-BF.3', 'Functions', 'Transformations including horizontal stretch', 'Describe how k times f(x), f(x) + k, f(x + k) and f(kx) change a function''s graph and table for positive and negative k.'),
  ('NC17.M3.F-BF.4', 'NC17.M3', 22, 'NC.M3.F-BF.4', 'Functions', 'Inverse functions', 'Understand inverse pairs such as exponential and logarithmic, decide whether an inverse exists, and represent and use the inverse of linear, quadratic or exponential functions in context.'),
  ('NC17.M3.F-LE.3', 'NC17.M3', 23, 'NC.M3.F-LE.3', 'Functions', 'Exponential beats polynomial growth', 'Compare rates of change over equal intervals to show exponential growth eventually exceeds polynomial growth.'),
  ('NC17.M3.F-LE.4', 'NC17.M3', 24, 'NC.M3.F-LE.4', 'Functions', 'Solve exponentials with logarithms', 'Write the solution of an exponential equation as a logarithm and evaluate it with technology.'),
  ('NC17.M3.F-TF.1', 'NC17.M3', 25, 'NC.M3.F-TF.1', 'Functions', 'Radian measure', 'Understand a radian as arc length divided by radius, a real number that serves as the domain of trigonometric functions.'),
  ('NC17.M3.F-TF.2', 'NC17.M3', 26, 'NC.M3.F-TF.2', 'Functions', 'Unit circle sine and cosine', 'Represent sine and cosine with tables, graphs and technology, reading them as the y- and x-coordinates of a point on the unit circle at a given radian angle.'),
  ('NC17.M3.F-TF.5', 'NC17.M3', 27, 'NC.M3.F-TF.5', 'Functions', 'Model periodic phenomena', 'Use technology to explore the parameters of f(x) = a sin(bx) + h, model periodic situations, and interpret key features in context.'),
  ('NC17.M3.G-CO.10', 'NC17.M3', 28, 'NC.M3.G-CO.10', 'Geometry', 'Centers of triangles', 'Verify by experiment the properties of a triangle''s centroid, incenter and circumcenter.'),
  ('NC17.M3.G-CO.11', 'NC17.M3', 29, 'NC.M3.G-CO.11', 'Geometry', 'Theorems about parallelograms', 'Prove that a parallelogram''s opposite sides and angles are congruent, its diagonals bisect each other, and congruent diagonals make it a rectangle.'),
  ('NC17.M3.G-CO.14', 'NC17.M3', 30, 'NC.M3.G-CO.14', 'Geometry', 'Prove theorems about figures', 'Use properties, definitions and theorems of two-dimensional figures to prove theorems and solve problems.'),
  ('NC17.M3.G-C.2', 'NC17.M3', 31, 'NC.M3.G-C.2', 'Geometry', 'Circle theorems', 'Understand and apply theorems about angles in circles (central, inscribed, circumscribed) and about radii, diameters, secants, tangents and chords.'),
  ('NC17.M3.G-C.5', 'NC17.M3', 32, 'NC.M3.G-C.5', 'Geometry', 'Arc length and sectors', 'Use similarity to show arc length is proportional to radius, define radian measure as arc over radius, and find arc lengths and sector areas.'),
  ('NC17.M3.G-GPE.1', 'NC17.M3', 33, 'NC.M3.G-GPE.1', 'Geometry', 'Equation of a circle', 'Derive the equation of a circle from its center and radius with the Pythagorean Theorem, and complete the square to find the center and radius from an equation.'),
  ('NC17.M3.G-GMD.3', 'NC17.M3', 34, 'NC.M3.G-GMD.3', 'Geometry', 'Volume formulas', 'Use the volume formulas for prisms, cylinders, pyramids, cones and spheres to solve problems.'),
  ('NC17.M3.G-GMD.4', 'NC17.M3', 35, 'NC.M3.G-GMD.4', 'Geometry', 'Cross-sections and solids of rotation', 'Identify two-dimensional cross-sections of solids and the solids formed by rotating two-dimensional shapes.'),
  ('NC17.M3.G-MG.1', 'NC17.M3', 36, 'NC.M3.G-MG.1', 'Geometry', 'Modeling with geometry', 'Model real objects and relationships with shapes, formulas and functions, and solve density, design and optimization problems.'),
  ('NC17.M3.S-IC.1', 'NC17.M3', 37, 'NC.M3.S-IC.1', 'Statistics and Probability', 'Inference from random samples', 'Understand how inferences about a population are drawn from a random sample of it.'),
  ('NC17.M3.S-IC.3', 'NC17.M3', 38, 'NC.M3.S-IC.3', 'Statistics and Probability', 'Surveys, experiments and observational studies', 'Recognise the purposes of and differences between sample surveys, experiments and observational studies, and how each should use randomization.'),
  ('NC17.M3.S-IC.4', 'NC17.M3', 39, 'NC.M3.S-IC.4', 'Statistics and Probability', 'Estimate with margin of error', 'Use simulation to see how samples estimate a population mean or proportion and how to find a margin of error.'),
  ('NC17.M3.S-IC.5', 'NC17.M3', 40, 'NC.M3.S-IC.5', 'Statistics and Probability', 'Compare populations by simulation', 'Use simulation to decide whether differences between samples from two populations show a real difference in a parameter.'),
  ('NC17.M3.S-IC.6', 'NC17.M3', 41, 'NC.M3.S-IC.6', 'Statistics and Probability', 'Evaluate reports of data', 'Evaluate articles and websites that report data by checking the data source, the study design and how the data are displayed.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC17.M4.N.1', 'NC17.M4', 1, 'NC.M4.N.1', 'Number and Quantity', 'Complex number operations', 'Apply the properties of complex numbers to operate with them. Covers adding, subtracting and multiplying complex numbers.'),
  ('NC17.M4.N.2', 'NC17.M4', 2, 'NC.M4.N.2', 'Number and Quantity', 'Matrix and vector operations', 'Apply the properties of operations with matrices and vectors. Covers matrix addition, subtraction, multiplication and scalar multiplication, and vector addition, subtraction and scalar multiplication.'),
  ('NC17.M4.AF.1', 'NC17.M4', 3, 'NC.M4.AF.1', 'Algebra and Functions', 'Function composition', 'Build new functions by composing existing ones. Covers composing two functions algebraically, and evaluating a composite function from algebraic, graphical or tabular forms.'),
  ('NC17.M4.AF.2', 'NC17.M4', 4, 'NC.M4.AF.2', 'Algebra and Functions', 'Trigonometric identities and laws', 'Apply trigonometry to solve problems. Covers reciprocal and Pythagorean identities, the Law of Sines and Law of Cosines, and key features of sine and cosine models in context.'),
  ('NC17.M4.AF.3', 'NC17.M4', 5, 'NC.M4.AF.3', 'Algebra and Functions', 'Logarithmic functions', 'Apply the properties and key features of logarithmic functions. Covers simplifying and solving with logarithm properties, solving equations in context, and interpreting key features across representations.'),
  ('NC17.M4.AF.4', 'NC17.M4', 6, 'NC.M4.AF.4', 'Algebra and Functions', 'Piecewise functions', 'Understand the properties and key features of piecewise functions. Covers moving between algebraic and graphical forms, and building piecewise models of situations.'),
  ('NC17.M4.AF.5', 'NC17.M4', 7, 'NC.M4.AF.5', 'Algebra and Functions', 'Regression models', 'Model bivariate data with regression functions. Covers linear, quadratic, exponential, logarithmic and sinusoidal regression with technology, and judging fit of non-linear models with residuals.'),
  ('NC17.M4.SP.1', 'NC17.M4', 8, 'NC.M4.SP.1', 'Statistics and Probability', 'Statistical investigations', 'Plan and carry out statistical investigations of real-world questions. Covers statistical questions, designing surveys and experiments, organising large datasets with technology, and reading non-standard data displays.'),
  ('NC17.M4.SP.2', 'NC17.M4', 9, 'NC.M4.SP.2', 'Statistics and Probability', 'Statistical inference', 'Use informal and formal inference to make decisions in real contexts. Covers simulated sampling distributions, confidence intervals for proportions, and one-proportion z-tests.'),
  ('NC17.M4.SP.3', 'NC17.M4', 10, 'NC.M4.SP.3', 'Statistics and Probability', 'Probability distributions', 'Use probability distributions to make decisions under uncertainty. Covers discrete distributions and expected value, the binomial distribution, the normal approximation of sampling distributions, and normal probabilities.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('NC17.PC.N.1', 'NC17.PC', 1, 'PC.N.1', 'Number and Quantity', 'Complex number operations', 'Apply the properties of complex numbers and the complex number system. Covers adding, subtracting and multiplying complex numbers.'),
  ('NC17.PC.N.2', 'NC17.PC', 2, 'PC.N.2', 'Number and Quantity', 'Matrix operations', 'Apply the properties of matrix operations. Covers matrix addition and subtraction, associative, distributive and commutative properties, scalar multiplication, and matrix multiplication.'),
  ('NC17.PC.N.3', 'NC17.PC', 3, 'PC.N.3', 'Number and Quantity', 'Vector operations', 'Understand the properties of vectors and operate with them. Covers representing magnitude and direction, and adding and subtracting vectors.'),
  ('NC17.PC.A.1', 'NC17.PC', 4, 'PC.A.1', 'Algebra', 'Rational and polynomial inequalities', 'Solve one-variable inequalities involving rational and polynomial expressions. Covers sign analysis and graphical methods.'),
  ('NC17.PC.A.2', 'NC17.PC', 5, 'PC.A.2', 'Algebra', 'Exponential, logarithmic and trig equations', 'Solve equations involving exponential, logarithmic and trigonometric functions. Covers logarithm properties, exponential and logarithmic equations, trig equations with inverse functions and identities, and eliminating the parameter.'),
  ('NC17.PC.F.1', 'NC17.PC', 6, 'PC.F.1', 'Functions', 'Graphs of the six trig functions', 'Understand the key features of all six trigonometric functions. Covers features of transformed sine and cosine, of tangent, cotangent, secant and cosecant, building trig functions, and solving trig equations and inequalities.'),
  ('NC17.PC.F.2', 'NC17.PC', 7, 'PC.F.2', 'Functions', 'The unit circle', 'Use the unit circle to find values of the six trigonometric functions. Covers reference angles, and how the circle''s symmetry gives periodicity.'),
  ('NC17.PC.F.3', 'NC17.PC', 8, 'PC.F.3', 'Functions', 'Trigonometry of any triangle', 'Use trigonometry to solve problems with any triangle. Covers all solutions of inverse trig equations, the Law of Sines and Law of Cosines, and the Pythagorean identity.'),
  ('NC17.PC.F.4', 'NC17.PC', 9, 'PC.F.4', 'Functions', 'Exponential, log, rational functions, conics', 'Relate algebraic and graphical forms of exponential, logarithmic, rational and power functions and conic sections to their key features. Covers key features, growth and decay models, equations, optimization, transformations, and identifying conics.'),
  ('NC17.PC.F.5', 'NC17.PC', 10, 'PC.F.5', 'Functions', 'Composition and inverse functions', 'Build new functions by composition. Covers composing and evaluating composites, domains of composites, composition models, decomposing functions, finding inverses, and checking inverses by composition.'),
  ('NC17.PC.F.6', 'NC17.PC', 11, 'PC.F.6', 'Functions', 'Recursive functions', 'Build recursive functions to solve problems. Covers recursive functions from algebraic rules and from numerical sequences.'),
  ('NC17.PC.F.7', 'NC17.PC', 12, 'PC.F.7', 'Functions', 'Parametric functions', 'Build parametric functions to solve problems. Covers representing situations with parametric equations and solving contextual problems with technology.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

-- Math Kangaroo (mk): 6 levels, 48 topics

INSERT INTO curricula (id, name, source, edition, description, source_url, sort) VALUES
  ('mk', 'Math Kangaroo', 'Math Kangaroo (the international Kangaroo contest, Kangourou sans Frontières)', NULL, 'Practice in the style of the Math Kangaroo contest, one level per pair of grades as the contest has them. Each topic is a kind of contest problem; the questions are original, written for the bank after a review of the 2016-2025 papers, and the contest''s 3-, 4- and 5-point questions are the bank''s three difficulties.', NULL, 4)
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name, source = excluded.source, edition = excluded.edition,
  description = excluded.description, source_url = excluded.source_url, sort = excluded.sort
  WHERE curricula.organization_id IS NULL;

INSERT INTO curriculum_levels (id, curriculum_id, code, name, stage, grade_band, description) VALUES
  ('MK12', 'mk', NULL, 'Math Kangaroo Grades 1-2', 3001, 'Grades 1-2', 'The contest''s youngest level (Felix, or Pre-Ecolier).'),
  ('MK34', 'mk', NULL, 'Math Kangaroo Grades 3-4', 3002, 'Grades 3-4', 'The contest''s Ecolier level.'),
  ('MK56', 'mk', NULL, 'Math Kangaroo Grades 5-6', 3003, 'Grades 5-6', 'The contest''s Benjamin level.'),
  ('MK78', 'mk', NULL, 'Math Kangaroo Grades 7-8', 3004, 'Grades 7-8', 'The contest''s Kadett level.'),
  ('MK910', 'mk', NULL, 'Math Kangaroo Grades 9-10', 3005, 'Grades 9-10', 'The contest''s Junior level.'),
  ('MK1112', 'mk', NULL, 'Math Kangaroo Grades 11-12', 3006, 'Grades 11-12', 'The contest''s Student level.')
ON CONFLICT (id) DO UPDATE SET
  curriculum_id = excluded.curriculum_id, code = excluded.code, name = excluded.name,
  stage = excluded.stage, grade_band = excluded.grade_band, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('MK12.01', 'MK12', 1, NULL, 'Number', 'Counting and Numbers', 'Counting things described in words, how many whole numbers are in a range (house numbers 15 to 47), cuts and pieces of a rope, digits and two-digit numbers, and comparing numbers.'),
  ('MK12.02', 'MK12', 2, NULL, 'Number', 'Number Puzzles', 'Missing numbers in sums and differences, shapes standing for numbers, equal sums in rows, circles or boxes, sharing cards into groups with equal sums, and small number grids written row by row.'),
  ('MK12.03', 'MK12', 3, NULL, 'Reasoning', 'Patterns and Sequences', 'Repeating patterns of objects or colours (the 14th or the 27th item), alternating beads, two counts that move together (one climbs 3 steps while another goes down 2), and growing patterns.'),
  ('MK12.04', 'MK12', 4, NULL, 'Reasoning', 'Logic and Order', 'Ordering by clues (taller, older, on a higher shelf), places in a line (7th from the front, 2nd from the back), places in a race, who has which, and what must be true.'),
  ('MK12.05', 'MK12', 5, NULL, 'Geometry', 'Shapes and Space in Words', 'Shapes by their sides and corners, cubes glued in a row or a tower (drops of glue, faces that touch), the faces of a die, folding and cutting paper, turning left and right on a walk, and mirror letters, all described in words.'),
  ('MK12.06', 'MK12', 6, NULL, 'Number', 'Measuring, Time and Money', 'Weights from two weighings, lengths of sticks laid end to end or overlapping, prices from two purchases, days of the week and ages, and how long an activity with breaks takes.'),
  ('MK12.07', 'MK12', 7, NULL, 'Reasoning', 'Story Problems', 'Legs, wheels or humps of mixed animals and things, rooms and windows, points won and lost in a game, turns taken over several nights, working backwards, and guess and check.'),
  ('MK12.08', 'MK12', 8, NULL, 'Combinatorics', 'Counting Ways', 'Making numbers from given digits, pairs and dances, the sums possible when two numbers are chosen, paths on a small grid described in words, the most or fewest possible, and how many to take to be sure.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('MK34.01', 'MK34', 1, NULL, 'Number', 'Digits and Number Puzzles', 'Digits and place value in numbers up to four digits, digit sums of a year or a page number, the largest or smallest number from given digits, a missing digit in an addition written in a line, numbers filling a ring or a short chain so that sums match, and sorting numbers by a rule.'),
  ('MK34.02', 'MK34', 2, NULL, 'Number', 'Everyday Arithmetic Stories', 'Shopping, packages of several sizes and the fewest needed, leftovers and sharing with remainders, halves, thirds and quarters of a small group, change after buying, totals gathered over several days, and "how many more are needed" questions.'),
  ('MK34.03', 'MK34', 3, NULL, 'Algebra', 'Balances, Weights and Ages', 'Items that weigh the same, what balances on a scale described in words, two kinds of object with a known total, sharing a total so one share is twice or three times another, ages that differ by fixed amounts, and finding the one unknown by guess-and-check or working backwards.'),
  ('MK34.04', 'MK34', 4, NULL, 'Algebra', 'Patterns, Cycles and Calendars', 'Sequences that step by a constant or follow a repeating rule, a pattern that repeats every few places and which place falls where, days of the week from "yesterday" and "the day after tomorrow", weeks and days, timetables and clocks, and a bouncing back-and-forth journey between two ends.'),
  ('MK34.05', 'MK34', 5, NULL, 'Reasoning', 'Logic and Deduction', 'Who-is-who from clues, one child lying among several statements, ordering people or things by height, weight or rank, a small table where each row and column uses each symbol once, matching people to objects, and finding what must be true when some cases are excluded.'),
  ('MK34.06', 'MK34', 6, NULL, 'Combinatorics', 'Counting Ways and Orders', 'How many orders for a few people to line up, how many ordered pairs from a short list, ways to build a tower from some of the discs, ways to colour with restrictions, different figures from a small set of parts, and listing all cases systematically.'),
  ('MK34.07', 'MK34', 7, NULL, 'Geometry', 'Shapes, Folds and Moves', 'Naming and counting plane shapes in a described figure, symmetry and mirror lines of a shape, turning by quarter and half turns, folding a strip or a sheet once or twice and punching a hole (where do the holes land), and a path on a grid given as a list of direction moves.'),
  ('MK34.08', 'MK34', 8, NULL, 'Geometry', 'Solids, Lengths and Areas', 'Cubes in stacks and layers described in words, faces that are painted or hidden, dice with opposite faces adding to seven, perimeter and area by counting unit squares, a border of squares around a rectangle, and lengths of a fence or path made of equal pieces.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('MK56.01', 'MK56', 1, NULL, 'Number', 'Digits and Number Puzzles', 'Forming the largest or smallest number from given digits or by deleting digits, cutting a long digit string into parts and adding them, letters standing for digits in a sum, divisibility by 2, 3, 5, 9 and 18, place value and digit sums, and the numbers in a patterned product.'),
  ('MK56.02', 'MK56', 2, NULL, 'Number', 'Fractions and Parts of a Whole', 'Fractions of a quantity, a length or a group in words, cutting a rope or a cake into equal pieces and then cutting again, ratios and mixtures (parts of one to parts of another), chance as a fraction of equal parts, and comparing which part is bigger or which mixture is strongest.'),
  ('MK56.03', 'MK56', 3, NULL, 'Algebra', 'Word Problems with Totals', 'Ages and their sums, money and prices, packages and change-free payments, a total split into unequal parts, speeds and times, "twice as many" and "half as many", two situations of chairs short and chairs left over, and unknowns found by guess-and-check or reasoning.'),
  ('MK56.04', 'MK56', 4, NULL, 'Algebra', 'Sums and Patterns of Numbers', 'Numbers placed on a ring or a shape so every line has the same sum, an arithmetic sequence (a distance growing by the same amount), the middle value as a mean, balance scales and equal weights, chain calculations with hidden steps, and which numbers can sit where.'),
  ('MK56.05', 'MK56', 5, NULL, 'Reasoning', 'Truth-tellers and Clues', 'Knights and liars, who may say which statement, exactly one true note or exactly one lie, people lying only on certain days, ranking people from clues about who is ahead of whom, seating at a table, and what must be true whatever happens.'),
  ('MK56.06', 'MK56', 6, NULL, 'Combinatorics', 'Counting Ways', 'How many whole numbers or numbers with a property, arrangements of digits larger than a given number, ways to choose 3 of 7, colouring a row so neighbours differ, ordering cards or discs, bouquets of a fixed total from three prices, and counting with overlap or on both sides.'),
  ('MK56.07', 'MK56', 7, NULL, 'Geometry', 'Geometry in Words', 'Rectangles and squares with stated sides, area and perimeter, a square joined at midpoints, a rectangle cut at fractions, cubes made of unit cubes and how many faces are painted, a box and the height of water in it, a cube''s opposite faces, a sheet folded and cut into pieces, and a clock seen in a mirror or a figure turned a quarter.'),
  ('MK56.08', 'MK56', 8, NULL, 'Reasoning', 'Moves, Games and Extremes', 'Smallest number of swaps or moves, a game where the one who takes the last wins or loses, working backward from the end, "how many must you take to be sure" (pigeonhole), a walk that visits every place once, lines or regions that need different colours, a repeated process with a pattern, and time, clock and calendar steps.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('MK78.01', 'MK78', 1, NULL, 'Number', 'Whole Numbers and Digits', 'Place value and digits written in words (the largest or smallest number from given digit cards, last digit of a sum or product, digit sums), primes and divisibility rules, order of operations with brackets and negative numbers, consecutive integers, and number puzzles in which each letter or hidden digit stands for one digit.'),
  ('MK78.02', 'MK78', 2, NULL, 'Number', 'Fractions, Percents, Ratios', 'Fractions and percentages of a quantity, percentage increase and decrease and the reversal of a percentage change, fraction of a fraction, ratios of two amounts before and after a change, mixtures and concentrations (water in fresh and dried fruit, a paint blend), and comparing fractions by size.'),
  ('MK78.03', 'MK78', 3, NULL, 'Algebra', 'Equations in Stories', 'Ages, money and shares described in words, totals and differences of two unknowns, working backwards from a final amount, equal sharing and transfers between people, the same quantity said in two ways (a jar part full and nearly full), and grids or rows of numbers where neighbours obey a sum rule given in words.'),
  ('MK78.04', 'MK78', 4, NULL, 'Algebra', 'Speed, Time and Averages', 'Constant speed with distance, time and meeting or catching up (including the second meeting), laps on a circular track, clocks that run fast or slow, journeys on foot and by bike compared, and the mean of a list and how adding or removing a value changes it.'),
  ('MK78.05', 'MK78', 5, NULL, 'Combinatorics', 'Counting and Arrangements', 'Counting things described in words, how many whole numbers are in a range, numbers with only certain digits, lists of ways to arrange three to five objects with a restriction, routes on a grid moving only right or down, pairs and handshakes in a group, tournament matches, and the fewest picks that guarantee a result.'),
  ('MK78.06', 'MK78', 6, NULL, 'Reasoning', 'Logic and Patterns', 'Liars and truth-tellers, ordering people from comparisons, eliminating cases from clues, deducing a hidden code or an unknown from true-or-false statements, parity and remainder arguments, repeating patterns and cycles (a digit sequence, a clock, jumps along a line), and the position of an item in a very long sequence.'),
  ('MK78.07', 'MK78', 7, NULL, 'Geometry', 'Geometry in Words', 'Areas and perimeters of rectangles, squares and triangles built up or cut apart as described in words, composite shapes made of equal rectangles, fractions of a shape, angles in triangles and polygons (isosceles, equilateral, straight line, right angle), circles touching sides or each other, midpoints, and paper folded in two.'),
  ('MK78.08', 'MK78', 8, NULL, 'Geometry', 'Solids and Symmetry', 'Cubes and cuboids built from unit cubes (how many remain, are painted, are hidden), dice with opposite faces summing to 7, faces, edges and vertices of solids, surface area and volume of a cuboid, nets in words, and axes and rotational symmetry of letters, digits, polygons and simple figures given in text.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('MK910.01', 'MK910', 1, NULL, 'Number', 'Percentages, Ratios and Rates', 'Percentages and percentage change, ratios and proportion, means of a list and how they move when a value is added or removed, fractions of a quantity in a story (a share of a journey or a recipe), unit conversion, and speed, time, work and mixing with constant rates (two walkers on a track, a boat with and without a current).'),
  ('MK910.02', 'MK910', 2, NULL, 'Number', 'Divisibility, Primes and Digits', 'Divisibility rules and remainders, primes and prime factors, gcd and lcm, parity, digit sums and products, numbers built from digits with a condition (a palindrome, a number divisible by 6 or 9, a digit deleted), how many digits a number has, and the day of the week after a long time.'),
  ('MK910.03', 'MK910', 3, NULL, 'Algebra', 'Equations, Sequences and Patterns', 'Setting up and solving equations from words (ages, money, consecutive numbers), sums of squares and of consecutive numbers, a rule that builds a sequence and the term far along, a repeating cycle, the equation of a line and where it meets the axes, and expressions whose value can be found without finding each unknown.'),
  ('MK910.04', 'MK910', 4, NULL, 'Combinatorics', 'Counting and Probability', 'Counting arrangements, paths, routes, passwords and codes, choosing a few from many, dice sums and tickets, counting with a forbidden item, complementary counting, tilings and fills of a small table described in words, and a probability of equally likely outcomes.'),
  ('MK910.05', 'MK910', 5, NULL, 'Reasoning', 'Logic and Extremal Puzzles', 'Truth-tellers and liars, who-is-who from clues, seating and rankings, handshakes and tournaments, the pigeonhole ("how many must be taken to be sure of three alike"), smallest and largest possible under a rule, and number-placement puzzles where sums or products must agree.'),
  ('MK910.06', 'MK910', 6, NULL, 'Geometry', 'Areas, Lengths and Ratios of Figures', 'Areas and perimeters of rectangles, triangles, trapezia and circles given in words, a figure cut by midpoints or by lines into parts and the fraction of the whole, similar figures and scaling of area, the length of a segment through Pythagoras, and a square or rectangle with stated sides.'),
  ('MK910.07', 'MK910', 7, NULL, 'Geometry', 'Angles, Circles and Coordinates in Words', 'Angles in triangles, polygons and parallel lines, isosceles and equilateral triangles, the inscribed angle and the angle in a semicircle, tangents and chords with a stated radius, the triangle inequality, and points and lines given by coordinates (distance, a square on the grid, the triangle a line cuts off the axes).'),
  ('MK910.08', 'MK910', 8, NULL, 'Geometry', 'Cubes, Solids and Nets in Words', 'A cube cut from small cubes and painted (how many faces painted), dice and opposite faces, vertices, edges and faces of solids, surface area and volume of cuboids, the shortest route on a box, the way a net folds (with the net described by its squares), and flat figures folded or mirrored described in words.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES
  ('MK1112.01', 'MK1112', 1, NULL, 'Number', 'Digits and Divisibility', 'Questions about the digits of numbers: last digits of long products and powers, digit sums and what they tell about divisibility by 3, 9 and 11, numbers with a stated digit property (reversed digits, digit product, a digit deleted), counting multiples in a range, smallest or largest number with a given digit sum, and divisibility of a sum or difference that can be reasoned about without a calculator.'),
  ('MK1112.02', 'MK1112', 2, NULL, 'Number', 'Factors, Primes and Powers', 'Divisors of a number (how many, their sum or product, which are odd or square), prime factorisation and gcd of large numbers written as powers, the highest power of a prime that divides a product, factorial or sum of powers, numbers with exactly a given number of divisors, comparing sizes of numbers written as powers, and when a root or an expression is a whole number.'),
  ('MK1112.03', 'MK1112', 3, NULL, 'Algebra', 'Equations and Roots', 'Solving or reasoning about equations without a calculator: quadratics with sum and product of roots, expressions like x plus its reciprocal, absolute-value equations (how many solutions), exponent equations with a variable exponent, systems of two or three equations from a story, and a parameter that decides how many solutions an equation has.'),
  ('MK1112.04', 'MK1112', 4, NULL, 'Algebra', 'Functions, Sequences and Rates', 'Linear and quadratic functions described in words (intercepts, signs, intersections, the largest value on an interval), recursive sequences and number patterns of dots or squares, functional rules such as f(x+y) = f(x)f(y), and word problems on percent change, averages, scale, speed, work and mixing that reduce to one or two equations.'),
  ('MK1112.05', 'MK1112', 5, NULL, 'Combinatorics', 'Counting and Probability', 'Counting arrangements, selections, colourings, digit strings and paths described in words, "at least one" by complement, dice, coins, balls and boxes, tournaments with random pairings, a winning probability in a repeated game, and the pigeonhole idea of how many draws make a result certain.'),
  ('MK1112.06', 'MK1112', 6, NULL, 'Reasoning', 'Logic, Games and Puzzles', 'Knights and liars on a line, in a circle or at a table, statements of which a stated number are true, who-has-the-prize deduction, games where players alternately remove or add numbers, flipping a fixed number of coins or cells per move and asking which end states are possible, invariants (parity, remainders), and number placements in a row, ring or table with equal sums or a stated rule on neighbours.'),
  ('MK1112.07', 'MK1112', 7, NULL, 'Geometry', 'Plane Geometry in Words', 'Triangles, rectangles, squares and circles described in words: areas of a figure made of squares and circle parts, angles with tangents, chords and inscribed angles, right triangles with bisectors or an incircle, similar triangles and ratios of areas, regular hexagons and octagons, coordinates and midpoints, folding a strip of paper, a shortest route through a point on a line, and lattice points on a circle.'),
  ('MK1112.08', 'MK1112', 8, NULL, 'Geometry', 'Solids and Measurement', 'Cubes, cuboids, cylinders, pyramids and tetrahedra in words: surface area and volume, a cuboid painted and cut into unit cubes, a cylinder made by rolling a sheet, cutting corners off a solid, equal-volume solids with different dimensions, the shortest path on a surface by unfolding, and counting faces, edges and vertices of a polyhedron.')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, code = excluded.code,
  unit = excluded.unit, name = excluded.name, description = excluded.description;
