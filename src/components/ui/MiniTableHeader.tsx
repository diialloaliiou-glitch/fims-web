const ALIGN_CLASSES = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export function MiniTableHeader({
  columns,
  align,
  minWidths,
  noWrap,
}: {
  columns: string[];
  align?: ("left" | "right" | "center")[];
  minWidths?: (number | undefined)[];
  noWrap?: boolean;
}) {
  return (
    <thead className="sticky top-0 z-10 bg-bg-card text-text-primary">
      <tr>
        {columns.map((col, i) => (
          <th
            key={col + i}
            style={minWidths?.[i] ? { minWidth: minWidths[i] } : undefined}
            className={`${noWrap ? "whitespace-nowrap" : "whitespace-normal"} bg-bg-card px-3 py-2 align-top text-xs font-semibold uppercase leading-tight tracking-wide ${
              ALIGN_CLASSES[align?.[i] ?? "center"]
            }`}
          >
            {col}
          </th>
        ))}
      </tr>
    </thead>
  );
}
