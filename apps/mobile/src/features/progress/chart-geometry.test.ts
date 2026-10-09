import { COMPACT, FULL, chartGeometry, nearestMark, orderedMarks, pathLength, toDay } from './chart-geometry';

const plan = { starts_on: '2026-09-01', target_on: '2027-06-15' };
const timeline = [
  { occurred_on: '2026-09-08', percent: 0 },
  { occurred_on: '2026-09-15', percent: 11 },
];

describe('chartGeometry', () => {
  const width = 340;
  const g = chartGeometry({
    plan,
    summary: { start_percent: 0 },
    timeline,
    today: '2026-10-08',
    width,
    size: FULL,
  });

  it('maps the plan start to the left edge and the goal date to the right', () => {
    expect(g.x(toDay(plan.starts_on))).toBeCloseTo(FULL.margin.left);
    expect(g.x(toDay(plan.target_on))).toBeCloseTo(width - FULL.margin.right);
  });

  it('maps 0% to the baseline and 100% to the top of the plot', () => {
    expect(g.y(0)).toBeCloseTo(FULL.height - FULL.margin.bottom);
    expect(g.y(100)).toBeCloseTo(FULL.margin.top);
  });

  it('draws the pace line from nothing at the start to everything at the goal', () => {
    expect(g.pace).toEqual({ x1: g.x(g.start), y1: g.y(0), x2: g.x(g.goal), y2: g.y(100) });
  });

  it('steps at each lesson and carries the line on to today', () => {
    // Start, then a flat run and a step per lesson, then today.
    expect(g.line.split(' ')).toHaveLength(1 + 2 * timeline.length + 1);
    expect(g.endPoint[0]).toBeCloseTo(g.x(toDay('2026-10-08')));
    expect(g.endPoint[1]).toBeCloseTo(g.y(11));
  });

  it('runs the timeline on past the goal when today is later', () => {
    const late = chartGeometry({
      plan,
      summary: { start_percent: 0 },
      timeline,
      today: '2027-08-01',
      width,
      size: FULL,
    });
    expect(late.x(toDay('2027-08-01'))).toBeCloseTo(width - FULL.margin.right);
    expect(late.x(late.goal)).toBeLessThan(width - FULL.margin.right);
  });

  it('thins the month ticks so labels never collide', () => {
    const narrow = chartGeometry({
      plan,
      summary: { start_percent: 0 },
      timeline,
      today: '2026-10-08',
      width: 280,
      size: FULL,
    });
    const gaps = narrow.ticks.slice(1).map((day, index) => narrow.x(day) - narrow.x(narrow.ticks[index]!));
    expect(narrow.ticks.length).toBeGreaterThan(1);
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(40);
  });

  it('keeps the compact size for the dashboard cards', () => {
    const compact = chartGeometry({
      plan,
      summary: { start_percent: 0 },
      timeline,
      today: '2026-10-08',
      width: 240,
    });
    expect(compact.y(0)).toBeCloseTo(COMPACT.height - COMPACT.margin.bottom);
  });

  it('measures the line it draws', () => {
    expect(
      pathLength([
        [0, 0],
        [3, 4],
        [3, 10],
      ]),
    ).toBe(11);
    expect(g.lineLength).toBeGreaterThan(g.endPoint[0] - g.x(g.start));
  });
});

describe('nearestMark', () => {
  const g = chartGeometry({
    plan,
    summary: { start_percent: 0 },
    timeline,
    today: '2026-10-08',
    width: 340,
    size: FULL,
  });
  const cancellations = [{ occurs_on: '2026-11-24' }];

  it('snaps a finger to the nearest lesson', () => {
    expect(nearestMark(g.x(toDay('2026-09-14')), g.x, timeline, cancellations)).toEqual({
      kind: 'lesson',
      index: 1,
    });
  });

  it('finds a cancelled lesson as well', () => {
    expect(nearestMark(g.x(toDay('2026-11-23')), g.x, timeline, cancellations)).toEqual({
      kind: 'cancelled',
      index: 0,
    });
  });

  it('selects nothing out of reach', () => {
    expect(nearestMark(g.x(toDay('2027-04-01')), g.x, timeline, cancellations)).toBeNull();
  });

  it('orders every mark by date for the screen reader', () => {
    expect(orderedMarks([{ occurred_on: '2026-12-01' }, ...timeline], cancellations)).toEqual([
      { kind: 'lesson', index: 1 },
      { kind: 'lesson', index: 2 },
      { kind: 'cancelled', index: 0 },
      { kind: 'lesson', index: 0 },
    ]);
  });
});
