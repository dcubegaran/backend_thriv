// Weekly Attendance maths, shared by the site page, the mobile app and the server (keep the copies the same:
// client/src/utils/labourAdvance.js and mobile_app/src/utils/labourAdvance.ts).
//
// A worker's advance can be saved as one total for a Monday–Sunday week. That total replaces the
// per-day advances typed in Add Labour for the worker's entries in that week.

/** YYYY-MM-DD of a stored entry date (entries are saved at UTC midnight of the chosen day) */
function dayOf(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/** Monday (YYYY-MM-DD) of the week a YYYY-MM-DD day falls in */
function weekStartOf(ymd) {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}

/** Last day (Sunday) of the week starting on weekStart */
function weekEndOf(weekStart) {
  const d = new Date(`${weekStart}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

/** True when start..end is exactly one Monday–Sunday week (only then can the weekly advance be edited) */
function isSingleWeek(start, end) {
  return Boolean(start) && weekStartOf(start) === start && weekEndOf(start) === end;
}

/** One worker + labour type: the Weekly Attendance row key */
function workerKeyOf(log) {
  return `${log.workerId || log.workerNameSnapshot}-${log.labourTypeId || log.labourTypeNameSnapshot}`;
}

const savedMap = saved => new Map((saved || []).map(a => [`${a.workerKey}|${a.weekStart}`, Number(a.amount) || 0]));

// Groups logs by worker and week. Per group:
// - with a saved total: advance = the total; it pays off salary already marked paid first, so
//   remaining = unpaid salary - (advance beyond the paid salary); money spent = max(advance, paid salary)
// - without: the per-day advances; remaining = unpaid salary - unpaid entries' advances;
//   money spent = per entry, paid ? max(salary, advance) : advance
function weekGroups(logs, saved) {
  const totals = savedMap(saved);
  const groups = new Map();
  logs.forEach(log => {
    const key = workerKeyOf(log);
    const weekStart = weekStartOf(dayOf(log.date));
    const id = `${key}|${weekStart}`;
    const g = groups.get(id) || {
      key, weekStart, logs: [], salary: 0, paidSalary: 0, unpaidSalary: 0, dayAdvance: 0, unpaidDayAdvance: 0, paid: true,
    };
    const salary = Number(log.totalAmount || 0);
    const advance = Number(log.advancePaid || 0);
    g.logs.push(log);
    g.salary += salary;
    g.dayAdvance += advance;
    if (log.paid) g.paidSalary += salary;
    else { g.unpaidSalary += salary; g.unpaidDayAdvance += advance; }
    g.paid = g.paid && Boolean(log.paid);
    groups.set(id, g);
  });
  return [...groups.values()].map(g => {
    const hasSaved = totals.has(`${g.key}|${g.weekStart}`);
    const saved = totals.get(`${g.key}|${g.weekStart}`) || 0;
    return hasSaved
      ? { ...g, saved: true, advance: saved, remaining: g.unpaidSalary - Math.max(0, saved - g.paidSalary), spend: Math.max(saved, g.paidSalary) }
      : {
        ...g,
        saved: false,
        advance: g.dayAdvance,
        remaining: g.unpaidSalary - g.unpaidDayAdvance,
        spend: g.logs.reduce((s, l) => s + (l.paid ? Math.max(Number(l.totalAmount || 0), Number(l.advancePaid || 0)) : Number(l.advancePaid || 0)), 0),
      };
  });
}

/**
 * Weekly Attendance rows for the entries dated start..end (YYYY-MM-DD, either may be empty).
 * Negative remaining = more advance was given than the salary still owed.
 */
function buildAttendanceRows(logs, saved, start, end) {
  const inRange = logs.filter(log => {
    const day = dayOf(log.date);
    return (!start || day >= start) && (!end || day <= end);
  });
  const rows = new Map();
  weekGroups(inRange, saved).forEach(g => {
    const first = g.logs[0];
    const row = rows.get(g.key) || {
      key: g.key,
      workerName: first.workerNameSnapshot,
      labourType: first.labourTypeNameSnapshot,
      days: 0, totalSalary: 0, advancePaid: 0, remaining: 0, paid: true, labourLogIds: [],
    };
    row.days += g.logs.reduce((s, l) => s + Number(l.days || 0), 0);
    row.totalSalary += g.salary;
    row.advancePaid += g.advance;
    row.remaining += g.remaining;
    row.paid = row.paid && g.paid;
    g.logs.forEach(l => row.labourLogIds.push(String(l._id)));
    rows.set(g.key, row);
  });
  return [...rows.values()].sort((a, b) => a.workerName.localeCompare(b.workerName));
}

/** Labour money spent on the site so far (all entries) */
function labourSpend(logs, saved) {
  return weekGroups(logs, saved).reduce((s, g) => s + g.spend, 0);
}

module.exports = { dayOf, weekStartOf, weekEndOf, isSingleWeek, workerKeyOf, buildAttendanceRows, labourSpend };
