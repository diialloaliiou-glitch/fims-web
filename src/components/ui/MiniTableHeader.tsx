const ALIGN_CLASSES = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export function MiniTableHeader({
  columns,
  align,
}: {
  columns: string[];
  align?: ("left" | "right" | "center")[];
}) {
  return (
    <thead className="sticky top-0 z-10 bg-bg-card text-text-primary">
      <tr>
        {columns.map((col, i) => (
          <th
            key={col + i}
            className={`whitespace-normal bg-bg-card px-3 py-2 align-top text-xs font-semibold uppercase leading-tight tracking-wide ${
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
