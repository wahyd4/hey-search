import { Globe, ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Category = "web" | "images";
type ImageSize = "" | "large" | "medium" | "small";
type SortOrder = "default" | "date_desc" | "date_asc";
type DateFilter = "" | "day" | "week" | "month" | "year";

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  category: Category;
  imageSize: ImageSize;
  sortOrder: SortOrder;
  dateFilter: DateFilter;
  onCategoryChange: (v: Category) => void;
  onImageSizeChange: (v: ImageSize) => void;
  onSortChange: (v: SortOrder) => void;
  onDateFilterChange: (v: DateFilter) => void;
}

const IMAGE_SIZE_OPTIONS: { value: ImageSize; label: string }[] = [
  { value: "", label: "All sizes" },
  { value: "large", label: "Large" },
  { value: "medium", label: "Medium" },
  { value: "small", label: "Small" },
];

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
];

const DATE_FILTER_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "", label: "Any time" },
  { value: "day", label: "Past day" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
  { value: "year", label: "Past year" },
];

function OptionRow<T extends string>({
  options,
  value,
  onChange,
  wrap = false,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  wrap?: boolean;
}) {
  return (
    <div className={cn("flex gap-2", wrap ? "flex-wrap" : "flex-wrap")}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "bg-accent text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function FilterSheet({
  open,
  onClose,
  category,
  imageSize,
  sortOrder,
  dateFilter,
  onCategoryChange,
  onImageSizeChange,
  onSortChange,
  onDateFilterChange,
}: FilterSheetProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Search filters"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" />

      {/* Sheet */}
      <div
        className="relative z-10 w-full max-w-lg rounded-t-2xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-base font-semibold">Search filters</h2>
          <button
            onClick={onClose}
            aria-label="Close filters"
            className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Filter groups */}
        <div className="overflow-y-auto max-h-[60vh] px-5 py-4 space-y-5">
          {/* Category */}
          <section aria-labelledby="filter-category-label">
            <p id="filter-category-label" className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Category
            </p>
            <div className="flex gap-2">
              {([
                { key: "web" as const, label: "Web", icon: Globe },
                { key: "images" as const, label: "Images", icon: ImageIcon },
              ]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => { onCategoryChange(key); }}
                  aria-pressed={category === key}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    category === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Image size — only when images category */}
          {category === "images" && (
            <section aria-labelledby="filter-size-label">
              <p id="filter-size-label" className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Image size
              </p>
              <OptionRow options={IMAGE_SIZE_OPTIONS} value={imageSize} onChange={onImageSizeChange} />
            </section>
          )}

          {/* Sort */}
          <section aria-labelledby="filter-sort-label">
            <p id="filter-sort-label" className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sort
            </p>
            <OptionRow options={SORT_OPTIONS} value={sortOrder} onChange={onSortChange} />
          </section>

          {/* Date */}
          <section aria-labelledby="filter-date-label">
            <p id="filter-date-label" className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Date published
            </p>
            <OptionRow options={DATE_FILTER_OPTIONS} value={dateFilter} onChange={onDateFilterChange} />
          </section>
        </div>

        {/* Done button */}
        <div className="px-5 py-4 border-t">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
