// src/icons.js
var icon$1 = (...paths) => ({
	size: 20,
	paths
});
var icons = {
	move: icon$1("M10 2v16M2 10h16M7 5l3-3 3 3M7 15l3 3 3-3M5 7l-3 3 3 3M15 7l3 3-3 3"),
	"add-person": icon$1("M7 5a3 3 0 1 0 6 0a3 3 0 1 0-6 0M4 18v-3a6 6 0 0 1 12 0v3", "M15 6h5M17.5 3.5v5"),
	"edit-person": icon$1("M4 14 14 4l3 3L7 17H4zM12 6l3 3"),
	"older-sibling": icon$1("M8 6 4 10l4 4M4 10h12M12 5v10"),
	"younger-sibling": icon$1("M12 6l4 4-4 4M16 10H4M8 5v10"),
	"add-partner": icon$1("M2 4h5v5H2zM13 6a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M4.5 11v4h11v-4M10 15v4"),
	"add-child": icon$1("M3 3h5v5H3zM12 3h5v5h-5zM5.5 8v3h9V8M10 11v4M7.5 15h5v4h-5z"),
	"add-parents": icon$1("M3 3h5v5H3zM12 3h5v5h-5zM5.5 8v3h9V8M10 11v5M7 15l3 3 3-3"),
	"add-twin": icon$1("M10 2v5M10 7 4 14M10 7l6 7M2 14h4v4H2zM14 14h4v4h-4z"),
	"connect-union": icon$1("M2 3h5v5H2zM13 3h5v5h-5zM4.5 9v6h11V9"),
	"connect-parentage": icon$1("M3 2h5v5H3zM12 2h5v5h-5zM5.5 8v3h9V8M10 11v4M8 15h4v4H8z"),
	"connect-twins": icon$1("M10 2v5M10 7 4 14M10 7l6 7M4 11h12"),
	"connect-relation": icon$1("M2 10h3l2-5 3 10 3-10 2 5h3"),
	reverse: icon$1("M3 6h14l-4-4M17 14H3l4 4"),
	household: icon$1("M2 10 10 3l8 7M4 9v9h12V9M8 18v-6h4v6"),
	"toggle-membership": icon$1("M2 10 10 3l8 7M4 9v9h8M14 15h6M17 12v6"),
	"tidy-layout": icon$1("M2 4h16M2 10h16M2 16h16M5 2v4M10 8v4M15 14v4"),
	privacy: icon$1("M2 10q8-12 16 0q-8 12-16 0M8 10a2 2 0 1 0 4 0a2 2 0 1 0-4 0"),
	"mask-years": icon$1("M3 4h14v14H3zM3 8h14M6 2v4M14 2v4M6 12h8M6 15h4"),
	"show-relations": icon$1("M2 10h4l2-5 4 10 2-5h4"),
	"show-households": icon$1("M2 10 10 3l8 7M4 9v9h12V9"),
	"show-notes": icon$1("M4 2h12v16H4zM7 6h6M7 10h6M7 14h4")
};
for (const name of [
	"template-nuclear",
	"template-three-generation",
	"template-single-parent",
	"template-remarried"
]) icons[name] = icons["add-child"];
for (const name of [
	"relation-close",
	"relation-fused",
	"relation-hostile",
	"relation-cutoff",
	"relation-focused_on"
]) icons[name] = icons["connect-relation"];
// src/model.js
var prefix = "diagram.genogram";
var ids = Object.fromEntries([
	"person",
	"union",
	"parentage",
	"relation",
	"household"
].map((k) => [k, `${prefix}.${k}`]));
var defaults = {
	person: {
		symbol: "unknown",
		orientation: "none",
		lifeStatus: "alive",
		isIndexPerson: false,
		clinical: "none",
		smoking: false,
		obesity: false,
		languageDifficulty: false,
		name: "",
		ageLabel: "",
		yearSpan: "",
		note: "",
		birthOrderHint: 0,
		householdId: null
	},
	union: {
		partnerA: null,
		partnerB: null,
		status: "marriage",
		barOffset: 44,
		label: ""
	},
	parentage: {
		parentA: null,
		parentB: null,
		union: null,
		child: null,
		pedigree: "biological",
		twinWith: null,
		twinType: "none",
		barRatio: .5
	},
	relation: {
		from: null,
		to: null,
		kind: "close",
		curveOffset: 0,
		color: "#dc2626",
		label: ""
	},
	household: {
		label: "동거 가구",
		padding: 28,
		strokeStyle: "dashed",
		color: "#475569",
		fallbackX: 0,
		fallbackY: 0
	}
};
var commandNames = [
	"edit-person",
	"add-person",
	"older-sibling",
	"younger-sibling",
	"add-partner",
	"add-child",
	"add-parents",
	"add-twin",
	"connect-relation",
	"connect-union",
	"connect-parentage",
	"connect-twins",
	"relation-close",
	"relation-fused",
	"relation-hostile",
	"relation-cutoff",
	"relation-focused_on",
	"reverse",
	"household",
	"toggle-membership",
	"template-nuclear",
	"template-three-generation",
	"template-single-parent",
	"template-remarried",
	"tidy-layout",
	"privacy",
	"mask-years",
	"show-relations",
	"show-households",
	"show-notes"
];
var escapeXml = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;",
	"'": "&apos;"
})[c]);
var finite = (v, d = 0) => Number.isFinite(v) ? v : d;
var lens = {
	privacy: "full",
	maskYears: false,
	showRelations: true,
	showHouseholds: true,
	showNotes: true
};
function display(v, type) {
	v = String(v ?? "");
	if (type === "name") {
		if (lens.privacy === "hidden") return "";
		if (lens.privacy === "surname_masked") return v ? `${v[0]}○○` : "";
		if (lens.privacy === "initials") return Array.from(v).map((c) => {
			const n = c.charCodeAt(0) - 44032;
			return n >= 0 && n < 11172 ? "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"[Math.floor(n / 588)] : c[0];
		}).join("");
	}
	return lens.maskYears ? v.replace(/\b(\d{3})\d\b/g, "$1*") : v;
}
function personBounds(view, id) {
	if (!id || !view.isAlive(id) || !view.getCanonical(id, ids.person)) return;
	return view.getComputed(id, "computed.layoutBounds");
}
// src/preferences.js
var settingsSchema = [{
	key: "privacy",
	label: "이름 표시",
	kind: "select",
	defaultValue: "full",
	options: [
		{
			value: "full",
			label: "전체"
		},
		{
			value: "surname_masked",
			label: "성씨만"
		},
		{
			value: "initials",
			label: "이니셜"
		},
		{
			value: "hidden",
			label: "숨김"
		}
	]
}, ...Object.entries({
	maskYears: ["연도 마스킹", false],
	showRelations: ["정서 관계선", true],
	showHouseholds: ["동거 가구", true],
	showNotes: ["임상 메모", true]
}).map(([key, [label, defaultValue]]) => ({
	key,
	label,
	kind: "boolean",
	defaultValue
}))];
function bindPreferences(context) {
	const control = context.services.get("extensions.preferences");
	function refresh() {
		if (!control) return;
		for (const field of settingsSchema) lens[field.key] = control.get(field.key);
		context.world.invalidateComputed();
	}
	refresh();
	const off = control?.subscribe(refresh);
	return {
		change(key, value) {
			if (control) control.set(key, value);
			else {
				lens[key] = value;
				context.world.invalidateComputed();
			}
		},
		dispose() {
			off?.();
		}
	};
}
// src/ui-labels.js
var labels$1 = {
	symbol: "인물 기호",
	orientation: "성적 지향 표시",
	clinical: "임상 상태",
	lifeStatus: "생존 상태",
	status: "결합 상태",
	pedigree: "자녀 관계",
	twinType: "쌍둥이",
	kind: "정서 관계",
	strokeStyle: "테두리",
	male: "남성",
	female: "여성",
	unknown: "미상",
	trans_male: "트랜스 남성",
	trans_female: "트랜스 여성",
	nonbinary: "논바이너리",
	pregnancy: "임신",
	miscarriage: "자연유산",
	abortion: "인공유산",
	stillbirth_male: "사산 남",
	stillbirth_female: "사산 여",
	pet: "반려동물",
	none: "없음",
	gay: "동성애 남성",
	lesbian: "동성애 여성",
	bisexual: "양성애",
	physical: "신체 질환",
	mental: "정신 건강",
	substance: "약물·알코올 남용",
	suspected_substance: "약물·알코올 남용 의심",
	recovery_with_illness: "질환 및 물질 사용 회복",
	smoking: "흡연",
	obesity: "비만",
	languageDifficulty: "언어 문제",
	mental_substance: "심각한 정신·신체 문제 및 물질 사용",
	recovering: "회복 중 (유형 미지정)",
	substance_recovery: "물질 사용 회복 중",
	illness_remission: "신체·정신 질환 관해",
	alive: "생존",
	deceased: "사망",
	marriage: "혼인",
	engagement: "약혼",
	cohabitation: "동거",
	separation: "별거",
	divorce: "이혼",
	reunion_divorce: "이혼 후 재결합",
	reunion_separation: "별거 후 재결합",
	secret_affair: "비공식 관계",
	biological: "친생",
	adopted: "입양",
	foster: "위탁",
	surrogate: "대리 출생",
	fraternal: "이란성",
	identical: "일란성",
	close: "친밀",
	fused: "융합",
	distant: "소원",
	hostile: "갈등",
	fused_hostile: "융합·갈등",
	close_hostile: "친밀·갈등",
	negative_focused: "부정적 관계집중",
	caregiving: "돌봄",
	cutoff: "단절",
	cutoff_repaired: "단절 후 회복",
	estranged: "거리·단절",
	focused_on: "집중",
	abuse_physical: "신체 학대",
	abuse_emotional: "정서 학대",
	abuse_sexual: "성적 학대",
	dashed: "파선",
	dotted: "점선",
	name: "이름",
	ageLabel: "나이",
	yearSpan: "출생·사망 연도",
	note: "임상 메모"
};
// src/aspects/person.js
var symbols = [
	"male",
	"female",
	"unknown",
	"trans_male",
	"trans_female",
	"nonbinary",
	"pregnancy",
	"miscarriage",
	"abortion",
	"stillbirth_male",
	"stillbirth_female",
	"pet"
];
/** Symbol box in the person's local frame; every symbol is drawn inside it. */
var SYMBOL = {
	top: 6,
	bottom: 58,
	half: 26
};
/** Half-size of a death cross; stillbirth symbols retain their smaller cross. */
function deathMarkSpan(p) {
	if (p.lifeStatus !== "deceased" && !String(p.symbol ?? "").startsWith("stillbirth")) return 0;
	return String(p.symbol ?? "").startsWith("stillbirth") ? 22 : p.isIndexPerson ? 35 : 32;
}
var graphemeSegmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(void 0, { granularity: "grapheme" }) : null;
/** Wrap notes conservatively without scaling glyphs or changing the saved text. */
function noteLines(value, width = 120) {
	const limit = Math.max(1, Math.floor(Math.max(12, width - 8) / 12)), output = [];
	for (const paragraph of String(value ?? "").split("\n")) {
		const chars = graphemeSegmenter ? Array.from(graphemeSegmenter.segment(paragraph), (part) => part.segment) : Array.from(paragraph);
		if (!chars.length) output.push("");
		for (let i = 0; i < chars.length;) {
			let end = Math.min(chars.length, i + limit);
			if (end < chars.length) {
				for (let j = end - 1; j > i; j--) if (/\s/u.test(chars[j])) {
					end = j + 1;
					break;
				}
			}
			output.push(chars.slice(i, end).join(""));
			i = end;
		}
	}
	return output;
}
/** Baselines of the visible text rows drawn below the symbol. */
function labelRows(p, width = 120) {
	const rows = [];
	if (display(p.name, "name")) rows.push([
		display(p.name, "name"),
		78,
		"name"
	]);
	if (display(p.yearSpan)) rows.push([
		display(p.yearSpan),
		94,
		"yearSpan"
	]);
	if (lens.showNotes) noteLines(display(p.note), width).forEach((line, i) => {
		if (line.trim()) rows.push([
			line,
			110 + i * 16,
			"note"
		]);
	});
	return rows;
}
/** Vertical extent of the label block below the symbol, in local units, or undefined when empty. */
function labelExtent(p, width = 120) {
	const rows = labelRows(p, width);
	if (!rows.length) return;
	return {
		top: Math.min(...rows.map(([, y]) => y)) - 12,
		bottom: Math.max(...rows.map(([, y]) => y)) + 4,
		width: Math.max(...rows.map(([v]) => Array.from(String(v)).length * 12))
	};
}
function localToWorld(g, x, y, out) {
	const cx = g.width / 2, cy = g.height / 2, c = Math.cos(g.rotation), s = Math.sin(g.rotation);
	out.x = g.x + cx + (x - cx) * c - (y - cy) * s;
	out.y = g.y + cy + (x - cx) * s + (y - cy) * c;
	return out;
}
/** Tight world box around the symbol and its visible labels. */
function selectionBox(p, g, out) {
	const cx = g.width / 2, extent = labelExtent(p, g.width), death = deathMarkSpan(p), half = Math.max(SYMBOL.half + 6, death ? death + 2 : 0, extent ? Math.min(g.width / 2, extent.width / 2 + 4) : 0), top = Math.min(SYMBOL.top - 6, death ? 32 - death - 2 : 0), bottom = Math.max(SYMBOL.bottom + 6, death ? 32 + death + 2 : 0, extent ? extent.bottom + 4 : 0);
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	const pt = {
		x: 0,
		y: 0
	};
	for (const [x, y] of [
		[cx - half, top],
		[cx + half, top],
		[cx + half, bottom],
		[cx - half, bottom]
	]) {
		localToWorld(g, x, y, pt);
		minX = Math.min(minX, pt.x);
		minY = Math.min(minY, pt.y);
		maxX = Math.max(maxX, pt.x);
		maxY = Math.max(maxY, pt.y);
	}
	out.x = minX;
	out.y = minY;
	out.width = maxX - minX;
	out.height = maxY - minY;
	out.rotation = 0;
	return out;
}
/** Outline of the symbol, slightly enlarged, as local points. */
function symbolOutline(p, g) {
	const cx = g.width / 2, cy = 32, pad = 4;
	const ring = (r) => Array.from({ length: 33 }, (_, i) => [cx + r * Math.cos(i / 32 * 2 * Math.PI), cy + r * Math.sin(i / 32 * 2 * Math.PI)]);
	const square = (r) => [
		[cx - r, cy - r],
		[cx + r, cy - r],
		[cx + r, cy + r],
		[cx - r, cy + r],
		[cx - r, cy - r]
	];
	switch (p.symbol) {
		case "female":
		case "trans_female": return ring(30);
		case "male":
		case "trans_male": return square(30);
		case "stillbirth_female": return ring(19);
		case "stillbirth_male": return square(19);
		case "miscarriage":
		case "abortion": return ring(17);
		case "pregnancy": return [
			[cx, 2],
			[cx + 30, 55],
			[cx - 30, 55],
			[cx, 2]
		];
		case "pet": return [
			[cx - 27, 6],
			[cx + 27, 6],
			[cx + 27, 39],
			[cx, 62],
			[cx - 27, 39],
			[cx - 27, 6]
		];
		default: {
			const r = 26 + pad * Math.SQRT2;
			return [
				[cx, cy - r],
				[cx + r, cy],
				[cx, cy + r],
				[cx - r, cy],
				[cx, cy - r]
			];
		}
	}
}
var scratch = {
	x: 0,
	y: 0
};
var box = {
	x: 0,
	y: 0,
	width: 0,
	height: 0,
	rotation: 0
};
function read(id, v) {
	const p = v.getCanonical(id, ids.person), g = p && v.getComputed(id, `computed.${ids.person}`);
	return g ? [p, g] : [];
}
var selection = {
	priority: 20,
	getBounds(id, v, out) {
		const [p, g] = read(id, v);
		if (!g) return false;
		selectionBox(p, g, out);
		return true;
	},
	hitTest(id, v, x, y, zoom) {
		const [p, g] = read(id, v);
		if (!g) return Infinity;
		selectionBox(p, g, box);
		const dx = Math.max(box.x - x, 0, x - box.x - box.width), dy = Math.max(box.y - y, 0, y - box.y - box.height), d = Math.hypot(dx, dy);
		return d <= 4 / Math.max(.01, zoom) ? d : Infinity;
	},
	intersectsRect(id, v, l, t, r, b) {
		const [p, g] = read(id, v);
		if (!g) return false;
		selectionBox(p, g, box);
		return box.x <= r && box.x + box.width >= l && box.y <= b && box.y + box.height >= t;
	},
	getOutlinePath(id, v, projection) {
		const [p, g] = read(id, v);
		if (!g) return "";
		return symbolOutline(p, g).map(([x, y], i) => {
			localToWorld(g, x, y, scratch);
			projection.worldToScreen(scratch.x, scratch.y, scratch);
			return `${i ? "L" : "M"}${scratch.x},${scratch.y}`;
		}).join("");
	},
	canTransform: () => true,
	canResize: () => false,
	canRotate: () => false
};
var options = (field, values, label) => ({
	kind: "segmented",
	field,
	label,
	placement: "inspector",
	options: values.map((value) => ({
		value,
		label: labels$1[value] ?? value
	}))
});
function body(p, g, id = "preview") {
	const cx = g.width / 2, cy = 32;
	let s = "";
	const circle = (r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`, rect = (r) => `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}"/>`, diamond = `<path d="M ${cx} 6 l 26 26 -26 26 -26 -26 Z"/>`;
	switch (p.symbol) {
		case "female":
			s = circle(26);
			break;
		case "male":
			s = rect(26);
			break;
		case "trans_male":
			s = rect(26) + circle(18);
			break;
		case "trans_female":
			s = circle(26) + rect(18);
			break;
		case "pregnancy":
			s = `<path d="M ${cx} 8 l 25 44 h -50 Z"/>`;
			break;
		case "miscarriage":
			s = `<circle cx="${cx}" cy="32" r="9" fill="#334155"/>`;
			break;
		case "abortion":
			s = `<path d="M ${cx - 9} 23 l 18 18 m 0 -18 l -18 18"/>`;
			break;
		case "stillbirth_male":
			s = rect(15);
			break;
		case "stillbirth_female":
			s = circle(15);
			break;
		case "pet":
			s = `<path d="M ${cx - 23} 10 h 46 v 27 l -23 20 -23 -20 Z"/>`;
			break;
		case "nonbinary":
			s = diamond + circle(16);
			break;
		default: s = diamond;
	}
	const clipId = `genogram-clinical-${Array.from(String(id), (c) => c.codePointAt(0).toString(16)).join("-")}`;
	const clinical = p.clinical;
	const hasFill = [
		"physical",
		"mental",
		"substance",
		"mental_substance",
		"substance_recovery",
		"illness_remission",
		"suspected_substance",
		"recovery_with_illness"
	].includes(clinical);
	let marks = "";
	if (hasFill || p.smoking || p.obesity || p.languageDifficulty) {
		const bottomClip = `${clipId}-lower`;
		marks += `<defs><clipPath id="${clipId}">${s}</clipPath><clipPath id="${bottomClip}"><rect x="${cx - 26}" y="32" width="52" height="26"/></clipPath></defs>`;
		let fill = "";
		if (clinical === "physical") fill = `<rect x="${cx}" y="6" width="26" height="52"/>`;
		else if (clinical === "mental") fill = `<rect x="${cx - 26}" y="6" width="26" height="52"/>`;
		else if (clinical === "substance") fill = `<rect x="${cx - 26}" y="32" width="52" height="26"/>`;
		else if (clinical === "mental_substance") fill = `<path d="M ${cx - 26} 6 h 26 v 26 h 26 v 26 h -52 Z" fill="#94a3b8"/><path d="M ${cx} 6 v 52 M ${cx - 26} 32 h 52" fill="none" stroke="#334155" stroke-width="2"/>`;
		else if ([
			"substance_recovery",
			"illness_remission",
			"recovery_with_illness"
		].includes(clinical)) {
			fill = `<rect x="${cx - 26}" y="32" width="26" height="26"/>`;
			if (clinical === "recovery_with_illness") fill += `<rect x="${cx}" y="6" width="26" height="26" fill="#cbd5e1"/>`;
			if (clinical !== "illness_remission") fill += `<path d="M ${cx} 32 h 26" fill="none" stroke="#334155" stroke-width="2"/>`;
			if (clinical !== "substance_recovery") fill += `<path d="M ${cx} 6 v 26" fill="none" stroke="#334155" stroke-width="2"/>`;
		} else if (clinical === "suspected_substance") {
			let hatch = "";
			for (let x = cx - 52; x < cx + 52; x += 7) hatch += `<path d="M ${x} 58 l 26 -26"/>`;
			fill = `<g clip-path="url(#${bottomClip})" fill="none" stroke="#334155" stroke-width="2">${hatch}</g><path d="M ${cx - 26} 32 h 52" fill="none" stroke="#334155" stroke-width="2"/>`;
		}
		if (p.languageDifficulty) {
			let hatch = "";
			for (let x = cx - 52; x < cx + 52; x += 7) hatch += `<path d="M ${x} 58 l 26 -26"/>`;
			fill += `<g clip-path="url(#${bottomClip})" fill="none"><g stroke="white" stroke-width="4">${hatch}</g><g stroke="#334155" stroke-width="2">${hatch}</g></g>`;
		}
		if (p.obesity) fill += `<circle cx="${cx}" cy="32" r="16" fill="none" stroke="white" stroke-width="6"/><circle cx="${cx}" cy="32" r="16" fill="none" stroke="#334155" stroke-width="4"/>`;
		if (p.smoking) fill += `<circle cx="${cx + 18}" cy="14" r="4" fill="#334155" stroke="white" stroke-width="1"/>`;
		marks += `<g clip-path="url(#${clipId})" fill="#334155">${fill}</g>`;
	}
	if (clinical === "recovering") marks += `<text x="${cx}" y="53" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#334155">R</text>`;
	if (p.orientation !== "none") marks += `<path d="M ${cx - 12} 18 h 24 l -12 20 Z" fill="none" stroke="#334155"/>`;
	if (p.isIndexPerson) marks += `<g transform="translate(${cx},32) scale(1.15) translate(${-cx},-32)" fill="none" stroke="#334155">${s}</g>`;
	const death = deathMarkSpan(p);
	if (death) marks += `<path data-genogram-death="true" d="M ${cx - death} ${32 - death} l ${death * 2} ${death * 2} m 0 -${death * 2} l -${death * 2} ${death * 2}" stroke="#334155" stroke-width="2" fill="none"/>`;
	const texts = [[
		p.ageLabel,
		36,
		"ageLabel"
	], ...labelRows(p, g.width)];
	return `<g fill="white" stroke="#334155" stroke-width="2">${s}</g>${marks}<g text-anchor="middle" fill="#334155" font-family="sans-serif" font-size="12" stroke="white" stroke-width="2" stroke-linejoin="round" paint-order="stroke fill">${texts.map(([v, y, field]) => `<text data-genogram-field="${field}" x="${cx}" y="${y}"${field !== "note" && Array.from(String(v ?? "")).length * 12 > g.width - 8 ? ` textLength="${Math.max(1, g.width - 8)}" lengthAdjust="spacingAndGlyphs"` : ""}>${escapeXml(v)}</text>`).join("")}</g>`;
}
var person = {
	id: ids.person,
	label: "인물",
	defaults: defaults.person,
	refs: { householdId: "nullify" },
	textFields: [
		"name",
		"ageLabel",
		"yearSpan",
		"note"
	],
	textSearchFields: [
		"name",
		"yearSpan",
		"note"
	],
	dependsOnCanonical: [
		ids.person,
		"core.transform",
		"core.bounds"
	],
	derive(p, id, v) {
		const t = v.getCanonical(id, "core.transform") ?? {}, b = v.getCanonical(id, "core.bounds") ?? {};
		const width = b.width > 0 ? b.width : 120;
		return {
			x: finite(t.x),
			y: finite(t.y),
			rotation: finite(t.rotation),
			labelHeight: 110 + 16 * (noteLines(display(p.note), width).length - 1),
			deathMarkSpan: deathMarkSpan(p),
			width,
			height: b.height > 0 ? b.height : 120
		};
	},
	paintOverflow: 32,
	selection,
	paintBounds(g) {
		if (!g) return;
		const h = Math.max(g.height, g.labelHeight + 8), a = g.rotation, c = Math.cos(a), s = Math.sin(a), cx = g.x + g.width / 2, cy = g.y + g.height / 2;
		const span = g.deathMarkSpan ?? 0, left = Math.min(0, span ? g.width / 2 - span - 1 : 0), right = Math.max(g.width, span ? g.width / 2 + span + 1 : g.width), top = Math.min(0, span ? 32 - span - 1 : 0), bottom = Math.max(h, span ? 32 + span + 1 : h);
		const points = [
			[left, top],
			[right, top],
			[right, bottom],
			[left, bottom]
		].map(([x, y]) => ({
			x: cx + (x - g.width / 2) * c - (y - g.height / 2) * s,
			y: cy + (x - g.width / 2) * s + (y - g.height / 2) * c
		}));
		const x = Math.min(...points.map((p) => p.x)), y = Math.min(...points.map((p) => p.y));
		return {
			x,
			y,
			width: Math.max(...points.map((p) => p.x)) - x,
			height: Math.max(...points.map((p) => p.y)) - y
		};
	},
	renderSvg(p, g, id) {
		return { svg: g ? `<g transform="translate(${g.x},${g.y}) rotate(${g.rotation * 180 / Math.PI},${g.width / 2},${g.height / 2})">${body(p, g, id)}</g>` : "" };
	},
	ui: { controls: [
		...[
			"name",
			"ageLabel",
			"yearSpan"
		].map((field) => ({
			kind: "text",
			field,
			label: labels$1[field] ?? field,
			placement: "inspector",
			section: "기본 정보"
		})),
		{
			...options("symbol", symbols, "인물 기호"),
			section: "기호와 상태"
		},
		{
			...options("symbol", symbols, "인물 기호"),
			id: "symbol-floating",
			placement: "selection-bar"
		},
		{
			...options("orientation", [
				"none",
				"gay",
				"lesbian",
				"bisexual"
			], "성적 지향 표시"),
			section: "기호와 상태"
		},
		{
			...options("clinical", [
				"none",
				"physical",
				"mental",
				"substance",
				"mental_substance",
				"recovering",
				"substance_recovery",
				"illness_remission",
				"suspected_substance",
				"recovery_with_illness"
			], "임상 상태"),
			section: "기호와 상태",
			description: "오른쪽 음영: 신체 질환 · 아래 음영: 물질 사용 · 아래 사선: 물질 사용 의심. 왼쪽 아래 음영에 가로선은 물질 사용 회복, 세로선은 질환 관해입니다. R은 기존 회복 기록의 유형 미지정입니다."
		},
		...[
			"smoking",
			"obesity",
			"languageDifficulty"
		].map((field) => ({
			kind: "toggle",
			field,
			label: labels$1[field],
			placement: "inspector",
			section: "추가 임상 표시",
			sectionCollapsed: true
		})),
		{
			...options("lifeStatus", ["alive", "deceased"], "생존"),
			section: "기호와 상태"
		},
		{
			kind: "text",
			field: "note",
			label: labels$1.note,
			placement: "inspector",
			section: "상담 메모",
			sectionCollapsed: true
		},
		{
			kind: "number",
			field: "birthOrderHint",
			label: "형제 순서",
			placement: "inspector",
			section: "기본 정보"
		},
		{
			kind: "toggle",
			field: "isIndexPerson",
			label: "내담자",
			placement: "inspector",
			section: "기호와 상태"
		}
	] }
};
// src/inline-editor.js
/** Changes outside the locally edited span survive remote updates during composition. */
function mergeDraft(base, local, remote) {
	if (remote === base || local === remote) return local;
	if (local === base) return remote;
	let a = 0, z = 0;
	while (a < base.length && a < local.length && base[a] === local[a]) a++;
	while (z < base.length - a && z < local.length - a && base[base.length - 1 - z] === local[local.length - 1 - z]) z++;
	let r = 0, t = 0;
	while (r < base.length && r < remote.length && base[r] === remote[r]) r++;
	while (t < base.length - r && t < remote.length - r && base[base.length - 1 - t] === remote[remote.length - 1 - t]) t++;
	const end = base.length - z, remoteEnd = base.length - t, insert = local.slice(a, local.length - z), delta = remote.length - base.length;
	if (remoteEnd <= a) return remote.slice(0, a + delta) + insert + remote.slice(end + delta);
	if (r >= end) return remote.slice(0, a) + insert + remote.slice(end);
	return remote.slice(0, Math.min(a, r)) + remote.slice(r, remote.length - t) + insert + remote.slice(Math.max(remoteEnd, end) + delta);
}
function mountInlineEditor(context) {
	const provider = context.services.get("canvas.active-tool-surface"), frames = context.services.get("canvas.frames"), textHistory = context.services.get("canvas.text-history");
	let close = () => {}, openCurrent = () => {}, detach = () => {};
	function mount() {
		close();
		detach();
		const s = provider?.get();
		if (!s || !frames || typeof document === "undefined") return;
		let session = null, until = 0, composing = false, offWorld = () => {};
		const input = document.createElement("textarea");
		input.dataset.canvasEditor = "true";
		input.dataset.genogramEditor = "true";
		input.dataset.escapeOwner = "true";
		input.setAttribute("aria-label", "가계도 인물 편집");
		Object.assign(input.style, {
			position: "absolute",
			display: "none",
			boxSizing: "border-box",
			resize: "none",
			overflow: "hidden",
			padding: "0",
			border: "0",
			outline: "none",
			background: "transparent",
			color: "#334155",
			textAlign: "center",
			whiteSpace: "pre",
			transformOrigin: "top center",
			pointerEvents: "auto",
			zIndex: "20",
			fontFamily: "sans-serif"
		});
		s.surface.hud.append(input);
		let hidden = [];
		function restoreText() {
			for (const el of hidden) el.style.visibility = "";
			hidden = [];
		}
		function save() {
			if (!session || composing) return;
			const current = context.world.getCanonical(session.id, ids.person);
			if (!current) {
				finish(false);
				return;
			}
			const value = mergeDraft(session.base, input.value, String(current[session.field] ?? ""));
			if (value !== current[session.field]) {
				textHistory?.change();
				context.world.applyCanonicalTransaction(`${prefix}:edit`, [{
					id: session.id,
					aspect: ids.person,
					patch: { [session.field]: value }
				}]);
			}
			session.base = value;
			input.value = value;
		}
		function finish(commit = true) {
			if (!session) return;
			if (composing) return;
			if (commit) save();
			session = null;
			restoreText();
			input.style.display = "none";
			s.host.requestRender();
			textHistory?.seal();
		}
		close = () => {
			composing = false;
			finish(true);
			offWorld();
		};
		openCurrent = (id, field = "name") => {
			const p = context.world.getCanonical(id, ids.person);
			if (!p || context.world.isEntityReadOnly?.(id)) return;
			if (field === "name" && lens.privacy !== "full" || field === "note" && !lens.showNotes) return;
			finish();
			session = {
				id,
				field,
				base: String(p[field] ?? "")
			};
			input.value = session.base;
			input.setAttribute("aria-label", {
				name: "이름",
				ageLabel: "나이",
				yearSpan: "출생·사망 연도",
				note: "임상 메모"
			}[field]);
			input.style.display = "block";
			s.host.requestRender();
			input.focus();
			input.select();
		};
		const locked = (e) => composing || e.isComposing || e.keyCode === 229 || e.key === "Process" || Date.now() < until;
		input.addEventListener("compositionstart", () => {
			composing = true;
		});
		input.addEventListener("compositionend", () => {
			composing = false;
			until = Date.now() + 16;
			save();
		});
		input.addEventListener("input", () => save());
		input.addEventListener("blur", () => {
			if (!composing) finish();
		});
		input.addEventListener("keydown", (e) => {
			if (locked(e)) return;
			if (e.key === "Escape" || e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				finish();
				s.surface.element.focus();
			} else if (e.key === "Tab" && session) {
				e.preventDefault();
				const fields = [
					"name",
					"ageLabel",
					"yearSpan",
					"note"
				], { id, field } = session, index = (fields.indexOf(field) + (e.shiftKey ? 3 : 1)) % 4;
				finish();
				openCurrent(id, fields[index]);
			}
		});
		const click = (e) => {
			if (locked(e) || e.target?.closest?.("input,textarea,button,[contenteditable]")) return;
			const selected = s.selection.getSelection();
			if (selected.length !== 1) return;
			const id = selected[0], p = context.world.getCanonical(id, ids.person);
			if (!p) return;
			const b = context.world.getComputed(id, "computed.layoutBounds"), out = {
				x: 0,
				y: 0
			};
			s.host.screenToWorld(e.clientX, e.clientY, out);
			if (!b || out.x < b.x || out.x > b.x + b.width || out.y < b.y || out.y > b.y + Math.max(b.height, labelExtent(p, b.width)?.bottom ?? b.height)) return;
			const y = out.y - b.y;
			openCurrent(id, y < 60 ? "ageLabel" : y < 85 ? "name" : y < 101 ? "yearSpan" : "note");
			e.preventDefault();
		};
		s.surface.element.addEventListener("dblclick", click);
		offWorld = context.world.subscribe?.(() => {
			if (session && !composing) {
				const p = context.world.getCanonical(session.id, ids.person);
				if (!p) {
					session = null;
					restoreText();
					input.style.display = "none";
					return;
				}
				const value = mergeDraft(session.base, input.value, String(p[session.field] ?? ""));
				session.base = String(p[session.field] ?? "");
				if (input.value !== value) input.value = value;
			}
		}) ?? (() => {});
		const worldPoint = {
			x: 0,
			y: 0
		};
		const offFrame = frames.subscribe(() => {
			if (!session) return;
			const b = context.world.getComputed(session.id, "computed.layoutBounds");
			if (!b) return;
			const y = {
				ageLabel: 24,
				name: 66,
				yearSpan: 82,
				note: 98
			}[session.field];
			const zoom = Math.max(.01, s.host.getZoom());
			const angle = b.rotation ?? 0, cx = b.x + b.width / 2, cy = b.y + b.height / 2;
			const dy = y - b.height / 2;
			s.host.worldToScreen(cx - dy * Math.sin(angle), cy + dy * Math.cos(angle), worldPoint);
			const rect = s.surface.hud.getBoundingClientRect();
			const isNote = session.field === "note";
			input.style.width = `${Math.max(1, (isNote ? Math.max(12, b.width - 8) : b.width) * zoom)}px`;
			input.style.height = `${(isNote ? noteLines(input.value, b.width).length * 16 : 16) * zoom}px`;
			input.style.whiteSpace = isNote ? "pre-wrap" : "pre";
			input.style.overflowWrap = isNote ? "anywhere" : "normal";
			input.wrap = isNote ? "soft" : "off";
			input.style.fontSize = `${12 * zoom}px`;
			input.style.lineHeight = `${16 * zoom}px`;
			input.style.left = `${worldPoint.x - rect.left}px`;
			input.style.top = `${worldPoint.y - rect.top}px`;
			input.style.transform = `translateX(-50%) rotate(${angle}rad)`;
			restoreText();
			const fields = s.surface.element.querySelectorAll?.("[data-entity-id] [data-genogram-field]") ?? [];
			for (const el of fields) if (el.getAttribute("data-genogram-field") === session.field && el.closest("[data-entity-id]")?.getAttribute("data-entity-id") === session.id) {
				el.style.visibility = "hidden";
				hidden.push(el);
			}
		});
		detach = () => {
			offWorld();
			offFrame();
			s.surface.element.removeEventListener("dblclick", click);
			input.remove();
		};
	}
	mount();
	const off = provider?.subscribe?.(mount);
	return {
		open(id, field) {
			openCurrent(id, field);
		},
		dispose() {
			close();
			detach();
			off?.();
		}
	};
}
// src/interactions.js
/** Each active view owns handles and preview; the host owns the frame clock and input arbitration. */
function mountInteractions(context, run) {
	const provider = context.services.get("canvas.active-tool-surface"), frames = context.services.get("canvas.frames");
	if (!provider || !frames) return () => {};
	let clean = () => {};
	function mount() {
		clean();
		const s = provider.get();
		if (!s) return;
		const { world } = context, off = [], overlay = world.createScratchOverlay(`${prefix}:handles`), elements = [], handles = [], point = {
			x: 0,
			y: 0
		}, screen = {
			x: 0,
			y: 0
		}, bounds = {
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			rotation: 0
		}, hit = {
			id: "",
			priority: 0,
			distanceScreenPx: 0
		};
		let hoverX = 0, hoverY = 0, hovering = false;
		const tooltip = document.createElement("div");
		tooltip.setAttribute("role", "tooltip");
		Object.assign(tooltip.style, {
			position: "absolute",
			display: "none",
			pointerEvents: "none",
			whiteSpace: "nowrap",
			padding: "5px 8px",
			borderRadius: "5px",
			background: "var(--alid-bg-surface, #fff)",
			color: "var(--alid-text, #18181b)",
			border: "1px solid var(--alid-border-subtle, #e4e4e7)",
			boxShadow: "var(--alid-shadow, 0 1px 2px #0001)",
			font: "12px/1.4 var(--alid-font, system-ui, sans-serif)"
		});
		s.surface.hud.append(tooltip);
		let gesture = null, composing = false, until = 0;
		const key = `root.select.${prefix}:adjust`;
		function cancel() {
			const previous = gesture;
			gesture = null;
			if (previous && s.surface.element.hasPointerCapture?.(previous.pointer)) s.surface.element.releasePointerCapture(previous.pointer);
			overlay.clear();
			if (s.selection.stateMachine.stateId === key) s.selection.stateMachine.transition("root.select");
		}
		off.push(s.selection.stateMachine.mountChildState("root.select", {
			id: `${prefix}:adjust`,
			onExit() {
				gesture = null;
				overlay.clear();
			}
		}));
		function target() {
			const selected = s.selection.getSelection();
			return selected.length === 1 ? selected[0] : null;
		}
		function location(kind, out) {
			const id = target();
			if (!id) return false;
			const p = world.getCanonical(id, ids.person);
			if (kind.startsWith("add-") || kind.includes("sibling")) {
				if (!p) return false;
				const geometry = world.getComputed(id, `computed.${ids.person}`);
				if (!geometry) return false;
				selectionBox(p, geometry, bounds);
				const offset = 12 / Math.max(.01, s.host.getZoom());
				out.x = kind === "add-partner" ? bounds.x + bounds.width + offset : bounds.x + bounds.width / 2;
				out.y = kind === "add-parents" ? bounds.y - offset : kind === "add-child" ? bounds.y + bounds.height + offset : bounds.y + bounds.height / 2;
				return true;
			}
			const g = world.getComputed(id, `computed.${ids[kind]}`);
			if (!g) return false;
			out.x = g.adjustment?.x ?? g.origin.x;
			out.y = g.adjustment?.y ?? g.origin.y;
			return true;
		}
		const kinds = [
			"add-partner",
			"add-child",
			"add-parents",
			"union",
			"parentage",
			"relation"
		];
		for (const kind of kinds) {
			const isLineHandle = kind === "union" || kind === "parentage";
			const isCurveHandle = kind === "relation";
			const el = isLineHandle ? document.createElementNS("http://www.w3.org/2000/svg", "svg") : document.createElement("button");
			const title = {
				"add-partner": "배우자 추가",
				"add-child": "자녀 추가",
				"add-parents": "부모 추가",
				union: "결합선 높이",
				parentage: "자녀 분기 높이",
				relation: "정서선 곡률"
			}[kind];
			const isAddButton = kind.startsWith("add-");
			const isBlueHandle = isAddButton || isLineHandle;
			const paths = isAddButton ? ["M10 4v12M4 10h12"] : icons[kind]?.paths;
			if (isLineHandle) {
				el.setAttribute("viewBox", "0 0 24 24");
				el.setAttribute("aria-hidden", "true");
				el.innerHTML = "<path d=\"M2 6H22 M2 18H22\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>";
			} else if (isCurveHandle) el.innerHTML = "<svg viewBox=\"0 0 22 22\" width=\"22\" height=\"22\" aria-hidden=\"true\"><path d=\"M11 4 18 11 11 18 4 11Z\" fill=\"var(--alid-bg-surface,white)\" stroke=\"var(--alid-accent,#008FF0)\" stroke-width=\"2\"/></svg>";
			else if (paths) el.innerHTML = `<svg viewBox="0 0 20 20" width="${isAddButton ? 12 : 14}" height="${isAddButton ? 12 : 14}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths.map((d) => `<path d="${d}"/>`).join("")}</svg>`;
			else el.textContent = "◆";
			if (!isLineHandle) el.title = title;
			el.setAttribute("aria-label", title);
			el.dataset.canvasUi = "true";
			Object.assign(el.style, {
				position: "absolute",
				width: isLineHandle ? "24px" : isAddButton ? "16px" : "22px",
				height: isLineHandle ? "24px" : isAddButton ? "16px" : "22px",
				padding: "0",
				border: isBlueHandle || isCurveHandle ? "none" : "1px solid #64748b",
				borderRadius: isBlueHandle ? "3px" : "50%",
				background: isLineHandle || isCurveHandle ? "transparent" : isAddButton ? "var(--alid-accent, #008FF0)" : "white",
				color: isLineHandle ? "var(--alid-accent, #008FF0)" : isAddButton ? "white" : "",
				pointerEvents: "none",
				display: "none"
			});
			s.surface.hud.append(el);
			elements.push(el);
			const handle = {
				id: `${prefix}:${kind}`,
				priority: 30,
				shape: isBlueHandle ? "rect" : "circle",
				radiusScreenPx: 11,
				widthScreenPx: isLineHandle ? 24 : isAddButton ? 16 : 22,
				heightScreenPx: isLineHandle ? 24 : isAddButton ? 16 : 22,
				getWorldPosition: (out) => location(kind, out),
				onPointerDown(e) {
					if (composing || e.isComposing || Date.now() < until || e.button !== 0) return false;
					if (!(kind in ids)) {
						run(kind);
						return true;
					}
					const id = target();
					const field = kind === "union" ? "barOffset" : kind === "parentage" ? "barRatio" : "curveOffset", p = world.getCanonical(id, ids[kind]);
					if (!p || world.isEntityReadOnly?.(id)) return false;
					const geometry = world.getComputed(id, `computed.${ids[kind]}`), adjustment = geometry?.adjustment;
					const units = adjustment?.units ?? (kind === "parentage" ? 200 : 1);
					if (Math.abs(units) < 1e-6) return false;
					const members = kind === "parentage" ? geometry?.adjustmentIds ?? [id] : [id];
					if (members.some((member) => world.isEntityReadOnly?.(member))) return false;
					s.host.screenToWorld(e.clientX, e.clientY, point);
					gesture = {
						id,
						kind,
						field,
						initial: p[field],
						startX: point.x,
						startY: point.y,
						startClientX: e.clientX,
						axisX: adjustment?.axisX ?? 0,
						axisY: adjustment?.axisY ?? 1,
						units,
						members,
						ops: members.map((id) => ({
							id,
							aspect: ids[kind],
							patch: { [field]: p[field] }
						})),
						startClientY: e.clientY,
						delta: 0,
						pointer: e.pointerId
					};
					s.selection.stateMachine.transition(key);
					s.surface.element.setPointerCapture(e.pointerId);
					return true;
				}
			};
			off.push(s.selection.gizmos.register(handle));
			handles.push(handle);
		}
		function clearAdjustmentCursor() {
			if ([
				"ns-resize",
				"ew-resize",
				"nwse-resize",
				"nesw-resize"
			].includes(s.surface.element.style.cursor)) s.surface.element.style.cursor = "";
		}
		function move(e) {
			hovering = !gesture && !e.buttons && e.pointerType !== "touch";
			hoverX = e.clientX;
			hoverY = e.clientY;
			s.host.requestRender();
			if (!gesture || e.pointerId !== gesture.pointer) return;
			s.host.screenToWorld(e.clientX, e.clientY, point);
			gesture.delta = ((point.x - gesture.startX) * gesture.axisX + (point.y - gesture.startY) * gesture.axisY) / gesture.units;
			if (Math.hypot(e.clientX - gesture.startClientX, e.clientY - gesture.startClientY) < 3.5) return;
			const value = gesture.initial + gesture.delta;
			for (const op of gesture.ops) op.patch[gesture.field] = gesture.kind === "parentage" ? Math.max(.1, Math.min(.9, value)) : value;
			if (overlay.setBatch) overlay.setBatch(gesture.ops);
			else for (const op of gesture.ops) overlay.set(op.id, op.aspect, op.patch);
			s.host.requestRender();
		}
		function up(e) {
			if (!gesture || e.pointerId !== gesture.pointer) return;
			const g = gesture;
			s.host.screenToWorld(e.clientX, e.clientY, point);
			g.delta = ((point.x - g.startX) * g.axisX + (point.y - g.startY) * g.axisY) / g.units;
			cancel();
			if (Math.hypot(e.clientX - g.startClientX, e.clientY - g.startClientY) < 3.5 || Math.abs(g.delta) < 1e-8) return;
			const current = world.getCanonical(g.id, ids[g.kind]);
			if (!current || g.members.some((id) => world.isEntityReadOnly?.(id))) return;
			const value = current[g.field] + g.delta;
			s.host.history.begin();
			try {
				const ops = [];
				for (const id of g.members) {
					const p = world.getCanonical(id, ids[g.kind]);
					if (!p) continue;
					if (g.kind === "parentage" && (current.union ? p.union !== current.union : p.union || p.parentA !== current.parentA || p.parentB !== current.parentB)) continue;
					ops.push({
						id,
						aspect: ids[g.kind],
						patch: { [g.field]: g.kind === "parentage" ? Math.max(.1, Math.min(.9, value)) : value }
					});
				}
				world.applyCanonicalTransaction(`${prefix}:adjust`, ops);
				s.host.history.commit();
			} catch (err) {
				s.host.history.abort();
				throw err;
			}
		}
		function keydown(e) {
			if (!composing && !e.isComposing && e.keyCode !== 229 && Date.now() >= until && e.key === "Escape") cancel();
		}
		const events = {
			pointermove: move,
			pointerleave: () => {
				hovering = false;
				tooltip.style.display = "none";
				clearAdjustmentCursor();
			},
			pointerdown: () => {
				hovering = false;
				tooltip.style.display = "none";
			},
			pointerup: up,
			pointercancel: cancel,
			lostpointercapture: cancel,
			keydown,
			compositionstart: () => {
				composing = true;
				cancel();
			},
			compositionend: () => {
				composing = false;
				until = Date.now() + 16;
			}
		};
		for (const [name, fn] of Object.entries(events)) {
			s.surface.element.addEventListener(name, fn);
			off.push(() => s.surface.element.removeEventListener(name, fn));
		}
		off.push(frames.subscribe(() => {
			const hasHit = hovering && s.selection.gizmos.hitTest(hoverX, hoverY, s.host.worldToScreen, hit);
			if (hasHit && (hit.id === `diagram.genogram:union` || hit.id === `diagram.genogram:parentage`)) s.surface.element.style.cursor = "ns-resize";
			else if (hasHit && hit.id === `diagram.genogram:relation`) {
				const id = target(), a = id && world.getComputed(id, `computed.${ids.relation}`)?.adjustment;
				const x = a?.axisX ?? 0, y = a?.axisY ?? 1;
				s.surface.element.style.cursor = Math.abs(x) > .9 ? "ew-resize" : Math.abs(y) > .9 ? "ns-resize" : x * y > 0 ? "nwse-resize" : "nesw-resize";
			} else clearAdjustmentCursor();
			const hovered = hasHit ? kinds.findIndex((kind) => `${prefix}:${kind}` === hit.id) : -1;
			tooltip.style.display = hovered >= 0 ? "block" : "none";
			if (hovered >= 0 && handles[hovered].getWorldPosition(point)) {
				tooltip.textContent = elements[hovered].getAttribute?.("aria-label") ?? elements[hovered].title;
				s.host.worldToScreen(point.x, point.y, screen);
				const rect = s.surface.hud.getBoundingClientRect();
				tooltip.style.left = `${screen.x - rect.left + 16}px`;
				tooltip.style.top = `${screen.y - rect.top + 14}px`;
			} else tooltip.style.display = "none";
			for (let i = 0; i < handles.length; i++) {
				const el = elements[i];
				if (!handles[i].getWorldPosition(point)) {
					el.style.display = "none";
					continue;
				}
				s.host.worldToScreen(point.x, point.y, screen);
				el.style.display = "block";
				const rect = s.surface.hud.getBoundingClientRect();
				const half = kinds[i] === "union" || kinds[i] === "parentage" ? 12 : kinds[i].startsWith("add-") ? 8 : 11;
				el.style.left = `${screen.x - rect.left - half}px`;
				el.style.top = `${screen.y - rect.top - half}px`;
			}
		}));
		clean = () => {
			cancel();
			clearAdjustmentCursor();
			for (const f of off.reverse()) f();
			overlay.dispose();
			tooltip.remove();
			for (const el of elements) el.remove();
		};
	}
	mount();
	const unsubscribe = provider.subscribe(mount);
	return () => {
		unsubscribe();
		clean();
	};
}
var extension_default = {
	id: "diagram.genogram",
	title: "가계도",
	version: "0.1.3",
	summary: "상담용 인물 기호와 가족 관계를 작성합니다.",
	engine: "^0.1.1",
	dependencies: {},
	optionalDependencies: {},
	conflicts: [],
	provides: {
		"services": [],
		"hsmSlots": []
	}
};
// src/manifest.js
/** Shared by the bundle and build script; keep the reviewed and executed contracts identical. */
function createPackageManifest(metadata) {
	return {
		id: metadata.id,
		settingsSchema,
		version: metadata.version,
		engine: metadata.engine,
		dependencies: { ...metadata.dependencies },
		optionalDependencies: { ...metadata.optionalDependencies },
		conflicts: [...metadata.conflicts],
		provides: {
			services: [...metadata.provides.services],
			aspects: Object.keys(ids).map((k) => `${metadata.id}.${k}`),
			hsmSlots: [...metadata.provides.hsmSlots]
		}
	};
}
// src/relationship-icons.js
var icon = (...paths) => ({
	size: 20,
	paths
});
var solid = (d) => ({
	d,
	fill: true
});
var zig = "M1 10 L3 7 5 13 7 7 9 13 11 7 13 13 15 7 17 13 19 10";
var zigShort = "M1 10 L3 7 5 13 7 7 9 13 11 7 13 13 15 10";
var pair = ["M1 5 H19", "M1 15 H19"];
var arrow = "M15 7 L19 10 L15 13";
var triangle = "M19 10 L14 7 L14 13 Z";
var relationshipIcons = {
	close: icon(...pair),
	fused: icon(...pair, "M1 10 H19"),
	distant: icon("M1 10 H4 M7 10 H10 M13 10 H16 M19 10 H20"),
	hostile: icon(zig),
	close_hostile: icon(...pair, zig),
	fused_hostile: icon(...pair, "M1 10 H19", zig),
	focused_on: icon("M1 10 H19", arrow),
	negative_focused: icon(zigShort, arrow),
	caregiving: icon("M1 10 H19", arrow, "M11 7 L15 10 L11 13"),
	cutoff: icon("M1 10 H7 M13 10 H19 M7 5 V15 M13 5 V15"),
	cutoff_repaired: icon("M1 10 H3 M5 10 H6 M14 10 H15 M17 10 H19 M6 5 V15 M14 5 V15 M8 10 A2 2 0 1 0 12 10 A2 2 0 1 0 8 10"),
	estranged: icon("M1 10 H3 M5 10 H7 M13 10 H15 M17 10 H19 M7 5 V15 M13 5 V15"),
	abuse_physical: icon(zigShort, solid(triangle)),
	abuse_emotional: icon(zigShort, triangle),
	abuse_sexual: icon("M1 5 H15", "M1 15 H15", zigShort, solid(triangle))
};
// src/geometry/label-gaps.js
/** Local label rectangles are deterministic and match the rendered text's size cap. */
function labelObstacles(view) {
	const result = [];
	for (const id of view.listEntityIds?.() ?? []) {
		const person = view.getCanonical(id, ids.person), box = person && personBounds(view, id);
		if (!box) continue;
		const angle = box.rotation ?? 0, cos = Math.cos(angle), sin = Math.sin(angle);
		for (const [text, baseline] of labelRows(person, box.width)) {
			const half = Math.min(Math.max(1, box.width - 8), Array.from(String(text)).length * 12) / 2 + 2;
			result.push({
				cx: box.x + box.width / 2,
				cy: box.y + box.height / 2,
				cos,
				sin,
				left: box.width / 2 - half,
				right: box.width / 2 + half,
				top: baseline - 14,
				bottom: baseline + 6,
				width: box.width,
				height: box.height
			});
		}
	}
	return result;
}
/** Remove only the portions hidden by text, retaining the underlying relationship data. */
function pathsAroundLabels(paths, view) {
	const obstacles = labelObstacles(view);
	if (!obstacles.length) return paths;
	const result = [];
	for (const path of paths) {
		let current;
		for (let i = 1; i < path.length; i++) {
			const a = path[i - 1], b = path[i], dx = b.x - a.x, dy = b.y - a.y;
			const blocked = [];
			for (const o of obstacles) {
				const ax = a.x - o.cx, ay = a.y - o.cy;
				const x = ax * o.cos + ay * o.sin + o.width / 2;
				const y = -ax * o.sin + ay * o.cos + o.height / 2;
				const vx = dx * o.cos + dy * o.sin, vy = -dx * o.sin + dy * o.cos;
				let lo = 0, hi = 1;
				for (const [p, q] of [
					[-vx, x - o.left],
					[vx, o.right - x],
					[-vy, y - o.top],
					[vy, o.bottom - y]
				]) {
					if (p === 0) {
						if (q < 0) {
							lo = 1;
							hi = 0;
							break;
						}
					} else if (p < 0) lo = Math.max(lo, q / p);
					else hi = Math.min(hi, q / p);
					if (lo > hi) break;
				}
				if (lo < hi && hi > 0 && lo < 1) blocked.push([Math.max(0, lo), Math.min(1, hi)]);
			}
			blocked.sort((l, r) => l[0] - r[0]);
			let start = 0;
			const emit = (end) => {
				if (end - start <= 1e-9) return;
				const from = {
					x: a.x + dx * start,
					y: a.y + dy * start
				}, to = {
					x: a.x + dx * end,
					y: a.y + dy * end
				};
				if (current && start === 0) current.push(to);
				else {
					current = [from, to];
					result.push(current);
				}
			};
			for (const [lo, hi] of blocked) {
				if (hi <= start) continue;
				if (lo > start) emit(lo);
				current = void 0;
				start = Math.max(start, hi);
			}
			if (start < 1) emit(1);
			else current = void 0;
		}
	}
	return result;
}
// src/geometry/person-anchors.js
/** Center of the rendered person symbol, transformed with the person's authored rotation. */
function personSymbol(view, id) {
	const props = view.getCanonical(id, ids.person), box = props && personBounds(view, id);
	if (!box) return;
	const rotation = Number.isFinite(box.rotation) ? box.rotation : 0;
	const cos = Math.cos(rotation), sin = Math.sin(rotation), dy = 32 - box.height / 2;
	return {
		props,
		cos,
		sin,
		x: box.x + box.width / 2 - dy * sin,
		y: box.y + box.height / 2 + dy * cos
	};
}
var cross = (ax, ay, bx, by) => ax * by - ay * bx;
function outline(symbol) {
	const scale = symbol.props.isIndexPerson ? 1.15 : 1;
	let radius, vertices;
	switch (symbol.props.symbol) {
		case "female":
		case "trans_female":
			radius = 26;
			break;
		case "stillbirth_female":
			radius = 15;
			break;
		case "miscarriage":
			radius = 9;
			break;
		case "male":
		case "trans_male":
			vertices = [
				[-26, -26],
				[26, -26],
				[26, 26],
				[-26, 26]
			];
			break;
		case "stillbirth_male":
			vertices = [
				[-15, -15],
				[15, -15],
				[15, 15],
				[-15, 15]
			];
			break;
		case "abortion":
			vertices = [
				[-9, -9],
				[9, -9],
				[9, 9],
				[-9, 9]
			];
			break;
		case "pregnancy":
			vertices = [
				[0, -24],
				[25, 20],
				[-25, 20]
			];
			break;
		case "pet":
			vertices = [
				[-23, -22],
				[23, -22],
				[23, 5],
				[0, 25],
				[-23, 5]
			];
			break;
		default: vertices = [
			[0, -26],
			[26, 0],
			[0, 26],
			[-26, 0]
		];
	}
	return radius !== void 0 ? { radius: radius * scale } : { vertices: vertices.map(([x, y]) => [x * scale, y * scale]) };
}
function localPoint(symbol, point) {
	const x = point.x - symbol.x, y = point.y - symbol.y;
	return {
		x: x * symbol.cos + y * symbol.sin,
		y: -x * symbol.sin + y * symbol.cos
	};
}
function insidePolygon(x, y, vertices) {
	let inside = false;
	for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
		const [xi, yi] = vertices[i], [xj, yj] = vertices[j];
		if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}
