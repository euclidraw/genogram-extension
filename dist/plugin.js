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
	"add-person",
	"older-sibling",
	"younger-sibling",
	"add-partner",
	"add-child",
	"add-parents",
	"add-twin",
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
		};
		let gesture = null, composing = false, until = 0;
		const key = `root.select.${prefix}:adjust`;
		function cancel() {
			gesture = null;
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
				const b = world.getComputed(id, "computed.layoutBounds");
				if (!b) return false;
				const dx = kind === "older-sibling" ? -18 : kind === "younger-sibling" || kind === "add-partner" ? b.width + 18 : b.width / 2, dy = kind === "add-parents" ? -18 : kind === "add-child" ? b.height + 18 : kind === "add-partner" ? 32 : kind === "add-twin" ? b.height : 32;
				out.x = b.x + dx;
				out.y = b.y + dy;
				return true;
			}
			const g = world.getComputed(id, `computed.${ids[kind]}`);
			if (!g) return false;
			out.x = g.origin.x;
			out.y = g.origin.y;
			return true;
		}
		for (const kind of [
			"older-sibling",
			"younger-sibling",
			"add-partner",
			"add-child",
			"add-parents",
			"add-twin",
			"union",
			"parentage",
			"relation"
		]) {
			const el = document.createElement("button");
			el.textContent = kind in ids ? "◆" : "+";
			el.title = kind;
			el.setAttribute("aria-label", kind);
			el.dataset.canvasUi = "true";
			Object.assign(el.style, {
				position: "absolute",
				width: "22px",
				height: "22px",
				padding: "0",
				border: "1px solid #64748b",
				borderRadius: "50%",
				background: "white",
				pointerEvents: "none",
				display: "none"
			});
			s.surface.hud.append(el);
			elements.push(el);
			const handle = {
				id: `${prefix}:${kind}`,
				priority: 30,
				shape: "circle",
				radiusScreenPx: 11,
				getWorldPosition: (out) => location(kind, out),
				onPointerDown(e) {
					if (composing || e.isComposing || Date.now() < until || e.button !== 0) return false;
					if (!(kind in ids)) {
						run(kind);
						return true;
					}
					const id = target(), field = kind === "union" ? "barOffset" : kind === "parentage" ? "barRatio" : "curveOffset", p = world.getCanonical(id, ids[kind]);
					s.host.screenToWorld(e.clientX, e.clientY, point);
					gesture = {
						id,
						kind,
						field,
						initial: p[field],
						startY: point.y,
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
		function move(e) {
			if (!gesture || e.pointerId !== gesture.pointer) return;
			s.host.screenToWorld(e.clientX, e.clientY, point);
			gesture.delta = (point.y - gesture.startY) / (gesture.kind === "parentage" ? 200 : 1);
			if (Math.abs(e.clientY - gesture.startClientY) < 3.5) return;
			const value = gesture.initial + gesture.delta;
			overlay.set(gesture.id, ids[gesture.kind], { [gesture.field]: gesture.kind === "parentage" ? Math.max(.1, Math.min(.9, value)) : value });
			s.host.requestRender();
		}
		function up(e) {
			if (!gesture || e.pointerId !== gesture.pointer) return;
			const g = gesture;
			cancel();
			if (Math.abs(e.clientY - g.startClientY) < 3.5) return;
			const current = world.getCanonical(g.id, ids[g.kind]);
			if (!current) return;
			const value = current[g.field] + g.delta;
			s.host.history.begin();
			try {
				world.applyCanonicalTransaction(`${prefix}:adjust`, [{
					id: g.id,
					aspect: ids[g.kind],
					patch: { [g.field]: g.kind === "parentage" ? Math.max(.1, Math.min(.9, value)) : value }
				}]);
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
			for (let i = 0; i < handles.length; i++) {
				const el = elements[i];
				if (!handles[i].getWorldPosition(point)) {
					el.style.display = "none";
					continue;
				}
				s.host.worldToScreen(point.x, point.y, screen);
				el.style.display = "block";
				el.style.left = `${screen.x - 11}px`;
				el.style.top = `${screen.y - 11}px`;
			}
		}));
		clean = () => {
			cancel();
			for (const f of off.reverse()) f();
			overlay.dispose();
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
	version: "0.1.0",
	summary: "상담용 인물 기호와 가족 관계를 작성합니다.",
	engine: "^0.1.0",
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
var options = (field, values, label) => ({
	kind: "segmented",
	field,
	label,
	placement: "inspector",
	options: values.map((value) => ({
		value,
		label: value
	}))
});
function body(p, g) {
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
	let marks = "";
	if (p.clinical !== "none") {
		const c = p.clinical;
		marks += `<path d="M ${cx - 18} 32 h ${c === "substance" ? 36 : 18} v 18 h -${c === "substance" ? 36 : 18} Z" fill="#64748b" opacity=".45"/>`;
		if (c === "physical" || c === "mental_substance") for (let i = 0; i < 6; i++) marks += `<path d="M ${cx + 2 + i * 3} 32 v 18" stroke="#334155"/>`;
		if (c === "recovering") marks += `<path d="M ${cx - 15} 40 l 10 8 20 -24" stroke="#334155" fill="none"/>`;
	}
	if (p.orientation !== "none") marks += `<path d="M ${cx - 12} 18 h 24 l -12 20 Z" fill="none" stroke="#334155"/>`;
	if (p.isIndexPerson) marks += `<g transform="translate(${cx},32) scale(1.15) translate(${-cx},-32)" fill="none" stroke="#334155">${s}</g>`;
	if (p.lifeStatus === "deceased" || p.symbol.startsWith("stillbirth")) marks += `<path d="M ${cx - 22} 10 l 44 44 m 0 -44 l -44 44" stroke="#334155" fill="none"/>`;
	const texts = [
		[p.ageLabel, 36],
		[display(p.name, "name"), 78],
		[display(p.yearSpan), 94],
		...lens.showNotes ? String(p.note).split("\n").map((x, i) => [display(x), 110 + i * 16]) : []
	];
	return `<g fill="white" stroke="#334155" stroke-width="2">${s}</g>${marks}<g text-anchor="middle" fill="#334155" font-family="sans-serif" font-size="12">${texts.map(([v, y]) => `<text x="${cx}" y="${y}">${escapeXml(v)}</text>`).join("")}</g>`;
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
		return {
			x: finite(t.x),
			y: finite(t.y),
			rotation: finite(t.rotation),
			width: b.width > 0 ? b.width : 120,
			height: b.height > 0 ? b.height : 120
		};
	},
	paintOverflow: 32,
	renderSvg(p, g) {
		return { svg: g ? `<g transform="translate(${g.x},${g.y}) rotate(${g.rotation * 180 / Math.PI},${g.width / 2},${g.height / 2})">${body(p, g)}</g>` : "" };
	},
	ui: { controls: [
		...[
			"name",
			"ageLabel",
			"yearSpan",
			"note"
		].map((field) => ({
			kind: "text",
			field,
			label: field,
			placement: "inspector"
		})),
		options("symbol", symbols, "인물 기호"),
		options("orientation", [
			"none",
			"gay",
			"lesbian",
			"bisexual"
		], "성적 지향 표시"),
		options("clinical", [
			"none",
			"physical",
			"mental",
			"substance",
			"mental_substance",
			"recovering"
		], "임상 상태"),
		options("lifeStatus", ["alive", "deceased"], "생존"),
		{
			kind: "toggle",
			field: "isIndexPerson",
			label: "내담자",
			placement: "inspector"
		}
	] }
};
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
function anchor(v, id, bottom = false) {
	const b = personBounds(v, id);
	if (!b) return;
	const x = b.x + b.width / 2, y = b.y + (bottom ? 58 : 6), angle = finite(b.rotation), cx = b.x + b.width / 2, cy = b.y + b.height / 2;
	return point(cx + (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle), cy + (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle));
}
function labelBottom(v, id) {
	const b = personBounds(v, id), p = v.getCanonical(id, ids.person);
	return b ? b.y + 110 + 16 * (String(p?.note ?? "").split("\n").length - 1) : 0;
}
function unionGeometry(p, id, v) {
	const a = anchor(v, p.partnerA, true), b = anchor(v, p.partnerB, true);
	if (!a || !b) return;
	const y = Math.max(a.y, b.y, labelBottom(v, p.partnerA), labelBottom(v, p.partnerB)) + Math.max(12, finite(p.barOffset, 44));
	return {
		paths: [[
			a,
			point(a.x, y),
			point(b.x, y),
			b
		]],
		origin: point((a.x + b.x) / 2, y),
		label: p.label
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
	if (twin) {
		const mid = (c.x + twin.x) / 2;
		paths.push([point(mid, y), c]);
		if (p.child < p.twinWith && p.twinType === "identical") paths.push([point((mid + c.x) / 2, (y + c.y) / 2), point((mid + twin.x) / 2, (y + twin.y) / 2)]);
	} else paths.push([point(c.x, y), c]);
	return {
		paths,
		origin: point(c.x, y),
		label: ""
	};
}
function relationGeometry(p, id, v) {
	const a = anchor(v, p.from, true), b = anchor(v, p.to);
	if (!a || !b) return;
	const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
	if (len < 1) return;
	const nx = -dy / len, ny = dx / len, off = finite(p.curveOffset), count = Math.max(2, Math.ceil(len / 6)), paths = [];
	const copies = p.kind === "fused" ? 3 : p.kind === "close" || p.kind === "fused_hostile" ? 2 : 1;
	for (let k = 0; k < copies; k++) {
		const pts = [];
		for (let i = 0; i <= count; i++) {
			const t = i / count, zig = (p.kind.includes("hostile") || p.kind.startsWith("abuse")) && i > 0 && i < count ? i % 2 ? 4 : -4 : 0, h = 4 * off * t * (1 - t) + (k - (copies - 1) / 2) * 5 + zig;
			pts.push(point(a.x + dx * t + nx * h, a.y + dy * t + ny * h));
		}
		paths.push(pts);
	}
	const mid = point((a.x + b.x) / 2 + nx * off, (a.y + b.y) / 2 + ny * off);
	if (p.kind.startsWith("cutoff") || p.kind === "estranged") {
		const ps = paths.shift(), cut = Math.floor(ps.length / 2);
		paths.push(ps.slice(0, Math.max(1, cut - 1)), ps.slice(cut + 2));
		for (const d of [-4, 4]) paths.push([point(mid.x + dx / len * d - nx * 8, mid.y + dy / len * d - ny * 8), point(mid.x + dx / len * d + nx * 8, mid.y + dy / len * d + ny * 8)]);
	}
	if (p.kind === "focused_on" || p.kind.startsWith("abuse")) paths.push([
		point(b.x - dx / len * 12 + nx * 6, b.y - dy / len * 12 + ny * 6),
		b,
		point(b.x - dx / len * 12 - nx * 6, b.y - dy / len * 12 - ny * 6)
	]);
	return {
		paths,
		origin: mid,
		label: p.label
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
		label: kind,
		defaults: defaults[kind],
		refs: refs[kind],
		textFields: kind === "parentage" ? [] : ["label"],
		dependsOnCanonical: Object.values(ids),
		dependsOnComputed: ["computed.layoutBounds", ...kind === "parentage" ? [`computed.${ids.union}`] : []],
		derive,
		paintBounds: (g) => g && bounds(g.paths, 20),
		renderSvg(p, g) {
			if (!g || kind === "relation" && !lens.showRelations || kind === "household" && !lens.showHouseholds) return { svg: "" };
			let paths = g.paths.map((ps) => `<path d="${pathData(ps)}"/>`).join("");
			const o = g.origin;
			if (kind === "relation" && p.kind === "cutoff_repaired") paths += `<circle cx="${o.x}" cy="${o.y}" r="5"/>`;
			if (kind === "union" && [
				"separation",
				"divorce",
				"reunion_divorce",
				"reunion_separation"
			].includes(p.status)) {
				const n = p.status.includes("divorce") ? 2 : 1;
				for (let i = 0; i < n; i++) paths += `<path d="M ${o.x + i * 7 - 5} ${o.y + 8} l 10 -16"/>`;
				if (p.status.startsWith("reunion")) paths += `<circle cx="${o.x}" cy="${o.y}" r="12"/>`;
			}
			let dash = kind === "household" || [
				"distant",
				"estranged",
				"abuse_emotional"
			].includes(p.kind) || [
				"cohabitation",
				"engagement",
				"secret_affair"
			].includes(p.status) || ["adopted", "foster"].includes(p.pedigree) ? " stroke-dasharray=\"6 4\"" : "";
			return { svg: `<g fill="none" stroke="${kind === "household" && /^#[\da-f]{6}$/i.test(p.color) ? p.color : "#334155"}" stroke-width="2"${dash}>${paths}</g><text x="${o.x}" y="${o.y - 8}" font-family="sans-serif" font-size="12">${escapeXml(display(g.label))}</text>` };
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
			canTransform: () => false
		},
		ui: { controls: [
			...Object.entries(enumerations[kind]).map(([field, values]) => ({
				kind: "segmented",
				field,
				label: field,
				placement: "selection-bar",
				options: values.map((value) => ({
					value,
					label: value
				}))
			})),
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
function familyCommands(context) {
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
				lens.privacy = modes[(modes.indexOf(lens.privacy) + 1) % 4];
			} else lens[key] = !lens[key];
			world.invalidateComputed();
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
			const [a, b] = requirePeople(2), count = all("relation").filter((e) => {
				const p = prop(e, "relation");
				return p.from === a && p.to === b || p.from === b && p.to === a;
			}).length;
			entity(ops, "relation", {
				from: a,
				to: b,
				kind: name.slice(9),
				curveOffset: 28 * (count + 1)
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
// src/index.js
var labels = {
	"add-person": "내담자·인물 추가",
	"older-sibling": "손위 형제",
	"younger-sibling": "손아래 동생",
	"add-partner": "배우자 추가",
	"add-child": "자녀 추가",
	"add-parents": "부모 추가",
	"add-twin": "쌍둥이 추가",
	"connect-union": "부부로 연결",
	"connect-parentage": "첫 선택 부모 → 자녀 연결",
	"connect-twins": "쌍둥이로 묶기",
	"reverse": "방향 반전",
	"household": "동거 가구로 묶기",
	"toggle-membership": "가구 편입·제외",
	"tidy-layout": "가족 정돈",
	"privacy": "이름 표시 방식 전환",
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
	ui: { controls: commandNames.map((name) => ({
		id: name,
		kind: "action",
		label: labels[name],
		commandSymbol: `${prefix}:${name}`,
		placement: name === "add-person" || name.startsWith("template-") ? "tool-shelf" : name === "privacy" || name.startsWith("show-") || name === "mask-years" ? "settings" : "selection-bar",
		requiresSelection: !(name === "add-person" || name.startsWith("template-") || name === "privacy" || name.startsWith("show-") || name === "mask-years"),
		minSelectionCount: name.startsWith("connect-") || name.startsWith("relation-") ? 2 : name === "add-person" || name.startsWith("template-") || name === "privacy" || name.startsWith("show-") || name === "mask-years" ? 0 : 1
	})) },
	activate(context) {
		const family = familyCommands(context), off = [];
		try {
			for (const name of commandNames) off.push(context.commands.register({
				id: `${prefix}:${name}`,
				title: labels[name],
				summary: labels[name],
				shortcutScope: "canvas",
				...{
					"older-sibling": "M-[",
					"younger-sibling": "M-]",
					"add-partner": "M-s",
					"add-child": "M-c",
					"add-parents": "M-p",
					"add-twin": "M-t",
					household: "C-c g"
				}[name] ? { keys: [{
					"older-sibling": "M-[",
					"younger-sibling": "M-]",
					"add-partner": "M-s",
					"add-child": "M-c",
					"add-parents": "M-p",
					"add-twin": "M-t",
					household: "C-c g"
				}[name]] } : {},
				run: () => family.run(name)
			}));
			off.push(mountInteractions(context, family.run));
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
			api: Object.freeze({ run: family.run }),
			dispose() {
				family.dispose();
				for (const f of off.splice(0).reverse()) f();
			}
		};
	}
};
export { src_default as default };
