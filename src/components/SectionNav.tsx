import { useEffect, useState } from "react";

export interface SectionNavItem {
  id: string;
  label: string;
}

interface SectionNavProps {
  items: SectionNavItem[];
  /** Sticky offset (px) from the top of the viewport. */
  topOffset?: number;
}

/**
 * Sticky horizontal section nav. Highlights the section currently
 * intersecting the viewport and smooth-scrolls on click.
 */
export function SectionNav({ items, topOffset = 60 }: SectionNavProps) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    if (items.length === 0) return;
    const elements = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to the top that is intersecting.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        // Trigger when section enters the band just under the sticky bar.
        rootMargin: `-${topOffset + 40}px 0px -55% 0px`,
        threshold: [0, 0.1, 0.5, 1],
      },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items, topOffset]);

  const handleClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string,
  ) => {
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const top =
      target.getBoundingClientRect().top + window.scrollY - topOffset - 8;
    window.scrollTo({ top, behavior: "smooth" });
    setActiveId(id);
  };

  return (
    <nav
      aria-label="Report sections"
      className="sticky z-30 -mx-4 md:-mx-0 backdrop-blur-xl border-b border-border no-print"
      style={{ top: topOffset, background: "rgba(10,10,11,0.9)" }}
    >
      <ul className="flex items-stretch gap-0 overflow-x-auto px-4 md:px-2 h-12 no-scrollbar">
        {items.map((it) => {
          const isActive = it.id === activeId;
          return (
            <li key={it.id} className="shrink-0 flex items-stretch">
              <a
                href={`#${it.id}`}
                onClick={(e) => handleClick(e, it.id)}
                className={`inline-flex items-center whitespace-nowrap px-4 text-[13px] font-medium border-b-2 transition-colors ${
                  isActive
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
                aria-current={isActive ? "true" : undefined}
              >
                {it.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
