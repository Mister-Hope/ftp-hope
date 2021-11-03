import { cache } from "xregexp";

export const REX_TIMEVAL = XRegExp.cache(
  "^(?<year>\\d{4})(?<month>\\d{2})(?<date>\\d{2})(?<hour>\\d{2})(?<minute>\\d{2})(?<second>\\d+)(?:.\\d+)?$"
);
export const RE_PASV = /([\d]+),([\d]+),([\d]+),([\d]+),([-\d]+),([-\d]+)/u;
export const RE_WD = /"(.+)"(?: |$)/u;
export const RE_SYST = /^([^ ]+)(?: |$)/u;

export const REX_LISTUNIX = cache(
  "^(?<type>[\\-ld])(?<permission>([\\-r][\\-w][\\-xstT]){3})(?<acl>(\\+))?\\s+(?<inodes>\\d+)\\s+(?<owner>\\S+)\\s+(?<group>\\S+)\\s+(?<size>\\d+)\\s+(?<timestamp>((?<month1>\\w{3})\\s+(?<date1>\\d{1,2})\\s+(?<hour>\\d{1,2}):(?<minute>\\d{2}))|((?<month2>\\w{3})\\s+(?<date2>\\d{1,2})\\s+(?<year>\\d{4})))\\s+(?<name>.+)$",
  ""
);
export const REX_LISTMSDOS = cache(
  "^(?<month>\\d{2})(?:\\-|\\/)(?<date>\\d{2})(?:\\-|\\/)(?<year>\\d{2,4})\\s+(?<hour>\\d{2}):(?<minute>\\d{2})\\s{0,1}(?<ampm>[AaMmPp]{1,2})\\s+(?:(?<size>\\d+)|(?<isdir>\\<DIR\\>))\\s+(?<name>.+)$",
  ""
);
export const RE_ENTRY_TOTAL = /^total/;
export const RE_RES_END = /(?:^|\r?\n)(\d{3}) [^\r\n]*\r?\n/;
export const RE_EOL = /\r?\n/g;
export const RE_DASH = /-/g;

export const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export const RETVAL = {
  PRELIM: 1,
  OK: 2,
  WAITING: 3,
  ERR_TEMP: 4,
  ERR_PERM: 5,
};

export const bytesNOOP = Buffer.from("NOOP\r\n");
