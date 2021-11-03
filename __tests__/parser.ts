import { Parser } from "../lib/parser";

it("Normal directory", () => {
  expect(
    Parser.parseListEntry("drwxr-xr-x  10 root   root    4096 Dec 21  2012 usr")
  ).toEqual({
    type: "d",
    name: "usr",
    target: undefined,
    sticky: false,
    rights: { user: "rwx", group: "rx", other: "rx" },
    acl: false,
    owner: "root",
    group: "root",
    size: 4096,
    date: new Date("2012-12-21T00:00"),
  });

  expect(
    Parser.parseListEntry(
      "drwxrwxrwx   1 owner   group          0 Aug 31 2012 e-books"
    )
  ).toEqual({
    type: "d",
    name: "e-books",
    target: undefined,
    sticky: false,
    rights: { user: "rwx", group: "rwx", other: "rwx" },
    acl: false,
    owner: "owner",
    group: "group",
    size: 0,
    date: new Date("2012-08-31T00:00"),
  });
});

it("Normal file", () => {
  expect(
    Parser.parseListEntry(
      "-rw-rw-rw-   1 owner   group    7045120 Sep 02  2012 music.mp3"
    )
  ).toEqual({
    type: "-",
    name: "music.mp3",
    target: undefined,
    sticky: false,
    rights: { user: "rw", group: "rw", other: "rw" },
    acl: false,
    owner: "owner",
    group: "group",
    size: 7045120,
    date: new Date("2012-09-02T00:00"),
  });
});

it("File with ACL set", () => {
  expect(
    Parser.parseListEntry(
      "-rw-rw-rw-+   1 owner   group    7045120 Sep 02  2012 music.mp3"
    )
  ).toEqual({
    type: "-",
    name: "music.mp3",
    target: undefined,
    sticky: false,
    rights: { user: "rw", group: "rw", other: "rw" },
    acl: true,
    owner: "owner",
    group: "group",
    size: 7045120,
    date: new Date("2012-09-02T00:00"),
  });
});

it("Directory with sticky bit and executable for others", () => {
  expect(
    Parser.parseListEntry("drwxrwxrwt   7 root   root    4096 May 19 2012 tmp")
  ).toEqual({
    type: "d",
    name: "tmp",
    target: undefined,
    sticky: true,
    rights: { user: "rwx", group: "rwx", other: "rwx" },
    acl: false,
    owner: "root",
    group: "root",
    size: 4096,
    date: new Date("2012-05-19T00:00"),
  });

  expect(
    Parser.parseListEntry("drwxrwx--t   7 root   root    4096 May 19 2012 tmp")
  ).toEqual({
    type: "d",
    name: "tmp",
    target: undefined,
    sticky: true,
    rights: { user: "rwx", group: "rwx", other: "x" },
    acl: false,
    owner: "root",
    group: "root",
    size: 4096,
    date: new Date("2012-05-19T00:00"),
  });

  expect(
    Parser.parseListEntry("drwxrwxrwT   7 root   root    4096 May 19 2012 tmp")
  ).toEqual({
    type: "d",
    name: "tmp",
    target: undefined,
    sticky: true,
    rights: { user: "rwx", group: "rwx", other: "rw" },
    acl: false,
    owner: "root",
    group: "root",
    size: 4096,
    date: new Date("2012-05-19T00:00"),
  });

  expect(
    Parser.parseListEntry("drwxrwx--T   7 root   root    4096 May 19 2012 tmp")
  ).toEqual({
    type: "d",
    name: "tmp",
    target: undefined,
    sticky: true,
    rights: { user: "rwx", group: "rwx", other: "" },
    acl: false,
    owner: "root",
    group: "root",
    size: 4096,
    date: new Date("2012-05-19T00:00"),
  });
});

it("Ignored line", () => {
  expect(Parser.parseListEntry("total 871")).toEqual(null);
});