/** Exact segment intervals occupied by the circular or polygonal person outline. */
function insideIntervals(a, b, entry) {
	const { symbol, shape } = entry;
	const start = localPoint(symbol, a), end = localPoint(symbol, b), dx = end.x - start.x, dy = end.y - start.y;
	const cuts = [0, 1];
	if (shape.radius !== void 0) {
		const aa = dx * dx + dy * dy, bb = 2 * (start.x * dx + start.y * dy), cc = start.x ** 2 + start.y ** 2 - shape.radius ** 2;
		const disc = bb * bb - 4 * aa * cc;
		if (aa > 0 && disc >= 0) {
			for (const t of [(-bb - Math.sqrt(disc)) / (2 * aa), (-bb + Math.sqrt(disc)) / (2 * aa)]) if (t > 0 && t < 1) cuts.push(t);
		}
	} else {
		const vertices = shape.vertices;
		for (let i = 0; i < vertices.length; i++) {
			const p = vertices[i], q = vertices[(i + 1) % vertices.length], ex = q[0] - p[0], ey = q[1] - p[1];
			const denominator = cross(dx, dy, ex, ey);
			if (Math.abs(denominator) < 1e-12) continue;
			const px = p[0] - start.x, py = p[1] - start.y;
			const t = cross(px, py, ex, ey) / denominator, u = cross(px, py, dx, dy) / denominator;
			if (t > 0 && t < 1 && u >= -1e-12 && u <= 1 + 1e-12) cuts.push(t);
		}
	}
	cuts.sort((x, y) => x - y);
	const intervals = [];
	for (let i = 1; i < cuts.length; i++) {
		const lo = cuts[i - 1], hi = cuts[i];
		if (hi - lo < 1e-10) continue;
		const t = (lo + hi) / 2, x = start.x + t * dx, y = start.y + t * dy;
		if (shape.radius !== void 0 ? x * x + y * y < shape.radius ** 2 - 1e-9 : insidePolygon(x, y, shape.vertices)) intervals.push([lo, hi]);
	}
	return intervals;
}
/** Remove portions inside person symbols while retaining connected outside segments. */
function pathsOutsideSymbols(paths, symbols) {
	const result = [], entries = symbols.map((symbol) => ({
		symbol,
		shape: outline(symbol)
	}));
	for (const path of paths) {
		let current;
		for (let i = 1; i < path.length; i++) {
			const a = path[i - 1], b = path[i], dx = b.x - a.x, dy = b.y - a.y;
			const blocked = entries.flatMap((entry) => insideIntervals(a, b, entry)).sort((x, y) => x[0] - y[0]);
			let start = 0;
			const emit = (end) => {
				if (end - start <= 1e-9) return;
				const from = {
					x: a.x + dx * start,
					y: a.y + dy * start
				}, to = {
					x: a.x + dx * end,
					y: a.y + dy * end
				};
				if (current && start === 0) current.push(to);
				else {
					current = [from, to];
					result.push(current);
				}
			};
			for (const [lo, hi] of blocked) {
				if (hi <= start) continue;
				if (lo > start) emit(lo);
				current = void 0;
				start = Math.max(start, hi);
			}
			if (start < 1) emit(1);
			else current = void 0;
		}
	}
	return result;
}
// src/geometry/paths.js
function distance(paths, x, y) {
	let best = Infinity;
	for (const pts of paths) for (let i = 1; i < pts.length; i++) {
		const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
		best = Math.min(best, Math.hypot(x - a.x - t * dx, y - a.y - t * dy));
	}
	return best;
}
function intersects(paths, l, t, r, b) {
	for (const pts of paths) for (let i = 1; i < pts.length; i++) {
		const a = pts[i - 1], z = pts[i];
		let lo = 0, hi = 1;
		const dx = z.x - a.x, dy = z.y - a.y;
		let ok = true;
		for (let k = 0; k < 4; k++) {
			const p = k === 0 ? -dx : k === 1 ? dx : k === 2 ? -dy : dy, q = k === 0 ? a.x - l : k === 1 ? r - a.x : k === 2 ? a.y - t : b - a.y;
			if (p === 0) {
				if (q < 0) {
					ok = false;
					break;
				}
			} else {
				const u = q / p;
				if (p < 0) lo = Math.max(lo, u);
				else hi = Math.min(hi, u);
				if (lo > hi) {
					ok = false;
					break;
				}
			}
		}
		if (ok) return true;
	}
	return false;
}
function pathData(pts) {
	return pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
}
function bounds(paths, pad = 8) {
	let x = Infinity, y = Infinity, r = -Infinity, b = -Infinity;
	for (const ps of paths) for (const p of ps) {
		x = Math.min(x, p.x);
		y = Math.min(y, p.y);
		r = Math.max(r, p.x);
		b = Math.max(b, p.y);
	}
	return Number.isFinite(x) ? {
		x: x - pad,
		y: y - pad,
		width: r - x + 2 * pad,
		height: b - y + 2 * pad
	} : void 0;
}
var point = (x, y) => ({
	x,
	y
});
// src/aspects/lines.js
var people = (v) => v.listEntityIds?.() ?? [];
var RELATION_WIDTH_SCALE = 2 / 3;
function anchor(v, id, bottom = false) {
	const b = personBounds(v, id);
	if (!b) return;
	const x = b.x + b.width / 2, y = b.y + (bottom ? 58 : 6), angle = finite(b.rotation), cx = b.x + b.width / 2, cy = b.y + b.height / 2;
	return point(cx + (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle), cy + (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle));
}
function labelBottom(v, id) {
	const b = personBounds(v, id), p = v.getCanonical(id, ids.person);
	return b ? b.y + Math.max(110 + 16 * (String(p?.note ?? "").split("\n").length - 1), (labelExtent(p, b.width)?.bottom ?? 4) - 4) : 0;
}
function dashLine(points, on = 6, off = 4) {
	const paths = [];
	let phase = 0;
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1], b = points[i], dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
		if (!length) continue;
		let at = 0;
		while (at < length - 1e-9) {
			const draw = phase < on, take = Math.min(length - at, (draw ? on : on + off) - phase);
			if (take <= 1e-9) {
				phase = 0;
				continue;
			}
			if (draw) paths.push([point(a.x + dx * at / length, a.y + dy * at / length), point(a.x + dx * (at + take) / length, a.y + dy * (at + take) / length)]);
			at += take;
			phase = (phase + take) % (on + off);
		}
	}
	return paths;
}
function ring(center, radius, steps = 24) {
	return Array.from({ length: steps + 1 }, (_, i) => point(center.x + radius * Math.cos(i * 2 * Math.PI / steps), center.y + radius * Math.sin(i * 2 * Math.PI / steps)));
}
function parallel(points, offset) {
	const a = points[0], b = points[points.length - 1], dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
	return points.map((point$1) => point(point$1.x - dy / length * offset, point$1.y + dx / length * offset));
}
function unionGeometry(p, id, v) {
	const a = anchor(v, p.partnerA, true), b = anchor(v, p.partnerB, true);
	if (!a || !b) return;
	const y = Math.max(a.y, b.y, labelBottom(v, p.partnerA), labelBottom(v, p.partnerB)) + Math.max(12, finite(p.barOffset, 44));
	const origin = point((a.x + b.x) / 2, y), middle = [point(a.x, y), point(b.x, y)];
	const middlePaths = p.status === "cohabitation" ? dashLine(middle, 6, 4) : p.status === "engagement" ? dashLine(middle, 2, 4) : p.status === "secret_affair" ? dashLine(middle, 1, 5) : [middle];
	const paths = [
		[a, middle[0]],
		...middlePaths,
		[middle[1], b]
	];
	if ([
		"separation",
		"divorce",
		"reunion_divorce",
		"reunion_separation"
	].includes(p.status)) {
		const count = p.status.includes("divorce") ? 2 : 1;
		for (let i = 0; i < count; i++) {
			const x = origin.x + (i - (count - 1) / 2) * 7;
			paths.push([point(x - 5, y + 8), point(x + 5, y - 8)]);
		}
		if (p.status.startsWith("reunion")) paths.push(ring(origin, 12));
	}
	return {
		paths,
		origin,
		label: p.label,
		adjustment: {
			x: origin.x,
			y: origin.y,
			axisX: 0,
			axisY: 1,
			units: 1
		}
	};
}
function parentageGeometry(p, id, v) {
	const a = anchor(v, p.parentA, true), c = anchor(v, p.child);
	if (!a || !c) return;
	let o = a;
	const u = p.union && v.getComputed(p.union, `computed.${ids.union}`);
	if (u) o = u.origin;
	else {
		const b = anchor(v, p.parentB, true);
		if (b) o = point((a.x + b.x) / 2, Math.max(a.y, b.y) + 44);
	}
	const siblings = people(v).filter((e) => {
		const q = v.getCanonical(e, ids.parentage);
		return v.isAlive(e) && q && (p.union ? q.union === p.union : !q.union && q.parentA === p.parentA && q.parentB === p.parentB);
	}).sort();
	const children = siblings.map((e) => anchor(v, v.getCanonical(e, ids.parentage).child)).filter(Boolean);
	const y = o.y + (Math.min(c.y, ...children.map((a) => a.y)) - o.y) * Math.max(.1, Math.min(.9, finite(p.barRatio, .5)));
	const paths = [];
	if (siblings[0] === id) {
		const xs = [o.x, ...children.map((a) => a.x)];
		paths.push([o, point(o.x, y)], [point(Math.min(...xs), y), point(Math.max(...xs), y)]);
	}
	const twin = p.twinType !== "none" && anchor(v, p.twinWith);
	const mid = twin ? (c.x + twin.x) / 2 : c.x;
	const branch = [point(mid, y), c];
	if (p.pedigree === "foster") paths.push(...dashLine(branch));
	else if (p.pedigree === "adopted") paths.push(parallel(branch, -3), ...dashLine(parallel(branch, 3)));
	else paths.push(branch);
	if (twin && p.child < p.twinWith && p.twinType === "identical") paths.push([point((mid + c.x) / 2, (y + c.y) / 2), point((mid + twin.x) / 2, (y + twin.y) / 2)]);
	return {
		paths,
		origin: point(c.x, y),
		label: p.pedigree === "surrogate" ? "대리" : "",
		adjustment: {
			x: (Math.min(o.x, ...children.map((a) => a.x)) + Math.max(o.x, ...children.map((a) => a.x))) / 2,
			y,
			axisX: 0,
			axisY: 1,
			units: Math.min(c.y, ...children.map((a) => a.y)) - o.y
		},
		adjustmentIds: siblings
	};
}
function relationGeometry(p, id, v) {
	const start = personSymbol(v, p.from), end = personSymbol(v, p.to);
	if (!start || !end) return;
	const a = point(start.x, start.y), b = point(end.x, end.y);
	const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
	if (len < 1) return;
	const nx = -dy / len, ny = dx / len, off = finite(p.curveOffset), count = Math.max(2, Math.ceil(len / 6));
	const mid = point((a.x + b.x) / 2 + nx * off, (a.y + b.y) / 2 + ny * off), paths = [], fills = [];
	const curve = (offset = 0, zigzag = false) => {
		const points = [];
		for (let i = 0; i <= count; i++) {
			const t = i / count, zig = zigzag && i > 0 && i < count ? (i % 2 ? 4 : -4) * RELATION_WIDTH_SCALE : 0;
			const h = 4 * off * t * (1 - t) + offset + zig;
			points.push(point(a.x + dx * t + nx * h, a.y + dy * t + ny * h));
		}
		return points;
	};
	const push = (points, fill = "none") => {
		paths.push(points);
		fills.push(fill);
	};
	const addDashed = (points) => {
		for (const segment of dashLine(points, 4, 3)) push(segment);
	};
	const kind = p.kind;
	const visibleCenter = pathsOutsideSymbols([curve()], [start, end]);
	if (!visibleCenter.length) return;
	const lastCenter = visibleCenter[visibleCenter.length - 1];
	const targetPoint = lastCenter[lastCenter.length - 1];
	const endParameter = Math.max(0, Math.min(1, ((targetPoint.x - a.x) * dx + (targetPoint.y - a.y) * dy) / (len * len)));
	if (kind === "cutoff" || kind === "cutoff_repaired" || kind === "estranged") {
		const base = curve(), cut = Math.floor(count / 2), left = base.slice(0, Math.max(1, cut - 1)), right = base.slice(Math.min(count, cut + 2));
		if (kind === "cutoff_repaired" || kind === "estranged") {
			addDashed(left);
			addDashed(right);
		} else {
			push(left);
			push(right);
		}
		for (const d of [-5, 5]) push([point(mid.x + dx / len * d - nx * 7 * RELATION_WIDTH_SCALE, mid.y + dy / len * d - ny * 7 * RELATION_WIDTH_SCALE), point(mid.x + dx / len * d + nx * 7 * RELATION_WIDTH_SCALE, mid.y + dy / len * d + ny * 7 * RELATION_WIDTH_SCALE)]);
		if (kind === "cutoff_repaired") push(ring(mid, 4 * RELATION_WIDTH_SCALE), "white");
	} else {
		if ([
			"close",
			"close_hostile",
			"fused",
			"fused_hostile",
			"abuse_sexual"
		].includes(kind)) {
			push(curve(-6 * RELATION_WIDTH_SCALE));
			push(curve(6 * RELATION_WIDTH_SCALE));
		}
		if (kind === "fused") push(curve());
		else if (kind === "fused_hostile") {
			push(curve());
			push(curve(0, true));
		} else if ([
			"close_hostile",
			"hostile",
			"negative_focused",
			"abuse_physical",
			"abuse_emotional",
			"abuse_sexual"
		].includes(kind)) push(curve(0, true));
		else if (kind === "distant") addDashed(curve());
		else if (kind !== "close") push(curve());
		if ([
			"focused_on",
			"negative_focused",
			"caregiving",
			"abuse_physical",
			"abuse_emotional",
			"abuse_sexual"
		].includes(kind)) {
			const arrow = (distance, filled) => {
				const t = Math.max(0, endParameter - distance / len), h = 4 * off * t * (1 - t);
				const tip = distance === 0 ? targetPoint : point(a.x + dx * t + nx * h, a.y + dy * t + ny * h);
				const tx = dx + nx * 4 * off * (1 - 2 * t), ty = dy + ny * 4 * off * (1 - 2 * t), length = Math.hypot(tx, ty);
				const ux = tx / length, uy = ty / length, back = point(tip.x - ux * 10, tip.y - uy * 10);
				const left = point(back.x - uy * 5 * RELATION_WIDTH_SCALE, back.y + ux * 5 * RELATION_WIDTH_SCALE), right = point(back.x + uy * 5 * RELATION_WIDTH_SCALE, back.y - ux * 5 * RELATION_WIDTH_SCALE);
				push(filled ? [
					left,
					tip,
					right,
					left
				] : [
					left,
					tip,
					right
				], filled === "solid" ? "solid" : filled === "hollow" ? "white" : "none");
			};
			arrow(0, kind === "abuse_physical" || kind === "abuse_sexual" ? "solid" : kind === "abuse_emotional" ? "hollow" : false);
			if (kind === "caregiving") arrow(12, false);
		}
	}
	return {
		paths,
		fills,
		origin: mid,
		label: p.label,
		clipSymbols: [start, end],
		adjustment: {
			x: mid.x,
			y: mid.y,
			axisX: nx,
			axisY: ny,
			units: 1
		}
	};
}
function householdGeometry(p, id, v) {
	const boxes = people(v).filter((e) => v.getCanonical(e, ids.person)?.householdId === id).map((e) => personBounds(v, e)).filter(Boolean);
	if (!boxes.length) return;
	const pad = Math.max(0, finite(p.padding, 28)), x = Math.min(...boxes.map((b) => b.x)) - pad, y = Math.min(...boxes.map((b) => b.y)) - pad, r = Math.max(...boxes.map((b) => b.x + b.width)) + pad, b = Math.max(...boxes.map((b) => b.y + b.height)) + pad;
	return {
		paths: [[
			point(x, y),
			point(r, y),
			point(r, b),
			point(x, b),
			point(x, y)
		]],
		origin: point(x + 8, y + 16),
		label: p.label
	};
}
var refs = {
	union: {
		partnerA: "cascade-hide",
		partnerB: "cascade-hide"
	},
	parentage: {
		parentA: "cascade-hide",
		child: "cascade-hide",
		parentB: "nullify",
		union: "nullify",
		twinWith: "nullify"
	},
	relation: {
		from: "cascade-hide",
		to: "cascade-hide"
	},
	household: {}
};
var enumerations = {
	union: { status: [
		"marriage",
		"engagement",
		"cohabitation",
		"separation",
		"divorce",
		"reunion_divorce",
		"reunion_separation",
		"secret_affair"
	] },
	parentage: {
		pedigree: [
			"biological",
			"adopted",
			"foster",
			"surrogate"
		],
		twinType: [
			"none",
			"fraternal",
			"identical"
		]
	},
	relation: { kind: [
		"close",
		"fused",
		"distant",
		"hostile",
		"fused_hostile",
		"close_hostile",
		"negative_focused",
		"caregiving",
		"cutoff",
		"cutoff_repaired",
		"estranged",
		"focused_on",
		"abuse_physical",
		"abuse_emotional",
		"abuse_sexual"
	] },
	household: { strokeStyle: ["dashed", "dotted"] }
};
function make(kind, derive) {
	const aspect = ids[kind], get = (id, v) => v.getComputed(id, `computed.${aspect}`);
	return {
		id: aspect,
		label: {
			union: "부부·파트너",
			parentage: "부모·자녀",
			relation: "정서 관계",
			household: "동거 가구"
		}[kind],
		defaults: defaults[kind],
		refs: refs[kind],
		textFields: kind === "parentage" ? [] : ["label"],
		dependsOnCanonical: Object.values(ids),
		dependsOnComputed: ["computed.layoutBounds", ...kind === "parentage" ? [`computed.${ids.union}`] : []],
		derive(p, id, view) {
			const geometry = derive(p, id, view);
			if (!geometry || kind === "household") return geometry;
			const paths = [], fills = [];
			geometry.paths.forEach((path, index) => {
				const outside = geometry.clipSymbols ? pathsOutsideSymbols([path], geometry.clipSymbols) : [path];
				for (const candidate of outside) for (const visible of pathsAroundLabels([candidate], view)) {
					const first = visible[0], last = visible[visible.length - 1];
					const closed = first && last && Math.hypot(first.x - last.x, first.y - last.y) < 1e-8;
					paths.push(visible);
					fills.push(closed ? geometry.fills?.[index] ?? "none" : "none");
				}
			});
			if (kind === "union") {
				let longest = 0;
				for (const path of paths) for (let i = 1; i < path.length; i++) {
					const a = path[i - 1], b = path[i];
					if (Math.abs(a.y - geometry.origin.y) > 1e-6 || Math.abs(b.y - a.y) > 1e-6) continue;
					const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x);
					const reserve = [
						"separation",
						"divorce",
						"reunion_divorce",
						"reunion_separation"
					].includes(p.status) ? 26 : 0;
					const intervals = reserve ? [[left, Math.min(right, geometry.origin.x - reserve)], [Math.max(left, geometry.origin.x + reserve), right]] : [[left, right]];
					for (const [start, end] of intervals) {
						const length = end - start;
						if (length > longest) {
							longest = length;
							geometry.adjustment.x = (start + end) / 2;
							geometry.adjustment.y = a.y;
						}
					}
				}
			}
			return {
				...geometry,
				paths,
				fills
			};
		},
		paintBounds: (g) => {
			if (!g) return;
			const b = bounds(g.paths, 20);
			if (b && g.label) {
				const right = g.origin.x + Array.from(String(g.label)).length * 12;
				b.width = Math.max(b.width, right - b.x);
				b.y = Math.min(b.y, g.origin.y - 24);
			}
			return b;
		},
		renderSvg(p, g) {
			if (!g || kind === "relation" && !lens.showRelations || kind === "household" && !lens.showHouseholds) return { svg: "" };
			const color = (kind === "relation" || kind === "household") && typeof p.color === "string" && /^#[\da-f]{6}$/i.test(p.color) ? p.color : kind === "relation" ? "#dc2626" : "#334155";
			const paths = g.paths.map((ps, index) => `<path d="${pathData(ps)}" fill="${g.fills?.[index] === "solid" ? color : g.fills?.[index] === "white" ? "white" : "none"}"/>`).join("");
			const o = g.origin;
			return { svg: `<g fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"${kind === "household" ? p.strokeStyle === "dotted" ? " stroke-dasharray=\"1 5\" stroke-linecap=\"round\"" : " stroke-dasharray=\"6 4\"" : ""}>${paths}</g><text x="${o.x}" y="${o.y - 8}" font-family="sans-serif" font-size="12">${escapeXml(display(g.label))}</text>` };
		},
		selection: {
			priority: 20,
			getBounds(id, v, out) {
				const g = get(id, v), b = g && bounds(g.paths);
				if (!b) return false;
				Object.assign(out, b, { rotation: 0 });
				return true;
			},
			hitTest(id, v, x, y, zoom) {
				const g = get(id, v);
				if (!g || kind === "relation" && !lens.showRelations || kind === "household" && !lens.showHouseholds) return Infinity;
				const d = distance(g.paths, x, y);
				return d <= 8 / Math.max(.01, zoom) ? d : Infinity;
			},
			intersectsRect(id, v, l, t, r, b) {
				const g = get(id, v);
				return !!g && !(kind === "relation" && !lens.showRelations || kind === "household" && !lens.showHouseholds) && intersects(g.paths, l, t, r, b);
			},
			getOutlinePath(id, view, projection) {
				const g = get(id, view);
				if (!g || kind === "relation" && !lens.showRelations || kind === "household" && !lens.showHouseholds) return "";
				const point = {
					x: 0,
					y: 0
				};
				let path = "";
				for (const points of g.paths) {
					if (points.length < 2) continue;
					for (let i = 0; i < points.length; i++) {
						projection.worldToScreen(points[i].x, points[i].y, point);
						if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return "";
						path += `${i ? "L" : "M"}${point.x},${point.y}`;
					}
				}
				return path;
			},
			canTransform: () => false
		},
		ui: { controls: [
			...Object.entries(enumerations[kind]).map(([field, values]) => ({
				kind: "segmented",
				field,
				label: labels$1[field] ?? field,
				placement: "inspector",
				options: values.map((value) => ({
					value,
					label: labels$1[value] ?? value,
					...kind === "relation" && field === "kind" ? { icon: relationshipIcons[value] } : {}
				}))
			})),
			...kind === "relation" ? [{
				id: "relationship-floating",
				kind: "segmented",
				field: "kind",
				label: "정서 관계",
				placement: "selection-bar",
				options: enumerations.relation.kind.map((value) => ({
					value,
					label: labels$1[value] ?? value,
					icon: relationshipIcons[value]
				}))
			}] : [],
			...kind === "relation" ? [{
				kind: "color",
				field: "color",
				label: "관계선 색상",
				placement: "inspector"
			}] : [],
			...kind === "parentage" ? [] : [{
				kind: "text",
				field: "label",
				label: "메모·연도",
				placement: "inspector"
			}],
			{
				kind: "number",
				field: kind === "union" ? "barOffset" : kind === "parentage" ? "barRatio" : kind === "relation" ? "curveOffset" : "padding",
				label: "선 위치·여백",
				placement: "inspector"
			}
		] }
	};
}
var lines = [
	make("union", unionGeometry),
	make("parentage", parentageGeometry),
	make("relation", relationGeometry),
	make("household", householdGeometry)
];
// src/commands/family.js
function familyCommands(context, preferences) {
	const { world } = context, provider = context.services.get("canvas.active-tool-surface"), creation = context.services.get("canvas.creation");
	let active = true;
	const all = (k) => world.listEntityIds().filter((id) => world.isAlive(id) && world.getCanonical(id, ids[k]));
	const prop = (id, k) => world.getCanonical(id, ids[k]);
	const selected = () => provider?.get()?.selection.getSelection() ?? [];
	const persons = () => selected().filter((id) => prop(id, "person"));
	const id = () => `genogram-${crypto.randomUUID()}`;
	const op = (id, k, patch) => ({
		id,
		aspect: ids[k] ?? k,
		patch
	});
	const pos = (id) => world.getCanonical(id, "core.transform") ?? {
		x: 0,
		y: 0
	};
	function commit(name, ops, focus) {
		if (!active) throw Error("확장이 비활성화되었습니다.");
		const s = provider?.get();
		if (!s) throw Error("활성 캔버스가 필요합니다.");
		s.host.history.begin();
		try {
			world.applyCanonicalTransaction(`${prefix}:${name}`, ops);
			s.host.history.commit();
		} catch (e) {
			s.host.history.abort();
			throw e;
		}
		if (focus) s.selection.select(focus);
	}
	function entity(ops, k, p = {}) {
		const n = id();
		ops.push(op(n, k, {
			...defaults[k],
			...p
		}));
		return n;
	}
	function person(ops, x, y, p = {}) {
		const n = entity(ops, "person", p);
		ops.push(op(n, "core.transform", {
			x,
			y,
			rotation: 0
		}), op(n, "core.bounds", {
			width: 100,
			height: 120
		}));
		return n;
	}
	const union = (ops, a, b, n = 0) => entity(ops, "union", {
		partnerA: a,
		partnerB: b,
		barOffset: 44 + n * 20
	});
	function parent(ops, a, b, c, u = null) {
		return entity(ops, "parentage", {
			parentA: a,
			parentB: b,
			child: c,
			union: u
		});
	}
	function requirePeople(n) {
		const p = persons();
		if (p.length !== n) throw Error(`인물 ${n}명을 선택하세요.`);
		return p;
	}
	function hasAncestor(ancestor, child) {
		const seen = /* @__PURE__ */ new Set(), pending = [child];
		while (pending.length) {
			const c = pending.pop();
			if (c === ancestor) return true;
			if (seen.has(c)) continue;
			seen.add(c);
			for (const e of all("parentage")) {
				const p = prop(e, "parentage");
				if (p.child === c) {
					if (p.parentA) pending.push(p.parentA);
					if (p.parentB) pending.push(p.parentB);
				}
			}
		}
		return false;
	}
	function run(name) {
		if (!active) throw Error("확장이 비활성화되었습니다.");
		if (name === "add-person") return creation.create({
			caller: `${prefix}:${name}`,
			aspects: { [ids.person]: {
				...defaults.person,
				isIndexPerson: all("person").length === 0
			} },
			width: 100,
			height: 120
		});
		if ([
			"privacy",
			"mask-years",
			"show-relations",
			"show-households",
			"show-notes"
		].includes(name)) {
			const key = {
				"mask-years": "maskYears",
				"show-relations": "showRelations",
				"show-households": "showHouseholds",
				"show-notes": "showNotes"
			}[name];
			if (name === "privacy") {
				const modes = [
					"full",
					"surname_masked",
					"initials",
					"hidden"
				];
				preferences.change("privacy", modes[(modes.indexOf(lens.privacy) + 1) % 4]);
			} else preferences.change(key, !lens[key]);
			return;
		}
		const ops = [];
		let focus;
		if (name.startsWith("template-")) {
			const a = person(ops, 0, 0, { symbol: "unknown" });
			focus = a;
			if (name === "template-single-parent") for (let i = 0; i < 2; i++) parent(ops, a, null, person(ops, i * 110, 220, { isIndexPerson: i === 0 }));
			else {
				const b = person(ops, 180, 0), u = union(ops, a, b);
				for (let i = 0; i < 2; i++) parent(ops, a, b, person(ops, i * 110 + 40, 220, { isIndexPerson: i === 0 }), u);
				if (name === "template-three-generation") {
					const g = person(ops, -80, -220), h = person(ops, 100, -220);
					parent(ops, g, h, a, union(ops, g, h));
				}
				if (name === "template-remarried") {
					ops.push(op(u, "union", { status: "divorce" }));
					const c = person(ops, -180, 0), v = union(ops, a, c, 1);
					parent(ops, a, c, person(ops, -100, 220), v);
				}
			}
		} else if (name === "connect-union") {
			const [a, b] = requirePeople(2);
			if (all("union").some((e) => {
				const p = prop(e, "union");
				return p.partnerA === a && p.partnerB === b || p.partnerA === b && p.partnerB === a;
			})) throw Error("이미 연결된 부부입니다.");
			union(ops, a, b);
		} else if (name === "connect-parentage") {
			const [a, b] = requirePeople(2);
			if (hasAncestor(b, a)) throw Error("부모·자녀 순환 관계는 만들 수 없습니다.");
			if (all("parentage").some((e) => {
				const p = prop(e, "parentage");
				return p.child === b && (p.parentA === a || p.parentB === a);
			})) throw Error("이미 연결된 부모·자녀입니다.");
			parent(ops, a, null, b);
		} else if (name === "connect-twins") {
			const [a, b] = requirePeople(2), pa = all("parentage").find((e) => prop(e, "parentage").child === a), pb = all("parentage").find((e) => prop(e, "parentage").child === b);
			if (!pa || !pb || prop(pa, "parentage").parentA !== prop(pb, "parentage").parentA || prop(pa, "parentage").union !== prop(pb, "parentage").union) throw Error("같은 부모에 연결된 자녀 두 명을 선택하세요.");
			ops.push(op(pa, "parentage", {
				twinWith: b,
				twinType: "fraternal"
			}), op(pb, "parentage", {
				twinWith: a,
				twinType: "fraternal"
			}));
		} else if (name.startsWith("relation-")) {
			const [a, b] = requirePeople(2);
			focus = entity(ops, "relation", {
				from: a,
				to: b,
				kind: name.slice(9)
			});
		} else if (name === "reverse") for (const e of selected()) {
			const p = prop(e, "relation");
			if (p) ops.push(op(e, "relation", {
				from: p.to,
				to: p.from
			}));
		}
		else if (name === "household") {
			const ps = persons();
			if (!ps.length) throw Error("동거 인물을 선택하세요.");
			const h = entity(ops, "household");
			for (const p of ps) ops.push(op(p, "person", { householdId: h }));
		} else if (name === "toggle-membership") {
			const h = selected().find((e) => prop(e, "household"));
			if (!h) throw Error("가구 테두리와 인물을 함께 선택하세요.");
			for (const p of persons()) ops.push(op(p, "person", { householdId: prop(p, "person").householdId === h ? null : h }));
		} else if (name === "tidy-layout") {
			const ps = persons().length ? persons() : all("person"), depth = /* @__PURE__ */ new Map(), visiting = /* @__PURE__ */ new Set();
			function level(p) {
				if (depth.has(p)) return depth.get(p);
				if (visiting.has(p)) throw Error("순환 부모 관계를 먼저 수정하세요.");
				visiting.add(p);
				let n = 0;
				for (const e of all("parentage")) {
					const q = prop(e, "parentage");
					if (q.child === p) {
						for (const a of [q.parentA, q.parentB]) if (a && ps.includes(a)) n = Math.max(n, level(a) + 1);
					}
				}
				visiting.delete(p);
				depth.set(p, n);
				return n;
			}
			for (const p of ps) level(p);
			const rows = /* @__PURE__ */ new Map();
			for (const p of ps) {
				const n = depth.get(p);
				if (!rows.has(n)) rows.set(n, []);
				rows.get(n).push(p);
			}
			for (const [n, row] of rows) {
				row.sort((a, b) => prop(a, "person").birthOrderHint - prop(b, "person").birthOrderHint || pos(a).x - pos(b).x || a.localeCompare(b));
				row.forEach((p, i) => ops.push(op(p, "core.transform", {
					x: i * 180,
					y: n * 240
				})));
			}
		} else {
			const chosenUnion = name === "add-child" && selected().length === 1 && prop(selected()[0], "union");
			const a = chosenUnion ? chosenUnion.partnerA : requirePeople(1)[0], p = pos(a), parents = all("parentage").find((e) => prop(e, "parentage").child === a), q = parents && prop(parents, "parentage");
			if (name === "add-partner") {
				const n = all("union").filter((e) => {
					const u = prop(e, "union");
					return u.partnerA === a || u.partnerB === a;
				}).length;
				focus = person(ops, p.x + (n % 2 ? -1 : 1) * 180 * (1 + Math.floor(n / 2)), p.y);
				union(ops, a, focus, n);
			} else if (name === "add-child") {
				let u = selected().find((e) => prop(e, "union"));
				const unions = all("union").filter((e) => {
					const q = prop(e, "union");
					return q.partnerA === a || q.partnerB === a;
				});
				if (!u && unions.length > 1) throw Error("자녀를 연결할 부부 관계선을 선택하세요.");
				u = u ?? unions[0];
				const partner = u ? prop(u, "union").partnerA === a ? prop(u, "union").partnerB : prop(u, "union").partnerA : null;
				const n = all("parentage").filter((e) => prop(e, "parentage").parentA === a).length;
				focus = person(ops, p.x + n * 110, p.y + 240);
				parent(ops, a, partner, focus, u);
			} else if (name === "add-parents") {
				if (q) throw Error("이미 부모가 연결되어 있습니다.");
				const b = person(ops, p.x - 90, p.y - 240), c = person(ops, p.x + 90, p.y - 240);
				parent(ops, b, c, a, union(ops, b, c));
			} else if ([
				"older-sibling",
				"younger-sibling",
				"add-twin"
			].includes(name)) {
				if (!q) throw Error("먼저 부모를 연결하세요. 부모를 모르면 미상 인물로 추가할 수 있습니다.");
				const delta = name === "older-sibling" ? -110 : 110;
				for (const e of all("person")) {
					const t = pos(e);
					if (e !== a && Math.abs(t.y - p.y) < 50 && (delta < 0 ? t.x < p.x : t.x > p.x)) ops.push(op(e, "core.transform", { x: t.x + delta }));
				}
				focus = person(ops, p.x + delta, p.y, { birthOrderHint: prop(a, "person").birthOrderHint + (delta < 0 ? -1 : 1) });
				const r = parent(ops, q.parentA, q.parentB, focus, q.union);
				if (name === "add-twin") ops.push(op(r, "parentage", {
					twinWith: a,
					twinType: "fraternal"
				}), op(parents, "parentage", {
					twinWith: focus,
					twinType: "fraternal"
				}));
			}
		}
		if (ops.length) commit(name, ops, focus);
		return focus;
	}
	return {
		run,
		dispose() {
			active = false;
		},
		all,
		prop
	};
}
// src/tools.js
var enums = {
	symbol: symbols,
	orientation: [
		"none",
		"gay",
		"lesbian",
		"bisexual"
	],
	lifeStatus: ["alive", "deceased"],
	clinical: [
		"none",
		"physical",
		"mental",
		"substance",
		"mental_substance",
		"recovering",
		"substance_recovery",
		"illness_remission",
		"suspected_substance",
		"recovery_with_illness"
	]
};
/** Discovery callbacks only read or prepare operations. Never execute UI commands. */
function registerGenogramTools(context) {
	const tools = context.services.get("workspace.tools");
	if (!tools) return () => {};
	const off = [];
	const { world } = context;
	const read = (id) => {
		if (!world.isAlive(id)) throw Error("INVALID_INPUT: missing entity");
		return {
			id,
			aspects: Object.fromEntries(Object.values(ids).flatMap((aspect) => {
				const value = world.getCanonical(id, aspect);
				if (!value) return [];
				const copy = structuredClone(value);
				if (aspect === ids.person) {
					copy.name = display(copy.name, "name");
					copy.yearSpan = display(copy.yearSpan);
					copy.note = lens.showNotes ? display(copy.note) : "";
				}
				return [[aspect, copy]];
			}))
		};
	};
	const register = (name, description, properties, required, execute) => off.push(tools.register({
		id: `${prefix}:${name}`,
		description,
		inputSchema: {
			type: "object",
			properties,
			required
		},
		execute: async (input, { signal }) => {
			signal.throwIfAborted();
			return execute(input);
		}
	}));
	try {
		register("plan-changes", "가계도 genogram 생성·삭제·가족 구조·관계·배치 수정. actions is JSON array: [{action:'create',kind:'person',id:'alias',patch:{name:'Kim'},x:0,y:0},{action:'create',kind:'union',patch:{partnerA:'alias',partnerB:'existing-id'}},{action:'update',id:'existing-id',kind:'person',patch:{name:'Lee'}},{action:'move',id:'existing-id',x:180,y:240},{action:'delete',id:'existing-id'}]. kind: person/union/parentage/relation/household. References may use aliases defined in this batch. Create IDs are host-generated. Delete cascades attached relations and clears household/twin references. Returns approval proposal, NEVER applies. Up to 100 operations; no clinical inference. Use descriptors for fields and schema tool for defaults/enums.", { actions: { type: "string" } }, ["actions"], ({ actions }) => {
			if (!tools.prepareChange) throw Error("Host update required: extension change approvals");
			return tools.prepareChange(planGenogramChanges(world, JSON.parse(actions)));
		});
		register("schema", "가계도 genogram defaults, enum values and batch action format (read-only).", {}, [], () => ({
			defaults,
			enums,
			ids,
			enumerations,
			instructions: "Create person with x/y; create union with partnerA/B; parentage with parentA/B, child, union; relation with from/to/kind. plan-changes previews the complete atomic batch for user approval. Never infer sensitive attributes."
		}));
		for (const [kind, aspect] of Object.entries(ids)) off.push(tools.registerDescriptor({
			aspect,
			description: `가계도 genogram ${kind}. References are entity IDs, not names. Do not infer clinical diagnoses. Use plan-changes for creation/deletion/structure/layout with explicit user approval; no direct mutation tools.`,
			fields: Object.fromEntries(Object.entries(defaults[kind]).map(([field, value]) => [field, enums[field] ? `Allowed: ${enums[field].join(", ")}` : `${value === null ? "entity reference or null" : typeof value}: ${field}`]))
		}));
		register("search", "가계도 genogram 인물·가족·관계 조회. Respects name/year privacy and hidden notes. Search query matches visible names or IDs. Paginated, no writes.", {
			query: { type: "string" },
			offset: { type: "number" }
		}, [], ({ query = "", offset = 0 }) => {
			if (!Number.isInteger(offset) || offset < 0 || query.length > 200) throw Error("INVALID_INPUT");
			const matches = world.listEntityIds().filter((id) => world.isAlive(id) && Object.values(ids).some((aspect) => world.getCanonical(id, aspect))).filter((id) => `${id} ${display(world.getCanonical(id, ids.person)?.name, "name")}`.toLowerCase().includes(query.toLowerCase()));
			return {
				entities: matches.slice(offset, offset + 20).map(read),
				total: matches.length,
				nextOffset: offset + 20 < matches.length ? offset + 20 : null
			};
		});
		register("relationships", "가계도 genogram 인물의 부부·부모자녀·정서 관계 조회 (read-only).", { personId: { type: "string" } }, ["personId"], ({ personId }) => {
			if (!world.isAlive(personId) || !world.getCanonical(personId, ids.person)) throw Error("INVALID_INPUT: person required");
			const matches = world.listEntityIds().filter((id) => world.isAlive(id) && [
				[ids.union, ["partnerA", "partnerB"]],
				[ids.parentage, [
					"parentA",
					"parentB",
					"child"
				]],
				[ids.relation, ["from", "to"]]
			].some(([aspect, fields]) => fields.some((field) => world.getCanonical(id, aspect)?.[field] === personId)));
			return {
				person: read(personId),
				relationships: matches.slice(0, 50).map(read),
				truncated: matches.length > 50
			};
		});
		register("plan-person-edit", "가계도 genogram 인물 속성 수정안. patch is a JSON object string. Returns operations only, DOES NOT APPLY. Target must be selected at send time; pass operations to changes_propose for user approval. Never infer diagnoses. No householdId/reference editing, creation or deletion.", {
			personId: { type: "string" },
			patch: { type: "string" }
		}, ["personId", "patch"], ({ personId, patch }) => {
			if (!world.isAlive(personId) || !world.getCanonical(personId, ids.person)) throw Error("INVALID_INPUT: person required");
			const value = JSON.parse(patch);
			if (!value || Array.isArray(value) || typeof value !== "object" || !Object.keys(value).length) throw Error("INVALID_INPUT: patch object required");
			for (const [field, v] of Object.entries(value)) {
				if (!Object.hasOwn(defaults.person, field) || field === "householdId" || typeof v !== typeof defaults.person[field]) throw Error("INVALID_INPUT: field/type");
				if (enums[field] && !enums[field].includes(v)) throw Error("INVALID_INPUT: enum");
				if (typeof v === "string" && v.length > 4e3 || typeof v === "number" && (!Number.isInteger(v) || Math.abs(v) > 1e4)) throw Error("INVALID_INPUT: field budget");
			}
			return {
				status: "plan-only",
				requiresApproval: true,
				operations: [{
					id: personId,
					aspect: ids.person,
					patch: value
				}]
			};
		});
	} catch (error) {
		for (const dispose of off.reverse()) dispose();
		throw error;
	}
	return () => {
		for (const dispose of off.splice(0).reverse()) dispose();
	};
}
function planGenogramChanges(world, actions) {
	if (!Array.isArray(actions) || !actions.length || actions.length > 50) throw Error("INVALID_INPUT: actions budget");
	const snapshot = world.exportCanonicalSnapshot(), next = structuredClone(snapshot), aliases = /* @__PURE__ */ new Map(), ops = [];
	const resolve = (id) => aliases.get(id) ?? id;
	for (const action of actions) {
		if (!action || typeof action !== "object" || Array.isArray(action)) throw Error("INVALID_INPUT: action");
		if (action.action !== "create") continue;
		if (!Object.hasOwn(ids, action.kind)) throw Error("INVALID_INPUT: kind");
		if (action.id !== void 0 && (typeof action.id !== "string" || !action.id || aliases.has(action.id) || Object.hasOwn(snapshot, action.id))) throw Error("INVALID_INPUT: duplicate alias");
		const id = `genogram-${crypto.randomUUID()}`;
		aliases.set(action.id ?? id, id);
	}
	let createIndex = 0;
	const newIds = [...aliases.values()];
	const push = (id, aspect, patch) => {
		ops.push({
			id,
			aspect,
			patch
		});
		if (patch === null) delete next[id];
		else {
			next[id] ??= {};
			next[id][aspect] = {
				...next[id][aspect],
				...patch
			};
		}
	};
	const references = {
		person: ["householdId"],
		union: ["partnerA", "partnerB"],
		parentage: [
			"parentA",
			"parentB",
			"child",
			"union",
			"twinWith"
		],
		relation: ["from", "to"],
		household: []
	};
	for (const action of actions) {
		if (!action || typeof action !== "object") throw Error("INVALID_INPUT: action");
		const id = action.action === "create" ? newIds[createIndex++] : resolve(action.id);
		if (typeof id !== "string" || !id) throw Error("INVALID_INPUT: id");
		if (action.action !== "create" && !Object.values(ids).some((aspect) => next[id]?.[aspect])) throw Error("INVALID_INPUT: missing genogram entity");
		if (action.action === "delete") {
			push(id, ids.person, null);
			continue;
		}
		if (action.action === "move") {
			if (!next[id]?.[ids.person] || !Number.isFinite(action.x) || !Number.isFinite(action.y) || Math.abs(action.x) > 1e7 || Math.abs(action.y) > 1e7) throw Error("INVALID_INPUT: person position");
			push(id, "core.transform", {
				x: action.x,
				y: action.y
			});
			continue;
		}
		if (!["create", "update"].includes(action.action) || !Object.hasOwn(ids, action.kind)) throw Error("INVALID_INPUT: action/kind");
		const kind = action.kind, aspect = ids[kind];
		if (action.action === "update" && !next[id]?.[aspect]) throw Error("INVALID_INPUT: aspect mismatch");
		const patch = action.patch ?? {};
		if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw Error("INVALID_INPUT: patch");
		for (const [field, value] of Object.entries(patch)) {
			if (!Object.hasOwn(defaults[kind], field)) throw Error("INVALID_INPUT: field");
			if (references[kind].includes(field)) {
				if (value !== null && typeof value !== "string") throw Error("INVALID_INPUT: reference");
			} else if (typeof value !== typeof defaults[kind][field] || typeof value === "string" && value.length > 4e3 || typeof value === "number" && (!Number.isFinite(value) || Math.abs(value) > 1e7)) throw Error("INVALID_INPUT: field type/budget");
			const allowed = kind === "person" ? enums[field] : enumerations[kind]?.[field];
			if (allowed && !allowed.includes(value)) throw Error("INVALID_INPUT: enum");
		}
		const values = {
			...action.action === "create" ? defaults[kind] : {},
			...patch
		};
		for (const field of references[kind]) if (typeof values[field] === "string") values[field] = resolve(values[field]);
		push(id, aspect, values);
		if (action.action === "create" && kind === "person") {
			const x = action.x ?? 0, y = action.y ?? 0;
			if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e7 || Math.abs(y) > 1e7) throw Error("INVALID_INPUT: position");
			push(id, "core.transform", {
				x,
				y,
				rotation: 0
			});
			push(id, "core.bounds", {
				width: 100,
				height: 120
			});
		}
	}
	const deleted = new Set(ops.filter((op) => op.patch === null).map((op) => op.id));
	for (const [id, entity] of Object.entries(next)) for (const kind of [
		"union",
		"parentage",
		"relation"
	]) {
		const value = entity[ids[kind]];
		if (value && references[kind].filter((field) => field !== "twinWith").some((field) => deleted.has(value[field]))) {
			push(id, ids[kind], null);
			deleted.add(id);
		}
	}
	for (const [id, entity] of Object.entries(next)) if (entity[ids.parentage] && deleted.has(entity[ids.parentage].union)) {
		push(id, ids.parentage, null);
		deleted.add(id);
	}
	for (const [id, entity] of Object.entries(next)) {
		if (deleted.has(entity[ids.person]?.householdId)) push(id, ids.person, { householdId: null });
		if (deleted.has(entity[ids.parentage]?.twinWith)) push(id, ids.parentage, {
			twinWith: null,
			twinType: "none"
		});
	}
	validateGraph(next);
	if (ops.length > 100) throw Error("INVALID_INPUT: operation budget");
	return ops;
}
function validateGraph(snapshot) {
	const person = (id) => !!snapshot[id]?.[ids.person], unions = /* @__PURE__ */ new Set(), parents = /* @__PURE__ */ new Map();
	for (const entity of Object.values(snapshot)) {
		const p = entity[ids.person], u = entity[ids.union], c = entity[ids.parentage], r = entity[ids.relation];
		if (p?.householdId && !snapshot[p.householdId]?.[ids.household]) throw Error("INVALID_INPUT: household reference");
		if (u) {
			if (!person(u.partnerA) || !person(u.partnerB) || u.partnerA === u.partnerB) throw Error("INVALID_INPUT: partners");
			const key = [u.partnerA, u.partnerB].sort().join("\0");
			if (unions.has(key)) throw Error("INVALID_INPUT: duplicate union");
			unions.add(key);
		}
		if (c) {
			if (!person(c.child) || ![c.parentA, c.parentB].some(person) || [c.parentA, c.parentB].some((id) => id !== null && !person(id)) || c.parentA && c.parentA === c.parentB) throw Error("INVALID_INPUT: parentage");
			if (c.union) {
				const u = snapshot[c.union]?.[ids.union];
				if (!u || ![c.parentA, c.parentB].every((id) => id === null || [u.partnerA, u.partnerB].includes(id))) throw Error("INVALID_INPUT: union reference");
			}
			if (c.twinWith && (!person(c.twinWith) || c.twinWith === c.child)) throw Error("INVALID_INPUT: twin reference");
			const list = parents.get(c.child) ?? [];
			for (const id of [c.parentA, c.parentB].filter(Boolean)) {
				if (list.includes(id)) throw Error("INVALID_INPUT: duplicate parentage");
				list.push(id);
			}
			parents.set(c.child, list);
		}
		if (r && (!person(r.from) || !person(r.to) || r.from === r.to)) throw Error("INVALID_INPUT: relation endpoints");
	}
	const done = /* @__PURE__ */ new Set(), visiting = /* @__PURE__ */ new Set();
	function visit(id) {
		if (visiting.has(id)) throw Error("INVALID_INPUT: ancestry cycle");
		if (done.has(id)) return;
		visiting.add(id);
		for (const p of parents.get(id) ?? []) visit(p);
		visiting.delete(id);
		done.add(id);
	}
	for (const id of parents.keys()) visit(id);
}
// src/index.js
var labels = {
	"edit-person": "인물 바로 편집",
	"add-person": "내담자·인물 추가",
	"older-sibling": "손위 형제",
	"younger-sibling": "손아래 동생",
	"add-partner": "배우자 추가",
	"add-child": "자녀 추가",
	"add-parents": "부모 추가",
	"add-twin": "쌍둥이 추가",
	"connect-relation": "정서 관계 연결",
	"connect-union": "부부로 연결",
	"connect-parentage": "첫 선택 부모 → 자녀 연결",
	"connect-twins": "쌍둥이로 묶기",
	reverse: "방향 반전",
	household: "동거 가구로 묶기",
	"toggle-membership": "가구 편입·제외",
	"tidy-layout": "가족 정돈",
	privacy: "이름 표시 방식 전환",
	"mask-years": "연도 마스킹",
	"show-relations": "정서선 표시 전환",
	"show-households": "가구 표시 전환",
	"show-notes": "메모 표시 전환",
	"template-nuclear": "핵가족 템플릿",
	"template-three-generation": "3세대 템플릿",
	"template-single-parent": "한부모 템플릿",
	"template-remarried": "재혼 가족 템플릿",
	"relation-close": "친밀",
	"relation-fused": "융합",
	"relation-hostile": "갈등",
	"relation-cutoff": "단절",
	"relation-focused_on": "집중"
};
var src_default = {
	...createPackageManifest(extension_default),
	summary: extension_default.summary,
	aspects: [person, ...lines],
	ui: { controls: commandNames.map((name) => {
		const global = name === "add-person" || name.startsWith("template-") || [
			"privacy",
			"mask-years",
			"show-relations",
			"show-households",
			"show-notes"
		].includes(name);
		const floating = [
			"connect-union",
			"connect-parentage",
			"connect-relation",
			"household"
		].includes(name);
		const aspectId = global ? void 0 : name === "reverse" ? ids.relation : name === "toggle-membership" ? ids.household : ids.person;
		return {
			id: name,
			kind: "action",
			label: labels[name],
			icon: icons[name],
			commandSymbol: `${prefix}:${name}`,
			placement: name === "add-person" ? "tool-shelf" : [
				"privacy",
				"mask-years",
				"show-relations",
				"show-households",
				"show-notes"
			].includes(name) || name.startsWith("template-") ? "settings" : floating ? "selection-bar" : "inspector",
			...aspectId ? { aspectId } : {},
			...!global && !floating ? {
				section: name.startsWith("relation-") ? "정서 관계 만들기" : name === "reverse" ? "관계 편집" : name === "toggle-membership" ? "가구 편집" : "가족 구성",
				sectionCollapsed: true
			} : {},
			requiresSelection: !global,
			minSelectionCount: floating || name.startsWith("relation-") || name === "connect-twins" || name === "toggle-membership" ? 2 : global ? 0 : 1,
			...name.startsWith("connect-") || name.startsWith("relation-") ? { maxSelectionCount: 2 } : {}
		};
	}) },
	activate(context) {
		const preferences = bindPreferences(context), family = familyCommands(context, preferences), editor = mountInlineEditor(context), off = [() => preferences.dispose(), () => editor.dispose()];
		const execute = (name) => {
			if (name === "edit-person") {
				const selected = context.services.get("canvas.active-tool-surface")?.get()?.selection.getSelection();
				if (selected?.length === 1) editor.open(selected[0]);
				return;
			}
			const result = family.run(name === "connect-relation" ? "relation-close" : name);
			if (name === "add-person" && result) editor.open(result);
			return result;
		};
		try {
			off.push(registerGenogramTools(context));
			for (const name of commandNames) off.push(context.commands.register({
				id: `${prefix}:${name}`,
				title: labels[name],
				summary: labels[name],
				shortcutScope: "canvas",
				...name === "edit-person" ? { shortcutSelectionAspect: ids.person } : {},
				...{
					"edit-person": "Enter",
					"older-sibling": "M-[",
					"younger-sibling": "M-]",
					"add-partner": "M-s",
					"add-child": "M-c",
					"add-parents": "M-p",
					"add-twin": "M-t",
					household: "C-c g"
				}[name] ? { keys: [{
					"edit-person": "Enter",
					"older-sibling": "M-[",
					"younger-sibling": "M-]",
					"add-partner": "M-s",
					"add-child": "M-c",
					"add-parents": "M-p",
					"add-twin": "M-t",
					household: "C-c g"
				}[name]] } : {},
				run: () => execute(name)
			}));
			off.push(mountInteractions(context, execute));
			if (context.world.registerSelectionExpander) off.push(context.world.registerSelectionExpander((selected) => {
				const expanded = new Set(selected);
				for (const id of selected) {
					const u = context.world.getCanonical(id, ids.union);
					if (u) {
						if (u.partnerA) expanded.add(u.partnerA);
						if (u.partnerB) expanded.add(u.partnerB);
					}
					if (context.world.getCanonical(id, ids.household)) {
						for (const p of context.world.listEntityIds()) if (context.world.getCanonical(p, ids.person)?.householdId === id) expanded.add(p);
					}
				}
				return [...expanded];
			}));
		} catch (e) {
			for (const f of off.reverse()) f();
			family.dispose();
			throw e;
		}
		return {
			api: Object.freeze({ run: execute }),
			dispose() {
				family.dispose();
				for (const f of off.splice(0).reverse()) f();
			}
		};
	}
};
export { src_default as default };
