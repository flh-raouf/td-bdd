import { trpc } from "@/lib/trpc";

type Relationship = {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  route: Array<{ x: number; y: number }>;
};

const relationships: Relationship[] = [
  {
    fromTable: "SUBSCRIBER",
    fromColumn: "customerId",
    toTable: "CUSTOMER",
    toColumn: "customerId",
    route: [
      { x: 380, y: 102 },
      { x: 325, y: 102 },
      { x: 325, y: 82 },
      { x: 270, y: 82 },
    ],
  },
  {
    fromTable: "RECHARGE",
    fromColumn: "phoneNumber",
    toTable: "SUBSCRIBER",
    toColumn: "phoneNumber",
    route: [
      { x: 380, y: 362 },
      { x: 340, y: 362 },
      { x: 340, y: 82 },
      { x: 380, y: 82 },
    ],
  },
  {
    fromTable: "USES",
    fromColumn: "phoneNumber",
    toTable: "SUBSCRIBER",
    toColumn: "phoneNumber",
    route: [
      { x: 720, y: 82 },
      { x: 620, y: 82 },
    ],
  },
  {
    fromTable: "USES",
    fromColumn: "serviceId",
    toTable: "SERVICE",
    toColumn: "serviceId",
    route: [
      { x: 720, y: 102 },
      { x: 660, y: 102 },
      { x: 660, y: 260 },
      { x: 270, y: 260 },
      { x: 270, y: 342 },
    ],
  },
  {
    fromTable: "FEATURE",
    fromColumn: "planId",
    toTable: "PLAN",
    toColumn: "planId",
    route: [
      { x: 720, y: 392 },
      { x: 675, y: 392 },
      { x: 675, y: 542 },
      { x: 270, y: 542 },
    ],
  },
  {
    fromTable: "SIGNUP",
    fromColumn: "phoneNumber",
    toTable: "SUBSCRIBER",
    toColumn: "phoneNumber",
    route: [
      { x: 960, y: 542 },
      { x: 980, y: 542 },
      { x: 980, y: 24 },
      { x: 620, y: 24 },
      { x: 620, y: 82 },
    ],
  },
  {
    fromTable: "SIGNUP",
    fromColumn: "planId",
    toTable: "PLAN",
    toColumn: "planId",
    route: [
      { x: 720, y: 562 },
      { x: 700, y: 562 },
      { x: 700, y: 640 },
      { x: 20, y: 640 },
      { x: 20, y: 542 },
      { x: 30, y: 542 },
    ],
  },
];

const layout: { table: string; x: number; y: number }[] = [
  { table: "CUSTOMER", x: 30, y: 40 },
  { table: "SERVICE", x: 30, y: 300 },
  { table: "PLAN", x: 30, y: 500 },
  { table: "SUBSCRIBER", x: 380, y: 40 },
  { table: "RECHARGE", x: 380, y: 300 },
  { table: "USES", x: 720, y: 40 },
  { table: "FEATURE", x: 720, y: 330 },
  { table: "SIGNUP", x: 720, y: 500 },
];

const tableWidth = 240;
const tableHeaderHeight = 32;
const rowHeight = 20;
const nameWidth = 140;
const pkColor = "#58a6ff";
const fkColor = "#f0883e";
const fkHighlightColor = "#ffd166";

function getTablePos(tableName: string) {
  return layout.find((l) => l.table === tableName) ?? { x: 0, y: 0 };
}

function getTableHeight(columnCount: number) {
  return tableHeaderHeight + columnCount * rowHeight + 4;
}

function isBehindTablesRelationship(rel: Relationship) {
  return (
    rel.fromTable === "SIGNUP" &&
    rel.fromColumn === "phoneNumber" &&
    rel.toTable === "SUBSCRIBER" &&
    rel.toColumn === "phoneNumber"
  );
}

function roundedRoutePath(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return "";

  const radius = 10;
  const [first, ...rest] = points;
  let path = `M ${first.x} ${first.y}`;

  for (let i = 0; i < rest.length; i++) {
    const point = rest[i];
    const next = rest[i + 1];
    const previous = points[i];

    if (!next) {
      path += ` L ${point.x} ${point.y}`;
      continue;
    }

    const beforeX = point.x - Math.sign(point.x - previous.x) * radius;
    const beforeY = point.y - Math.sign(point.y - previous.y) * radius;
    const afterX = point.x + Math.sign(next.x - point.x) * radius;
    const afterY = point.y + Math.sign(next.y - point.y) * radius;

    path += ` L ${beforeX} ${beforeY} Q ${point.x} ${point.y} ${afterX} ${afterY}`;
  }

  return path;
}

