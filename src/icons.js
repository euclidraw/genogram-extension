// Pure 20×20 path data: shared by the host, independent of its named icon set.
const icon = (...paths) => ({ size: 20, paths });
const person = "M7 5a3 3 0 1 0 6 0a3 3 0 1 0-6 0M4 18v-3a6 6 0 0 1 12 0v3";
export const icons = {
  move: icon(
    "M10 2v16M2 10h16M7 5l3-3 3 3M7 15l3 3 3-3M5 7l-3 3 3 3M15 7l3 3-3 3",
  ),
  "add-person": icon(person, "M15 6h5M17.5 3.5v5"),
  "edit-person": icon("M4 14 14 4l3 3L7 17H4zM12 6l3 3"),
  "older-sibling": icon("M8 6 4 10l4 4M4 10h12M12 5v10"),
  "younger-sibling": icon("M12 6l4 4-4 4M16 10H4M8 5v10"),
  "add-partner": icon(
    "M2 4h5v5H2zM13 6a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M4.5 11v4h11v-4M10 15v4",
  ),
  "add-child": icon(
    "M3 3h5v5H3zM12 3h5v5h-5zM5.5 8v3h9V8M10 11v4M7.5 15h5v4h-5z",
  ),
  "add-parents": icon(
    "M3 3h5v5H3zM12 3h5v5h-5zM5.5 8v3h9V8M10 11v5M7 15l3 3 3-3",
  ),
  "add-twin": icon("M10 2v5M10 7 4 14M10 7l6 7M2 14h4v4H2zM14 14h4v4h-4z"),
  "connect-union": icon("M2 3h5v5H2zM13 3h5v5h-5zM4.5 9v6h11V9"),
  "connect-parentage": icon(
    "M3 2h5v5H3zM12 2h5v5h-5zM5.5 8v3h9V8M10 11v4M8 15h4v4H8z",
  ),
  "connect-twins": icon("M10 2v5M10 7 4 14M10 7l6 7M4 11h12"),
  "connect-relation": icon("M2 10h3l2-5 3 10 3-10 2 5h3"),
  reverse: icon("M3 6h14l-4-4M17 14H3l4 4"),
  household: icon("M2 10 10 3l8 7M4 9v9h12V9M8 18v-6h4v6"),
  "toggle-membership": icon("M2 10 10 3l8 7M4 9v9h8M14 15h6M17 12v6"),
  "tidy-layout": icon("M2 4h16M2 10h16M2 16h16M5 2v4M10 8v4M15 14v4"),
  privacy: icon("M2 10q8-12 16 0q-8 12-16 0M8 10a2 2 0 1 0 4 0a2 2 0 1 0-4 0"),
  "mask-years": icon("M3 4h14v14H3zM3 8h14M6 2v4M14 2v4M6 12h8M6 15h4"),
  "show-relations": icon("M2 10h4l2-5 4 10 2-5h4"),
  "show-households": icon("M2 10 10 3l8 7M4 9v9h12V9"),
  "show-notes": icon("M4 2h12v16H4zM7 6h6M7 10h6M7 14h4"),
};
for (const name of [
  "template-nuclear",
  "template-three-generation",
  "template-single-parent",
  "template-remarried",
])
  icons[name] = icons["add-child"];
for (const name of [
  "relation-close",
  "relation-fused",
  "relation-hostile",
  "relation-cutoff",
  "relation-focused_on",
])
  icons[name] = icons["connect-relation"];
