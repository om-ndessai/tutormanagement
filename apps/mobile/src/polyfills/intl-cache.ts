// Reuse Intl formatters instead of building a new one on every call.
//
// Hermes on Android builds an Intl formatter 30-45x slower than on iOS (measured on the API 37
// emulator: ~5 ms per toLocaleDateString, ~6 ms per formatCents, ~9 ms per formatRelativeTime,
// against 0.1-0.2 ms on iOS). `toLocaleString`, `toLocaleDateString` and the shared package's
// formatters build one per call, and a dashboard re-rendering each second (a countdown, a live
// timer) then keeps the JS thread busy without pause -- the screen stalls and UI Automator never
// sees it go idle. One formatter per (locale, options) is built once and reused, here at the
// engine edge, so every caller -- the shared package included -- gets the fast path.
type Options = Record<string, unknown> | undefined;

function keyOf(locales: unknown, options: Options): string {
  return JSON.stringify([locales ?? null, options ?? null]);
}

// Formatting itself is slow there too (~2 ms per date, ~9 ms per relative time), and screens
// format the same few values on every render: each cached formatter also remembers its
// results, in a bounded memo.
const MEMO_LIMIT = 2000;

function memoizeFormat<T extends { format: (...args: never[]) => string }>(formatter: T): T {
  const original = formatter.format.bind(formatter) as (...args: unknown[]) => string;
  const memo = new Map<string, string>();
  Object.defineProperty(formatter, 'format', {
    configurable: true,
    value: (...args: unknown[]) => {
      const key = args.map((arg) => (arg instanceof Date ? `d${arg.getTime()}` : String(arg))).join('|');
      let result = memo.get(key);
      if (result === undefined) {
        result = original(...args);
        if (memo.size >= MEMO_LIMIT) memo.clear();
        memo.set(key, result);
      }
      return result;
    },
  });
  return formatter;
}

function cached<T extends { format: (...args: never[]) => string }>(
  cache: Map<string, T>,
  key: string,
  make: () => T,
): T {
  let value = cache.get(key);
  if (value === undefined) {
    value = memoizeFormat(make());
    cache.set(key, value);
  }
  return value;
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();

const NativeNumberFormat = Intl.NumberFormat;
const NativeDateTimeFormat = Intl.DateTimeFormat;
const NativeRelativeTimeFormat = Intl.RelativeTimeFormat;

// Number.prototype.toLocaleString -> a cached NumberFormat (formatCents).
Number.prototype.toLocaleString = function toLocaleString(locales?: unknown, options?: Options) {
  return cached(
    numberFormats,
    keyOf(locales, options),
    () => new NativeNumberFormat(locales as string, options),
  ).format(this.valueOf());
};

// Date.prototype.toLocale{,Date,Time}String -> a cached DateTimeFormat, with each method's
// default fields when none are given (as the spec does).
function dateMethod(defaults: Intl.DateTimeFormatOptions) {
  return function (this: Date, locales?: unknown, options?: Options) {
    const asked = options ?? {};
    const hasFields = [
      'weekday',
      'year',
      'month',
      'day',
      'hour',
      'minute',
      'second',
      'dateStyle',
      'timeStyle',
    ].some((field) => field in asked);
    const resolved = hasFields ? asked : { ...defaults, ...asked };
    return cached(
      dateFormats,
      keyOf(locales, resolved),
      () => new NativeDateTimeFormat(locales as string, resolved),
    ).format(this);
  };
}
Date.prototype.toLocaleDateString = dateMethod({ year: 'numeric', month: 'numeric', day: 'numeric' });
Date.prototype.toLocaleTimeString = dateMethod({ hour: 'numeric', minute: 'numeric', second: 'numeric' });
Date.prototype.toLocaleString = dateMethod({
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

// `new Intl.RelativeTimeFormat(...)` / `new Intl.DateTimeFormat(...)` -> the cached instance
// (formatRelativeTime builds one per call). Formatters are immutable, so sharing is safe.
function cachingConstructor<T extends { format: (...args: never[]) => string }>(
  Native: new (l?: string, o?: Options) => T,
  cache: Map<string, T>,
) {
  const Wrapped = function (this: unknown, locales?: string, options?: Options) {
    return cached(cache, keyOf(locales, options), () => new Native(locales, options));
  } as unknown as typeof Native;
  Object.setPrototypeOf(Wrapped, Native);
  (Wrapped as unknown as { prototype: unknown }).prototype = (
    Native as unknown as { prototype: unknown }
  ).prototype;
  return Wrapped;
}
Object.defineProperty(Intl, 'RelativeTimeFormat', {
  configurable: true,
  writable: true,
  value: cachingConstructor(
    NativeRelativeTimeFormat as unknown as new (l?: string, o?: Options) => Intl.RelativeTimeFormat,
    relativeFormats,
  ),
});
Object.defineProperty(Intl, 'DateTimeFormat', {
  configurable: true,
  writable: true,
  value: cachingConstructor(
    NativeDateTimeFormat as unknown as new (l?: string, o?: Options) => Intl.DateTimeFormat,
    dateFormats,
  ),
});