export function ErDiagram() {
  const tableColumnQueries = layout.map((l) => ({
    tableName: l.table,
    query: trpc.schema.tableColumns.useQuery(l.table),
  }));

  const columnsMap = new Map<
    string,
    { name: string; key: string; type: string }[]
  >();
  for (const { tableName, query } of tableColumnQueries) {
    if (query.data) {
      columnsMap.set(
        tableName,
        query.data.map((c) => ({
          name: c.columnName,
          key: c.columnKey,
          type: c.columnType,
        })),
      );
    }
  }

  const allTables = layout.flatMap((l) =>
    columnsMap.has(l.table) ? [l.table] : [],
  );

  const height = 720;

  const renderRelationship = (rel: Relationship, i: number) => {
    const fromCols = columnsMap.get(rel.fromTable) ?? [];
    const toCols = columnsMap.get(rel.toTable) ?? [];
    const fromColIdx = fromCols.findIndex((c) => c.name === rel.fromColumn);
    const toColIdx = toCols.findIndex((c) => c.name === rel.toColumn);
    if (fromColIdx === -1 || toColIdx === -1) return null;

    const path = roundedRoutePath(rel.route);
    const relationshipLabel = `${rel.fromTable}.${rel.fromColumn} references ${rel.toTable}.${rel.toColumn}`;

    return (
      <g key={`rel-${i}`} className="er-relationship cursor-pointer">
        <desc>{relationshipLabel}</desc>
        <path
          className="er-hit"
          d={path}
          fill="none"
          stroke="transparent"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={14}
        />
        <path
          className="er-line"
          d={path}
          fill="none"
          stroke={fkColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          strokeOpacity={0.9}
          markerEnd="url(#fkArrow)"
          filter="url(#lineGlow)"
        />
      </g>
    );
  };

  return (
    <div className="overflow-auto rounded-md border border-border bg-card p-5">
      <svg
        viewBox={`0 0 990 ${height}`}
        className="er-diagram-svg w-full"
        aria-label="TelecomDZ ER Schema"
        style={{ minHeight: height }}
      >
        <defs>
          <marker
            id="fkArrow"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" fill="context-stroke" />
          </marker>
          <filter id="lineGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow
              dx="0"
              dy="0"
              floodColor="var(--color-card)"
              floodOpacity="0.9"
              stdDeviation="2"
            />
          </filter>
        </defs>

        <style>
          {`
            .er-line {
              vector-effect: non-scaling-stroke;
              transition: stroke 140ms ease, stroke-opacity 140ms ease, stroke-width 140ms ease;
            }

            .er-hit {
              pointer-events: stroke;
            }

            .er-diagram-svg:has(.er-relationship:hover) .er-line {
              stroke-opacity: 0.28;
            }

            .er-diagram-svg .er-relationship:hover .er-line {
              stroke: ${fkHighlightColor};
              stroke-opacity: 1;
              stroke-width: 3;
            }
          `}
        </style>

        <rect width="990" height={height} fill="var(--color-card)" rx={6} />

        <g className="er-relationships er-relationships-behind">
          {relationships.map((rel, i) =>
            isBehindTablesRelationship(rel) ? renderRelationship(rel, i) : null,
          )}
        </g>

        {/* Table boxes */}
        {allTables.map((tableName) => {
          const pos = getTablePos(tableName);
          const cols = columnsMap.get(tableName) ?? [];
          const bh = getTableHeight(cols.length);

          return (
            <g key={tableName}>
              <rect
                x={pos.x}
                y={pos.y}
                width={tableWidth}
                height={bh}
                rx={4}
                fill="var(--color-card, #161b22)"
                stroke="var(--color-border, #30363d)"
                strokeWidth={1}
              />
              <rect
                x={pos.x}
                y={pos.y}
                width={tableWidth}
                height={tableHeaderHeight}
                rx={4}
                fill="var(--color-sidebar-active, #1f2937)"
              />
              <rect
                x={pos.x}
                y={pos.y + tableHeaderHeight - 4}
                width={tableWidth}
                height={4}
                fill="var(--color-sidebar-active, #1f2937)"
              />
              <text
                x={pos.x + tableWidth / 2}
                y={pos.y + 20}
                textAnchor="middle"
                fill="var(--color-foreground, #e1e4e8)"
                fontSize={11}
                fontWeight="bold"
              >
                {tableName}
              </text>
              {cols.map((col, idx) => {
                const color =
                  col.key === "PRI"
                    ? pkColor
                    : col.key === "MUL"
                      ? fkColor
                      : "var(--color-muted, #8b949e)";
                const prefix =
                  col.key === "PRI" ? "• " : col.key === "MUL" ? "→ " : "  ";
                return (
                  <g key={col.name}>
                    <text
                      x={pos.x + 10}
                      y={pos.y + tableHeaderHeight + idx * rowHeight + 14}
                      fill={color}
                      fontSize={10}
                      fontFamily="monospace"
                    >
                      {prefix}
                      {col.name}
                    </text>
                    <text
                      x={pos.x + nameWidth}
                      y={pos.y + tableHeaderHeight + idx * rowHeight + 14}
                      fill="var(--color-muted-foreground, #484f58)"
                      fontSize={10}
                      fontFamily="monospace"
                    >
                      {col.type}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Relationship lines use reserved gutters so tables stay readable. */}
        <g className="er-relationships">
          {relationships.map((rel, i) => {
            return isBehindTablesRelationship(rel)
              ? null
              : renderRelationship(rel, i);
          })}
        </g>

        {/* Legend */}
        <g transform={`translate(20, ${height - 26})`}>
          <text x={0} y={0} fill="var(--color-muted, #8b949e)" fontSize={10}>
            <tspan fill={pkColor}>•</tspan> Primary key{" "}
            <tspan fill={fkColor}>→</tspan> Foreign key
          </text>
        </g>
      </svg>
    </div>
  );
}
