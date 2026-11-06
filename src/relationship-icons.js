// Compact, declarative previews of the relationship line vocabulary.
const icon = (...paths) => ({ size: 20, paths });
const solid = d => ({ d, fill: true });
const zig = 'M1 10 L3 7 5 13 7 7 9 13 11 7 13 13 15 7 17 13 19 10';
const zigShort = 'M1 10 L3 7 5 13 7 7 9 13 11 7 13 13 15 10';
const pair = ['M1 5 H19', 'M1 15 H19'];
const arrow = 'M15 7 L19 10 L15 13';
const triangle = 'M19 10 L14 7 L14 13 Z';
export const relationshipIcons = {
  close: icon(...pair),
  fused: icon(...pair, 'M1 10 H19'),
  distant: icon('M1 10 H4 M7 10 H10 M13 10 H16 M19 10 H20'),
  hostile: icon(zig),
  close_hostile: icon(...pair, zig),
  fused_hostile: icon(...pair, 'M1 10 H19', zig),
  focused_on: icon('M1 10 H19', arrow),
  negative_focused: icon(zigShort, arrow),
  caregiving: icon('M1 10 H19', arrow, 'M11 7 L15 10 L11 13'),
  cutoff: icon('M1 10 H7 M13 10 H19 M7 5 V15 M13 5 V15'),
  cutoff_repaired: icon('M1 10 H3 M5 10 H6 M14 10 H15 M17 10 H19 M6 5 V15 M14 5 V15 M8 10 A2 2 0 1 0 12 10 A2 2 0 1 0 8 10'),
  estranged: icon('M1 10 H3 M5 10 H7 M13 10 H15 M17 10 H19 M7 5 V15 M13 5 V15'),
  abuse_physical: icon(zigShort, solid(triangle)),
  abuse_emotional: icon(zigShort, triangle),
  abuse_sexual: icon('M1 5 H15', 'M1 15 H15', zigShort, solid(triangle)),
};
